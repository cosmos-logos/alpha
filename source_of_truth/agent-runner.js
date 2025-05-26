// source_of_truth/agent-runner.js

const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

app.post('/webhook/pre-merge', (req, res) => {
  console.log('🧠 [PRE-MERGE] Webhook received!');
  console.log(JSON.stringify(req.body, null, 2));
  res.json({ status: 'Alpha agent pre-merge acknowledged' });
});

app.post('/webhook/post-merge', (req, res) => {
  console.log('🧠 [POST-MERGE] Webhook received!');
  console.log(JSON.stringify(req.body, null, 2));

  // Required for post-merge validation to succeed
  res.json({ ack: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Alpha agent listening at http://localhost:${PORT}`);
});
