/**
 * E10/R6 — `light-realizer-boundary`: one place realizes a world light.
 *
 * `slices.md` R6 routes every world light through resolved descriptors and one
 * Canvas light store. No build, type check or renderer can see a second
 * `new SpotLight()` or `<T.PointLight>` appear — Three lights it happily — so the
 * guarantee lives here, with the same three rules as the material factory:
 *
 * 1. **The store constructs Point, Spot and the Sun; nobody else does.** A
 *    `PointLight`/`SpotLight` constructor exists only in the store, and a
 *    `DirectionalLight` only in the store and the explicitly listed neutral rigs.
 * 2. **Every other light constructor is on an exact, shrink-only allowlist.**
 *    The host fills (ambient, the Sky's hemisphere, Paper's neutral rig) and the
 *    dev benches are not world lights of the resolved look; they stay where they
 *    are, counted per file, so a new site fails and so does a stale entry.
 * 3. **Names, not spellings.** Constructors are found through each module's own
 *    import edges (`moduleBindingEdges`), so an aliased class, a namespace import
 *    and an aliased Threlte `T` are the same site as the plain spelling.
 *
 * It also pins the layer direction of the new modules (descriptor → store →
 * representation) and that the two consumers lease from the Canvas store.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDITOR_SRC, listSourceFiles, moduleBindingEdges, parseModuleSpecifiers } from '../../helpers/import-closure';
import { withoutComments } from '../../helpers/render-boundary-scan';

const STORE = 'lib/render/resources/light-store.ts';
const DESCRIPTOR = 'lib/render/resources/light-descriptor.ts';
const DESCRIPTION = 'lib/render/scene-light-description.ts';
const REPRESENTATION = 'lib/render/scene-light-representation.ts';

/** The store's own three: Point, Spot and the Sun. */
const STORE_SITES = { PointLight: 1, SpotLight: 1, DirectionalLight: 1 };

/**
 * Host fills and dev benches: lights that are not resolved-look world lights.
 * Exact per class; shrink-only.
 */
const HOST_LIGHTS: Record<string, { sites: Record<string, number>; owner: string }> = {
	// Ambient under the Sky and under Paper; Paper's two-light neutral rig.
	'lib/authoring/stage/shell/StageCanvas.svelte': { sites: { AmbientLight: 1, DirectionalLight: 2 }, owner: 'Stage host fill + Paper rig' },
	'lib/visitor/VisitorPreviewSurface.svelte': { sites: { AmbientLight: 1, DirectionalLight: 2 }, owner: 'Preview host fill + Paper rig' },
	// The Sky's hemisphere fill. The Sun is the store's.
	'lib/render/WorldEnvironment.svelte': { sites: { HemisphereLight: 1, AmbientLight: 1 }, owner: 'Sky hemisphere fill' },
	'routes/dev/assets/+page.svelte': { sites: { HemisphereLight: 1, DirectionalLight: 1 }, owner: 'dev bench' },
	'routes/dev/materials/+page.svelte': { sites: { AmbientLight: 1, HemisphereLight: 1, DirectionalLight: 1 }, owner: 'dev bench' }
};

const LIGHT_CLASSES = [
	'PointLight',
	'SpotLight',
	'DirectionalLight',
	'HemisphereLight',
	'AmbientLight',
	'RectAreaLight',
	'LightProbe'
] as const;

