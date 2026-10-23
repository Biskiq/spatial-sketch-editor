#!/usr/bin/env node
/**
 * Delivery bundle report (T3.P03.S02).
 *
 * Promoted from the convergence packet's disposable probe
 * (`broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/performance/bundle-analysis.mjs`,
 * recorded run 2026-10-22) into the editor workspace's on-demand harness. It
 * reads an already-built SvelteKit client + server output and reports, per
 * product route:
 *
 *   - the client JS/CSS files a cold navigation loads (SvelteKit's modulepreload
 *     set: start + app entry imports + root layout/error nodes + leaf imports),
 *   - raw / gzip(9) / brotli(11) sizes,
 *   - package attribution when sourcemaps are present,
 *   - the source modules reachable from that route's load set.
 *
 * Explicit assertions:
 *   --forbid <route>=<substring>   fail when a file OR source module in the
 *                                  route's first-load set contains the substring
 *                                  (repeatable). This is the lazy-chunk absence
 *                                  check T3.P02.S01 needs for Preview, and the
 *                                  editor-module-in-visitor-set refusal.
 *
 * --forbid requires usable maps for every JS file, OR explicitly selected
 * --provenance <client/bundle-provenance.json> from BUNDLE_PROVENANCE=1 npm run build.
 * Provenance proves Rollup module membership, never source-map byte attribution.
 * Invalid provenance fails closed even if maps are complete. Evidence is a trusted
 * build artifact with an integrity digest, not a signature against deliberate forgery.
 * --forbid-file <route>=<substring> checks only emitted file names (no maps).
 *
 * It never builds, never writes into the repository and needs no dependency
 * beyond `@jridgewell/sourcemap-codec` (already present transitively).
 *
 * Usage (from the repo root, after `npm run build`, or `vite build --sourcemap`
 * for attribution):
 *   node apps/editor/perf/bundle-report.mjs [--out <dir>] [--json <file>]
 *     [--forbid "/p/[publicationId]=src/lib/authoring/"] [...]
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { gzipSync, brotliCompressSync, constants as zc } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readProvenance } from './bundle-provenance.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const editor = resolve(here, '..');
const repo = resolve(editor, '../..');
const require = createRequire(join(repo, 'package.json'));
const { decode } = require('@jridgewell/sourcemap-codec');

const args = process.argv.slice(2);
const opt = (name, def) => {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : def;
};
const optAll = (name) => {
	const values = [];
	for (let index = 0; index < args.length; index++) if (args[index] === name) values.push(args[index + 1]);
	return values;
};
const outDir = resolve(opt('--out', join(editor, '.svelte-kit/output')));
const jsonOut = opt('--json', null);
const forbidden = [...optAll('--forbid').map((entry) => ({ entry, filesOnly: false })),
	...optAll('--forbid-file').map((entry) => ({ entry, filesOnly: true }))].map(({ entry, filesOnly }) => {
	const separator = entry.indexOf('=');
	if (separator <= 0) {
		console.error(`--forbid needs <route>=<substring>, got: ${entry}`);
		process.exit(2);
	}
	return { route: entry.slice(0, separator), substring: entry.slice(separator + 1), filesOnly };
});
const client = join(outDir, 'client');
const server = join(outDir, 'server');

const ROUTES = ['/', '/editor', '/projects', '/project/[projectId]/spatial', '/p/[publicationId]', '/dev/assets', '/dev/materials'];

// Explicit selection prevents silently upgrading incomplete maps to module evidence.
// Reject an empty/missing value even if usable maps would otherwise let the
// report complete, so selecting provenance can never silently fall back.
const provenanceOptionIndex = args.findIndex((arg) => arg === '--provenance' || arg.startsWith('--provenance='));
const provenanceOption = provenanceOptionIndex < 0 ? null : args[provenanceOptionIndex];
const provenanceValue = provenanceOption === null
	? null
	: provenanceOption.startsWith('--provenance=')
		? provenanceOption.slice('--provenance='.length)
		: args[provenanceOptionIndex + 1];
const missingProvenanceValue = provenanceOption !== null && (
	typeof provenanceValue !== 'string' ||
	provenanceValue.trim() === '' ||
	(provenanceOption === '--provenance' && provenanceValue.startsWith('--'))
);
if (missingProvenanceValue) {
	console.error('--provenance requires a non-empty path');
	process.exit(2);
}
const provenancePath = provenanceOption === null ? null : provenanceValue;
let provenance = null;
let provenanceError = null;
if (provenancePath) {
	try { provenance = readProvenance(resolve(provenancePath), client); }
	catch (error) {
		provenanceError = error.message;
		console.error(`PROVENANCE UNAVAILABLE: ${provenanceError}`);
	}
}

// ---- route -> node table (server manifest) ----
const manifestSrc = readFileSync(join(server, 'manifest.js'), 'utf8');
const clientBlock = /client: \{start:"([^"]+)",app:"([^"]+)",imports:\[([^\]]*)\]/.exec(manifestSrc);
const entryImports = [...new Set(clientBlock[3].split(',').map((s) => s.replace(/"/g, '').trim()).filter(Boolean))];
const routeRe = /id: "([^"]+)",[\s\S]*?page: \{ layouts: \[([^\]]*)\], errors: \[([^\]]*)\], leaf: (\d+) \}/g;
const routeNodes = new Map();
for (let match; (match = routeRe.exec(manifestSrc)); ) {
	const numbers = (s) =>
		s
			.split(',')
			.map((x) => x.trim())
			.filter(Boolean)
			.map(Number);
	routeNodes.set(match[1], { layouts: numbers(match[2]), errors: numbers(match[3]), leaf: Number(match[4]) });
}
function nodeFiles(node) {
	const source = readFileSync(join(server, 'nodes', `${node}.js`), 'utf8');
	const imports = /imports = \[([^\]]*)\]/.exec(source);
	const css = /stylesheets = \[([^\]]*)\]/.exec(source);
	const list = (match) => (match ? match[1].split(',').map((s) => s.replace(/"/g, '').trim()).filter(Boolean) : []);
	return [...list(imports), ...list(css)];
}

// ---- sizes ----
const sizeCache = new Map();
function sizeOf(relative) {
	if (sizeCache.has(relative)) return sizeCache.get(relative);
	let buffer = readFileSync(join(client, relative));
	// Strip a trailing sourceMappingURL comment so a --sourcemap build measures shipped bytes.
	const text = buffer.toString('utf8').replace(/\n?\/\/# sourceMappingURL=[^\n]*\s*$/, '');
	buffer = Buffer.from(text, 'utf8');
	const result = {
		raw: buffer.length,
		gzip: gzipSync(buffer, { level: 9 }).length,
		br: brotliCompressSync(buffer, { params: { [zc.BROTLI_PARAM_QUALITY]: 11, [zc.BROTLI_PARAM_SIZE_HINT]: buffer.length } }).length
	};
	sizeCache.set(relative, result);
	return result;
}

// ---- attribution ----
function bucket(source) {
	const s = source.replace(/\\/g, '/');
	let match;
	if ((match = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(s))) {
		const pkg = match[1];
		if (pkg === 'three') return /examples\/jsm/.test(s) ? 'three/examples(addons)' : 'three(core)';
		return pkg;
	}
	if ((match = /packages\/(layout-core|project-model|camera-core)\//.exec(s))) return `@portfolio/${match[1]}`;
	if ((match = /src\/lib\/([^/]+)(?:\/([^/]+))?/.exec(s))) {
		const top = match[1];
		if (['authoring', 'museum', 'visitor', 'project', 'editor'].includes(top) && match[2] && !match[2].includes('.'))
			return `editor:lib/${top}/${match[2]}`;
		return `editor:lib/${top}`;
	}
	if (/src\/routes\//.test(s)) return 'editor:routes';
	if (/\.svelte-kit\/generated/.test(s)) return 'sveltekit(generated)';
	return 'other:' + s.split('/').slice(-2).join('/');
}

const attrCache = new Map();
function attribute(relative) {
	if (attrCache.has(relative)) return attrCache.get(relative);
	const mapPath = join(client, relative + '.map');
	if (!relative.endsWith('.js') || !existsSync(mapPath)) {
		attrCache.set(relative, null);
		return null;
	}
	const code = readFileSync(join(client, relative), 'utf8').replace(/\n?\/\/# sourceMappingURL=[^\n]*\s*$/, '');
	const map = JSON.parse(readFileSync(mapPath, 'utf8'));
	const lines = code.split('\n');
	const decoded = decode(map.mappings);
	const bySource = new Map();
	const textBySource = new Map();
	const add = (key, count, text) => {
		bySource.set(key, (bySource.get(key) ?? 0) + count);
		if (!textBySource.has(key)) textBySource.set(key, []);
		textBySource.get(key).push(text);
	};
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		const segments = decoded[lineIndex] ?? [];
		let previousColumn = 0;
		let previousSource = null;
		for (const segment of segments) {
			const column = segment[0];
			const text = line.slice(previousColumn, column);
			add(previousSource ?? '(unmapped)', Buffer.byteLength(text), text);
			previousColumn = column;
			previousSource = segment.length >= 4 ? map.sources[segment[1]] : null;
		}
		const tail = line.slice(previousColumn) + '\n';
		add(previousSource ?? '(unmapped)', Buffer.byteLength(tail), tail);
	}
	const result = new Map([...bySource].map(([key, count]) => [key, { n: count, text: textBySource.get(key).join('') }]));
	attrCache.set(relative, result);
	return result;
}

const format = (n) => (n / 1024).toFixed(1);
const report = { outDir, moduleEvidence: provenancePath ? { kind: 'rollup-module-identity', path: resolve(provenancePath), error: provenanceError } : { kind: 'source-map' }, routes: {}, chunks: {}, forbidden: [] };
const allFiles = new Set();

for (const route of ROUTES) {
	const nodes = routeNodes.get(route);
	if (!nodes) continue;
	const files = new Set([clientBlock[1], clientBlock[2], ...entryImports]);
	for (const node of [...nodes.layouts, ...nodes.errors, nodes.leaf]) for (const file of nodeFiles(node)) files.add(file);
	const list = [...files].filter((file) => existsSync(join(client, file)));
	const total = { raw: 0, gzip: 0, br: 0 };
	const js = { raw: 0, gzip: 0, br: 0 };
	const packages = new Map();
	const packageText = new Map();
	const modules = new Set();
	const mappedModules = new Set();
	// A missing emitted JS file cannot provide source-absence evidence either.
	const jsFiles = [...files].filter((file) => file.endsWith('.js'));
	let attributed = jsFiles.length > 0 && jsFiles.every((file) => existsSync(join(client, file)));
	for (const file of list) {
		allFiles.add(file);
		const size = sizeOf(file);
		for (const key of Object.keys(total)) total[key] += size[key];
		if (file.endsWith('.js')) for (const key of Object.keys(js)) js[key] += size[key];
		const attribution = attribute(file);
		if (file.endsWith('.js') && (!attribution || ![...attribution.keys()].some((source) => source !== '(unmapped)'))) attributed = false;
		if (attribution)
			for (const [source, { n, text }] of attribution) {
				const bucketName = source === '(unmapped)' ? '(unmapped)' : bucket(source);
				packages.set(bucketName, (packages.get(bucketName) ?? 0) + n);
				packageText.set(bucketName, (packageText.get(bucketName) ?? '') + text);
				if (source !== '(unmapped)') mappedModules.add(source.replace(/^(\.\.\/)+/, ''));
			}
	}
	const moduleAttributed = provenancePath
		? Boolean(provenance && jsFiles.length && jsFiles.every((file) => provenance.get(file)?.length))
		: attributed;
	for (const source of provenancePath ? jsFiles.flatMap((file) => provenance?.get(file) ?? []) : mappedModules) modules.add(source);

	report.routes[route] = {
		leafNode: nodes.leaf,
		files: list,
		total,
		js,
		attributed,
		moduleAttributed,
		packages: Object.fromEntries(
			[...packages]
				.sort((a, b) => b[1] - a[1])
				.map(([key, raw]) => {
					const buffer = Buffer.from(packageText.get(key) ?? '', 'utf8');
					return [key, { raw, brStandalone: brotliCompressSync(buffer, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } }).length }];
				})
		),
		modules: [...modules].sort()
	};
}
for (const file of allFiles) report.chunks[file] = sizeOf(file);

// ---- absence / isolation assertions ----
for (const rule of forbidden) {
	const route = report.routes[rule.route];
	if (route === undefined) {
		console.error(`forbid: no route "${rule.route}" in the build output`);
		process.exit(2);
	}
	const hits = [
		...route.files.filter((file) => file.includes(rule.substring)).map((file) => `file ${file}`),
		...(rule.filesOnly ? [] : route.modules).filter((module) => module.includes(rule.substring)).map((module) => `module ${module}`)
	];
	const unavailable = !rule.filesOnly && !route.moduleAttributed;
	report.forbidden.push({ ...rule, hits, unavailable });
	if (unavailable) {
		console.error(`SOURCE ATTRIBUTION UNAVAILABLE for ${rule.route}: ${provenancePath ? provenanceError ?? 'missing module identities in route JS' : '--forbid requires usable maps for every JS file; use an opt-in BUNDLE_PROVENANCE=1 build with --provenance <client/bundle-provenance.json> for Rollup module identity, or --forbid-file for names only'}`);
	}
	if (hits.length > 0) {
		console.error(`\nFORBIDDEN LOAD-SET ENTRY on ${rule.route} matching "${rule.substring}":`);
		for (const hit of hits) console.error(`  ${hit}`);
	}
}

// ---- text report ----
const out = [];
out.push(`client output: ${client}`);
out.push(`module identity evidence: ${report.moduleEvidence.kind}${provenanceError ? ` (unavailable: ${provenanceError})` : ''}`);
for (const [route, routeReport] of Object.entries(report.routes)) {
	out.push(`\n## ${route} (leaf node ${routeReport.leafNode}) — ${routeReport.files.length} files`);
	out.push(`  total  raw ${format(routeReport.total.raw)} KiB | gzip ${format(routeReport.total.gzip)} KiB | br ${format(routeReport.total.br)} KiB`);
	out.push(`  js     raw ${format(routeReport.js.raw)} KiB | gzip ${format(routeReport.js.gzip)} KiB | br ${format(routeReport.js.br)} KiB`);
	if (routeReport.attributed) {
		out.push('  bytes by source package (KiB; br* = standalone brotli-11 of that package\'s generated spans):');
		out.push(`    ${'package'.padEnd(44)} ${'raw'.padStart(8)} ${'br*'.padStart(8)}`);
		for (const [key, value] of Object.entries(routeReport.packages))
			if (value.raw > 512) out.push(`    ${key.padEnd(44)} ${format(value.raw).padStart(8)} ${format(value.brStandalone).padStart(8)}`);
	} else out.push('  (incomplete/absent sourcemaps: package byte attribution unavailable)');
}
out.push('\n## emitted but in no product/dev route load set');
const emitted = [];
const walk = (directory) => {
	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) walk(path);
		else emitted.push(path.slice(client.length + 1));
	}
};
walk(join(client, '_app/immutable'));
for (const entry of emitted.filter((file) => !file.endsWith('.map') && !allFiles.has(file)))
	out.push(`  ${entry}  ${format(statSync(join(client, entry)).size)} KiB`);
console.log(out.join('\n'));

if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 1));
if (provenanceError || report.forbidden.some((entry) => entry.hits.length > 0 || entry.unavailable)) process.exit(1);
