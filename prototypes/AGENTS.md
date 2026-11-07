# Prototypes area context

**Read first:** [`prototypes/README.md`](README.md) · root [`AGENTS.md`](../AGENTS.md).

Prototypes are durable runnable hypotheses and QA/reference evidence. They are **not** npm
workspaces, production applications, persisted-format authorities or a shortcut into a contract.
Their local tests, fixtures and captures are still real evidence and must remain runnable when moved.

- Keep an executable and its assets/tests together.
- A production import of a prototype is forbidden.
- Do not treat an old prototype's timing, data shape, chrome or mock mechanism as current product
  behavior; route current design to the accepted reference sheets and owning contracts.
- When changing a prototype, run its local checks or record the concrete blocker.
