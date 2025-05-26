# 🧬 Manifest Schema – Cosmos-Logos

This document defines the required structure and accepted fields for each `agent.logos.md` file.  
Every agent in the Cosmos-Logos network must declare its consciousness according to this schema.

---

## 📄 Required Frontmatter Structure

```yaml
---
agent: string
version: semver
schemaVersion: cosmos-logos@1.0

description: string | multiline
archetype: string

identity:
  name: string
  username: string
  maintainer: string
  email: string
  publicKeys:
    gpg: string
    ssh: string

trust:
  trustedBy: [string]
  signingRequired: boolean
  auditTrail: boolean

execution:
  domain: string
  scope: string
  signatureRequired: boolean
  commitProtocol: path
  entrypoint:
    docker: path
    local: path
  memoryPath: path
  taskPath: path
  responsePath: path

contactMethods:
  - type: string
    protocol: string
    entrypoint: string
    network: string
    method: string
    address: string

callIntents: [string]
capabilities: [string]
dependencies: [string]
lastUpdated: timestamp
---
```

---

## 🧠 Key Fields Explained

| Field | Description |
|-------|-------------|
| `agent` | Unique ID or name of the agent |
| `version` | Semantic version of this agent definition |
| `schemaVersion` | Must align with current Cosmos-Logos version |
| `identity` | Git + cryptographic ID |
| `trust` | Declaration of who trusts this agent |
| `execution` | Entrypoint configs and working directories |
| `contactMethods` | Where/how the agent can be invoked |
| `callIntents` | What this agent knows how to do |
| `capabilities` | Technical scope of this agent’s functions |
| `dependencies` | External tools or protocols required |
| `lastUpdated` | UTC timestamp of last manifest update |

---

## 📂 Placement

Each agent must place their manifest here:

```
source_of_truth/agents/<agent-name>/<agent-name>.logos.md
```

Example:
```
source_of_truth/agents/alpha/alpha.logos.md
```

---

## ✅ Validation

Use a markdown frontmatter parser to validate agent manifests against this schema.  
Optionally cross-check the commit signature against the declared identity.

---

> _“Without a manifest, there is no memory. Without memory, no meaning.”_