function escapeName(name: string): string {
	return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Constructor sites per light class in one module, deduplicated by offset. */
export function lightSites(file: string, source: string): Record<string, number> {
	const code = withoutComments(source);
	const aliases = new Map<string, Set<string>>(LIGHT_CLASSES.map((name) => [name, new Set([name])]));
	const namespaces = new Set<string>();
	const components = new Set<string>(['T']);
	for (const edge of moduleBindingEdges(file, source)) {
		if (edge.kind === 'import-named' && !edge.typeOnly) {
			aliases.get(edge.imported)?.add(edge.local);
			if (edge.imported === 'T') components.add(edge.local);
		} else if (edge.kind === 'import-namespace' && !edge.typeOnly) {
			namespaces.add(edge.local);
		}
	}
	const found: Record<string, number> = {};
	for (const name of LIGHT_CLASSES) {
		const offsets = new Set<number>();
		const collect = (pattern: RegExp): void => {
			for (const match of code.matchAll(pattern)) offsets.add(match.index);
		};
		for (const local of aliases.get(name)!) collect(new RegExp(`\\bnew\\s+${escapeName(local)}\\s*\\(`, 'g'));
		for (const ns of namespaces) collect(new RegExp(`\\bnew\\s+${escapeName(ns)}\\s*\\.\\s*${name}\\s*\\(`, 'g'));
		for (const t of components) collect(new RegExp(`<${escapeName(t)}\\.${name}\\b`, 'g'));
		if (offsets.size > 0) found[name] = offsets.size;
	}
	return found;
}

function allSites(): Record<string, Record<string, number>> {
	const out: Record<string, Record<string, number>> = {};
	for (const absolute of listSourceFiles(EDITOR_SRC)) {
		if (!/\.(ts|svelte)$/.test(absolute) || /\.test\./.test(path.basename(absolute))) continue;
		const file = path.relative(EDITOR_SRC, absolute).split(path.sep).join('/');
		const sites = lightSites(absolute, readFileSync(absolute, 'utf8'));
		if (Object.keys(sites).length > 0) out[file] = sites;
	}
	return out;
}

function read(file: string): string {
	return readFileSync(path.join(EDITOR_SRC, file), 'utf8');
}

describe('light-realizer-boundary: one realizer for world lights', () => {
	it('the light constructor sites are exactly the store and the listed host lights', () => {
		const expected: Record<string, Record<string, number>> = { [STORE]: STORE_SITES };
		for (const [file, entry] of Object.entries(HOST_LIGHTS)) expected[file] = entry.sites;
		expect(allSites()).toEqual(expected);
	});

	it('Point and Spot are constructed only by the store', () => {
		for (const [file, sites] of Object.entries(allSites())) {
			if (file === STORE) continue;
			expect(sites.PointLight ?? 0, file).toBe(0);
			expect(sites.SpotLight ?? 0, file).toBe(0);
		}
	});

	it('the Sky constructs no Sun and the retired component is gone', () => {
		expect(HOST_LIGHTS['lib/render/WorldEnvironment.svelte']!.sites).toEqual({ HemisphereLight: 1, AmbientLight: 1 });
		expect(existsSync(path.join(EDITOR_SRC, 'lib/museum/entities/EntityLight.svelte'))).toBe(false);
	});

	it('names an owner for every host light', () => {
		for (const [file, entry] of Object.entries(HOST_LIGHTS)) expect(entry.owner, file).not.toBe('');
	});
});

describe('light-realizer-boundary: the detector binds names, not spellings', () => {
	it('counts an aliased class, a namespace and an aliased Threlte binding', () => {
		const source = [
			"import { SpotLight as Beam } from 'three';",
			"import * as THREE from 'three';",
			'const a = new Beam();',
			'const b = new THREE.PointLight();',
			'// new SpotLight() in a comment is not a site'
		].join('\n');
		expect(lightSites('/virtual/a.ts', source)).toEqual({ SpotLight: 1, PointLight: 1 });
		const svelte = "<script lang=\"ts\">import { T as Three } from '@threlte/core';</script>\n<Three.DirectionalLight />";
		expect(lightSites('/virtual/b.svelte', svelte)).toEqual({ DirectionalLight: 1 });
	});
});

describe('light-realizer-boundary: layer direction', () => {
	it('the descriptor is plain data with no imports', () => {
		expect(parseModuleSpecifiers(read(DESCRIPTOR))).toEqual([]);
		expect(withoutComments(read(DESCRIPTOR))).not.toMatch(/\bnew\s+\w/);
	});

	it('the store imports only Three, its descriptor and the one render layer it must cover', () => {
		// T2 §10 / X1: a lifted overhead still casts. The shadow camera must enable
		// the same layer a representation uses to lift it, so the store names that
		// layer; it still never imports a representation or a Stage drawing module.
		expect(parseModuleSpecifiers(read(STORE)).sort()).toEqual([
			'$lib/render/render-layers',
			'./light-descriptor',
			'three'
		]);
	});

	it('the authored-light description is portable: no Three, no store', () => {
		const imports = parseModuleSpecifiers(read(DESCRIPTION));
		expect(imports).not.toContain('three');
		expect(imports.some((specifier) => /light-store/.test(specifier))).toBe(false);
	});

	it('the representation reads only Three and types from the store and the description', () => {
		expect(parseModuleSpecifiers(read(REPRESENTATION)).sort()).toEqual(
			['./resources/light-store', './scene-light-description', 'three'].sort()
		);
		const edges = moduleBindingEdges(path.join(EDITOR_SRC, REPRESENTATION), read(REPRESENTATION));
		for (const edge of edges) {
			if (edge.kind === 'import-named' && edge.specifier !== 'three') expect(edge.typeOnly, edge.imported).toBe(true);
		}
		expect(withoutComments(read(REPRESENTATION))).toContain('lights.acquire(');
	});

	it('both consumers lease from the Canvas light store', () => {
		expect(withoutComments(read('lib/visitor/VisitorEntityGroups.svelte'))).toMatch(
			/createSceneLightRepresentation\(\{\s*lights:\s*resources\.lights\s*\}\)/
		);
		expect(withoutComments(read('lib/render/WorldEnvironment.svelte'))).toContain('resources.lights.acquire(');
		expect(withoutComments(read('lib/render/resources/render-resources.ts'))).toContain('createLightStore()');
	});
});
