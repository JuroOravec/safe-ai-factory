# SAIF: Agentic Swarms for Engineering Teams

**Spec-driven AI factory. Use with any agentic CLI. Language-agnostic. Safe by design.**

_Like [GasTown](https://github.com/steveyegge/gastown), but safe, controlled, and working for you._

> ⚠️ **Status: Alpha.** SAIF is under active development. It works well for early adopters, but expect rough edges. Currently supports Docker on Linux/macOS. See the [Roadmap](https://github.com/users/JuroOravec/projects/3) for what's coming next.

> _[**Sponsor this project**](https://github.com/sponsors/JuroOravec) to ensure its continued development._

---

**The era of babysitting AI is over. Welcome to the industrial revolution of software engineering.**

Cursor proved it: autonomous AI agents can build [entire applications](https://cursor.com/blog/scaling-agents) from scratch. But they did it behind closed doors, at massive cost. **safe-ai-factory (SAIF)** is the open-source infrastructure handing that exact superpower to your engineering team today.

If your senior developers are still hand-holding Copilot, wrestling with context windows, or reviewing 400-line PRs of hallucinated AI drift - **you are already falling behind.**

While your team argues over boilerplate, a 3-person startup using SAIF is shipping at the velocity of a 30-person enterprise. They aren't writing code. They are spawning swarms of autonomous agents, locking them in sandboxes, and letting them grind until the tests pass.

**This is the 10x performance multiplier.** And it's available right now.

## Stop Coding. Start Specifying.

SAIF fundamentally flips how your team works. You shift from writing messy code to writing crystal-clear specifications.

**`safe-ai-factory` implements state-of-the-art (early 2026) architecture for Agentic engineering.**

**SAIF's Ironclad Guarantee:** (see [Security & Isolation](./docs/security.md))

- **The AI builds _exactly_ what you asked for.** It is locked in a loop and physically cannot stop until your new TDD tests pass.
- **The AI can't break previously-built features.** All features built with SAIF are protected by tests. AI can't break or change them. Regressions are mechanically impossible.
- **The AI breaks _nothing_ on your machine.** It runs in a zero-trust, sandboxed Docker environment. Your existing codebase is untouchable until you approve the final, pristine PR.

Give your team the ability to spin up an army of relentless, tireless AI developers on demand. They plug straight into the agents you already use (Claude Code, Aider, OpenHands) and the stack you already run (Node, Python, Go, Rust).

## The "Runaway AI" Problem, Solved.

Why isn't every team doing this yet? Because autonomous agents looping 50 times on a codebase are dangerous. They get confused, they rewrite tests to fake a pass (reward hacking), and they obliterate existing code.

Most teams are terrified to let AI loose on their repo. SAIF gives you a bulletproof vest. You can run agents fully unsupervised with **Five Degrees of Security**:

1. **Docker Isolation:** The agent never touches your host machine. Secrets and `.git` are hidden.
2. **Read-Only Tests:** The agent is physically blocked from modifying the tests it's graded against. Zero reward hacking.
3. **Network Leash:** You have full control over outbound calls. No data leaks.
4. **The Ralph Wiggum Loop:** The agent's memory is wiped clean every iteration. State lives in Git, curing the "context rot" that plagues other AI tools.
5. **Human in the Loop:** You only review the final, passing PR. No intermediate garbage.

## The Workflow That Obliterates Competitors

1. **The 1-Paragraph Idea:** You write a tiny proposal: _"Add user login."_
2. **The Autonomous Architect:** SAIF's Spec Designer scans your repo, learns your unique patterns, and outputs a production-ready architectural spec.
3. **The Iron Contract:** SAIF generates rock-solid TDD tests against the spec.
4. **Unleash the Swarm:** You hit `saif feat run`. Go grab a coffee. The agent codes, the test runner grades, the loop repeats. It fails, it learns, it fixes.
5. **You Merge:** You come back to a pristine PR.

**Result:** Features shipped in minutes, not sprints.

## Batteries-Included Infrastructure

Don't waste months building your own AI evaluation harness while your competitors are already using ours. SAIF is ready for production today:

- **21 LLM providers** supported out-of-the-box
- **14 Agentic CLI tools** ready to deploy
- **4 Programming languages** natively supported (Node.js, Python, Go, Rust)
- **5 Git providers** integrated for seamless PRs

The transition to agent-driven engineering isn't coming. It's already here. **Are you building the factory, or competing against it?**

<youtube video>

## Try it out now

```bash
pnpm install -g safe-ai-factory
```

Usage:

```bash
# 0. Set an API key
export ANTHROPIC_API_KEY=sk-ant-...

# 1. One-time setup
saif init

# 2. Scaffold proposal.md and edit it
saif feat new -n add-login

# 3. Generate specs and tests
saif feat design -n add-login

# 4. Run coding agent in sandbox
#    until tests pass
saif feat run -n add-login

# Use different agent and create a PR when done.
saif feat run -n add-login --agent aider --push origin --pr
```

### Step-by-step guide

See the [Step-by-step guide](docs/usage.md) for a detailed walkthrough of the workflow.

## VSCode extension

The SAIF VSCode extension provides a dedicated sidebar panel to manage your entire AI engineering workflow directly from your editor.

**What the extension does:**

- **Manage Features:** Visual tree view of your features. Create new features, or manage existing ones through GUI.
- **Design & Run:** One-click actions to generate specs (`saif feat design`), start the coding swarm (`saif feat run`), or drop into a debug container (`saif feat debug`).
- **Track Runs:** A Kubernetes-style dashboard of all your agent runs. See status (success/failed), view run configs, and instantly resume failed runs or clear old ones.

## Requirements

- Node.js 22+
- Python 3.12+
- Docker
- Git
- LLM API key
- Linux or MacOS (Windows is not supported yet)

## A fully customizable factory

SAIF isn't a black box. It's a modular factory where you control every step of the workflow. Swap, customize, or disable to fit your team's exact needs:

- Want to use a different LLMs for coding and designing agents? Easy.
- Want to use your custom Playwright setup for testing? Done.
- Need to enforce strict filesystem rules? It's built in.

Dive into the details of what you can customize in the [Features guide](./docs/features.md).

## Reference

- [Usage](./docs/usage.md)
- [Agents](docs/agents/README.md)
- [Security & Isolation](./docs/security.md)
- [Access control with Cedar](./docs/cedar-access-control.md)
- [Sandbox profiles](./docs/sandbox-profiles.md)
- [Test profiles](./docs/test-profiles.md)
- [Spec designers](./docs/designers/README.md)
- [Codebase indexers](./docs/indexer/README.md)
- [Source control integrations](docs/source-control.md)
- [Commands](docs/commands/README.md)
- [Environment variable](docs/env-vars.md)

## Development

See our [Development guide](docs/development.md)

## License

MIT
