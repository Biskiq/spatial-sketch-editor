#!/usr/bin/env python3
"""Builds qa/compare.html: a labeled baseline | revised comparison of every matched specimen.

Matched specimens are those whose filenames exist in both the baseline and the revised folder at
the same viewport, which is how the capture scripts guarantee identical camera/fixture settings.

    python3 make-compare.py
"""
import html
import os

HERE = os.path.dirname(os.path.abspath(__file__))
VIEWPORTS = ["1440x900", "1280x800", "1280x800-dpr2-renderer"]
LABELS = {
    "v01-plan-north": "V1 · Plan, North wall selected",
    "v02-3d-gwin": "V2 · 3D overview, Garden window selected",
    "v03-face-flat-gwin": "V3 · Garden window facing, fully unrolled",
    "v04a-peel-inside": "V4a · Partly peeled, inside",
    "v04b-peel-outside": "V4b · Partly peeled, outside",
    "v05-section-depth": "V5 · Section with depth (view-only displacement)",
    "v06a-lift-clearance": "V6a · Lifted ceiling, clearance caution",
    "v06b-lookup": "V6b · Looking up",
    "v07-dense-dims": "V7 · Dense dimensions",
    "v08a-drag-active": "V8a · Handle drag in progress",
    "v08b-drag-released": "V8b · After release",
    "v09-invalid-entry": "V9 · Numeric entry, invalid input",
    "v10a-set-aside": "V10a · Set aside",
    "v10b-reveal": "V10b · Shown through",
    "v11-states": "V11 · Focus, armed, selected, disabled",
    "v12a-return-mid": "V12a · Return mid-flight (ordinary motion)",
    "v12b-return-endpoint": "V12b · Return endpoint",
    "d01-plan-north": "DPR2 · Plan, North wall selected (2× backing store)",
    "d02-dense-dims": "DPR2 · Dense dimensions (2× backing store)",
}

rows = []
for vp in VIEWPORTS:
    names = sorted(os.listdir(os.path.join(HERE, "baseline", vp))) if os.path.isdir(os.path.join(HERE, "baseline", vp)) else []
    for n in names:
        base = f"baseline/{vp}/{n}"
        rev = f"revised/{vp}/{n}"
        if not os.path.exists(os.path.join(HERE, rev)):
            continue
        key = n[:-4]
        label = LABELS.get(key, key)
        rows.append(f"""  <section>
    <h3>{html.escape(label)} <small>{html.escape(vp)} · DPR 1 CSS px</small></h3>
    <div class="pair">
      <figure><figcaption>baseline</figcaption><img src="{base}" alt="baseline {key}"></figure>
      <figure><figcaption>revised</figcaption><img src="{rev}" alt="revised {key}"></figure>
    </div>
  </section>""")

doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>P26 visual-system refinement — matched specimens</title>
<style>
  body {{ margin: 0; background: #1b1f1e; color: #e8ecea; font: 14px/1.4 system-ui, sans-serif; }}
  header {{ padding: 18px 22px; border-bottom: 1px solid #38403d; }}
  h1 {{ font-size: 18px; margin: 0 0 4px; }}
  p.note {{ margin: 4px 0 0; color: #9aa5a0; }}
  section {{ padding: 16px 22px 24px; border-bottom: 1px solid #2a312f; }}
  h3 {{ font-size: 14px; margin: 0 0 10px; letter-spacing: .02em; }}
  h3 small {{ color: #8b9691; font-weight: 400; margin-left: 8px; }}
  .pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }}
  figure {{ margin: 0; }}
  figcaption {{ font: 600 10px/1 ui-monospace, monospace; text-transform: uppercase; color: #8b9691; margin-bottom: 5px; }}
  img {{ width: 100%; display: block; border: 1px solid #38403d; }}
</style></head>
<body>
<header>
  <h1>P26 continuous spatial workspace — visual-system refinement</h1>
  <p class="note">Matched specimens: identical fixture, camera, viewport and motion mode. Baseline is
  the prototype at the pre-implementation revision; revised is the implementation. Dimensions are
  recorded in the folder names rather than by resizing images.</p>
</header>
{chr(10).join(rows)}
</body></html>
"""

with open(os.path.join(HERE, "compare.html"), "w") as f:
    f.write(doc)
print(f"compare.html: {len(rows)} matched specimens")
