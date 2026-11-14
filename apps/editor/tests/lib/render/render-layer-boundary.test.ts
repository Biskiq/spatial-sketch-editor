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
 * The rules, exactly:
 *
 * 1. **Descriptors are data.** `material-descriptor.ts` imports nothing: no
 *    Three, no Svelte, no editor, no content catalogue, no authored-unit reader.
 * 2. **Stores do not read authoring.** Neither resource module reaches an
 *    authoring/route/visitor module, a compiler, a codec, a session or a
 *    representation. `texture-store.ts` keeps its one pre-existing type-only edge
 *    to the resolved-look module, which E7 moves; that is named, not ignored.
 * 3. **Representations do not read authored truth.** They consume compiled
 *    output and stores — never the codec, the compiler entry, source admission,
 *    the facade or an adapter.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDITOR_SRC, parseModuleSpecifiers } from '../../helpers/import-closure';

function importsOf(relative: string): string[] {
	return parseModuleSpecifiers(readFileSync(path.join(EDITOR_SRC, relative), 'utf8'));
}

/** A specifier that belongs above the resource layer. */
const AUTHORING = /^\$lib\/(?:authoring|visitor|routes|editor)(?:\/|$)/;
const COMPILE_SESSION = /codec|source-admission|host-acceptance|stage-facade|stage-session|stage-adapter-host|adapters\/|compile|project-model/;
const REPRESENTATION = /layout-(?:wall|object|room)-representation/;

function forbidden(specifiers: readonly string[], patterns: readonly RegExp[]): string[] {
	return specifiers.filter((specifier) => patterns.some((pattern) => pattern.test(specifier)));
}

describe('render-layer-boundary: descriptors are plain, portable data', () => {
	it('the descriptor module imports nothing at all', () => {
		expect(importsOf('lib/render/resources/material-descriptor.ts')).toEqual([]);
	});

	it('the descriptor module names no Three or Svelte construct', () => {
		const code = readFileSync(path.join(EDITOR_SRC, 'lib/render/resources/material-descriptor.ts'), 'utf8');
		expect(code).not.toMatch(/\bfrom ['"]three['"]/);
		expect(code).not.toMatch(/\bfrom ['"]svelte/);
		// No renderer object is constructed here at all (the only `new` is `Error`).
		expect(code).not.toMatch(/\bnew\s+(?:Mesh|Shadow|Line|Points|Group|Scene|Object3D|Color|Shape|Texture|Box|Sphere|Cylinder)\w*\s*\(/);
	});
});

describe('render-layer-boundary: stores read no authoring layer', () => {
	it('the material store imports only Three and its descriptor', () => {
		const specifiers = importsOf('lib/render/resources/material-store.ts');
		expect(specifiers.filter((specifier) => specifier !== 'three' && specifier !== './material-descriptor')).toEqual([]);
	});

	it('the texture store reaches no authoring, compile, session or representation module', () => {
		const specifiers = importsOf('lib/render/resources/texture-store.ts');
		expect(forbidden(specifiers, [AUTHORING, COMPILE_SESSION, REPRESENTATION])).toEqual([]);
		// Its one pre-existing edge, kept explicit: a type-only read of the resolved
		// Scene look, which R2b/E7 replaces with a descriptor.
		const outside = specifiers.filter(
			(specifier) =>
				specifier !== 'three' &&
				specifier !== '@portfolio/layout-core' &&
				specifier !== '$lib/types/materials' &&
				specifier !== '$lib/museum/materials/scene-instance-material'
		);
		expect(outside).toEqual([]);
	});
});

describe('render-layer-boundary: representations consume compiled output and stores', () => {
	const representations = [
		'lib/render/layout-wall-representation.ts',
		'lib/render/layout-object-representation.ts',
		'lib/render/layout-room-representation.ts'
	];

	for (const file of representations) {
		it(`${path.basename(file)} imports no authored-unit, compile, codec or session module`, () => {
			const specifiers = importsOf(file).filter(
				// `$lib/visitor/room-presentation` holds three constant strings and
				// imports nothing; it is a value module, not a visitor host or an
				// authored-unit reader, and the Wall/Room surfaces have always read it.
				(specifier) => specifier !== '$lib/visitor/room-presentation'
			);
			expect(forbidden(specifiers, [AUTHORING, /@portfolio\/project-model/, /codec/, /compile/, /stage-/])).toEqual([]);
		});

		it(`${file.split('/').pop()} takes its materials from the store it is given`, () => {
			const code = readFileSync(path.join(EDITOR_SRC, file), 'utf8');
			expect(code).toMatch(/MaterialStore/);
			expect(code).toContain('store.acquire(');
		});
	}

	it('a representation never creates a store of its own', () => {
		for (const file of representations) {
			const code = readFileSync(path.join(EDITOR_SRC, file), 'utf8');
			expect(code, file).not.toContain('createMaterialStore(');
		}
	});
});
