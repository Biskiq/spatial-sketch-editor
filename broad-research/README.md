# Broad research

Research input for future design work. **Not** a product contract or routed authority —
`docs/README.md` and the `docs/reference/` contracts govern product truth.

Each of the five domain studies is a pair of files:

| Topic | Interactive synthesis | Verbatim report |
| --- | --- | --- |
| Multi-level spatial representation and authoring UX | [`multi-level-spatial-authoring-ux.html`](./multi-level-spatial-authoring-ux.html) | [`multi-level-spatial-authoring-ux.md`](./multi-level-spatial-authoring-ux.md) |
| Creative scene composition, surface authoring and look development | [`creative-scene-composition-ux.html`](./creative-scene-composition-ux.html) | [`creative-scene-composition-ux.md`](./creative-scene-composition-ux.md) |
| Interactive experience authoring and spatial storytelling | [`spatial-storytelling-ux.html`](./spatial-storytelling-ux.html) | [`spatial-storytelling-ux.md`](./spatial-storytelling-ux.md) |
| Expressive roofs, ceilings and volumetric spatial authoring | [`expressive-roof-volume-authoring-ux.html`](./expressive-roof-volume-authoring-ux.html) | [`expressive-roof-volume-authoring-ux.md`](./expressive-roof-volume-authoring-ux.md) |
| Visitor interfaces, interactive content and spatial web authoring | [`spatial-interface-authoring-ux.html`](./spatial-interface-authoring-ux.html) | [`spatial-interface-authoring-ux.md`](./spatial-interface-authoring-ux.md) |

- **Verbatim report (`.md`)** — the research chapters exactly as the original export has them,
  with all tables and works cited. It is self-contained, and this text is canonical. Every
  heading, paragraph (`…-pN`) and table (`…-tN`) has a stable `<a id>` anchor. Citations link
  to `#ref-N`. Inline equation images are transcribed as text. Figure positions are marked
  with a link to the HTML page that shows them. The front matter names the source export.
- **Interactive synthesis (`.html`)** — a single self-contained file: open it directly in a
  browser, with no network needed. The theme can be Auto, Light or Dark. It has two views:
  - **Interactive** (`#/interactive`) — explorable panels, charts and simulators rebuilt from
    the report and from widget snapshots the export flattened to images.
  - **Source notes** (`#/notes`) — provenance, the reconstruction log, the embedded
    widget/figure snapshots with their transcriptions, flagged in-source variances, and the
    equation transcriptions.

  Panels quote report paragraphs and tables from a hidden excerpt store. That store is
  generated in the same pass as the Markdown, with the same anchor ids, so quoted text matches
  the report exactly. "Read in verbatim report ↗" links and the header's **Verbatim report ↗**
  open the `.md` at the matching anchor.

Panels marked *reconstruction* are rebuilt from flattened widget snapshots. Panels marked
*illustrative* act out a mechanism the report describes, using sample content that is not in
the source. Each page's Source notes say which is which.

## Focused technical study

The same pair format, for a narrower engineering question:

| Topic | Interactive synthesis | Verbatim report |
| --- | --- | --- |
| Intuitive procedural architectural authoring: interaction grammars, geometric representations and reactive dependencies (the Tiny Glade lineage) | [`procedural-architectural-authoring-ux.html`](./procedural-architectural-authoring-ux.html) | [`procedural-architectural-authoring-ux.md`](./procedural-architectural-authoring-ux.md) |

Its source is a shared Gemini Deep Research page rather than a `.docx` export, so two things
differ. Equations stay as the page's LaTeX. Citations are the source cards Gemini shows for each
passage (`[Sn]`), because the page's citation numbers cannot be resolved to URLs. The front
matter and the page's Source notes record both. The Source notes also carry dated
verification notes: country-slice checked against its source, the roof formulas rechecked and
the performance figures classed. They correct the page's explanatory material and leave the
verbatim report untouched.

## Cross-domain synthesis

- **Research 6:** [`biskiq-integrated-product-synthesis.md`](./biskiq-integrated-product-synthesis.md) — integrated product direction, reviewed creator journeys, cross-domain revision principles, capability seams, and UX/architecture handoffs. This **Markdown-only editorially reconciled synthesis** is research input, not a ratified product contract. No interactive companion is added by this PR; the five domain-study HTML companions remain available above.
- **Research 6 unified reconciliation:** [`research-6-unified-reconciliation.md`](./research-6-unified-reconciliation.md) — one reconciled judgment on Research 6 across three independent reviews (PRs #151, #152 and #153): verified implementation gaps, creator priorities, rejected mechanisms, experiments and owner decisions. Research input for owner review, not a contract, roadmap change or authorization.

## After P01

- **Coordinated roadmaps:** [`post-p01-roadmaps/`](./post-p01-roadmaps/README.md) — concurrent [engineering foundations](./post-p01-roadmaps/engineering-authorization-roadmap.md) and a [divergent creative program](./post-p01-roadmaps/prototype-roadmap.md): Interactive Presentation Studio, Adaptive Spatial Composition, Vertical Pavilion and an early semantic agent proof. One disposition ledger joins owner direction, Research 6 evidence and production boundaries; live registers retain operational state. For owner review; it registers, authorizes and ratifies nothing.
