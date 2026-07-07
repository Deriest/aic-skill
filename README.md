# AIC — AI Engineering Company

**Strict 5-Phase AI Orchestration System for Hermes Agent**

AIC transforms your Hermes agent into a Dispatcher — a front-facing AI engineering manager. When you assign a task in natural language, the Dispatcher rigorously enforces a strict, **non-negotiable 5-phase lifecycle** (Investigate → Planning → Execution → Documentation → Verification) utilizing specialized AI workers. 

**Zero bypasses. Consistent output. Pure Virtual Office.**

---

## 🎯 The 5-Phase Strict Lifecycle 

Every task MUST progress through these 5 phases in exact order. The internal API server blocks any worker from operating out of turn.

1. **Investigate:** Dispatcher & Researcher analyze the request and read context. *(Engineers blocked)*
2. **Planning:** PM, Designer, and Architect formulate specifications and requirements. *(Engineers blocked)*
3. **Execution:** Frontend, Backend, and Infra Engineers write the actual code.
4. **Documentation:** Engineers finalize docs, READMEs, and changelogs.
5. **Verification:** QA and Governor test the code and ensure compliance.

## 🚀 How to Run

```bash
# 1. Install or clone the repository
git clone https://github.com/Deriest/aic-skill.git ~/.hermes/skills/workflows/aic

# 2. Start the Virtual Office Dashboard & Server
cd ~/.hermes/skills/workflows/aic
./aic dashboard
```

Upon starting, the CLI will:
1. Auto-update from GitHub.
2. Spin up the Control Plane API & Virtual Office (port `6868`).
3. Verify your `opencode.jsonc` provider setup.
4. Greet you via the Dispatcher!

## 💬 Usage (Agentic Workflow)

After running `./aic dashboard`, **you do not need the CLI anymore.**
Switch to your Hermes Agent chat:

1. Type `/aic` to activate the Dispatcher.
2. Chat naturally: *"Tolong buatin fitur login dong."* or *"Fix the styling bug on the header."*
3. The Dispatcher (Hermes) will respond in your language and start orchestrating the workers.
4. Watch the progress live on the **Virtual Office Dashboard (http://localhost:6868)**.

---

## 🏢 Dashboard: Pure Virtual Office

The dashboard is intentionally stripped down to keep things simple:
- **Office Floor:** Visual representation of which worker is currently 'working', 'idle', or 'blocked'.
- **Pipeline Tracker:** Live status showing exactly which of the 5 phases the current task is in.
- **Config Editor:** Live `.env` and `opencode.jsonc` modifier (change providers on the fly without restarting).

*No noisy activity logs, no redundant pages. Just the essential control plane.*

## ⚙️ Dependencies

- Hermes Agent
- OpenCode CLI (`npm i -g @opencode/cli`)
- Node.js (v18+)

## 📜 License
MIT
