---
name: Tight reporting style — no emojis, tables + fenced diffs
description: Vivek prefers short structured reports; no emojis in deliverables; confirm before destructive actions
type: feedback
originSessionId: a50c33aa-5bf3-4254-b5b1-73a4385d05c8
---

Summaries and status updates should be:

- Compact Markdown tables where possible, not prose paragraphs.
- File:line references as evidence when making claims about the code.
- Fenced code blocks for diffs / SQL / commands.
- **No emojis** — not in commit messages, not in deliverables. Check/cross symbols (✅/❌/⚠️/🔴) have crept in a couple of times and Vivek has not pushed back, but default to ASCII.
- Professional tone — authored by Vivek Kumar, Head of Engineering (per global `~/.claude/CLAUDE.md`).

**Why:** `~/.claude/CLAUDE.md` is explicit: "No AI-sounding language in deliverables". Vivek is the author-of-record for everything shipped; commits need to read like he wrote them.

**How to apply:**

- Ask before destructive actions (force push, hard reset, delete branches, drop tables).
- One-to-two sentence end-of-turn summaries.
- Skip the "great question!" / "I'll be happy to" preambles.
