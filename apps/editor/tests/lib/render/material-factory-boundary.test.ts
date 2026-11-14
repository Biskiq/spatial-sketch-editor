/**
 * E6/R2a — `material-factory-boundary`: one place constructs a world material.
 *
 * `renderer-refactor.md` §2.4 makes `MaterialStore.acquire(descriptor)` the only
 * construction site for a world surface, and the T2 direction forbids any slice
 * from building one outside the shared factory. No build, type check or lane
 * report can see a second `new MeshStandardMaterial(...)` — the renderer draws it
 * happily — so the guarantee lives here.
 *
 * Three rules, all exact:
 *
 * 1. **The store constructs; nobody else does.** A `Mesh*Material`,
 *    `ShadowMaterial` or `T.Mesh*Material` constructor outside the store must
 *    appear in the allowlist below.
 * 2. **The allowlist is exact and shrink-only.** It fails when a new site
 *    appears *and* when a listed site disappears without its entry being removed,
 *    so moving a surface into the store always deletes its allowance. The two
 *    groups are the remaining RR-7 sites (each with the E packet that retires it)
 *    and editor ink, which is not a world surface and stays outside the store by
 *    design (§2.4).
 * 3. **The check binds names, not spellings.** A constructor is found through the
 *    module's own import edges (`moduleBindingEdges`, the TypeScript-AST reader
 *    the compile boundary already uses), so an aliased import
 *    (`import { MeshBasicMaterial as Surface }`) and a caller-qualified namespace
 *    (`import * as THREE from 'three'; new THREE.MeshBasicMaterial(...)`) are the
 *    same site as the plain spelling. A rewrite that only changed the identifier
 *    would otherwise walk straight through a text pattern.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDITOR_SRC, listSourceFiles, moduleBindingEdges } from '../../helpers/import-closure';
import { withoutComments } from '../../helpers/render-boundary-scan';

/**
 * The exact remaining construction sites, by `apps/editor/src`-relative path.
 * Returns the count per file, so adding a second constructor to an allowlisted
 * file is a failure rather than a silent pass.
 */
const RR7_REMAINDER: Record<string, { count: number; owner: string }> = {
	// R2c models — shared model remaps (E8).
	'lib/museum/assets/AssetModel.svelte': { count: 1, owner: 'E8/R2c models' },
	'lib/museum/assets/instance-material-remap.ts': { count: 1, owner: 'E8/R2c models' },
	// R2b — the Scene look and its material components (E7).
	'lib/museum/assets/FallbackMaterial.svelte': { count: 1, owner: 'E7/R2b' },
	'lib/museum/materials/MuseumMaterial.svelte': { count: 1, owner: 'E7/R2b' },
	'lib/museum/materials/SceneInstanceMaterial.svelte': { count: 1, owner: 'E7/R2b' },
	// R5 artwork, environment ground and plinth (E9).
	'lib/museum/entities/EntityArtwork.svelte': { count: 6, owner: 'E9/R5 artwork' },
	'lib/museum/layout/GroundPlinth.svelte': { count: 1, owner: 'E9/R2c plinth' },
	'lib/render/WorldEnvironment.svelte': { count: 2, owner: 'E9/R2c environment, E10/R6 lights' },
	'lib/visitor/VisitorPreviewSurface.svelte': { count: 1, owner: 'E9/R2c environment' },
	// R6 — the light entity's invisible hit proxy (E10).
	'lib/museum/entities/EntityLight.svelte': { count: 1, owner: 'E10/R6' }
};

/** Editor ink: Paper, the mat grid, selection and gizmos. Not a world surface (§2.4). */
const EDITOR_INK: Record<string, { count: number; owner: string }> = {
	'lib/authoring/stage/paper-marks.ts': { count: 3, owner: 'Paper ink' },
	'lib/authoring/stage/paper-scene.ts': { count: 3, owner: 'Paper scene' },
	'lib/authoring/stage/shell/StageCanvas.svelte': { count: 1, owner: 'mat ground overlay' },
	'lib/authoring/stage/shell/StageMatGround.svelte': { count: 2, owner: 'mat ground' },
	'lib/authoring/stage/shell/StageSelectionLayer.svelte': { count: 2, owner: 'selection ink' },
	'lib/authoring/stage/shell/StageWallDevelopment.svelte': { count: 1, owner: 'development overlay' },
	'lib/authoring/stage/shell/StageWallPin.svelte': { count: 1, owner: 'pin gizmo' },
	'routes/dev/assets/+page.svelte': { count: 1, owner: 'dev bench' },
	'routes/dev/materials/+page.svelte': { count: 1, owner: 'dev bench' }
};

const STORE = 'lib/render/resources/material-store.ts';

