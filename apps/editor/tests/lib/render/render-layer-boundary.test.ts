/**
 * E6 — `render-layer-boundary`: the resource layer reads only what is above it.
 *
 * `renderer-refactor.md` §2 puts four layers under the authored units — render
 * descriptions (plain data), render resources (one owner per renderer),
 * retained representations (imperative `Object3D` graphs) and the renderer —
 * and fixes the dependency direction: each reads only the layer above.
 *
 * A reverse edge is invisible to every build and lane: a descriptor that imports
 * Three still works, and a store that imports the compiler still compiles. What
 * it destroys is the property the whole refactor exists for — that a descriptor
 * is portable data and a store cannot acquire an opinion about authored content.
 * So the direction is asserted here.
 *
 * Three routes, because a dependency can be written three ways:
 *
 * 1. **By name.** `material-descriptor.ts` has no imports; `material-store.ts`
 *    imports only Three and its descriptor; the texture store's module set is
 *    exact and named (its one pre-existing type-only edge is a stated exception).
 * 2. **By path.** Every specifier is resolved through the repository resolver
 *    (`resolveSpecifier`), so a relative or alias spelling that lands on a
 *    forbidden layer is the same edge as the `$lib/…` shorthand.
 * 3. **By indirection.** Every module's **import closure** (`importClosure`) —
 *    which follows `export * … from`, re-exported names and dynamic `import()` —
 *    must contain no forbidden file. A neutral barrel cannot carry a forbidden
 *    dependency past this test.
 *
 * Representations consume compiled output and stores: no authored-unit reader,
 * no codec, compiler, session, adapter or project-model truth.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	EDITOR_SRC,
	importClosure,
	parseModuleSpecifiers,
	relativeToRepo,
	resolveSpecifier
} from '../../helpers/import-closure';

const LIB = 'apps/editor/src/lib';
const DESCRIPTOR = `${LIB}/render/resources/material-descriptor.ts`;
const STORE = `${LIB}/render/resources/material-store.ts`;
const TEXTURE_STORE = `${LIB}/render/resources/texture-store.ts`;
const REPRESENTATIONS = [
	`${LIB}/render/layout-wall-representation.ts`,
	`${LIB}/render/layout-object-representation.ts`,
	`${LIB}/render/layout-room-representation.ts`
];
/**
 * The one permitted `$lib/visitor` edge: three constant strings with no imports
 * of their own. The Wall and Room surfaces have always read the default colours
 * and the Wall unlit share from it; it is a value module, not a visitor host.
 */
const VISITOR_PRESENTATION = `${LIB}/visitor/room-presentation.ts`;
/** The texture store's one pre-existing type-only edge, which R2b/E7 replaces with a descriptor. */
const SCENE_LOOK = `${LIB}/museum/materials/scene-instance-material.ts`;

const REPRESENTATION_FILE = /layout-(?:wall|object|room)-representation\.ts$/;

/** A layer no resource module may reach, by resolved path. */
function forbiddenForStores(relative: string): boolean {
	return (
		relative.startsWith(`${LIB}/authoring/`) ||
		relative.startsWith('apps/editor/src/routes/') ||
		(relative.startsWith(`${LIB}/visitor/`) && relative !== VISITOR_PRESENTATION) ||
		REPRESENTATION_FILE.test(relative)
	);
}

/** Representations additionally may not read authored Scene truth. */
function forbiddenForRepresentations(relative: string): boolean {
	return forbiddenForStores(relative) || relative.startsWith('packages/project-model/');
}

function absolute(relative: string): string {
	return path.join(EDITOR_SRC, relative.slice('apps/editor/src/'.length));
}

function importsOf(relative: string): string[] {
	return parseModuleSpecifiers(readFileSync(absolute(relative), 'utf8'));
}

/** The resolved repo-relative target of each specifier (`null` for an external). */
function resolvedImports(relative: string): { specifier: string; resolved: string | null }[] {
	const importer = absolute(relative);
	return importsOf(relative).map((specifier) => {
		const target = resolveSpecifier(importer, specifier);
		return { specifier, resolved: target === null ? null : relativeToRepo(target) };
	});
}

