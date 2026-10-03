---
name: browser-hygiene
description: Browser, session and process lifecycle for any agent that launches or attaches to Chrome/Chromium or browser automation (agent-browser, CDP) — QA, local-app verification, debugging, scraping, form work. Reuse a healthy session before launching another, keep one browser owner per task, release what you started on success, failure and abort, and never close or kill a browser this task does not own.
---

# Browser Hygiene

**Owns:** browser, session and process lifecycle — acquire, reuse, release.
**Does not own:** what the browser is used for. Assertions, acceptance criteria, app routes and
visual-review procedure belong to the calling workflow; command-level usage belongs to the browser
tool's own guidance (`agent-browser skills get core`).

Applies whenever an agent launches or attaches to Chrome/Chromium or browser automation: QA,
local-app verification, debugging, scraping/research, form interaction, or anything else.

## Ownership

```text
agent-owned   this task created it — the session name it chose, the browser it launched
              → may operate, restart and close it

external      a user or another agent owns it — the shared default session,
              --auto-connect, --cdp into someone else's Chrome, a user profile
              → may use or attach where the task is authorized to; never close or kill it
```

Name what you create, so ownership stays checkable later:

```bash
SESSION="$(agent-browser session id --scope worktree --prefix <task>)"
agent-browser --session "$SESSION" open <url>
```

`agent-browser session list` shows what is live. A leftover carrying this task's name is yours to
close; anything else is not yours, whatever it is doing. Reuse means the same session name — when the
task needs its browser state across runs, `--restore` is the supported way to keep it.

## Lifecycle

```text
ACQUIRE   check for a leftover session from an earlier attempt and reuse or close it first.
          Prefer a healthy existing agent-owned session over launching another.
          One browser owner/session per task. A second session exists only for real
          isolation (clean state, a different identity) or deliberate concurrency.
OPERATE   every command in the task uses that one session.
RELEASE   close it when its work is done — on success, failure and abort, not only success.
          Shell → trap '<close>' EXIT. Hosts with finally → finally.
          Close the temporary tabs you opened (tab close <id>).
```

A runner that performs several browser tasks in sequence releases one session before acquiring the
next. Processes started to serve the browser (dev server, static server) follow the same
acquire → release rule, on the same exit paths.

The CLI's default idle timeout closes an inactive headless browser after about an hour; headed and
user-attached sessions are exempt. Treat that as a backstop, never as cleanup.

## Failure and retry

A failed command, assertion or run is not a reason to launch another browser.

```text
1. inspect   agent-browser session info --json · session list
2. recover   re-run the command; doctor clears stale daemon sidecars (it does not close
             live sessions)
3. replace   only if the session is genuinely wedged — close the agent-owned session
             deliberately first, then start one replacement
```

Instances must not accumulate across retries.

## Never do these

```text
agent-browser close --all        closes sessions this task did not create
process-name kills of Chrome     pkill/killall reach the user's own browser
"close" of an attached external browser
                                 use it, close the tabs you opened, leave it running
```

## Evidence

Screenshots, logs, traces and other requested evidence persist where the caller asked for them.
Browser processes and temporary runtime resources do not persist merely because the agent launched
them.

## Overrides

An explicit caller instruction to leave a session running ("keep it open", "I'll check it") overrides
normal cleanup — report which session was left running and why.

## Prefer the canonical tool

Drive the browser through `agent-browser` rather than hand-writing Chrome launch scripts or one-off
CDP plumbing per retry: each new launcher is another browser the agent must remember to close. A
helper script is fine when it is a task-owned tool that follows the lifecycle above.
