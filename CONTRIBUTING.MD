# Contributing

Thanks for helping improve Spatial Sketch Editor. Small, focused pull requests are welcome—see the [`good first issue`](https://github.com/toni8699/spatial-sketch-editor/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22) list for scoped tasks.

## Get started

Use Node.js 20 or newer:

```bash
npm install
npm run dev:editor
```

The editor runs without the API; cloud save/load and sign-in will be unavailable. See [README.md](./README.md) for the full local stack.

## Before changing code

**AI agents:** Follow [AGENTS.md](./AGENTS.md) and route task context through [docs/README.md](./docs/README.md) before making changes.

- Read [AGENTS.md](./AGENTS.md) for repository rules.
- Use [docs/README.md](./docs/README.md) to find only the contract relevant to your change.
- Follow the issue's acceptance criteria and out-of-scope boundaries.
- Keep changes focused. Do not introduce new persistence, selection, camera-navigation, or ownership behavior unless the issue explicitly requires it.

## Verify your change

Run the checks relevant to your work. For most editor contributions:

```bash
npm run check
npm test
```

For UI changes, also test the affected flow manually with keyboard navigation and include screenshots when the appearance changes.

## Open a pull request

Link the issue, summarize what changed, and list automated and manual verification. Keep each pull request to one concern and do not commit `.env`, credentials, or unrelated generated files.