describe('render-layer-boundary: descriptors are plain, portable data', () => {
	it('the descriptor module imports nothing at all', () => {
		expect(importsOf(DESCRIPTOR)).toEqual([]);
	});

	it('the descriptor module names no Three or Svelte construct', () => {
		const code = readFileSync(absolute(DESCRIPTOR), 'utf8');
		expect(code).not.toMatch(/\bfrom ['"]three['"]/);
		expect(code).not.toMatch(/\bfrom ['"]svelte/);
		// No renderer object is constructed here at all (the only `new` is `Error`).
		expect(code).not.toMatch(
			/\bnew\s+(?:Mesh|Shadow|Line|Points|Group|Scene|Object3D|Color|Shape|Texture|Box|Sphere|Cylinder)\w*\s*\(/
		);
	});
});

describe('render-layer-boundary: stores read no authoring layer', () => {
	it('the material store imports only Three and its descriptor', () => {
		expect(importsOf(STORE).filter((specifier) => specifier !== 'three' && specifier !== './material-descriptor')).toEqual([]);
	});

	it('the material store’s closure is exactly the store and its descriptor', () => {
		expect([...importClosure([absolute(STORE)])].map(relativeToRepo).sort()).toEqual([DESCRIPTOR, STORE].sort());
	});

	it('the texture store’s module set is exact and keeps its one named exception', () => {
		expect(importsOf(TEXTURE_STORE).sort()).toEqual(
			[
				'@portfolio/layout-core',
				'$lib/museum/materials/scene-instance-material',
				'$lib/types/materials',
				'three'
			].sort()
		);
		expect(SCENE_LOOK).toMatch(/scene-instance-material\.ts$/);
	});

	it('no store reaches a forbidden layer by name or by path', () => {
		for (const store of [STORE, TEXTURE_STORE]) {
			for (const { specifier, resolved } of resolvedImports(store)) {
				if (resolved === null) continue;
				expect(forbiddenForStores(resolved), `${store} → ${specifier} resolved to ${resolved}`).toBe(false);
			}
		}
	});
});

describe('render-layer-boundary: representations consume compiled output and stores', () => {
	for (const file of REPRESENTATIONS) {
		it(`${path.basename(file)} imports no authored-unit, compile, codec or session module`, () => {
			const offenders = resolvedImports(file)
				.filter(({ resolved }) => resolved !== null && forbiddenForRepresentations(resolved))
				.map(({ specifier, resolved }) => `${specifier} → ${resolved}`);
			expect(offenders).toEqual([]);
		});

		it(`${path.basename(file)} reaches no forbidden layer through its import closure`, () => {
			// Follows `export * … from` and re-exported names, so a local barrel
			// that forward-imports the compiler is the same failure as a direct one.
			// The root is its own closure member and is not a dependency of itself.
			const offenders = [...importClosure([absolute(file)])]
				.map(relativeToRepo)
				.filter((member) => member !== file)
				.filter(forbiddenForRepresentations)
				.sort();
			expect(offenders).toEqual([]);
		});

		it(`${path.basename(file)} takes its materials from the store it is given`, () => {
			const code = readFileSync(absolute(file), 'utf8');
			expect(code).toMatch(/MaterialStore/);
			expect(code).toContain('store.acquire(');
			// A representation never creates a store of its own.
			expect(code).not.toContain('createMaterialStore(');
		});
	}
});

describe('render-layer-boundary: the mechanism catches renamed and indirect paths', () => {
	it('classifies a relative path by where it lands, not how it is written', () => {
		// `../authoring/…` from `lib/render/` is `lib/authoring/…`, whatever the spelling.
		const target = resolveSpecifier(absolute(REPRESENTATIONS[2]!), '../authoring/stage/stage-session');
		expect(target).not.toBeNull();
		expect(relativeToRepo(target!)).toBe(`${LIB}/authoring/stage/stage-session.ts`);
		expect(forbiddenForRepresentations(relativeToRepo(target!))).toBe(true);
		// The same file through the `$lib` alias is the same edge.
		const aliased = resolveSpecifier(absolute(REPRESENTATIONS[2]!), '$lib/authoring/stage/stage-session');
		expect(relativeToRepo(aliased!)).toBe(relativeToRepo(target!));
	});

	it('the closure follows re-exports, so a barrel cannot launder a dependency', () => {
		// A real chain: `ray.ts` re-exports a value from `stage-adapter-host.ts`,
		// which re-exports from `stage-facade.ts` and `camera-session.ts`.
		const closure = [...importClosure([absolute(`${LIB}/authoring/adapters/scene/shape/ray.ts`)])].map(relativeToRepo);
		for (const file of [
			`${LIB}/authoring/stage/stage-adapter-host.ts`,
			`${LIB}/authoring/stage/stage-facade.ts`,
			`${LIB}/authoring/stage/camera-session.ts`
		]) {
			expect(closure, file).toContain(file);
		}
		expect(closure.filter(forbiddenForStores)).not.toEqual([]);
	});

	it('keeps the permitted visitor exception and nothing else in the visitor layer', () => {
		expect(forbiddenForStores(VISITOR_PRESENTATION)).toBe(false);
		expect(forbiddenForStores(`${LIB}/visitor/VisitorLayoutShell.svelte`)).toBe(true);
		// The exception is exact: it does not open the rest of the folder.
		const closure = [...importClosure([absolute(REPRESENTATIONS[0]!)])]
			.map(relativeToRepo)
			.filter((file) => file.startsWith(`${LIB}/visitor/`));
		expect(closure).toEqual([VISITOR_PRESENTATION]);
	});
});
