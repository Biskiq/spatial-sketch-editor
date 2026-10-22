// Cold-process entry (bundled by cold-compile.mjs). One fresh Node process per
// run: parse + validate the Layout JSON, then the FIRST canonical compile (JIT
// cold), the second, a tenth, and the first Plan evaluation.
import { readFileSync } from 'node:fs';
import {
	compileWallFirstLayoutGeometry,
	evaluateLayoutPlan,
	parseWallFirstLayoutDocumentJson,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

const json = readFileSync(process.argv[2]!, 'utf8');
const t = () => performance.now();
let s = t();
const parsed = parseWallFirstLayoutDocumentJson(json);
const parseMs = t() - s;
if (!parsed.success) throw new Error('fixture does not parse');
const doc = parsed.document as LayoutDocumentWallFirst;
s = t();
const first = compileWallFirstLayoutGeometry(doc);
const compile1 = t() - s;
s = t();
compileWallFirstLayoutGeometry(doc);
const compile2 = t() - s;
for (let i = 0; i < 7; i++) compileWallFirstLayoutGeometry(doc);
s = t();
compileWallFirstLayoutGeometry(doc);
const compile10 = t() - s;
s = t();
evaluateLayoutPlan(first.geometry!, { cutHeightMeters: 1.2, depthMeters: 100, lateralSpanHalfWidthMeters: null, sourceKindFilter: null, reveal: [] }, { generationId: 'g', target: [0, 0], datumMeters: 0 });
const plan1 = t() - s;
console.log(JSON.stringify({ parseMs, compile1, compile2, compile10, plan1, sinceProcessStartMs: performance.now() }));
