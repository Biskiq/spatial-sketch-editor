/**
 * E8/R5 + R2c + G4 — architecture and lifecycle guards for model realization.
 *
 * These are text-level ownership checks, because each one is a regression that
 * type-checks and renders: a second material constructor, a per-instance dispose
 * of a shared template, an identity by name, or a shadow rule that re-introduces
 * the per-frame model trigger.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withoutComments } from '../../helpers/render-boundary-scan';
import { EDITOR_SRC, listSourceFiles } from '../../helpers/import-closure';

const read = (relative: string): string => withoutComments(readFileSync(resolve(EDITOR_SRC, '..', relative), 'utf8'));
const srcRel = (absolute: string): string => absolute.slice(resolve(EDITOR_SRC, '..').length + 1);

const REALIZATION = 'src/lib/render/models/model-realization.ts';
const HOST = 'src/lib/museum/assets/AssetModel.svelte';
const TRIGGERS = 'src/lib/authoring/stage/shell/StageShadowTriggers.svelte';
const STORE = 'src/lib/render/resources/material-store.ts';

describe('model realization: ownership (E8/R2c)', () => {
	it('constructs no world material; the store is the one factory', () => {
		expect(read(REALIZATION)).not.toMatch(/new\s+(?:Mesh|Shadow)[A-Za-z]*Material\b/);
		expect(read(HOST)).not.toMatch(/new\s+(?:Mesh|Shadow)[A-Za-z]*Material\b/);
		expect(read(STORE)).toMatch(/new MeshStandardMaterial\(/);
	});

	it('disposes nothing itself: every disposal of a surface or geometry is the store\'s or the loader\'s', () => {
		expect(read(REALIZATION)).not.toMatch(/\.dispose\(\)/);
		expect(read(HOST)).not.toMatch(/\.dispose\(\)/);
	});

	it('never clones a material per instance: an unstyled surface is a store copy, not a template clone', () => {
		const realization = read(REALIZATION);
		expect(realization).not.toMatch(/(?:material|Material)\w*\.clone\(/);
		expect(realization).not.toMatch(/geometry\.clone\(/);
		expect(read(STORE)).toMatch(/source\.clone\(\)/);
	});

	it('clones skinned hierarchies with their own skeletons, never by sharing bones', () => {
		const realization = read(REALIZATION);
		expect(realization).toMatch(/SkeletonUtils\.js/);
		expect(realization).toMatch(/isSkinnedMesh/);
	});

	it('identifies meshes by depth-first index, never by name or by searching the scene', () => {
		const realization = read(REALIZATION);
		expect(realization).not.toMatch(/getObjectByName|getObjectByProperty|\.name\s*(?:===|\.startsWith|\.includes)/);
		expect(read(HOST)).not.toMatch(/getObjectByName/);
	});

	it('the retired per-instance remap and clone helpers are gone from the source tree', () => {
		expect(existsSync(resolve(EDITOR_SRC, 'lib/museum/assets/instance-material-remap.ts'))).toBe(false);
		const offenders = listSourceFiles(EDITOR_SRC).filter((file) => {
			const code = withoutComments(readFileSync(file, 'utf8'));
			return /\bcloneModelScene\b|\bdisposeModelInstance\b|\bsetModelWireframe\b|\bremapModelMaterials\b|\breleaseModelMaterialRemap\b/.test(code);
		});
		expect(offenders.map(srcRel)).toEqual([]);
	});

	it('the realization layer imports no authoring or visitor module', () => {
		const realization = read(REALIZATION);
		expect(realization).not.toMatch(/from\s+['"]\$lib\/(?:authoring|visitor)\//);
		expect(realization).not.toMatch(/from\s+['"]\$lib\/(?:authoring|visitor)\//);
	});
});

describe('model arrival: one caster channel (E8/G4)', () => {
	it('only the model host publishes caster arrivals, releases and drawn-state changes', () => {
		const publishers = listSourceFiles(EDITOR_SRC)
			.filter((file) => /casters\.publish\(/.test(withoutComments(readFileSync(file, 'utf8'))))
			.map(srcRel);
		expect(publishers.sort()).toEqual([HOST]);
	});

	it('only the Stage shadow wiring subscribes to caster events and sets the per-frame mode', () => {
		const subscribers = listSourceFiles(EDITOR_SRC)
			.filter((file) => /casters\.subscribe\(/.test(withoutComments(readFileSync(file, 'utf8'))))
			.map(srcRel);
		expect(subscribers.sort()).toEqual([TRIGGERS]);
		const perFrame = listSourceFiles(EDITOR_SRC)
			.filter((file) => /setAlwaysUpdate\(/.test(withoutComments(readFileSync(file, 'utf8'))))
			.map(srcRel)
			.sort();
		expect(perFrame).toEqual([TRIGGERS, 'src/lib/render/shadow-invalidation.ts']);
	});

	it('the per-frame model rule is gone: a model alone never renders shadows every frame', () => {
		const triggers = read(TRIGGERS);
		expect(triggers).not.toMatch(/needsPerFrameShadows|asynchronousCaster/);
		expect(read('src/lib/render/shadow-invalidation.ts')).not.toMatch(/needsPerFrameShadows/);
	});

	it('a stale load mounts nothing: every arrival path is gated by the token the load began with', () => {
		const host = read(HOST);
		expect(host).toMatch(/const token = gate\.begin\(\);/);
		expect(host).toMatch(/if \(!gltf \|\| !gate\.accepts\(token\)\) return;/);
		expect(host).toMatch(/if \(!gate\.accepts\(current\.token\)\) return;/);
		expect(host).toMatch(/gate\.close\(\);/);
	});

	it('a superseded texture completion applies nothing: each completion is checked against the generation it began under', () => {
		const host = read(HOST);
		expect(host).toMatch(/const id = generation;/);
		expect(host).toMatch(/if \(id !== generation\) return;/);
	});

	it('mounts the drawn instance with explicit external ownership, so Threlte never disposes its leases or template', () => {
		expect(read(HOST)).toMatch(/<T is=\{instance\} dispose=\{false\} \/>/);
	});
});
