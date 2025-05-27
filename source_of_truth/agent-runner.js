
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');

console.log('🔧 Booting agent-server-sshlocked.js');

const app = express();
const PORT = 3000;

const COSMOS_FILE = path.join(__dirname, 'cosmos-logos.json');
const BASE_BRANCH = 'brain/7777';
const GH_CLI_PATH = '"C:\\Program Files\\GitHub CLI\\gh.exe"';
const GPG_EXE = '"C:\\Program Files (x86)\\GnuPG\\bin\\gpg.exe"';

const AGENT_NAME = 'alpha';
const SSH_KEY_PATH = path.join(__dirname, 'agents', AGENT_NAME, 'keys', 'alpha.ssh.private.key');
const GPG_KEY_PATH = path.join(__dirname, 'agents', AGENT_NAME, 'keys', 'alpha.gpg.private.key');
const GPG_HOME = path.join(__dirname, '.gnupg', AGENT_NAME);
const SIGNING_KEY_ID = 'B58C63840AA4D9B0';

const SSH_CONFIG_PATH = path.join(os.tmpdir(), `${AGENT_NAME}_ssh_config`);

let schemaVersion = 'unknown';

function writeSSHConfig() {
  const configContent = `
Host github.com
  HostName github.com
  User git
  IdentityFile ${SSH_KEY_PATH.replace(/\\/g, '/')}
  IdentitiesOnly yes
  PreferredAuthentications publickey
  StrictHostKeyChecking no
  `;
  fs.writeFileSync(SSH_CONFIG_PATH, configContent.trim());
  console.log(`🔐 SSH config written to ${SSH_CONFIG_PATH}`);
}

function scopedEnv() {
  return {
    ...process.env,
    GNUPGHOME: GPG_HOME,
    GIT_SSH_COMMAND: `ssh -F "${SSH_CONFIG_PATH}"`
  };
}

try {
  const raw = fs.readFileSync(COSMOS_FILE);
  const json = JSON.parse(raw);
  schemaVersion = json.schemaVersion || 'missing';
  console.log(`✅ Loaded cosmos-logos.json`);
  console.log(`🔖 schemaVersion: ${schemaVersion}`);
  console.log(`👤 Agent Name: ${AGENT_NAME}`);
} catch (err) {
  console.error("❌ Failed to load cosmos-logos.json:", err.message);
}

function setupIdentity() {
  if (!fs.existsSync(GPG_HOME)) {
    fs.mkdirSync(GPG_HOME, { recursive: true });
    console.log(`📁 Created GPG home: ${GPG_HOME}`);
  }

  try {
    execSync(`${GPG_EXE} --homedir "${GPG_HOME}" --import "${GPG_KEY_PATH}"`);
    console.log(`🔐 GPG key imported`);
  } catch (err) {
    console.error(`❌ GPG import failed: ${err.message}`);
  }

  try {
    const keys = execSync(`${GPG_EXE} --homedir "${GPG_HOME}" --list-secret-keys --keyid-format LONG`, { encoding: 'utf8' });
    console.log(`🔎 GPG keys:\n${keys}`);
  } catch (err) {
    console.error(`❌ GPG key list failed: ${err.message}`);
  }

  writeSSHConfig();
}

function validateSSH() {
  console.log('🔍 Validating SSH identity with agent key only...');
  try {
    execSync(`ssh -F "${SSH_CONFIG_PATH}" -T git@github.com`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ SSH validation failed:', err.message);
    throw err;
  }
}

function generateFilename(eventType) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const hash = crypto.createHash('sha256').update(timestamp).digest('hex').slice(0, 8);
  return `${timestamp}-${eventType}-${hash}.json`;
}

function writeMemoryLog(eventType, payload) {
  const filename = generateFilename(eventType);
  const memoryPath = path.join(__dirname, 'agents', AGENT_NAME, 'memory');
  const filepath = path.join(memoryPath, filename);
  if (!fs.existsSync(memoryPath)) fs.mkdirSync(memoryPath, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
  console.log(`📝 Memory log: ${filepath}`);
  return { filepath, filename };
}

app.use(bodyParser.json());

app.post('/webhook/pre-merge', async (req, res) => {
  console.log('⚡ [PRE-MERGE] Webhook received');
  try {
    setupIdentity();
    validateSSH();
    const log = writeMemoryLog('pre-commit', req.body);
    console.log(`✅ Pre-merge logged: ${log.filename}`);
    res.json({ ack: true, schemaVersion });
  } catch (err) {
    console.error('❌ Pre-merge failed:', err.message);
    res.status(500).json({ ack: false, error: err.message });
  }
});

app.post('/webhook/post-merge', async (req, res) => {
  console.log('⚡ [POST-MERGE] Webhook received');
  try {
    setupIdentity();
    validateSSH();

    const log = writeMemoryLog('post-merge', req.body);
    const { filepath, filename } = log;
    const branchName = `agent/${AGENT_NAME}/${filename.replace('.json', '')}`;
    const env = scopedEnv();

    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit', env });
    execSync(`git config user.name "alpha agent"`, { env });
    execSync(`git config user.email "alpha@cosmos-logos.org"`, { env });
    execSync(`git config user.signingkey ${SIGNING_KEY_ID}`, { env });
    execSync(`git config commit.gpgsign true`, { env });

    execSync(`git add ${path.relative(process.cwd(), filepath)}`, { stdio: 'inherit', env });
    execSync('git status', { stdio: 'inherit', env });
    execSync(`git commit -m "🧠 Transaction log: ${filename}" -S${SIGNING_KEY_ID}`, { stdio: 'inherit', env });
    execSync(`git push -u origin ${branchName}`, { stdio: 'inherit', env });

    const commitHash = execSync('git rev-parse HEAD', { env }).toString().trim();

    const prTitle = `🔁 Transaction Log: ${filename}`;
    const prBody = `This pull request has been confirmed and logged by agent **${AGENT_NAME}**.

- **Memory File:** \`${filename}\`
- **Schema Version:** \`${schemaVersion}\`
- **Commit:** \`${commitHash}\``;

    execSync(`${GH_CLI_PATH} pr create --base ${BASE_BRANCH} --head ${branchName} --title "${prTitle}" --body "${prBody}"`, {
      stdio: 'inherit',
      env
    });

    console.log('✅ Post-merge PR created');
    res.json({ ack: true, schemaVersion });
  } catch (err) {
    console.error('❌ Post-merge failed:', err.message);
    res.status(500).json({ ack: false, error: err.message });
  }
});

console.log('🧠 Agent locked to SSH config. Awaiting requests...');
app.listen(PORT, () => {
  console.log(`🚀 Listening on http://localhost:${PORT}`);
});
