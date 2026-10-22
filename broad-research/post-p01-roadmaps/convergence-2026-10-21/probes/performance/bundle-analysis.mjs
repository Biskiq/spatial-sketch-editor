#!/usr/bin/env node
// Disposable delivery-baseline probe (convergence 2026-10-21, performance packet).
//
// Reads an already-built SvelteKit client + server output (default:
// apps/editor/.svelte-kit/output) and reports, per product route:
//   - the client JS/CSS files a cold navigation loads (start + app entry imports,
//     root layout/error nodes and the route's leaf node imports from the server
//     node table — SvelteKit modulepreloads exactly that set),
//   - raw / gzip(9) / brotli(11) sizes via node:zlib,
//   - when `*.js.map` files are present (build with `npx vite build --sourcemap`),
//     byte attribution to source packages by decoding each chunk's mappings and
//     charging every generated-code span to the source of its segment.
// It never builds, never writes into the repo and needs no dependency beyond
// `@jridgewell/sourcemap-codec`, already present transitively in node_modules.
//
// Usage (from the repo root):
//   node broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/performance/bundle-analysis.mjs \
//     [--out <dir>] [--json <file>]
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { gzipSync, brotliCompressSync, constants as zc } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../../..');
const require = createRequire(join(repo, 'package.json'));
const { decode } = require('@jridgewell/sourcemap-codec');

const args = process.argv.slice(2);
const opt = (name, def) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : def;
};
const outDir = resolve(opt('--out', join(repo, 'apps/editor/.svelte-kit/output')));
const jsonOut = opt('--json', null);
const client = join(outDir, 'client');
const server = join(outDir, 'server');

const ROUTES = ['/', '/editor', '/projects', '/project/[projectId]/spatial', '/p/[publicationId]', '/dev/assets', '/dev/materials'];

