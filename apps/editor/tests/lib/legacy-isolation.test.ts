/**
 * `legacy/` isolation boundary (PR #115 §3.3/§3.4, arch lane).
 *
 * The frozen Chopin museum in `legacy/chopin-museum/` is a separate project that
 * must be deletable in one step without affecting the product. The product
 * therefore may not import, alias or reference it — through a module specifier,
 * a relative path or a quoted configuration path.
 *
 * The check is comment-aware: prose such as "legacy/manual hit fixtures" is not a
 * reference. Only module specifiers that resolve into `legacy/` and quoted paths
 * that name it count. The test never reads the folder, so it passes unchanged
 * once the folder is deleted.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseModuleSpecifiers, stripComments } from '../helpers/import-closure';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const LEGACY_DIR = path.join(REPO_ROOT, 'legacy');
const PRODUCT_ROOTS = [path.join(REPO_ROOT, 'apps'), path.join(REPO_ROOT, 'packages')];
const SKIP_DIRS = new Set(['node_modules', '.svelte-kit', '.vercel', '.git']);
const EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs', '.svelte', '.css', '.json', '.html'];

/** Every product source/config file, skipping build output and dependencies. */
function walk(root: string): string[] {
	const files: string[] = [];
	const pending = [root];
	while (pending.length > 0) {
		const entry = pending.pop()!;
		let stat: ReturnType<typeof statSync>;
		try {
			stat = statSync(entry);
		} catch {
			continue;
		}
		if (stat.isDirectory()) {
			for (const child of readdirSync(entry)) {
				if (SKIP_DIRS.has(child)) continue;
				pending.push(path.join(entry, child));
			}
		} else if (stat.isFile() && EXTENSIONS.some((extension) => entry.endsWith(extension))) {
			files.push(entry);
		}
	}
	return files;
}

function stripQuery(specifier: string): string {
	const query = specifier.indexOf('?');
	return query === -1 ? specifier : specifier.slice(0, query);
}

/** The reason `file` references `legacy/`, or null when it is clean. */
function legacyReference(file: string): string | null {
	const source = readFileSync(file, 'utf8');
	for (const specifier of parseModuleSpecifiers(source)) {
		if (specifier === 'legacy' || specifier.startsWith('legacy/')) return `import ${specifier}`;
		if (specifier.startsWith('.')) {
			const resolved = path.resolve(path.dirname(file), stripQuery(specifier));
			if (resolved === LEGACY_DIR || resolved.startsWith(`${LEGACY_DIR}${path.sep}`)) {
				return `import ${specifier}`;
			}
		}
	}
	const code = stripComments(source);
	// A quoted path that actually names something under `legacy/` (not the bare
	// directory token the guard itself necessarily mentions).
	if (/['"`](\.\.?\/)*legacy\/[A-Za-z0-9._-]/.test(code)) return 'quoted legacy path';
	return null;
}

describe('legacy/ isolation', () => {
	// A whole-tree scan: its cost is the size of the repository and the number of files
	// this lane is transforming at the same time, not the behaviour of any product path,
	// so it states its own budget instead of inheriting the default that fits a unit test.
	it('is referenced by no product file', { timeout: 120_000 }, () => {
		const offenders: string[] = [];
		for (const file of PRODUCT_ROOTS.flatMap((root) => walk(root))) {
			const reason = legacyReference(file);
			if (reason) offenders.push(`${path.relative(REPO_ROOT, file)} → ${reason}`);
		}
		expect(offenders).toEqual([]);
	});

	it('is outside the workspace globs', () => {
		const rootPackage = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
		for (const pattern of rootPackage.workspaces as string[]) {
			expect(pattern.startsWith('legacy')).toBe(false);
		}
	});
});
