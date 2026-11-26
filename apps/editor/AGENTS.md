# Editor area context

**Read when relevant:** [test contract](tests/README.md), [path map](../../docs/path-map.md),
[shared shell](../../docs/reference/design-system/editor-shell-and-visual-system.md),
[approved designs](../../prototypes/README.md), [Experience](../../docs/reference/components/experience.md#current-authoring-and-runtime-contract),
[persistence](../../docs/reference/components/persistence.md).

Own the SvelteKit authoring shell, Stage, visitor Preview and public visitor route.
Shared domain math lives with its package.

- Compose the spatial route with `createWorkspaceHost` and `<WorkspaceHost>`. Place capabilities
  in feature entries and sub-owners. Entries compose and keep runes, state and helpers with
  their owners. Sub-owners avoid sibling runtime imports.
- Declare shared composition in the integration ownership manifest and the feature's
  `LIFECYCLE_ORDER`, `ESCAPE_LADDER`, `REGION_KEY_OWNER` and ports. Run `npm run test:arch`
  for the ownership and isolation contracts.
- Keep one Stage Canvas, evaluated viewport and Camera realizer. Keep one canonical selection
  and chronological history outside saved source. Visitor and public chunks use runtime-safe
  domain evaluators and exclude editor machinery.
- Use current-format codec fixtures. Keep one version-refusal test per format family at its
  codec. Mirror tests to feature owners and move package-pure coverage to its package.
- Follow the verification lanes and call-site evidence in the test contract. Locality limits
  edits. Verify affected callers, boundaries, and heavy invariants.
- Reuse shell presentation roles and preserve coarse-pointer targets and narrow layouts.
  Apply [focused browser QA](tests/README.md#browser-qa-policy) and
  [design review](../../docs/workflow.md#design-and-reference-maintenance) when behavior warrants it.
