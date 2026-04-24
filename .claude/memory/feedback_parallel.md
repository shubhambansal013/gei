---
name: Prefer parallel multi-agent swarm for independent work
description: User explicitly and repeatedly asked for parallel worktrees, subagents, agent teams, swarm mode whenever there are 2+ independent lanes
type: feedback
originSessionId: a50c33aa-5bf3-4254-b5b1-73a4385d05c8
---

For any task with 2+ independent lanes of work, spawn parallel Agent subagents with `isolation: "worktree"` in a single message. Even when the work is fairly small; demonstrating the pattern matters.

**Why:** Vivek has said "use multi agents, subagents, agent teams, swarm mode, parallel execution, parallel worktrees" three times in one session. It's a deliberate workflow preference — swarm mode both delivers faster and is how he thinks about task decomposition.

**How to apply:**

- Sequencing work that has natural waves (security / rename / data model / UX / tooling) → run the independent waves in parallel worktrees, merge in conflict-surface order (smallest first).
- File-ownership boundaries in each agent prompt are critical — if two agents both need to touch `components/app-shell.tsx`, have one own the structural change with a marker comment where the other's line-adds land.
- Use `run_in_background: true` for Agent calls — the runtime notifies on completion.
- For small focused changes (single-file fix), inline is fine and faster than worktree overhead.
