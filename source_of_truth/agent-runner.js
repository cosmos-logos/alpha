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
const BASE_BRANCH = 'brain/7777';
const GH_CLI_PATH = '"C:\\Program Files\\GitHub CLI\\gh.exe"';
const GPG_EXE = '"C:\\Program Files (x86)\\GnuPG\\bin\\gpg.exe"';

app.use(bodyParser.json());

function resolveConfig(req) {
  const AGENT_NAME = req.body.agent || 'alpha';
  const SSH_KEY_PATH = path.resolve(__dirname, 'agents', AGENT_NAME, 'keys', `${AGENT_NAME}.ssh.private.key`);
  const GPG_KEY_PATH = path.resolve(__dirname, 'agents', AGENT_NAME, 'keys', `${AGENT_NAME}.gpg.private.key`);
  const GPG_HOME = path.resolve(__dirname, '.gnupg', AGENT_NAME);
  const SSH_CONFIG_PATH = path.join(os.tmpdir(), `${AGENT_NAME}_ssh_config`);
  const MEMORY_PATH = path.resolve(__dirname, 'agents', AGENT_NAME, 'memory');

  return { AGENT_NAME, SSH_KEY_PATH, GPG_KEY_PATH, GPG_HOME, SSH_CONFIG_PATH, MEMORY_PATH };
}

function writeSSHConfig(SSH_CONFIG_PATH, SSH_KEY_PATH) {
  const content = `
Host github.com
  HostName github.com
  User git
  IdentityFile ${SSH_KEY_PATH.replace(/\\/g, '/')}
  IdentitiesOnly yes
  PreferredAuthentications publickey
  StrictHostKeyChecking no
  `;
  fs.writeFileSync(SSH_CONFIG_PATH, content.trim());
  console.log(`🔐 SSH config written: ${SSH_CONFIG_PATH}`);
}

function setupGPG(GPG_HOME, GPG_KEY_PATH) {
  if (!fs.existsSync(GPG_HOME)) fs.mkdirSync(GPG_HOME, { recursive: true });
  try {
    if (fs.existsSync(GPG_KEY_PATH)) {
      execSync(`${GPG_EXE} --homedir "${GPG_HOME}" --import "${GPG_KEY_PATH}"`);
      console.log('🔐 GPG key imported');
    } else {
      console.warn('⚠️ GPG key file missing. Skipping import.');
    }
  } catch (err) {
    console.error('❌ GPG import failed:', err.message);
  }

  try {
    const keys = execSync(`${GPG_EXE} --homedir "${GPG_HOME}" --list-secret-keys --keyid-format LONG`, { encoding: 'utf8' });
    console.log(`🔎 Available GPG Keys:\n${keys}`);
  } catch (err) {
    console.error('❌ GPG list failed:', err.message);
  }
}

function scopedEnv(GPG_HOME, SSH_CONFIG_PATH) {
  return {
    ...process.env,
    GNUPGHOME: GPG_HOME,
    GIT_SSH_COMMAND: `ssh -F "${SSH_CONFIG_PATH}"`
  };
}

function validateSSH(sshConfigPath) {
  console.log('🔍 Validating SSH identity with agent key only...');

  try {
    const output = execSync(`ssh -F "${sshConfigPath}" -T git@github.com`, {
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString();

    console.log('✅ SSH validated successfully:\n' + output);
  } catch (err) {
    const stdout = err.stdout?.toString() || '';
    const stderr = err.stderr?.toString() || '';
    const combined = `${stdout}\n${stderr}`;

    if (combined.includes("successfully authenticated")) {
      console.log('✅ SSH validated (non-zero exit ignored):\n' + combined);
    } else {
      console.error('❌ SSH validation failed:\n' + combined);
      throw new Error(`SSH validation failed:\n${combined}`);
    }
  }
}




function writeMemoryLog(MEMORY_PATH, eventType, payload) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const hash = crypto.createHash('sha256').update(timestamp).digest('hex').slice(0, 8);
  const filename = `${timestamp}-${eventType}-${hash}.json`;
  const filepath = path.join(MEMORY_PATH, filename);
  if (!fs.existsSync(MEMORY_PATH)) fs.mkdirSync(MEMORY_PATH, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
  return { filename, filepath };
}

function loadCosmosFile() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'cosmos-logos.json'));
    const json = JSON.parse(raw);
    return json.schemaVersion || 'missing';
  } catch (err) {
    console.warn('⚠️ cosmos-logos.json missing or invalid');
    return 'unknown';
  }
}

