/** Same harness and fixtures, isolated processes, pinned baseline; no browser. */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, cpus, totalmem, loadavg } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const baselineSha = '764175e0e8db12e09a580a3e818b9420dfe50ca5';
const scratch = mkdtempSync(join(tmpdir(), 'biskiq-s06-compare-'));
const baseline = join(scratch, 'baseline'); mkdirSync(baseline);
const archive = execFileSync('git', ['archive', baselineSha, 'packages', 'apps/editor/src'], { cwd: root, maxBuffer: 100 * 1024 * 1024 });
const unpacked = spawnSync('tar', ['-x', '-C', baseline], { input: archive });
if (unpacked.status !== 0) throw new Error(String(unpacked.stderr));
const patch = (file, update) => {
 const path = join(baseline, file), source = update(readFileSync(path, 'utf8'));
 // Fail before running ANY measurement if an instrumentation-only patch does
 // not parse. Replacement text containing $' must use a callback, not JS's
 // special replacement-string substitution.
 transformSync(source, { loader: 'ts', sourcefile: file });
 writeFileSync(path, source);
};
// Instrument hidden baseline work without altering its algorithms or outputs.
patch('packages/layout-core/src/layout-world-index.ts', (s) => s
 .replace(/baseline\.(junctions|walls|objects|openings)\.slice\(\)/g, (_, field) => `(countWork('audit:source-array-slot-copy', baseline.${field}.length), baseline.${field}.slice())`)
 .replaceAll('prev.walks.slice()', "(countWork('audit:walk-summary-slot-copy', prev.walks.length), prev.walks.slice())")
 .replaceAll('new Map(prev.', 'countedMap(prev.') + `\nfunction countedMap<K,V>(map: ReadonlyMap<K,V>): Map<K,V> { countWork('audit:map-entry-copy', map.size); return new Map(map); }\n`);
patch('packages/layout-core/src/layout-bvh.ts', (s) => {
 s = s.replace('const stack = new Int32Array', "countWork('audit:bvh-scratch-bytes', 4 * Math.max(16, state.nodeCount));\n\tconst stack = new Int32Array")
  .replace('clone(): DynamicBvh {\n\t\t\treturn bindBvh({', "clone(): DynamicBvh {\n\t\t\tcountWork('audit:bvh-buffer-bytes-copied', Object.values(state).reduce((sum, value) => sum + (ArrayBuffer.isView(value) ? value.byteLength : 0), 0));\n\t\t\tcountWork('audit:bvh-irregular-slots-copied', state.irregularList.length);\n\t\t\treturn bindBvh({");
 const at = s.indexOf('overlaps(query: PlanBox, options?: BvhQueryOptions): number[] {');
 const prefix = s.slice(0, at)
  .replace('const entry = state.childLinks[lStart + i]!;', "countWork('audit:index-maintenance-child-test'); const entry = state.childLinks[lStart + i]!;")
  .replace('const child = state.childLinks[cStart + i]!;', "countWork('audit:index-maintenance-child-test'); const child = state.childLinks[cStart + i]!;");
 const query = s.slice(at)
  .replace('const considerEntry = (entry: number): void => {', "const considerEntry = (entry: number): void => { countWork('index:entry-test');")
  .replace('let nodeVisits = 1;', "let nodeVisits = 1; countWork('index:node-test');")
  .replace('const child = state.childLinks[cStart + i]!;', "countWork('index:node-test'); const child = state.childLinks[cStart + i]!;")
  .replace('found.sort((a, b) => a - b);', "found.sort((a, b) => { countWork('index:sort-compare'); return a - b; });")
  .replace('return found;', "countWork('index:result-record', found.length); return found;")
  .replace('for (let i = 0; i < state.irregularList.length; i += 1) {', "countWork('index:irregular-test', state.irregularList.length); for (let i = 0; i < state.irregularList.length; i += 1) {");
 return prefix + query;
});
patch('packages/layout-core/src/layout-geometry-delta.ts', (s) => s.replace('const result: CompiledLayoutGeometryResult = {', `countWorkForAudit(totalPoints + totalSpans + totalPolygons + totalAabbs, rooms.length + floorRoomIds.length + world.sortedWalls.length + world.objectUnit.compiledObjects.length + world.sortedJunctions.length);\n\tconst result: CompiledLayoutGeometryResult = {`) + `\nimport { countWork as auditCount } from './p2311-perf';\nfunction countWorkForAudit(queries: number, arrays: number): void { auditCount('audit:query-record-slot-copy', queries); auditCount('audit:compiled-array-slot-copy', arrays); }\n`);
patch('packages/project-model/src/f4/immutable.ts', (s) => s
 .replace('freezeF4Data(structuredClone(input))', 'freezeF4Data(structuredClone(input), true)')
 .replace('freezeF4Data<T>(input: T)', 'freezeF4Data<T>(input: T, capture = false)')
 .replace('for (const value of Object.values(input)) freezeF4Data(value);', "const values = Object.values(input); countWork('f4:freeze-property-slots', values.length); if (capture) { countWork('f4:clone-object'); countWork('f4:clone-property-slots', values.length); } for (const value of values) freezeF4Data(value, capture);"));
