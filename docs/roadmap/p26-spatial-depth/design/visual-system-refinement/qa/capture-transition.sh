#!/usr/bin/env bash
# Stills of the same rotate-in-a-face-session (the move that repaints the ground), taken at the same
# points of the same move in any build, so the transition can be looked at instead of argued about.
#
# The pan is played live first, recording the camera pose and the paper value each frame; the
# landmarks are then replayed from those recorded values, held by patching stage.render. Nothing is
# invented: every still is a frame the build actually produced at that timestamp.
#
# Usage: capture-transition.sh <url-base> <label>
set -e
cd "$(dirname "$0")"
BASE="${1:?usage: capture-transition.sh <url-base> <label>}"
LABEL="${2:?usage: capture-transition.sh <url-base> <label>}"
W=1440
H=900
OUT="$(pwd)/transition/$LABEL"
mkdir -p "$OUT"
export AGENT_BROWSER_SESSION="p26trans-$LABEL"
U="$BASE/index.html?shot=1&motion=teach"
TMPS="${TMPDIR:-/tmp}"

jsr() { agent-browser eval "$1"; }

RECJS="$TMPS/p26-transition-record.js"
cat > "$RECJS" <<'JS'
(async () => {
  const A = __me.A, S = __me.S, st = __me.ctx.stage;
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  S.motion = 'teach';
  await A.go3D();
  await A.face('rotunda');
  await A.unrollTo(1);
  await A.squareUp();
  await new Promise((r) => setTimeout(r, 900));
  // the reference speed control, not the pan: a deliberate rotate away from the square home, the
  // same angular rate as a slow drag (~55 deg/s)
  const az0 = st.cam.az;
  const rec = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 1700) {
    const t = performance.now() - t0;
    st.cam.az = az0 + (55 * Math.PI / 180) * (t / 1000);
    const s = st.camState();
    rec.push({ t: Math.round(t), paper: +st.paper.toFixed(4), cam: { target: [s.target.x, s.target.y, s.target.z], az: s.az, el: s.el, frameH: s.frameH, flat: s.flat, mirror: s.mirror } });
    await raf();
  }
  window.__rec = rec;
  return JSON.stringify(rec.filter((r, i) => i % 12 === 0).map((r) => r.t + ':' + r.paper));
})()
JS

HOLDJS="$TMPS/p26-transition-hold.js"
cat > "$HOLDJS" <<'JS'
(() => {
  const A = __me.A, S = __me.S, st = __me.ctx.stage;
  const i = __I__;
  const r = window.__rec[i];
  const c = r.cam;
  st.cam.target.set(c.target[0], c.target[1], c.target[2]);
  st.cam.az = c.az; st.cam.el = c.el; st.cam.frameH = c.frameH; st.cam.flat = c.flat; st.cam.mirror = c.mirror;
  if (!st._origRender) st._origRender = st.render.bind(st);
  const orig = st._origRender;
  const held = r.paper;
  st.render = (inset) => { st.paper = held; orig(inset); };
  return JSON.stringify({ t: r.t, paper: r.paper, held, index: i, of: window.__rec.length });
})()
JS

agent-browser set viewport "$W" "$H" >/dev/null
agent-browser open "$U" >/dev/null
sleep 2.6
echo "recorded (ms:paper): $(jsr "$(cat "$RECJS")")"
N="$(jsr "window.__rec.length")"
N="${N//\"/}"
echo "frames: $N"
for MS in 300 700 1100 1500; do
  IDX="$(python3 -c "
import json
rec = json.load(open('$TMPS/p26-transition-index.json')) if False else None
print(0)")"
  IDX="$(jsr "(() => { const r = window.__rec; let best = 0; for (let i = 0; i < r.length; i++) if (Math.abs(r[i].t - $MS) < Math.abs(r[best].t - $MS)) best = i; return best; })()")"
  IDX="${IDX//\"/}"
  R="$(jsr "$(sed "s/__I__/$IDX/" "$HOLDJS")")"
  echo "  ms=$MS idx=$IDX $R"
  agent-browser screenshot "$OUT/pan-${MS}ms.png" >/dev/null
done
echo "done: transition/$LABEL"