// ---- route -> node table (server manifest) ----
const manifestSrc = readFileSync(join(server, 'manifest.js'), 'utf8');
const clientBlock = /client: \{start:"([^"]+)",app:"([^"]+)",imports:\[([^\]]*)\]/.exec(manifestSrc);
const entryImports = [...new Set(clientBlock[3].split(',').map((s) => s.replace(/"/g, '').trim()).filter(Boolean))];
const routeRe = /id: "([^"]+)",[\s\S]*?page: \{ layouts: \[([^\]]*)\], errors: \[([^\]]*)\], leaf: (\d+) \}/g;
const routeNodes = new Map();
for (let m; (m = routeRe.exec(manifestSrc)); ) {
	const nums = (s) => s.split(',').map((x) => x.trim()).filter(Boolean).map(Number);
	routeNodes.set(m[1], { layouts: nums(m[2]), errors: nums(m[3]), leaf: Number(m[4]) });
}
function nodeFiles(n) {
	const src = readFileSync(join(server, 'nodes', `${n}.js`), 'utf8');
	const imp = /imports = \[([^\]]*)\]/.exec(src);
	const css = /stylesheets = \[([^\]]*)\]/.exec(src);
	const list = (m) => (m ? m[1].split(',').map((s) => s.replace(/"/g, '').trim()).filter(Boolean) : []);
	return [...list(imp), ...list(css)];
}

// ---- sizes ----
const sizeCache = new Map();
function sizeOf(rel) {
	if (sizeCache.has(rel)) return sizeCache.get(rel);
	let buf = readFileSync(join(client, rel));
	// Strip a trailing sourceMappingURL comment so a --sourcemap build measures shipped bytes.
	const s = buf.toString('utf8').replace(/\n?\/\/# sourceMappingURL=[^\n]*\s*$/, '');
	buf = Buffer.from(s, 'utf8');
	const r = {
		raw: buf.length,
		gzip: gzipSync(buf, { level: 9 }).length,
		br: brotliCompressSync(buf, { params: { [zc.BROTLI_PARAM_QUALITY]: 11, [zc.BROTLI_PARAM_SIZE_HINT]: buf.length } }).length
	};
	sizeCache.set(rel, r);
	return r;
}

// ---- attribution ----
function bucket(src) {
	const s = src.replace(/\\/g, '/');
	let m;
	if ((m = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(s))) {
		const pkg = m[1];
		if (pkg === 'three') return /examples\/jsm/.test(s) ? 'three/examples(addons)' : 'three(core)';
		return pkg;
	}
	if ((m = /packages\/(layout-core|project-model|camera-core)\//.exec(s))) return `@portfolio/${m[1]}`;
	if ((m = /src\/lib\/([^/]+)(?:\/([^/]+))?/.exec(s))) {
		const top = m[1];
		if (['authoring', 'museum', 'visitor', 'project', 'editor'].includes(top) && m[2] && !m[2].includes('.'))
			return `editor:lib/${top}/${m[2]}`;
		return `editor:lib/${top}`;
	}
	if (/src\/routes\//.test(s)) return 'editor:routes';
	if (/\.svelte-kit\/generated/.test(s)) return 'sveltekit(generated)';
	return 'other:' + s.split('/').slice(-2).join('/');
}

const attrCache = new Map();
function attribute(rel) {
	if (attrCache.has(rel)) return attrCache.get(rel);
	const mapPath = join(client, rel + '.map');
	if (!rel.endsWith('.js') || !existsSync(mapPath)) {
		attrCache.set(rel, null);
		return null;
	}
	const code = readFileSync(join(client, rel), 'utf8').replace(/\n?\/\/# sourceMappingURL=[^\n]*\s*$/, '');
	const map = JSON.parse(readFileSync(mapPath, 'utf8'));
	const lines = code.split('\n');
	const decoded = decode(map.mappings);
	const bySource = new Map(); // source path -> bytes
	const textBySource = new Map(); // source path -> generated code spans (for per-package compression)
	const add = (k, n, text) => {
		bySource.set(k, (bySource.get(k) ?? 0) + n);
		if (!textBySource.has(k)) textBySource.set(k, []);
		textBySource.get(k).push(text);
	};
	for (let li = 0; li < lines.length; li++) {
		const line = lines[li];
		const segs = decoded[li] ?? [];
		let prevCol = 0;
		let prevSrc = null;
		for (const seg of segs) {
			const col = seg[0];
			const text = line.slice(prevCol, col);
			add(prevSrc ?? '(unmapped)', Buffer.byteLength(text), text);
			prevCol = col;
			prevSrc = seg.length >= 4 ? map.sources[seg[1]] : null;
		}
		const tail = line.slice(prevCol) + '\n';
		add(prevSrc ?? '(unmapped)', Buffer.byteLength(tail), tail);
	}
	const result = new Map([...bySource].map(([k, n]) => [k, { n, text: textBySource.get(k).join('') }]));
	attrCache.set(rel, result);
	return result;
}

const fmt = (n) => (n / 1024).toFixed(1);
const report = { outDir, routes: {}, chunks: {} };
const allFiles = new Set();

for (const route of ROUTES) {
	const nodes = routeNodes.get(route);
	if (!nodes) continue;
	const files = new Set([clientBlock[1], clientBlock[2], ...entryImports]);
	for (const n of [...nodes.layouts, ...nodes.errors, nodes.leaf]) for (const f of nodeFiles(n)) files.add(f);
	const list = [...files].filter((f) => existsSync(join(client, f)));
	const tot = { raw: 0, gzip: 0, br: 0 };
	const js = { raw: 0, gzip: 0, br: 0 };
	const pkg = new Map();
	const pkgText = new Map();
	const modules = new Set();
	let attributed = true;
	for (const f of list) {
		allFiles.add(f);
		const s = sizeOf(f);
		for (const k of Object.keys(tot)) tot[k] += s[k];
		if (f.endsWith('.js')) for (const k of Object.keys(js)) js[k] += s[k];
		const a = attribute(f);
		if (f.endsWith('.js') && !a) attributed = false;
		if (a)
			for (const [src, { n, text }] of a) {
				const b = src === '(unmapped)' ? '(unmapped)' : bucket(src);
				pkg.set(b, (pkg.get(b) ?? 0) + n);
				pkgText.set(b, (pkgText.get(b) ?? '') + text);
				if (src !== '(unmapped)') modules.add(src.replace(/^(\.\.\/)+/, ''));
			}
	}
	report.routes[route] = {
		leafNode: nodes.leaf,
		files: list,
		total: tot,
		js,
		attributed,
		packages: Object.fromEntries(
			[...pkg]
				.sort((a, b) => b[1] - a[1])
				.map(([k, raw]) => {
					const buf = Buffer.from(pkgText.get(k) ?? '', 'utf8');
					// Standalone brotli of this package's spans: an upper-bound-ish estimate of its
					// share (cross-package context in a real chunk compresses slightly better).
					return [k, { raw, brStandalone: brotliCompressSync(buf, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } }).length }];
				})
		),
		modules: [...modules].sort()
	};
}
for (const f of allFiles) report.chunks[f] = sizeOf(f);

// Unreferenced emitted assets (in the client tree but in no route's load set and not a map).
const emitted = [];
const walk = (d) => {
	for (const e of readdirSync(d)) {
		const p = join(d, e);
		if (statSync(p).isDirectory()) walk(p);
		else emitted.push(p.slice(client.length + 1));
	}
};
walk(join(client, '_app/immutable'));
report.notInAnyRouteLoadSet = emitted
	.filter((f) => !f.endsWith('.map') && !allFiles.has(f))
	.map((f) => ({ file: f, raw: statSync(join(client, f)).size }));

// ---- text report ----
const out = [];
out.push(`client output: ${client}`);
for (const [route, r] of Object.entries(report.routes)) {
	out.push(`\n## ${route} (leaf node ${r.leafNode}) — ${r.files.length} files`);
	out.push(`  total  raw ${fmt(r.total.raw)} KiB | gzip ${fmt(r.total.gzip)} KiB | br ${fmt(r.total.br)} KiB`);
	out.push(`  js     raw ${fmt(r.js.raw)} KiB | gzip ${fmt(r.js.gzip)} KiB | br ${fmt(r.js.br)} KiB`);
	if (r.attributed) {
		out.push('  bytes by source package (KiB; br* = standalone brotli-11 of that package\'s generated spans):');
		out.push(`    ${'package'.padEnd(44)} ${'raw'.padStart(8)} ${'br*'.padStart(8)}`);
		for (const [k, v] of Object.entries(r.packages)) if (v.raw > 512) out.push(`    ${k.padEnd(44)} ${fmt(v.raw).padStart(8)} ${fmt(v.brStandalone).padStart(8)}`);
	} else out.push('  (no sourcemaps: package attribution unavailable)');
}
out.push('\n## emitted but in no product/dev route load set');
for (const e of report.notInAnyRouteLoadSet) out.push(`  ${e.file}  ${fmt(e.raw)} KiB`);
console.log(out.join('\n'));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 1));
