---
name: Issues live on GitHub — shubhambansal013/gei
description: Stakeholder files requirements via GitHub issues; use gh CLI to triage and close; expect new issues mid-session
type: reference
originSessionId: a50c33aa-5bf3-4254-b5b1-73a4385d05c8
---

Primary task/bug tracker is GitHub issues on the `shubhambansal013/gei` remote. The git remote URL is `git@github.com:shubhambansal013/gei.git`.

Common commands:

- List open: `gh issue list --state open --limit 50 --json number,title,body`
- View one: `gh issue view 22 --json number,title,body,createdAt`
- Close after landing: `gh issue close 1 2 4 --comment "Landed on feature/foundation"`

**Expect new issues mid-session** — Shubham files issues in bursts (filed #22, #27, #28 during a parallel-waves execution). Refetch `gh issue list` before claiming "all done".

Commits in this repo don't carry `Fixes #N` trailers by convention, so auto-close is NOT wired. Always close explicitly after Vivek reviews.
