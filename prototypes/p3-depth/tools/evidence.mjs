// Writes the measured corpus to evidence.json and prints the markdown table.
//
// Timings are best-of-five after one warm-up build. A single cold evaluation moves by
// several milliseconds with the JIT and with whatever else the machine is doing; the
// claim this table supports is "every case is a sub-frame rebuild", so it should not
// wobble between runs.
import { writeFileSync } from 'node:fs';
import { ROOF_CASES, WALK_CASES, runCorpus } from '../src/core/corpus.js';
import { buildRoofs } from '../src/core/roof.js';
import { buildWalk } from '../src/core/walk.js';

const REPS = 5;
const best = (fn) => {
  let ms = Infinity;
  for (let i = 0; i < REPS; i++) {
    const t = performance.now();
    fn();
    ms = Math.min(ms, performance.now() - t);
  }
  return ms;
};

for (const c of ROOF_CASES) buildRoofs([].concat(c.spec)); // warm-up
for (const c of WALK_CASES) buildWalk(c.spec);

const r = runCorpus();
const time = new Map();
for (const c of ROOF_CASES) time.set(c.id, best(() => buildRoofs([].concat(c.spec))));
for (const c of WALK_CASES) time.set(c.id, best(() => buildWalk(c.spec)));

const rows = [...r.roof.map((x) => ({ ...x, kind: 'roof' })), ...r.walk.map((x) => ({ ...x, kind: 'walk' }))]
  .map((x) => ({ ...x, ms: time.get(x.id) }));

const f = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);

console.log('| fixture | kind | status | ms | derived |');
console.log('| --- | --- | --- | --- | --- |');
for (const x of rows) {
  const derived = x.kind === 'roof'
    ? `${x.cells} cells, ${f(x.valley, 1)} m valley`
    : `${x.treads} treads, ${f(x.rail, 1)} m rail`;
  console.log(`| ${x.name} | ${x.kind} | ${x.status}${x.reason ? ` (${x.reason})` : ''} | ${f(x.ms)} | ${derived} |`);
}

const roofMs = rows.filter((x) => x.kind === 'roof').map((x) => x.ms).sort((a, b) => a - b);
const median = roofMs.length % 2
  ? roofMs[(roofMs.length - 1) / 2]
  : (roofMs[roofMs.length / 2 - 1] + roofMs[roofMs.length / 2]) / 2;
const summary = {
  ordinaryBuilt: `${r.roof.filter((x) => x.group !== 'control').length}/${r.roof.filter((x) => x.group !== 'control').length}`,
  roofBuilt: `${r.roof.filter((x) => x.status === 'built').length}/${r.roof.length}`,
  refusals: r.roof.filter((x) => x.status === 'refused').length,
  walksBuilt: `${r.walk.filter((x) => x.status === 'built').length}/${r.walk.length}`,
  medianMs: median,
  maxMs: roofMs[roofMs.length - 1],
  reps: REPS,
};
console.log('\nsummary', JSON.stringify(summary));

writeFileSync(
  new URL('../evidence.json', import.meta.url),
  `${JSON.stringify({ generated: new Date().toISOString(), method: `best of ${REPS} after warm-up`, summary, rows }, null, 2)}\n`,
);
