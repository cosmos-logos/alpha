
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('🔧 Starting agent-runner.js setup');

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

console.log('📖 Attempting to load schema version');
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
  console.log('🔧 Setting up SSH + GPG identity environment');

  process.env.GIT_SSH_COMMAND = `ssh -i "${SSH_KEY_PATH}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no`;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.GNUPGHOME = GPG_HOME;

  process.env.GIT_AUTHOR_NAME = 'alpha agent';
  process.env.GIT_COMMITTER_NAME = 'alpha agent';
  process.env.GIT_AUTHOR_EMAIL = 'alpha@cosmos-logos.org';
  process.env.GIT_COMMITTER_EMAIL = 'alpha@cosmos-logos.org';

  console.log(`📦 Using GPG executable: ${GPG_EXE}`);

  if (!fs.existsSync(GPG_HOME)) {
    console.log('📁 Creating GPG home directory');
    fs.mkdirSync(GPG_HOME, { recursive: true });
  }

  try {
    console.log(`🔁 Importing GPG key from ${GPG_KEY_PATH}`);
    execSync(`${GPG_EXE} --homedir "${GPG_HOME}" --import "${GPG_KEY_PATH}"`);
    console.log(`🔐 GPG key imported into ${GPG_HOME}`);
  } catch (err) {
    console.error(`❌ GPG import failed: ${err.message}`);
  }

  try {
    console.log('🚀 Launching gpg-agent');
    execSync(`gpgconf --homedir "${GPG_HOME}" --launch gpg-agent`);
    console.log(`🟢 gpg-agent launched`);
  } catch (err) {
    console.error(`⚠️ Failed to launch gpg-agent: ${err.message}`);
  }

  try {
    console.log('🧭 Setting GPG_TTY');
    process.env.GPG_TTY = execSync('tty', { encoding: 'utf8' }).trim();
  } catch {
    process.env.GPG_TTY = 'CON';
    console.log(`📌 GPG_TTY fallback to CON`);
  }

  try {
    const keyCheck = execSync(`${GPG_EXE} --homedir "${GPG_HOME}" --list-secret-keys`, { encoding: 'utf8' });
    console.log(`🔍 GPG keys loaded:\n${keyCheck}`);
  } catch (err) {
    console.error(`❌ Failed to list secret keys: ${err.message}`);
  }

  console.log(`🔐 SSH + GPG environment ready`);
}

