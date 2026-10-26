# Living Drawings — a design package for Biskiq

An interaction model for natural yet precise original 3D creation inside an existing space.

> Draw where it goes. Pull it into being. Draw over it to change your mind.

## Contents

| File | What it is |
|---|---|
| `index.html` | The proposal: the model, how it differs, revision without loss, an honest account of what building it taught us, risks and a research plan. |
| `round-two.html` | Round two: how the same language becomes more expressive. Places (add, carve, go through), repetition by drawing along, exceptions kept as descriptions, the representation (no general boolean), alternatives weighed, findings, and where complexity stops paying. |
| `studio.html` | The interactive prototype (Three.js r170, loaded from jsDelivr; all app code inline). |
| `.claude/launch.json` | Local static server config used during development. |

## How to open

Either open `index.html` directly in a browser (`file://` works), or serve the folder:

```bash
python3 -m http.server 4317 --bind 127.0.0.1
```

then visit <http://127.0.0.1:4317/>. The studio needs an internet connection the first time, to fetch Three.js from the CDN.

Targets: desktop browsers (mouse or trackpad) and iPad (finger or pencil). Phones are out of scope.

## Deep links into the studio

- `studio.html#pedestal`: a pedestal for a sculpture (fit, pull, draw over, swap, move)
- `studio.html#bench`: a bench that follows the wall (seam trace, section, widen the room, tie the end)
- `studio.html#niche`: a niche and its frame (recess, frame, pointed arch, remove → slack)
- `studio.html#through`: a circle on a plinth's top, pushed into a hollow, then through (round two)
- `studio.html#arm`: an arm at one end of a bench that follows its end and seat (round two)
- `studio.html#front`: only the front of a pedestal, kept through later changes (round two)
- `studio.html#panelling`: a panelled room; draw along, only this one, widen, tie under the niche (round two)
- `studio.html#gallery`: the finished room

Each journey step has **Show me**, which drives the real drawing pipeline with a synthetic pen, and a line saying how to do it yourself.

## Studio controls

| | |
|---|---|
| V / D / E | Look · Draw · Edit the space |
| T | Tidy ↔ Loose |
| R or hold Alt | Relations view |
| Enter / Esc | Accept / discard a pending form |
| Digits while pulling | Exact height |
| ⌘Z / ⇧⌘Z | Undo / redo |
| Right-drag or two fingers | Orbit and zoom |
