---
name: browser-hygiene
description: Browser, session and process lifecycle for any agent that launches or attaches to Chrome/Chromium or browser automation (agent-browser, CDP). Reuse a healthy session before launching another, keep one browser owner per task, release what you started, and never close or kill a browser this task does not own.
---

# Browser Hygiene

Applies whenever an agent launches or attaches to Chrome/Chromium: QA, local-app
verification, debugging, scraping, form work or evidence capture.

## Ownership

- **agent-owned** — this task created the session. Operate, restart and close it.
- **external** — the user or another agent owns it: the shared default session,
  `--auto-connect`, `--cdp` into someone else's Chrome, a user profile. Use it
  only where the task is authorized; never close or kill it.

Name what you create so ownership stays checkable:

```bash
SESSION="$(agent-browser session id --scope worktree --prefix <task>)"
agent-browser --session "$SESSION" open <url>
```

`agent-browser session list` shows what is live. A leftover carrying this task's
name is yours to close; anything else is not yours. Reuse means the same session
name; `--restore` keeps its state across runs. One browser owner per task.

## Lifecycle

1. **Acquire** — reuse a healthy agent-owned session, or close yesterday's
   leftover first. A second session exists only for real isolation or deliberate
   concurrency.
2. **Operate** — every command in the task uses that one session.
3. **Release** — close it on success, failure and abort, not only success:
   `trap '<close>' EXIT`, or `finally` where the host provides it. Close the
   temporary tabs you opened. Dev and static servers follow the same rule.

A failed run is not a reason to launch another browser. Inspect
`agent-browser session info --json`, re-run the command, and replace a genuinely
wedged agent-owned session only after closing it deliberately. The CLI's idle
timeout is a backstop, never cleanup.

## Never do these

```text
agent-browser close --all        closes sessions this task did not create
pkill / killall of Chrome        reaches the user's own browser
"close" an attached external     use it, close your tabs, leave it running
```

An explicit caller instruction to leave a session running overrides cleanup;
report which session was left running and why. Screenshots, logs and traces
persist where the caller asked for them.
