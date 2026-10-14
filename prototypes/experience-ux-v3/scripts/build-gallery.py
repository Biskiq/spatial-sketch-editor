#!/usr/bin/env python3
"""Build a local image index; no image transformation or runtime code."""
from pathlib import Path
from html import escape
import hashlib
import json
import struct

root = Path(__file__).resolve().parents[1]
states = [
    ('01-workspace-start', 'Start with one encounter', '1440 × 900 · empty Experience'),
    ('02-presentation-3d', 'Available Views', '1440 × 900 · Presentation / 3D'),
    ('03-view-plan', 'Inspect a View without moving', '1440 × 900 · View / Plan'),
    ('04-look-through-3d', 'Look through, then return', '1440 × 900 · explicit inspection'),
    ('05-guide-overview-3d', 'Arrange encounters', '1440 × 900 · Guide overview'),
    ('06-stop-plan', 'Curate this occurrence', '1440 × 900 · Stop-local Views / Plan'),
    ('07-reorder-guide', 'Reorder where the order lives', '1440 × 900 · direct drag / context actions'),
    ('08-movement-path-plan', 'Shape the movement', '1440 × 900 · Travel / Plan'),
    ('09-playback-3d', 'Observe the timing', '1440 × 900 · compact player / rig'),
    ('10-follow-camera-3d', 'Follow the result', '1440 × 900 · Camera following'),
    ('11-visitor-entry', 'Choose a visit', '1440 × 900 · guided / free entry'),
    ('12-visitor-guided', 'Follow the curated encounter', '1440 × 900 · guided visitor'),
    ('13-visitor-explore', 'See what catches your eye', '1440 × 900 · free visitor'),
    ('14-narrow-stop', 'Curate at a narrower width', '1024 × 768 · locator rail / Stop Card'),
    ('15-narrow-movement', 'Keep the spatial instrument usable', '768 × 900 · single support sheet'),
]
cards = '\n'.join(
    f'<article><a href="boards/{name}.png"><img src="boards/{name}.png" '
    f'alt="Experience V3 proposed board: {escape(title)}" loading="lazy"></a>'
    f'<div class="caption"><span>{name[:2]}</span><div><h2>{escape(title)}</h2>'
    f'<p>{escape(detail)}</p></div><a href="boards/{name}.png">Open full size ↗</a></div></article>'
    for name, title, detail in states
)
html = '''<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Experience V3 — design gallery</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#102e26;color:#eff6ef;font-family:'Avenir Next',system-ui,sans-serif}
header{max-width:1460px;margin:auto;padding:48px 32px 28px;border-bottom:1px solid #446552}
.eyebrow{font-size:11px;letter-spacing:.08em;color:#e6b85c}h1{font-size:38px;line-height:1.12;letter-spacing:-1px;margin:12px 0}
header p{font-size:14px;line-height:1.6;color:#c4d8ca;max-width:800px}a{color:#e6b85c;text-decoration:none}nav{display:flex;gap:24px;font-size:13px;margin-top:22px}
main{max-width:1460px;margin:auto;padding:28px 32px 48px;display:grid;grid-template-columns:1fr 1fr;gap:28px 22px}
article{border:1px solid #446552;border-radius:8px;overflow:hidden;background:#163d32}article img{display:block;width:100%;height:auto;background:#153a2e}
.caption{display:flex;align-items:flex-start;gap:12px;padding:16px}.caption>span{font-size:13px;color:#e6b85c}.caption h2{font-size:15px;margin:0 0 4px}.caption p{font-size:11px;color:#bed4c5;margin:0}.caption>a{font-size:11px;margin-left:auto;white-space:nowrap}
footer{max-width:1460px;margin:auto;padding:0 32px 40px;font-size:12px;color:#c4d8ca}
@media(max-width:900px){main{grid-template-columns:1fr;padding:20px}header{padding:30px 20px}h1{font-size:30px}nav{flex-wrap:wrap}}
</style></head><body><header><div class="eyebrow">MUSEUM EDITOR · EXPERIENCE V3 · PROPOSED 2026-10-13</div>
<h1>Compose the visit.</h1><p>One museum, reusable Presentations, locally curated Stops, and movement you can inspect where it happens.
These 15 PNGs are generated design specimens awaiting owner ratification. They are not screenshots of implemented application behavior.</p>
<nav><a href="design/README.md">Product proposal ↗</a><a href="README.md">Board acceptance notes ↗</a><a href="design/implementation-plan.md">Superseding plan ↗</a></nav></header><main>'''
html += cards + '</main><footer>Written product and visual rules govern semantics. Geometry, lighting and incidental pixels are illustrative. Historical V2 boards and runtime captures remain preserved.</footer></body></html>'
(root / 'gallery.html').write_text(html)
manifest = {'kind': 'generated-design-specimens', 'status': 'proposed-for-ratification',
            'inspectedRuntimeHead': 'de41341e82f4a745abe85537c59a217c160c60f3',
            'sourceSha256': {name: hashlib.sha256((root/name).read_bytes()).hexdigest()
                             for name in ['boards.html', 'specimens.js', 'specimens.css']},
            'boards': []}
for name, title, detail in states:
    data = (root/'boards'/f'{name}.png').read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n': raise ValueError(f'Not PNG: {name}')
    width, height = struct.unpack('>II', data[16:24])
    manifest['boards'].append({'id': name, 'title': title, 'width': width, 'height': height,
                               'sha256': hashlib.sha256(data).hexdigest()})
(root/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(f'Gallery: {len(states)} boards')
