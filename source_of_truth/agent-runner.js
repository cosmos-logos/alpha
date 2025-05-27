const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;

const COSMOS_FILE = path.join(__dirname, 'cosmos-logos.json');
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

function writeMemoryLog(eventType, payload) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const memoryPath = path.join(__dirname, 'agents', 'alpha', 'memory');

  try {
    if (!fs.existsSync(memoryPath)) {
      fs.mkdirSync(memoryPath, { recursive: true });
    }

    const filename = `${timestamp}-${eventType}.json`;
    const filepath = path.join(memoryPath, filename);
    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));

    console.log(`📝 Memory written to ${filepath}`);
    return { filepath, timestamp };
  } catch (err) {
    console.error(`❌ Failed to write ${eventType} memory log:`, err.message);
    return null;
  }
}

app.post('/webhook/pre-merge', (req, res) => {
  console.log('🧠 [PRE-MERGE] Webhook received!');
  console.log(JSON.stringify(req.body, null, 2));

  writeMemoryLog('pre-merge', req.body);

  res.json({
    ack: true,
    schemaVersion
  });
});

app.post('/webhook/post-merge', (req, res) => {
  console.log('🧠 [POST-MERGE] Webhook received!');
  console.log(JSON.stringify(req.body, null, 2));

  const log = writeMemoryLog('post-merge', req.body);

  if (!log) {
    return res.status(500).json({ ack: false, error: 'Failed to log memory.' });
  }

  const { filepath, timestamp } = log;
  const branchName = `agent/alpha/post-merge-${timestamp}`;

  try {
    execSync(`git addthought ${filepath}`, { stdio: 'inherit' });
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
    execSync(`git committhought -m "🧠 Agent alpha post-merge memory update: ${timestamp}"`, { stdio: 'inherit' });
    execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' });

    const prTitle = `Agent alpha - Post-merge memory update`;
    const prBody = `This is an automated consciousness log from the post-merge event on ${timestamp}.`;
    execSync(`gh pr create --base brain/7777 --head ${branchName} --title "${prTitle}" --body "${prBody}"`, { stdio: 'inherit' });

    console.log("✅ Pull request successfully created.");
  } catch (err) {
    console.error("❌ Failed during Git or PR creation:", err.message);
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
