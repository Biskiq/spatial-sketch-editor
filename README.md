# Biskiq

Biskiq is a browser-native editor for creating spatial worlds and directing visitor experiences.
Creators draw rooms and native shapes, arrange objects, manipulate them directly, author Camera
Views and Experience Guides, and run an isolated visitor Preview.

**Core Product Stability is owner-accepted at PR #271 (`ce4e232c`).** That is the foundation for
future work, not the product ceiling. Advanced geometry, the complete Object Studio and public
publishing are not claimed as shipped. Prepared visitor delivery remains future work; the public
publication route is unavailable until its prepared reader is implemented and activated.

World and Experience are lenses over one project. Layout, Scene, Camera, Experience and typed
resources retain distinct semantic ownership. The ambitious [North Star](docs/reference/north-star.md)
defines the destination; approved UX defines the desired state for its scope, while code and tests
establish landed behavior. Automated evidence status is separate from owner product acceptance.

## First ten minutes

1. Install Node 20+ and run `npm install`.
2. Copy `.env.example` to `.env` and set local values. Start the backend with `npm run stack:up`,
   then `npm run dev`. Open the local URL Vite prints. For host Postgres or editor-only development,
   see [local development](docs/local-development.md).
3. Run `npm run status` for capability evidence, flags and claims. An absent or incomplete current
   report is `unknown`, not a claim that the accepted product is missing or that CI passed.
4. Read [AGENTS.md](AGENTS.md), then the [documentation router](docs/README.md). Use the
   [path map](docs/path-map.md) to read only the contract needed for the affected responsibility.
5. Claim work through the [workflow](docs/workflow.md); check issues and active PRs for collisions.

Guest/local editing works without the API. Cloud Save/Load uses local username/password accounts;
create an account from the editor. No account is preconfigured. Production workspaces are
`apps/editor`, `apps/api` and the shared packages. Root editor commands do not verify the API.

## Product references

- [Architecture and boundaries](docs/reference/architecture.md)
- [Shared composition and execution contracts](docs/reference/composition-execution.md)
- [Approved shell and visual system](docs/reference/design-system/editor-shell-and-visual-system.md)
- [World interaction sheet](docs/reference/design-system/world-interaction-sheet.html)
- [Experience interaction sheet](docs/reference/design-system/experience-interaction-sheet.html)
- [Tests and verification](apps/editor/tests/README.md)
- [Contributing](CONTRIBUTING.MD)

## Optional research library

[Research](broad-research/README.md) and [prototypes](prototypes/README.md) preserve alternative
approaches, technical comparisons and runnable experiments. They are opt-in evidence, not current
product capability, persisted-format authority or a competing UX specification. Their shortcuts and
mock evaluators are not production architecture. Run an experiment using its own README; prototypes
are outside the npm workspace and production build.