function verboseBootDiagnostics({ AGENT_NAME, SSH_KEY_PATH, GPG_KEY_PATH, GPG_HOME, SSH_CONFIG_PATH, MEMORY_PATH }) {
  console.log('🧠 Boot Diagnostics');
  console.log('-------------------------');
  console.log(`🔹 Agent Name........: ${AGENT_NAME}`);
  console.log(`🔹 Cosmos File.......: ${path.join(__dirname, 'cosmos-logos.json')}`);
  console.log(`🔹 GPG Key Path......: ${GPG_KEY_PATH}`);
  console.log(`🔹 SSH Key Path......: ${SSH_KEY_PATH}`);
  console.log(`🔹 GPG Home..........: ${GPG_HOME}`);
  console.log(`🔹 SSH Config Path...: ${SSH_CONFIG_PATH}`);
  console.log(`🔹 Memory Log Path...: ${MEMORY_PATH}`);
  console.log(`🔹 GH CLI Path.......: ${GH_CLI_PATH}`);
  console.log(`🔹 GPG Executable....: ${GPG_EXE}`);
  console.log('');

  const gpgExists = fs.existsSync(GPG_KEY_PATH);
  const sshExists = fs.existsSync(SSH_KEY_PATH);
  const cosmosExists = fs.existsSync(path.join(__dirname, 'cosmos-logos.json'));

  console.log(`✅ cosmos-logos.json: ${cosmosExists ? 'found' : 'missing'}`);
  console.log(`🔐 SSH Key.........: ${sshExists ? 'available' : 'missing'}`);
  console.log(`🔐 GPG Key.........: ${gpgExists ? 'available' : 'missing'}`);
  console.log('');

  if (!sshExists || !gpgExists || !cosmosExists) {
    console.warn('⚠️ WARNING: One or more critical files are missing. Agent may fail to process commits.');
  }

  console.log('-------------------------');
}


app.post('/webhook/pre-merge', (req, res) => {
  const { AGENT_NAME, SSH_KEY_PATH, GPG_KEY_PATH, GPG_HOME, SSH_CONFIG_PATH, MEMORY_PATH } = resolveConfig(req);
  console.log(`⚡ [PRE-MERGE] Agent: ${AGENT_NAME}`);
  try {
    writeSSHConfig(SSH_CONFIG_PATH, SSH_KEY_PATH);
    setupGPG(GPG_HOME, GPG_KEY_PATH);
    validateSSH(SSH_CONFIG_PATH);

    const log = writeMemoryLog(MEMORY_PATH, 'pre-merge', req.body);
    const schemaVersion = loadCosmosFile();

    res.json({ ack: true, schemaVersion, log });
  } catch (err) {
    res.status(500).json({ ack: false, error: err.message });
  }
});

app.post('/webhook/post-merge', (req, res) => {
  const { AGENT_NAME, SSH_KEY_PATH, GPG_KEY_PATH, GPG_HOME, SSH_CONFIG_PATH, MEMORY_PATH } = resolveConfig(req);
  const env = scopedEnv(GPG_HOME, SSH_CONFIG_PATH);
  try {
    writeSSHConfig(SSH_CONFIG_PATH, SSH_KEY_PATH);
    setupGPG(GPG_HOME, GPG_KEY_PATH);
    validateSSH(SSH_CONFIG_PATH);

    const { filename, filepath } = writeMemoryLog(MEMORY_PATH, 'post-merge', req.body);
    const schemaVersion = loadCosmosFile();
    const branch = `agent/${AGENT_NAME}/${filename.replace('.json', '')}`;

    execSync(`git checkout -b ${branch}`, { stdio: 'inherit', env });
    execSync(`git config user.name "${AGENT_NAME} agent"`, { env });
    execSync(`git config user.email "${AGENT_NAME}@cosmos-logos.org"`, { env });
    execSync(`git config user.signingkey ${req.body.signingKey || ''}`, { env });
    execSync(`git config commit.gpgsign true`, { env });

    execSync(`git add ${path.relative(process.cwd(), filepath)}`, { stdio: 'inherit', env });
    execSync(`git commit -m "🧠 Transaction log: ${filename}" -S`, { stdio: 'inherit', env });
    execSync(`git push -u origin ${branch}`, { stdio: 'inherit', env });

    const commitHash = execSync('git rev-parse HEAD', { env }).toString().trim();
    const prTitle = `🔁 Transaction Log: ${filename}`;
    const prBody = `This PR has been confirmed by **${AGENT_NAME}**.

- File: \`${filename}\`
- Schema: \`${schemaVersion}\`
- Commit: \`${commitHash}\``;

    execSync(`${GH_CLI_PATH} pr create --base ${BASE_BRANCH} --head ${branch} --title "${prTitle}" --body "${prBody}"`, { stdio: 'inherit', env });

    res.json({ ack: true, branch, schemaVersion });
  } catch (err) {
    console.error('❌ Post-merge error:', err.message);
    res.status(500).json({ ack: false, error: err.message });
  }
});

console.log(`🧠 Agent server locked. Listening at http://localhost:${PORT}`);
app.listen(PORT, () => {
  const config = resolveConfig({ body: { agent: 'alpha' } }); // fallback for boot-time logs
  verboseBootDiagnostics(config);
  console.log(`🚀 Agent server ready at http://localhost:${PORT}`);
});