patch('packages/project-model/src/package-sha.ts', (s) => s.replace("countWork('digest:bytes', bytes.byteLength);", "countWork('digest:bytes', bytes.byteLength); countWork('digest:buffer-bytes-copied', 2 * bytes.byteLength);"));
patch('packages/project-model/src/units/validate.ts', (s) => s.replace("return JSON.stringify(envelope, null, 2) + '\\n';", "const json = JSON.stringify(envelope, null, 2) + '\\n'; countWork('envelope:serialized-utf16', json.length); return json;"));
patch('apps/editor/src/lib/render/wall-geometry-adapter.ts', (s) => "import { countWork } from '@portfolio/layout-core';\n" + s.replace("const geometry = new BufferGeometry();", "countWork('render:mesh-buffer-input-bytes', mesh.positions.byteLength + mesh.normals.byteLength + mesh.uvs.byteLength + mesh.indices.byteLength); countWork('render:adapter-buffer-bytes-copied', mesh.positions.byteLength + mesh.normals.byteLength + mesh.uvs.byteLength); const geometry = new BufferGeometry();"));
patch('packages/layout-core/src/layout-wall-first-codec.ts', (s) => "import { countWork } from './p2311-perf';\n" + s
 .replace("const parsed = parseDocument(input, '$', issues);", () => "countWork('validation:layout-document'); const parsed = parseDocument(input, '$', issues);")
 .replace('const values = input.map((value, index) => parser(value, `${path}[${index}]`, issues));', "const values = input.map((value, index) => { countWork('validation:layout-array-entry'); return parser(value, `${path}[${index}]`, issues); });")
 .replace('for (const key of Object.keys(record)) {', "for (const key of Object.keys(record)) { countWork('validation:layout-field-key');")
 .replace('for (const [index, value] of values.entries()) {', "for (const [index, value] of values.entries()) { countWork('validation:layout-unique-id-entry');"));
patch('packages/layout-core/src/layout-plan-box-index.ts', (s) => "import { countWork } from './p2311-perf';\n" + s
 .replace('const consider = (index: number): void => {', "const consider = (index: number): void => { countWork('grid:entry-reference');")
 .replace('stamp[index] = generation;', "stamp[index] = generation; countWork('grid:entry-test');")
 .replace('const list = cells.get(cellKey(cellX, cellZ));', "countWork('grid:cell-test'); const list = cells.get(cellKey(cellX, cellZ));"));
