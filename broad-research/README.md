# Broad research

Research input for future design work. **Not** a product contract or routed authority —
`docs/README.md` and the `docs/reference/` contracts govern product truth.

Each topic is a pair of files:

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
