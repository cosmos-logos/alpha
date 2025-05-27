
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('🔧 Starting unified agent-server.js');

const app = express();
const PORT = 3000;

const COSMOS_FILE = path.join(__dirname, 'cosmos-logos.json');
const BASE_BRANCH = 'brain/7777';
const GH_CLI_PATH = '"C:\\Program Files\\GitHub CLI\\gh.exe"';

const AGENT_NAME = 'alpha';

const SSH_KEY_PATH = path.join(__dirname, 'agents', AGENT_NAME, 'keys', 'alpha.ssh.private.key');
const GPG_KEY_PATH = path.join(__dirname, 'agents', AGENT_NAME, 'keys', 'alpha.gpg.private.key');

const GPG_HOME = path.join(__dirname, '.gnupg', AGENT_NAME);
const SIGNING_KEY_ID = 'B58C63840AA4D9B0';
const GPG_EXE = '"C:\\Program Files (x86)\\GnuPG\\bin\\gpg.exe"';

let schemaVersion = 'unknown';

try {
  const raw = fs.readFileSync(COSMOS_FILE);
  const json = JSON.parse(raw);
  schemaVersion = json.schemaVersion || 'missing';
  console.log(`✅ Loaded schema version: ${schemaVersion}`);
} catch (err) {
  console.error("❌ Failed to load cosmos-logos.json");
  console.error(err.message);
}

function setupHardcodedIdentity() {
  process.env.GIT_SSH_COMMAND = `ssh -i "${SSH_KEY_PATH}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no`;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.GNUPGHOME = GPG_HOME;

  process.env.GIT_AUTHOR_NAME = 'alpha agent';
  process.env.GIT_COMMITTER_NAME = 'alpha agent';
  process.env.GIT_AUTHOR_EMAIL = 'alpha@cosmos-logos.org';
  process.env.GIT_COMMITTER_EMAIL = 'alpha@cosmos-logos.org';

  if (!fs.existsSync(GPG_HOME)) {
    fs.mkdirSync(GPG_HOME, { recursive: true });
  }

  try {
    execSync(`${GPG_EXE} --homedir "${GPG_HOME}" --import "${GPG_KEY_PATH}"`);
  } catch (err) {
    console.error(`❌ GPG import failed: ${err.message}`);
  }

  try {
    execSync(`gpgconf --homedir "${GPG_HOME}" --launch gpg-agent`);
  } catch (err) {
    console.error(`⚠️ Failed to launch gpg-agent: ${err.message}`);
  }

  try {
    process.env.GPG_TTY = execSync('tty', { encoding: 'utf8' }).trim();
  } catch {
    process.env.GPG_TTY = 'CON';
  }

  try {
    const keyCheck = execSync(`${GPG_EXE} --homedir "${GPG_HOME}" --list-secret-keys`, { encoding: 'utf8' });
    console.log(`🔐 GPG keys loaded:\n${keyCheck}`);
  } catch (err) {
    console.error(`❌ Failed to list GPG keys: ${err.message}`);
  }
}

function validateIdentity() {
  try {
    const result = execSync(
      `ssh -i "${SSH_KEY_PATH}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -T git@github.com`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString();

    if (!result.includes('successfully authenticated')) {
      throw new Error(`Unexpected SSH response: ${result}`);
    }
  } catch (err) {
    const errOutput = err.stderr?.toString() || err.stdout?.toString() || err.message;
    if (!errOutput.includes('successfully authenticated')) {
      throw new Error(`SSH connection failed: ${errOutput}`);
    }
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

  try {
    if (!fs.existsSync(memoryPath)) {
      fs.mkdirSync(memoryPath, { recursive: true });
    }
    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
    return { filepath, filename };
  } catch (err) {
    console.error(`❌ Failed to write memory log:`, err.message);
    return null;
  }
}

app.use(bodyParser.json());

app.post('/webhook/pre-merge', async (req, res) => {
  console.log('⚡ [PRE-COMMIT] Webhook hit.');
  setupHardcodedIdentity();
  validateIdentity();

  const log = writeMemoryLog('pre-commit', req.body);
  if (!log) return res.status(500).json({ ack: false, error: 'Memory write failed.' });

  console.log(`🧾 Logged pre-commit payload as: ${log.filename}`);
  res.json({ ack: true, schemaVersion });
});

app.post('/webhook/post-merge', async (req, res) => {
  console.log('⚡ [POST-MERGE] Webhook hit.');
  setupHardcodedIdentity();
  validateIdentity();

  const log = writeMemoryLog('post-merge', req.body);
  if (!log) return res.status(500).json({ ack: false, error: 'Memory write failed.' });

  const { filepath, filename } = log;
  const branchName = `agent/${AGENT_NAME}/${filename.replace('.json', '')}`;

  try {
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
    const relativeFilePath = path.relative(process.cwd(), filepath);
    execSync(`git add ${relativeFilePath}`, { stdio: 'inherit' });
    execSync('git status', { stdio: 'inherit' });

    execSync(`git commit -m "🧠 Transaction log: ${filename}" -S${SIGNING_KEY_ID}`, { stdio: 'inherit' });
    execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' });

    const commitHash = execSync('git rev-parse HEAD').toString().trim();
    const prTitle = `🔁 Transaction Log: ${filename}`;
    const prBody = `This pull request has been confirmed and logged by agent **${AGENT_NAME}**.\n\n- **Memory File:** \\`${filename}\\`\n- **Schema Version:** \\`${schemaVersion}\\`\n- **Commit:** \\`${commitHash}\\``;

    execSync(`${GH_CLI_PATH} pr create --base ${BASE_BRANCH} --head ${branchName} --title "${prTitle}" --body "${prBody}"`, { stdio: 'inherit' });

    console.log("✅ Post-merge PR created.");
  } catch (err) {
    console.error("❌ Post-merge PR pipeline failed:", err.message);
    return res.status(500).json({ ack: false, error: err.message });
  }

  res.json({ ack: true, schemaVersion });
});

app.listen(PORT, () => {
  console.log(`🚀 Agent is listening at http://localhost:${PORT}`);
  console.log(`📖 Using schemaVersion: ${schemaVersion}`);
});
