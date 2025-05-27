const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

const COSMOS_FILE = path.join(__dirname, 'cosmos-logos.json');
const GITHUB_OWNER = 'cosmos-logos';
const GITHUB_REPO = 'alpha';
const BASE_BRANCH = 'brain/7777';
const GITHUB_API_URL = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/pulls";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

let schemaVersion = 'unknown';

try {
  const raw = fs.readFileSync(COSMOS_FILE);
  const json = JSON.parse(raw);
  schemaVersion = json.schemaVersion || 'missing';
} catch (err) {
  console.error("❌ Failed to load cosmos-logos.json");
  console.error(err.message);
}

app.use(bodyParser.json());

function generateFilename(eventType) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const hash = crypto.createHash('sha256').update(timestamp).digest('hex').slice(0, 8);
  return `${timestamp}-${eventType}-${hash}.json`;
}

function writeMemoryLog(eventType, payload) {
  const filename = generateFilename(eventType);
  const memoryPath = path.join(__dirname, 'agents', 'alpha', 'memory');
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

async function createGitHubPullRequest(branch, title, body) {
  const payload = {
    title,
    head: branch,
    base: BASE_BRANCH,
    body
  };

  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'cosmos-logos-agent'
  };

  const response = await fetch(GITHUB_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GitHub PR creation failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  console.log(`✅ Pull request created: ${data.html_url}`);
}

app.post('/webhook/post-merge', async (req, res) => {
  console.log('⚡ [POST-MERGE] Webhook hit.');
  console.log('🔍 Payload:', JSON.stringify(req.body, null, 2));

  const log = writeMemoryLog('post-merge', req.body);
  if (!log) {
    return res.status(500).json({ ack: false, error: 'Memory write failed.' });
  }

  const { filepath, filename } = log;
  const branchName = `agent/alpha/${filename.replace('.json', '')}`;

  try {
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
    const relativeFilePath = path.relative(process.cwd(), filepath);
    execSync(`git add ${relativeFilePath}`, { stdio: 'inherit' });
    execSync('git status', { stdio: 'inherit' });
    execSync(`git commit -m "🤖 Agent post-merge memory log: ${filename}"`, { stdio: 'inherit' });
    const commitHash = execSync('git rev-parse HEAD').toString().trim();
    execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' });

    const prTitle = `Agent alpha - Post-merge memory update`;
    const prBody = `Intent submitted from memory event ${filename}.

Commit: ${commitHash}`;
    await createGitHubPullRequest(branchName, prTitle, prBody);

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

app.listen(PORT, () => {
  console.log(`🚀 Agent is listening at http://localhost:${PORT}`);
  console.log(`📖 Using schemaVersion: ${schemaVersion}`);
});