const args = process.argv.slice(2), outputAt = args.indexOf('--output');
const output = outputAt < 0 ? join(root, 'apps/editor/perf/.results/persistent-comparison.json') : resolve(args[outputAt + 1]);
let points = args.includes('--smoke') ? [{ rooms: 10, steps: 8, mode: 'local', render: true }, { rooms: 10, steps: 6, mode: 'accept', render: true }] : [
 { rooms: 10, steps: 40, mode: 'local', render: true }, { rooms: 100, steps: 24, mode: 'local', render: true },
 { rooms: 1000, steps: 24, mode: 'local', render: false }, { rooms: 7143, steps: 12, mode: 'local', render: false },
 { rooms: 31250, steps: 12, mode: 'local', render: false, shape: 'freestanding' },
 { rooms: 10, steps: 8, mode: 'accept', render: true }, { rooms: 100, steps: 8, mode: 'accept', render: true },
 { rooms: 10, steps: 110, mode: 'history', render: false }
];
if (args.includes('--spatial')) points = [{ rooms: 100_000, steps: 2048, mode: 'spatial', render: false }];
const onlyAt = args.indexOf('--only');
if (onlyAt >= 0) points = points.filter((point) => `${point.mode}:${point.rooms}` === args[onlyAt + 1]);
if (points.length === 0) throw new Error('empty comparison selection');
const changedFiles = [...new Set(execFileSync('git', ['ls-files', '--modified', '--others', '--exclude-standard', '-z', '--', 'packages', 'apps/editor/src', 'apps/editor/perf/regressions'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))].sort();
const codeHash = createHash('sha256');
for (const file of changedFiles) codeHash.update(file + '\0').update(readFileSync(join(root, file))).update('\0');
const manifest = {
 changedFiles, changedFilesSha256: codeHash.digest('hex'),
 head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
 codeDiff: execFileSync('git', ['diff', '--stat', '--', 'packages', 'apps/editor/src'], { cwd: root, encoding: 'utf8' }),
 note: 'working-tree label includes local production edits; count and allocation sampling windows excluded from timing'
};
const results = [];
try {
 for (const [name, source] of [['764175e0', baseline], ['working-tree', root]]) {
  const config = join(scratch, `${name}.config.mts`);
  const aliases = [
   { find: '@portfolio/layout-core', replacement: `${source}/packages/layout-core/src/index.ts` },
   { find: '@portfolio/camera-core', replacement: `${source}/packages/camera-core/src/index.ts` },
   { find: '@portfolio/project-model/units', replacement: `${source}/packages/project-model/src/units/index.ts` },
   { find: '@portfolio/project-model/f4/unit-acceptance', replacement: `${source}/packages/project-model/src/f4/unit-acceptance.ts` },
   { find: '@portfolio/project-model/references/unit-resolution', replacement: `${source}/packages/project-model/src/references/unit-resolution.ts` },
   { find: '@portfolio/project-model', replacement: `${source}/packages/project-model/src/index.ts` },
   { find: '$lib', replacement: `${source}/apps/editor/src/lib` }
  ];
  writeFileSync(config, `export default { resolve: { alias: ${JSON.stringify(aliases)} }, server: { fs: { allow: [${JSON.stringify(root)}, ${JSON.stringify(scratch)}] } } };\n`);
  // Packages resolve third-party dependencies through the repository's runtime.
  // A directory symlink is local to this disposable archive, never a worktree.
  execFileSync('ln', ['-s', join(root, 'node_modules'), join(baseline, 'node_modules')]);
  for (let i = 0; i < points.length; i += 1) {
   const point = points[i], resultPath = join(scratch, `${name}-${i}.json`), sourcePath = `${resultPath}.source.json`, coldPath = `${resultPath}.cold.json`;
   process.stderr.write(`${name}: ${point.mode}, ${point.rooms} Rooms, render=${point.render}\n`);
   const child = spawnSync(process.execPath, ['--expose-gc', join(root, 'node_modules/vite-node/vite-node.mjs'), '--config', config, join(root, `apps/editor/perf/regressions/${point.mode === 'spatial' ? 'persistent-spatial-comparison' : 'persistent-comparison'}.ts`)], {
    cwd: join(root, 'apps/editor'), env: { ...process.env, S06_ROOMS: String(point.rooms), S06_STEPS: String(point.steps), S06_MODE: point.mode, S06_RENDER: point.render ? '1' : '0', S06_RESULT: resultPath, S06_SOURCE_FILE: sourcePath, S06_SHAPE: point.shape ?? 'rooms', S06_ALLOCATIONS: args.includes('--allocations') ? '1' : '0' }, timeout: 180_000, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024
   });
   if (child.status === 0) {
    const measured = JSON.parse(readFileSync(resultPath, 'utf8'));
    if (point.mode !== 'spatial') {
     const cold = spawnSync(process.execPath, [join(root, 'node_modules/vite-node/vite-node.mjs'), '--config', config, join(root, 'apps/editor/perf/regressions/persistent-cold-oracle.ts')], {
      cwd: join(root, 'apps/editor'), env: { ...process.env, S06_SOURCE_FILE: sourcePath, S06_COLD_RESULT: coldPath }, timeout: 180_000, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024
     });
     measured.coldOracle = cold.status === 0 ? { state: 'equal', ...JSON.parse(readFileSync(coldPath, 'utf8')) } : { state: 'failed', signal: cold.signal, status: cold.status, log: `${cold.stdout}\n${cold.stderr}`.slice(-3000) };
     if (measured.coldOracle.state === 'equal' && measured.coldOracle.oracleDigest !== measured.oracleDigest) measured.coldOracle.state = 'mismatch';
    }
    results.push({ revision: name, ...measured });
   }
   else { const log = `${child.stdout}\n${child.stderr}`; results.push({ revision: name, ...point, failed: true, status: child.status, signal: child.signal, error: child.error?.message, log: log.length <= 6000 ? log : log.slice(0, 2000) + '\n…\n' + log.slice(-4000) }); }
   mkdirSync(dirname(output), { recursive: true });
   writeFileSync(output, JSON.stringify({ baselineSha, manifest, platform: process.platform, architecture: process.arch, node: process.version, cpu: cpus()[0]?.model, totalMemoryBytes: totalmem(), loadAverageAtWrite: loadavg(), baselineInstrumentation: 'copy/test/output counts only; source algorithms unchanged', results }, null, 2) + '\n');
  }
  // Only the baseline needs the third-party lookup link; do not create it twice.
  if (name === '764175e0') rmSync(join(baseline, 'node_modules'));
 }
} finally { rmSync(scratch, { recursive: true, force: true }); }
process.stderr.write(`Saved ${output}\n`);
const comparisons = [];
for (const point of points) {
 const pair = results.filter((result) => result.mode === point.mode && (result.fixtureSeedRooms ?? result.rooms) === point.rooms && !result.failed);
 const keys = point.mode === 'spatial' ? [] : point.mode === 'local' ? ['oracleDigest'] : ['oracleDigest', 'sourceContentId', 'canonicalJsonSha256'];
 const mismatches = pair.length === 2 ? keys.filter((key) => pair[0][key] === undefined || pair[0][key] !== pair[1][key]) : [];
 comparisons.push({ mode: point.mode, fixtureSeedRooms: point.rooms, state: pair.length !== 2 ? 'unavailable' : keys.length === 0 ? 'per-policy oracle only' : mismatches.length ? 'mismatch' : 'equal', fields: keys, mismatches });
}
const report = JSON.parse(readFileSync(output, 'utf8'));
writeFileSync(output, JSON.stringify({ ...report, crossRevisionComparisons: comparisons }, null, 2) + '\n');
if (comparisons.some((comparison) => comparison.state === 'mismatch') || results.some((result) => result.coldOracle?.state !== undefined && result.coldOracle.state !== 'equal')) throw new Error('cold or cross-revision oracle failed; see recorded comparisons');
