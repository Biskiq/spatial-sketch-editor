/**
 * Shared `$lib` / route source reader for architecture-boundary suites.
 *
 * Boundary tests legitimately read production *source* (import direction,
 * unique-owner sweeps, code-path absences, token ownership). Each such suite
 * used to carry its own private copy of the same five helpers; this module is
 * the single owner, so a new boundary suite imports instead of duplicating.
 *
 * Roots are derived from this file's own location (never `process.cwd()`), so
 * every consumer resolves the same tree regardless of the mirrored `tests/lib`
 * depth it lives at.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** `apps/editor/src/lib` — the editor package's `$lib`. */
export const LIB_DIR = fileURLToPath(new URL('../../src/lib', import.meta.url));
/** `apps/editor/src/routes` — the editor package's route tree. */
export const ROUTES_DIR = fileURLToPath(new URL('../../src/routes', import.meta.url));
/** `apps/museum/src/routes` — the visitor package's route tree. */
export const VISITOR_ROUTES_DIR = fileURLToPath(
	new URL('../../../museum/src/routes', import.meta.url)
);
/** `packages/camera-core/src` — the shared navigation/motion package. */
export const CAMERA_CORE_DIR = path.resolve(LIB_DIR, '../../../..', 'packages/camera-core/src');

/** Read one `$lib`-relative source file. */
export function readLibSource(relativePath: string): string {
	return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
}

/** Does a `$lib`-relative file exist? (code-path absence checks) */
export function existsLibSource(relativePath: string): boolean {
	return fs.existsSync(path.join(LIB_DIR, relativePath));
}

/** Read one editor-route source file. */
export function readRouteSource(relativePath: string): string {
	return fs.readFileSync(path.join(ROUTES_DIR, relativePath), 'utf8');
}

/** Read one `packages/camera-core/src` source file. */
export function readCameraCoreSource(relativePath: string): string {
	return fs.readFileSync(path.join(CAMERA_CORE_DIR, relativePath), 'utf8');
}

/**
 * Recursively read every `.ts`/`.svelte` source under an ABSOLUTE root.
 *
 * Unlike `readAllSourceFiles` this keeps each file's full path, which suites that
 * need a PER-FILE scope (binding recognisers, readable failure messages) depend
 * on — a basename is ambiguous across the `tests/lib/**` mirror and the source
 * tree it mirrors.
 */
export function readSourceTree(root: string): { path: string; source: string }[] {
	const sources: { path: string; source: string }[] = [];
	const stack = [root];
	while (stack.length > 0) {
		const entry = stack.pop()!;
		const stat = fs.statSync(entry);
		if (stat.isDirectory()) {
			for (const child of fs.readdirSync(entry)) {
				if (child.startsWith('.')) continue;
				stack.push(path.join(entry, child));
			}
		} else if (entry.endsWith('.ts') || entry.endsWith('.svelte')) {
			sources.push({ path: entry, source: fs.readFileSync(entry, 'utf8') });
		}
	}
	return sources;
}

/**
 * Recursively read every `.ts`/`.svelte` source under a `$lib` sub-directory,
 * for unique-ownership and forbidden-import sweeps.
 */
export function readAllSourceFiles(relativeDir: string): { name: string; source: string }[] {
	return readSourceTree(path.join(LIB_DIR, relativeDir)).map((file) => ({
		name: path.basename(file.path),
		source: file.source
	}));
}
