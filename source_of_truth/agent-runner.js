const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

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

app.post('/webhook/pre-merge', (req, res) => {
  console.log('🧠 [PRE-MERGE] Webhook received!');
  console.log(JSON.stringify(req.body, null, 2));

  res.json({
    ack: true,
    schemaVersion
  });
});

app.post('/webhook/post-merge', (req, res) => {
  console.log('🧠 [POST-MERGE] Webhook received!');
  console.log(JSON.stringify(req.body, null, 2));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const memoryPath = path.join(__dirname, 'agents', 'alpha', 'memory');

  try {
    if (!fs.existsSync(memoryPath)) {
      fs.mkdirSync(memoryPath, { recursive: true });
    }

    const filename = `${timestamp}-post-merge.json`;
    const filepath = path.join(memoryPath, filename);
    fs.writeFileSync(filepath, JSON.stringify(req.body, null, 2));

    console.log(`📝 Memory written to ${filepath}`);
  } catch (err) {
    console.error("❌ Failed to write memory log:", err.message);
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
