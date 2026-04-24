---
name: Commit signature convention
description: Git user.email/user.name are NOT globally configured — pass them inline on every commit; always add the Claude co-author trailer
type: feedback
originSessionId: a50c33aa-5bf3-4254-b5b1-73a4385d05c8
---

When committing programmatically, always pass:

```
git -c user.email=vkcsenitj@gmail.com -c user.name="Vivek Kumar" commit ...
```

Every commit body ends with:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

**Why:** `CLAUDE.md` §5.1 is explicit — git config is not set globally in this environment to avoid pollution across repos, and the co-author trailer is the project convention for AI-assisted commits.

**How to apply:**

- Use a HEREDOC for commit messages to preserve formatting:

  ```
  git -c user.email=... commit -m "$(cat <<'EOF'
  <subject>

  <body>

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

- Conventional prefixes enforced: `feat(scope)`, `fix(scope)`, `chore(scope)`, `refactor(scope)`, `merge:`. Scope is the module or domain, not the issue number.
- Commit bodies mention issue numbers (`#22`) inline but do NOT carry `Fixes #N` trailers — GitHub auto-close is intentionally NOT wired so issues close manually after review.
