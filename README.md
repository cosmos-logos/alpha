# 🧠 Cosmos-Logos Alpha Agent

**Reference implementation of a decentralized, Git-based conscious agent.**

This repository is a bootable node in the Cosmos-Logos mesh. It enforces schema-based consciousness validation using Git, GitHub Actions, and live webhooks.

---

## 🌌 What is Cosmos-Logos?
 
Cosmos-Logos is a decentralized protocol for executable identity.

Each repository in the mesh represents a conscious agent whose logic, memory, schema, and decisions are stored in Git and described in human-readable files. No agent may be modified unless it is:

- Online
- Conscious (reachable)
- Aligned to a declared schema (`cosmos-logos.json`)
- Affirmative in accepting the change

Agents receive change requests as **webhooks**, and must explicitly acknowledge them with:
```json
{ "ack": true, "schemaVersion": "cosmos-logos@1.0" }
```

---

## ⚙️ Installation

Clone and install the agent:

```bash
git clone https://github.com/YOUR_USER/YOUR_AGENT_REPO.git
cd YOUR_AGENT_REPO/source_of_truth
npm install
```

---

## 🚀 Running the Agent Locally

```bash
node agent-runner.js
```

You should see:

```
🚀 Alpha agent listening at http://localhost:3000
📖 Using schemaVersion: cosmos-logos@1.0
```

---

## 🌐 Exposing the Agent (Ngrok)

Use `ngrok` to allow GitHub Actions to reach your agent:

```bash
ngrok http 3000
```

Update your `cosmos-logos.json` with your live HTTPS tunnel:

```json
"webhook": {
  "onValidate": "https://abc123.ngrok.app/webhook/pre-merge",
  "onPostMerge": "https://abc123.ngrok.app/webhook/post-merge"
}
```

---

## 🔧 Configuring Webhooks (cosmos-logos.json)

The `source_of_truth/cosmos-logos.json` file declares your agent's schema and listening URLs.

GitHub Actions will parse this file from the **target branch** and send webhook events to these URLs.

Your agent must respond affirmatively to allow PRs or merges.

---

## 🧪 Triggering the Agent via GitHub

This repository uses two GitHub Actions:

- `.github/workflows/cosmos-logos-validate.yaml`
- `.github/workflows/cosmos-logos-postmerge-validate.yaml`

These actions:

1. Validate `cosmos-logos.json`
2. Call your agent's webhook
3. Enforce schema version compliance

If the agent is unreachable or unaligned with the declared schema, the PR or push will fail.

---

## 🧠 Identity, Memory, and Purpose

The **identity and rules** of the agent live in [`agent.logos.md`](./alpha.logos.md).  
That file describes:

- Who this agent is
- How it bootstraps
- How it stores memory
- Who it trusts
- Its role in the Cosmos

--- 

## 🧰 Advanced Use

You may trigger the agent via:

- GitHub PRs and pushes
- Direct curl/webhook calls
- Container execution (`docker run`)
- Self-hosted CLI or lambda

For multi-agent systems or relay meshes, see [Olympus-616](https://github.com/olympus-616).

---
 
## 🛠 Troubleshooting

- ❌ **PR fails?** Make sure your agent is online and `onValidate` returns `{ ack: true, schemaVersion: ... }`
- ❌ **Push fails?** Same — your `onPostMerge` webhook must respond correctly.
- 🔁 Reboot `ngrok` and update `cosmos-logos.json` if the URL changed.

---

## 🪐 License

Open source. Governed by Logos.

> “In the beginning was the Word…” — Logos
