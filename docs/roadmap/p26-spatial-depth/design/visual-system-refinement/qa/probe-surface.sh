#!/usr/bin/env bash
# Reports which renderer material each wall wears as the representation changes, so the drafting
# surface can be compared across wall kinds and across 2D/3D. Prints the material key from
# Stage.mat, the displacement state and the camera's squared-ness.
#
# Usage: probe-surface.sh <url-base> [label]
set -e
cd "$(dirname "$0")"
BASE="${1:?usage: probe-surface.sh <url-base> [label]}"
LABEL="${2:-revised}"
export AGENT_BROWSER_SESSION="p26surf-$LABEL"
U="$BASE/index.html?shot=1&motion=instant"
js() { agent-browser eval "$1" >/dev/null; }

STATE=$(cat <<'JS'
(() => {
  const st = __me.ctx.stage, keys = Object.keys(st.mat);
  const which = (id) => {
    const it = st.items.get(id);
    if (!it || !it.mesh) return 'none';
    return keys.find((k) => st.mat[k] === it.mesh.material) || 'unknown';
  };
  const ids = ['north', 'gwin', 'rotunda'];
  const out = {};
  for (const id of ids) out[id] = { mat: which(id), sheet: !!st.d(id).sheet, u: +st.d(id).u.toFixed(2), mode: st.d(id).mode };
  return JSON.stringify(out);
})()
JS
)
KIND=$(cat <<'JS'
(() => {
  const st = __me.ctx.stage, s = __me.S.session;
  return JSON.stringify({
    session: s?.kind || null, subject: s?.wallId || null, u: s?.u ?? null,
    flat: +st.cam.flat.toFixed(2), paper: +st.paper.toFixed(2),
  });
})()
JS
)
show() { echo "  [$1] $(agent-browser eval "$KIND")"; agent-browser eval "$STATE" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("   ", json.dumps(d))'; }

agent-browser open "$U" >/dev/null; sleep 2.2
echo "1. as loaded (3D)"
show "3D home"

echo "2. straight wall settled square (face + square up)"
js "__me.A.select('north'); 1"; js "__me.A.face('north'); 1"; sleep 1.6
js "__me.A.squareUp(); 1"; sleep 1.4
show "north settled"

echo "3. rotunda settled square (unroll + square up)"
js "__me.A.closeSession(); 1"; sleep 1.0
js "__me.A.select('rotunda'); 1"; js "__me.A.unfold(); 1"; sleep 2.2
js "__me.A.squareUp(); 1"; sleep 1.4
show "rotunda settled"

echo "4. rotunda back to round, still faced (curvature slider at 0)"
js "__me.A.unrollTo(0); 1"; sleep 1.6
show "rotunda u=0"

echo "5. rotunda settled, then the view tilted off square (still 3D-inside-the-session)"
js "(() => { const st = __me.ctx.stage; st.cam.el = 0.45; st.cam.az += 0.3; return 1; })()"; sleep 1.6
show "rotunda tilted"

echo "6. every wall in the model, settled square in turn"
js "__me.A.closeSession(); 1"; sleep 1.2
WALLS=$(agent-browser eval "JSON.stringify(__me.ctx.museum.walls.map((w) => w.id))" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); d=json.loads(d) if isinstance(d,str) else d; print(" ".join(d))')
for id in $WALLS; do
  js "__me.A.select('$id'); 1"; js "__me.A.face('$id'); 1"; sleep 1.5
  js "__me.A.squareUp(); 1"; sleep 1.2
  R=$(agent-browser eval "(() => { const st = __me.ctx.stage, keys = Object.keys(st.mat); const it = st.items.get('$id'); const m = it && it.mesh ? keys.find((k) => st.mat[k] === it.mesh.material) : 'none'; return JSON.stringify({ wall: '$id', mat: m, sheet: !!st.d('$id').sheet, flat: +st.cam.flat.toFixed(2) }); })()")
  echo "  [$id settled] $R"
done
js "__me.A.closeSession(); 1"; sleep 1.4