function validateIdentity() {
  console.log('🔍 Validating SSH connectivity');
  try {
    const result = execSync(
      `ssh -i "${SSH_KEY_PATH}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -T git@github.com`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString();

    if (result.includes('successfully authenticated')) {
      console.log('✅ SSH connection to GitHub passed');
    } else {
      throw new Error(`❌ Unexpected SSH response:\n${result}`);
    }
  } catch (err) {
    const errOutput = err.stderr?.toString() || err.stdout?.toString() || err.message;
    if (errOutput.includes('successfully authenticated')) {
      console.log('✅ SSH connection to GitHub passed (via stderr)');
    } else {
      throw new Error(`❌ SSH connection failed: ${errOutput}`);
    }
  }
}

function generateFilename(eventType) {
  console.log(`📁 Generating filename for event: ${eventType}`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const hash = crypto.createHash('sha256').update(timestamp).digest('hex').slice(0, 8);
  const filename = `${timestamp}-${eventType}-${hash}.json`;
  console.log(`📦 Generated filename: ${filename}`);
  return filename;
}

function writeMemoryLog(eventType, payload) {
  console.log(`🧠 Writing memory log for event: ${eventType}`);
  const filename = generateFilename(eventType);
  const memoryPath = path.join(__dirname, 'agents', AGENT_NAME, 'memory');
  const filepath = path.join(memoryPath, filename);

  try {
    if (!fs.existsSync(memoryPath)) {
      console.log('📁 Creating memory directory');
      fs.mkdirSync(memoryPath, { recursive: true });
    }
    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
    console.log(`📝 Memory written to ${filepath}`);
    return { filepath, filename };
  } catch (err) {
    console.error(`❌ Failed to write memory log:`, err.message);
    return null;
  }
}

app.use(bodyParser.json());

app.post('/webhook/post-merge', async (req, res) => {
  console.log('⚡ [POST-MERGE] Webhook hit.');
  console.log('🔍 Payload:', JSON.stringify(req.body, null, 2));

  try {
    setupHardcodedIdentity();
    validateIdentity();
  } catch (validationError) {
    console.error(validationError.message);
    return res.status(400).json({ ack: false, error: validationError.message });
  }

  const log = writeMemoryLog('post-merge', req.body);
  if (!log) {
    return res.status(500).json({ ack: false, error: 'Memory write failed.' });
  }

  const { filepath, filename } = log;
  const branchName = `agent/${AGENT_NAME}/${filename.replace('.json', '')}`;

  try {
    console.log(`🌱 Creating branch ${branchName}`);
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });

    const relativeFilePath = path.relative(process.cwd(), filepath);
    console.log(`➕ Adding file ${relativeFilePath}`);
    execSync(`git add ${relativeFilePath}`, { stdio: 'inherit' });

    console.log(`📦 Checking git status`);
    execSync('git status', { stdio: 'inherit' });

    // 🔍 Log Git identity and signing key info
    console.log('🪪 Git & GPG identity diagnostics');
    try {
      const userName = execSync('git config user.name').toString().trim();
      const userEmail = execSync('git config user.email').toString().trim();
      const signingKey = execSync('git config user.signingkey').toString().trim();
      console.log(`👤 Git User: ${userName}`);
      console.log(`📧 Git Email: ${userEmail}`);
      console.log(`🔏 Signing Key: ${signingKey}`);
    } catch (err) {
      console.error('❌ Failed to read Git identity:', err.message);
    }

    try {
      const gpgList = execSync(`${GPG_EXE} --homedir "${GPG_HOME}" --list-secret-keys --keyid-format LONG`, { encoding: 'utf8' });
      console.log('🔐 Available GPG Keys:\n' + gpgList);
    } catch (err) {
      console.error('❌ Failed to list GPG keys:', err.message);
    }

    console.log(`✍️ Committing with GPG signing (runtime key ID ${SIGNING_KEY_ID})`);
    execSync(`git commit -m "🧠 Transaction log: ${filename}" -S${SIGNING_KEY_ID}`, { stdio: 'inherit' });

    console.log(`🚀 Pushing branch to origin`);
    execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' });

    const commitHash = execSync('git rev-parse HEAD').toString().trim();
    console.log(`🔗 Commit hash: ${commitHash}`);

    const prTitle = `🔁 Transaction Log: ${filename}`;
    const prBody = `This pull request has been confirmed and logged by agent **${AGENT_NAME}**.

    - **Memory File:** \`${filename}\`
    - **Schema Version:** \`${schemaVersion}\`
    - **Commit:** \`${commitHash}\``;

    console.log(`📬 Creating pull request`);
    execSync(`${GH_CLI_PATH} pr create --base ${BASE_BRANCH} --head ${branchName} --title "${prTitle}" --body "${prBody}"`, { stdio: 'inherit' });

    console.log("✅ Pull request successfully created.");
  } catch (err) {
    console.error("❌ PR pipeline failed:", err.message);
    return res.status(500).json({ ack: false, error: err.message });
  }

  res.json({
    ack: true,
    schemaVersion
  });
});

console.log('🧪 Running SSH identity check...');
try {
  setupHardcodedIdentity();
  validateIdentity();
  console.log(`✅ SSH identity validation succeeded.`);
} catch (err) {
  console.error(`❌ Identity validation failed:`);
  console.error(err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`🚀 Agent is listening at http://localhost:${PORT}`);
  console.log(`📖 Using schemaVersion: ${schemaVersion}`);
});
