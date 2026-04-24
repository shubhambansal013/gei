---
name: Direct push to feature/foundation is acceptable
description: Vivek prefers direct pushes to the integration branch in this repo; no PR gate unless asked
type: feedback
originSessionId: a50c33aa-5bf3-4254-b5b1-73a4385d05c8
---

Push `feature/foundation` to origin directly without opening a PR. Don't block on "should we open a PR?" unless Vivek says so.

**Why:** Historical git log shows every prior commit landed direct to `feature/foundation` (no merge commits from PRs). Vivek confirmed when asked "push as per git strategy" — he pushed direct, no PR cycle.

**How to apply:**

- After a coherent set of commits, push with `git push` (branch is tracking `origin/feature/foundation`).
- Don't auto-open PRs. Don't suggest them unless Vivek brings it up or the scope looks like a review would add value.
- `main` is still the long-lived branch — `feature/foundation` eventually fast-forwards or merges in. Do not touch `main` without explicit instruction.
