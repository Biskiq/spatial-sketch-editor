import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const editorRoot = resolve(scriptDir, '..');
const visitorDir = join(editorRoot, 'src', 'lib', 'visitor');
const routeDir = join(editorRoot, 'src', 'routes', 'p');
const routeFile = join(routeDir, '[publicationId]', '+page.svelte');
const viteConfig = join(editorRoot, 'vite.config.ts');

function listFiles(dir) {
	const entries = readdirSync(dir);
	const files = [];
	for (const entry of entries) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) files.push(...listFiles(full));
		else files.push(full);
	}
	return files;
}

// Static pre-build guard (fast grep). The authoritative gate is the Vite
// `public-surface-boundary` plugin, which walks the resolved module graph
// (no regex) during `vite build`. This script fails fast on obvious leaks
// and verifies the route root + plugin wiring. A source-only check of the
// inner surface is insufficient — the plugin covers ancestor layouts,
// dynamic imports and shared chunks via the transitive closure walk.
// `$lib/authoring/` is the live editor tree; the token this replaced named the
// deleted `$lib/editor/` and could never match a real import again.
const FORBIDDEN = [
	'$lib/authoring/',
	'MuseumScene.svelte',
	'MuseumHUD.svelte',
	'MuseumCanvas.svelte',
	'Workspace3DView',
	'EditorSceneEntities',
	'chopin-project',
	'chopin-room-presentation',
	'content/rooms',
	'chopin-layout',
	'state/runtime-state',
	'museum/navigation/CameraDirector',
	'museum/MuseumEntities',
	'paris-activation',
	'museum/rooms/',
	'museum/layout/LayoutMuseumShell',
	'project/project-codec',
	'project-export-store',
	'binary-texture-store'
];

try {
	readFileSync(routeFile, 'utf8');
} catch {
	console.error(`public surface gate: missing root ${routeFile}`);
	process.exit(1);
}

const configSource = readFileSync(viteConfig, 'utf8');
if (!configSource.includes('public-surface-boundary')) {
	console.error('public surface gate: public-surface-boundary plugin not registered in vite.config.ts');
	process.exit(1);
}

const files = [...listFiles(visitorDir).filter((file) => file.includes('public-release-client')), ...listFiles(routeDir)];
const violations = [];
for (const file of files) {
	if (file.endsWith('preview-surface-boundary.ts')) continue;
	const source = readFileSync(file, 'utf8');
	for (const token of FORBIDDEN) {
		if (source.includes(token)) violations.push(`${file}: contains forbidden '${token}'`);
	}
}

if (violations.length > 0) {
	console.error(`public surface gate: public closure reaches forbidden modules:\n${violations.join('\n')}`);
	process.exit(1);
}

console.log(`public surface ok: ${files.length} public files, route + plugin wired, no static leaks`);
