# Canaries

A canary is one realistic defect, recorded as a literal mutation of a production
file plus the tests that must fail because of it. The corpus is the evidence
behind the section 7 deletion rules: before a test is removed, every canary that
names it must be `killed`, and it must stay killed afterwards.

The runner is on demand and never runs in CI. It mutates one file at a time,
runs only that canary's tests, and restores the file from `HEAD`.

```sh
node tools/canaries/run.mjs --list            # ids and titles
node tools/canaries/run.mjs                   # every editor canary
node tools/canaries/run.mjs --only 01-envelope-version
node tools/canaries/run.mjs --kind api        # DB-backed API canaries
node tools/canaries/run.mjs --json .harness/canaries.json
```

- `killed` — the named tests failed. This is the required baseline and the
  required post-deletion result.
- `survived` — the tests stayed green. The canary proves nothing until a test
  catches it; add that test first.
- `error` — the mutation could not be applied (a moved line, a dirty target).
  Fix the patch, not the verdict.

`catalog.json` is the source of truth and `patches/` is generated from it:

```sh
node tools/canaries/generate.mjs           # rewrite patches/ after a catalog edit
node tools/canaries/generate.mjs --check   # CI-safe validation, writes nothing
```

Each patch must match exactly once in its file, so a patch cannot silently decay
when the production file moves.
