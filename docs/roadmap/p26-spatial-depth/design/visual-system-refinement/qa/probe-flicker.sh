#!/usr/bin/env bash
# Per-frame timeline of the moves that change the ground's identity, so the "flicker" can be
# attributed to a specific lever. Samples the stage canvas (no overlay) each frame through:
#   plan   a face session open on the laid-flat Rotunda, then Plan (the top-bar toggle)
#   3d     ...then back to 3D
#   pan    ...then a slow rotate away from the square home
# Reports, per sampled frame: the paper value the app asked for, the ground's mean luminance and
# the peak spatial banding in a patch of empty ground, plus how many frames the ground spends
# between "clearly mat" and "clearly paper" (its swap span, in ms).
#
# Usage: probe-flicker.sh <url-base> <label>
set -e
cd "$(dirname "$0")"
BASE="${1:?usage: probe-flicker.sh <url-base> <label>}"
LABEL="${2:-revised}"
export AGENT_BROWSER_SESSION="p26flick-$LABEL"
U="$BASE/index.html?shot=1&motion=teach"
js() { agent-browser eval "$1" >/dev/null; }
TMPS="${TMPDIR:-/tmp}"

JS="$TMPS/p26-flicker.js"
cat > "$JS" <<'JS'
(async () => {
  const A = __me.A, S = __me.S, st = __me.ctx.stage, src = document.getElementById('gl');
  const c2 = document.createElement('canvas');
  const g = c2.getContext('2d');
  const patch = () => {
    c2.width = src.width; c2.height = src.height;
    g.drawImage(src, 0, 0);
    const W = c2.width, H = c2.height;
    const x0 = Math.round(W * 0.02), x1 = Math.round(W * 0.26);
    const y0 = Math.round(H * 0.42), y1 = Math.round(H * 0.95);
    const lum = (R, G, B) => 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const rows = [];
    for (let y = y0; y < y1; y++) {
      const d = g.getImageData(x0, y, x1 - x0, 1).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += lum(d[i], d[i + 1], d[i + 2]);
      rows.push(s / (x1 - x0));
    }
    const n = rows.length;
    let sum = 0;
    for (const v of rows) sum += v;
    const mean = sum / n;
    const K = 7;
    let wide = 0, ns = 0, prev = null;
    for (let i = 0; i + K < n; i++) {
      let s = 0;
      for (let k = 0; k <= K; k++) s += rows[i + k];
      s /= K + 1;
      if (prev !== null) { wide += Math.abs(s - prev); ns++; }
      prev = s;
    }
    return { lum: +mean.toFixed(1), wide: +(wide / Math.max(1, ns)).toFixed(3) };
  };
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  // The museum crosses the sample patch as soon as the camera starts to descend, which would put a
  // wall's edge into the numbers. The question here is only what the GROUND does, so it is hidden.
  const hideMuseum = () => { st.root.visible = false; st.fx.visible = false; };

  // A face session, laid flat, squared up: the ground is paper and the camera is at its home.
  await A.go3D();
  await A.face('rotunda');
  await A.unrollTo(1);
  await A.squareUp();
  await new Promise((r) => setTimeout(r, 900));
  hideMuseum();

  const cap = async (label, trigger, frames) => {
    const out = [];
    hideMuseum();
    await raf();
    const done = trigger();
    for (let i = 0; i < frames; i++) {
      const m = patch();
      out.push({ t: i * 16.7, p: +st.paper.toFixed(3), el: +(st.cam.el * 180 / Math.PI).toFixed(1), lum: m.lum, wide: m.wide, sess: S.session ? S.session.kind : '-' });
      await raf();
    }
    await done;
    return { label, frames: out };
  };

  const runs = [];
  runs.push(await cap('plan', () => A.goPlan(), 90));
  await new Promise((r) => setTimeout(r, 700));
  runs.push(await cap('3d', () => A.go3D(), 90));
  await new Promise((r) => setTimeout(r, 700));
  // rebuild the session, then rotate away from home the way a drag does (~55 deg/s)
  await A.face('rotunda');
  await A.unrollTo(1);
  await A.squareUp();
  await new Promise((r) => setTimeout(r, 900));
  const az0 = st.cam.az, el0 = st.cam.el;
  const spin = (async () => { for (let i = 0; i < 90; i++) { st.cam.az = az0 + i * 0.016; await raf(); } })();
  runs.push(await cap('pan', () => spin, 90));
  return JSON.stringify(runs);
})()
JS

agent-browser open "$U" >/dev/null; sleep 2.6
echo "=== $LABEL ==="
agent-browser eval "$(cat "$JS")" | python3 -c '
import json, sys, os
s = json.loads(sys.stdin.read())
if isinstance(s, str): s = json.loads(s)
for run in s:
    fr = run["frames"]
    print("  %s" % run["label"])
    prev = None
    step = []
    for f in fr:
        step.append((f, None if prev is None else round(f["lum"] - prev["lum"], 1)))
        prev = f
    # the frames where the paper is neither clearly off nor clearly on
    mid = [f for f in fr if 0.02 < f["p"] < 0.98]
    span = len(mid) * 16.7
    # how much the ground moves in one frame while it is changing: median and 90th percentile are
    # the honest measures (one frame can always catch a one-off), max is printed for inspection
    moving = sorted(abs(d) for f, d in step if d is not None and 0.02 < f["p"] < 0.98)
    med = moving[len(moving) // 2] if moving else 0
    p90 = moving[int(len(moving) * 0.9)] if moving else 0
    mx = max((abs(d) for _, d in step if d is not None), default=0)
    print("     p %s -> %s   swap span %4.0f ms (%d frames between p 0.02 and 0.98)" % (fr[0]["p"], fr[-1]["p"], span, len(mid)))
    print("     lum %6.1f -> %6.1f   per-frame change while sweeping: median %5.1f  p90 %5.1f  max %5.1f" % (
        fr[0]["lum"], fr[-1]["lum"], med, p90, mx))
    print("     wide %5.3f -> %5.3f  peak %5.3f" % (fr[0]["wide"], fr[-1]["wide"], max(f["wide"] for f in fr)))
    shown = [f for f in fr if f["p"] != round(fr[0]["p"], 3)]
    if shown:
        print("     ground starts moving at frame %d (%.0f ms)" % (fr.index(shown[0]), fr.index(shown[0]) * 16.7))
    for f, d in step[:70]:
        if os.environ.get("FULL") == "1" or (d is not None and abs(d) > 0.8):
            print("       f%02d  p=%.3f el=%5.1f  lum=%6.1f (%s)  wide=%5.3f" % (
                fr.index(f), f["p"], f["el"], f["lum"], "     -" if d is None else "%+5.1f" % d, f["wide"]))
'
