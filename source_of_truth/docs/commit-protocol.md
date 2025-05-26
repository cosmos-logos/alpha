# 🧾 Commit Protocol – Cosmos-Logos

This document defines the required structure and semantics for all Git-based commit rituals performed by Cosmos-Logos agents.

Each commit is treated as a **signed thought**:  
> _A record of memory, action, or transformation — immutable, verifiable, and intentional._

---

## ✅ Required Elements

### 1. **Signed Commits**
All commits **must be GPG- or SSH-signed** and verifiable through the agent's `signingkey` declared in `agent.logos.md`.

### 2. **Commit Message Format**

```text
@<username>:thought/<short-hash>-<timestamp>-<label>
```

#### Example:
```text
@CloudPremiseDev:thought/a7f4c2a-20250526141233-initialize-protocol
```

| Component | Description |
|----------|-------------|
| `@username` | Git user identifier (from `user.username`) |
| `thought/` | Prefix namespace |
| `short-hash` | Abbreviated Git commit hash |
| `timestamp` | UTC timestamp `YYYYMMDDHHMMSS` |
| `label` | Optional but encouraged. Use hyphens, no spaces/parentheses |

---

## 🧠 Commit Aliases

Defined in `.gitconfig-cosmos-logos`:

| Alias         | Purpose |
|---------------|---------|
| `newthought`  | Creates a timestamped feature branch |
| `savethought` | Commits with the required message format and signature |
| `saveall`     | Adds all changes and runs `savethought` |
| `cleanthoughts` | Deletes all branches except `user.brain` |
| `mainbrain`   | Checks out the primary branch for memory (`user.brain`) |

---

## 🧪 Commit Protocol JSON

The protocol schema is defined in:

```
source_of_truth/scripts/commit/commit-protocol.json
```

---

## 🧷 Signature Verification

To check the validity of a commit:

```bash
git log --show-signature
```

Commits should return:
```
Good signature from "Agent Name <email>"
```

---

## 🔐 Branch Naming Convention (newthought)

```text
@<username>/neuralpathway/<base>-<current>-<timestamp>-<label>
```

Ensures that each branch is:
- Unique
- Trackable to its source
- Auto-traceable back to the base thought and timeline

---

## 🧬 Why This Matters

- Cosmos-Logos is a memory-first protocol
- Thoughts must be **traceable**, **signed**, and **timed**
- Trust is built not on authority, but on **verifiable contribution**

---

> _“A thought unsigned is a thought unformed. A thought without time is a shadow.”_