/** A class name that constructs a world surface: `Mesh*Material` or `ShadowMaterial`. */
const MATERIAL_CLASS = /^(?:Mesh|Shadow)[A-Za-z]*Material$/;

type MaterialBindings = {
	/** Local names bound to a material class by a named import, aliased or not. */
	readonly constructors: readonly string[];
	/** Local names bound to a whole module, so `<name>.Mesh*Material` is a site. */
	readonly namespaces: readonly string[];
	/** Identifiers that name the Threlte component namespace, so `<name>.Mesh*Material` is a site. */
	readonly components: readonly string[];
};

function escapeName(name: string): string {
	return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The names a module can construct a material through, read from its own import
 * edges rather than from a spelling. Every local name is discovered, so renaming
 * an import cannot hide a site.
 */
export function materialBindings(file: string, source: string): MaterialBindings {
	const constructors = new Set<string>();
	const namespaces = new Set<string>();
	// The Threlte components are bound as the named import `T`; its alias is the
	// same binding, so markup through the alias is the same site.
	const components = new Set<string>(['T']);
	for (const edge of moduleBindingEdges(file, source)) {
		if (edge.kind === 'import-named') {
			if (edge.typeOnly) continue;
			if (MATERIAL_CLASS.test(edge.imported)) constructors.add(edge.local);
			if (edge.imported === 'T') components.add(edge.local);
		} else if (edge.kind === 'import-namespace' && !edge.typeOnly) {
			namespaces.add(edge.local);
		}
	}
	return { constructors: [...constructors].sort(), namespaces: [...namespaces].sort(), components: [...components].sort() };
}

/**
 * Every distinct constructor site in one module, counted by **character offset**.
 *
 * The patterns deliberately overlap — `new MeshBasicMaterial(` is both the plain
 * spelling and the `MeshBasicMaterial` binding — so offsets are deduplicated and
 * one source site is always one count. That is what keeps the allowlist numbers
 * below stable across the three detection routes.
 */
export function constructorSites(file: string, source: string): number {
	const code = withoutComments(source);
	const { constructors, namespaces, components } = materialBindings(file, source);
	const offsets = new Set<number>();
	const collect = (pattern: RegExp): void => {
		for (const match of code.matchAll(pattern)) offsets.add(match.index);
	};
	// The plain spelling, and markup through the literal `T` namespace.
	collect(/\bnew\s+(?:Mesh|Shadow)[A-Za-z]*Material\s*\(/g);
	collect(/<T\.(?:Mesh|Shadow)[A-Za-z]*Material\b/g);
	// An aliased class binding: `import { MeshBasicMaterial as Surface }`, then `new Surface(`.
	for (const name of constructors) collect(new RegExp(`\\bnew\\s+${escapeName(name)}\\s*\\(`, 'g'));
	// A caller-qualified namespace: `import * as THREE from 'three'`, then `new THREE.MeshBasicMaterial(`.
	for (const name of namespaces) {
		collect(new RegExp(`\\bnew\\s+${escapeName(name)}\\s*\\.\\s*(?:Mesh|Shadow)[A-Za-z]*Material\\s*\\(`, 'g'));
	}
	// The same for markup through an aliased Threlte components binding.
	for (const name of components) {
		collect(new RegExp(`<${escapeName(name)}\\.(?:Mesh|Shadow)[A-Za-z]*Material\\b`, 'g'));
	}
	return offsets.size;
}

function sourceFiles(): { absolute: string; file: string; code: string }[] {
	return listSourceFiles(EDITOR_SRC)
		.filter((file) => /\.(ts|svelte)$/.test(file) && !/\.test\./.test(path.basename(file)))
		.map((absolute) => ({
			absolute,
			file: path.relative(EDITOR_SRC, absolute).split(path.sep).join('/'),
			code: readFileSync(absolute, 'utf8')
		}));
}

function constructionSites(): Record<string, number> {
	const found: Record<string, number> = {};
	for (const { absolute, file, code } of sourceFiles()) {
		const count = constructorSites(absolute, code);
		if (count > 0) found[file] = count;
	}
	return found;
}

describe('material-factory-boundary: one factory for world materials', () => {
	it('constructs a world material only in the store', () => {
		const allowlist = new Set([STORE, ...Object.keys(RR7_REMAINDER), ...Object.keys(EDITOR_INK)]);
		const offenders = Object.keys(constructionSites()).filter((file) => !allowlist.has(file)).sort();
		expect(offenders).toEqual([]);
	});

	it('keeps the allowlist exact: a new site fails, and so does a stale entry', () => {
		const actual = constructionSites();
		const expected: Record<string, number> = { [STORE]: 3 };
		for (const [file, entry] of Object.entries({ ...RR7_REMAINDER, ...EDITOR_INK })) expected[file] = entry.count;
		expect(actual).toEqual(expected);
	});

	it('names an owning packet for every remaining world-material site', () => {
		for (const [file, entry] of Object.entries(RR7_REMAINDER)) {
			expect(entry.owner, file).toMatch(/^E(7|8|9|10)\//);
		}
		// The three Layout surfaces R2a moved are gone from the list entirely.
		expect(RR7_REMAINDER).not.toHaveProperty('lib/museum/layout/wall-material-factory.ts');
		expect(RR7_REMAINDER).not.toHaveProperty('lib/render/layout-wall-representation.ts');
		expect(RR7_REMAINDER).not.toHaveProperty('lib/render/layout-object-representation.ts');
		expect(RR7_REMAINDER).not.toHaveProperty('lib/render/layout-room-representation.ts');
		expect(RR7_REMAINDER).not.toHaveProperty('lib/visitor/VisitorLayoutShell.svelte');
	});

	it('the Layout representations acquire instead of constructing', () => {
		for (const file of [
			'lib/render/layout-wall-representation.ts',
			'lib/render/layout-object-representation.ts',
			'lib/render/layout-room-representation.ts'
		]) {
			const absolutePath = path.join(EDITOR_SRC, file);
			const code = withoutComments(readFileSync(absolutePath, 'utf8'));
			expect(code, file).toContain('store.acquire(');
			// The binding-aware count, so an aliased constructor is not a blind spot here either.
			expect(constructorSites(absolutePath, code), file).toBe(0);
		}
	});

	it('the shell hands every representation the one Canvas store', () => {
		const shell = readFileSync(path.join(EDITOR_SRC, 'lib/visitor/VisitorLayoutShell.svelte'), 'utf8');
		expect(shell).toContain('createMaterialStore()');
		expect(shell).toContain('createWallRepresentation(materials)');
		expect(shell).toContain('createObjectRepresentation(materials)');
		expect(shell).toContain('createRoomRepresentation(materials)');
		expect(shell).toMatch(/materials\.dispose\(\)/);
	});
});

describe('material-factory-boundary: aliases and namespaces are the same site', () => {
	/** A synthetic module in the shape the parser expects; `file` decides TS vs Svelte. */
	const module = (source: string, file = 'synthetic.ts'): number => constructorSites(file, source);

	it('finds a plain constructor', () => {
		expect(module(`import { MeshBasicMaterial } from 'three';\nconst m = new MeshBasicMaterial({ color: 0xff2fd4 });`)).toBe(1);
	});

	it('finds an aliased constructor', () => {
		const aliased = `import { MeshStandardMaterial as Surface } from 'three';\nconst m = new Surface({ color: 0xffffff });`;
		expect(module(aliased)).toBe(1);
		// The binding is read from the import edge, not from the spelling.
		expect(materialBindings('synthetic.ts', aliased).constructors).toEqual(['Surface']);
	});

	it('counts an aliased site once, not twice, when it also matches the plain pattern', () => {
		expect(module(`import { MeshBasicMaterial } from 'three';\nconst m = new MeshBasicMaterial();`)).toBe(1);
	});

	it('finds a namespace-qualified constructor, aliased namespace or not', () => {
		expect(module(`import * as THREE from 'three';\nconst m = new THREE.MeshBasicMaterial();`)).toBe(1);
		const aliasedNamespace = `import * as Drei from 'three';\nconst m = new Drei.ShadowMaterial({ opacity: 0.3 });`;
		expect(module(aliasedNamespace)).toBe(1);
		expect(materialBindings('synthetic.ts', aliasedNamespace).namespaces).toEqual(['Drei']);
	});

	it('finds both sites when a module uses an alias and a namespace', () => {
		expect(
			module(
				`import { MeshBasicMaterial as Surface } from 'three';\nimport * as THREE from 'three';\nconst a = new Surface();\nconst b = new THREE.MeshStandardMaterial({});`
			)
		).toBe(2);
	});

	it('finds aliased Threlte markup', () => {
		const markup = `<script lang="ts">\n\timport { T as Threlte } from '@threlte/core';\n</script>\n<Threlte.MeshStandardMaterial color="#fff" />`;
		expect(module(markup, 'Synthetic.svelte')).toBe(1);
	});

	it('ignores a type-only material import, which constructs nothing', () => {
		expect(module(`import type { MeshBasicMaterial } from 'three';\nconst m: MeshBasicMaterial | null = null;`)).toBe(0);
	});

	it('ignores a commented-out constructor', () => {
		expect(module(`import { MeshBasicMaterial } from 'three';\n// const m = new MeshBasicMaterial();\nconst n = 1;`)).toBe(0);
	});
});
