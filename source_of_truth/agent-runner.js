const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;

const COSMOS_FILE = path.join(__dirname, 'cosmos-logos.json');
const BASE_BRANCH = 'brain/7777';
const GH_CLI_PATH = '"C:\\Program Files\\GitHub CLI\\gh.exe"';

const AGENT_NAME = 'alpha';
const SSH_KEY_PATH = path.join(__dirname, 'agents', 'alpha', 'keys', 'cosmos_logos.agent');

let schemaVersion = 'unknown';

// Load Cosmos-Logos schema version
try {
  const raw = fs.readFileSync(COSMOS_FILE);
  const json = JSON.parse(raw);
  schemaVersion = json.schemaVersion || 'missing';
} catch (err) {
  console.error("❌ Failed to load cosmos-logos.json");
  console.error(err.message);
}

// Set up SSH key environment
function setupHardcodedIdentity() {
  process.env.GIT_SSH_COMMAND = `ssh -i "${SSH_KEY_PATH}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no`;
  console.log(`🔐 SSH environment set for key: ${SSH_KEY_PATH}`);
}

// Test SSH connection to GitHub
function validateIdentity() {
  console.log('🔍 Validating SSH connectivity...');

  try {
    const result = execSync(
      `ssh -i "${SSH_KEY_PATH}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -T git@github.com`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] } // capture stderr
    ).toString();

    if (result.includes('successfully authenticated')) {
      console.log('✅ SSH connection to GitHub passed');
    } else {
      console.warn('⚠️ SSH responded, but did not confirm authentication explicitly.');
      console.warn(result);
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
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
    const relativeFilePath = path.relative(process.cwd(), filepath);
    execSync(`git add ${relativeFilePath}`, { stdio: 'inherit' });
    execSync('git status', { stdio: 'inherit' });
    execSync(`git commit -m "🤖 ${AGENT_NAME} post-merge memory log: ${filename}"`, { stdio: 'inherit' });
    const commitHash = execSync('git rev-parse HEAD').toString().trim();
    execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' });

    const prTitle = `Agent ${AGENT_NAME} - Post-merge memory update`;
    const prBody = `Intent submitted from memory event ${filename}.\n\nCommit: ${commitHash}`;

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

// Boot validation
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
