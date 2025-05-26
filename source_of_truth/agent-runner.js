// source_of_truth/agent-runner.js

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Dynamically load schema version from local cosmos-logos.json
const COSMOS_FILE = path.join(__dirname, 'cosmos-logos.json');
let schemaVersion = 'unknown';

try {
  const raw = fs.readFileSync(COSMOS_FILE);
  const json = JSON.parse(raw);
  schemaVersion = json.schemaVersion || 'missing';
} catch (err) {
  console.error("❌ Failed to load local cosmos-logos.json:", err.message);
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

  res.json({
    ack: true,
    schemaVersion
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Alpha agent listening at http://localhost:${PORT}`);
  console.log(`📖 Using schemaVersion: ${schemaVersion}`);
});
