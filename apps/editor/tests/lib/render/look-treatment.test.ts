/**
 * T2.S6 — a Treatment is resolve-time, never a document rewrite.
 *
 * Natural must be byte-identical to today: the same imported key, one clone and
 * one lease. Flat colour and Clay tune only the fields a stylised surface owns,
 * keep alpha-relevant structure, skip unsupported material classes, and swap
 * default Wall/Room surfaces by re-leasing rather than mutating a shared
 * material.
 */
import { describe, expect, it } from 'vitest';
import {
	DoubleSide,
	Mesh,
	MeshBasicMaterial,
	MeshNormalMaterial,
	MeshStandardMaterial,
	Texture
} from 'three';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { materialKey, type ImportedMaterialDescriptor } from '$lib/render/resources/material-descriptor';
import { CLAY_COLOR, CLAY_ROUGHNESS, FLAT_MIN_ROUGHNESS } from '$lib/render/materials/treatment';
import { createVisitorWallMaterialFactory } from '$lib/render/layout/wall-material-factory';
import { createWallRepresentation } from '$lib/render/layout-wall-representation';
import { createRoomRepresentation } from '$lib/render/layout-room-representation';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from '../layout/__fixtures__/layout-scale-fixtures';
import {
	compileWallFirstLayoutGeometry,
	createLayoutCompileSession,
	planRigidWallMove,
	withLayoutCompileSession
} from '@portfolio/layout-core';

const identity = (over: Partial<ImportedMaterialDescriptor> = {}): ImportedMaterialDescriptor => ({
	kind: 'imported',
	asset: '/models/chair.glb',
	mesh: 0,
	slot: 0,
	wireframe: false,
	...over
});

describe('T2.S6 — imported-model materials', () => {
	it('keeps Natural exactly today’s key, clone and lease counts', () => {
		const store = createMaterialStore();
		const source = new MeshStandardMaterial({ color: '#aa3311', roughness: 0.35, metalness: 0.8 });
		const first = store.acquire(identity(), undefined, source);
		const second = store.acquire(identity(), undefined, source);
		expect(second.material).toBe(first.material);
		expect(first.material).not.toBe(source);
		expect(store.stats()).toMatchObject({ created: 1, acquired: 2, treated: 0, treatmentSkipped: 0 });
		expect((first.material as MeshStandardMaterial).roughness).toBe(0.35);
		store.dispose();
	});

	it('keeps the exact pre-S6 canonical key for Natural', () => {
		expect(materialKey(identity())).toBe(
			'imported|asset=%2Fmodels%2Fchair.glb|mesh=0|slot=0|wireframe=0|remap=-'
		);
		expect(materialKey(identity({ treatment: 'clay' }))).toBe(
			'imported|asset=%2Fmodels%2Fchair.glb|mesh=0|slot=0|wireframe=0|treatment=clay|remap=-'
		);
	});

	it('tunes Flat colour and Clay, and keys each distinct from Natural', () => {
		const store = createMaterialStore();
		const source = new MeshStandardMaterial({ color: '#aa3311', roughness: 0.35, metalness: 0.8 });
		const flat = store.acquire(identity({ treatment: 'flat-colour' }), undefined, source)
			.material as MeshStandardMaterial;
		expect(flat.color.getHexString()).toBe('aa3311');
		expect(flat.roughness).toBe(FLAT_MIN_ROUGHNESS);
		expect(flat.metalness).toBe(0);

		const clay = store.acquire(identity({ treatment: 'clay' }), undefined, source)
			.material as MeshStandardMaterial;
		expect(clay.color.getHexString()).toBe(CLAY_COLOR.slice(1));
		expect(clay.roughness).toBe(CLAY_ROUGHNESS);
		expect(clay.metalness).toBe(0);

		expect(materialKey(identity())).not.toBe(materialKey(identity({ treatment: 'clay' })));
		expect(materialKey(identity({ treatment: 'clay' }))).not.toBe(
			materialKey(identity({ treatment: 'flat-colour' }))
		);
		// The source is never mutated.
		expect(source.color.getHexString()).toBe('aa3311');
		store.dispose();
	});

	it('keeps an alpha-masked silhouette: map, alphaTest, transparency and side survive', () => {
		const store = createMaterialStore();
		const map = new Texture();
		const displacement = new Texture();
		const alpha = new Texture();
		const source = new MeshStandardMaterial({
			map,
			normalMap: new Texture(),
			roughnessMap: new Texture(),
			metalnessMap: new Texture(),
			aoMap: new Texture(),
			emissiveMap: new Texture(),
			displacementMap: displacement,
			alphaMap: alpha,
			emissive: '#ff0000',
			emissiveIntensity: 2,
			alphaTest: 0.5,
			transparent: false,
			side: DoubleSide,
			color: '#335577'
		});
		const clay = store.acquire(identity({ treatment: 'clay' }), undefined, source)
			.material as MeshStandardMaterial;
		expect(clay.map).toBe(map);
		expect(clay.alphaMap).toBe(alpha);
		expect(clay.displacementMap).toBe(displacement);
		// Appearance channels are replaced; geometry and alpha are not.
		expect(clay.normalMap).toBeNull();
		expect(clay.roughnessMap).toBeNull();
		expect(clay.metalnessMap).toBeNull();
		expect(clay.aoMap).toBeNull();
		expect(clay.emissiveMap).toBeNull();
		expect(clay.emissive.getHexString()).toBe('000000');
		expect(clay.emissiveIntensity).toBe(0);
		expect(clay.alphaTest).toBe(0.5);
		expect(clay.transparent).toBe(false);
		expect(clay.side).toBe(DoubleSide);
		expect(clay.color.getHexString()).toBe(CLAY_COLOR.slice(1));

		// With no alpha riding on it, the base map is dropped.
		const plain = new MeshStandardMaterial({ map: new Texture(), color: '#335577' });
		const flat = store.acquire(identity({ treatment: 'flat-colour' }), undefined, plain)
			.material as MeshStandardMaterial;
		expect(flat.map).toBeNull();

		// An alphaMap alone preserves the mask; the base colour map goes.
		const masked = new MeshStandardMaterial({ map: new Texture(), alphaMap: new Texture() });
		const maskedFlat = store.acquire(identity({ mesh: 3, treatment: 'flat-colour' }), undefined, masked)
			.material as MeshStandardMaterial;
		expect(maskedFlat.map).toBeNull();
		expect(maskedFlat.alphaMap).toBe(masked.alphaMap);
		store.dispose();
	});

	it('tunes a colour-tunable non-PBR class and skips an unsupported one by count', () => {
		const store = createMaterialStore();
		const basic = store.acquire(identity({ mesh: 1, treatment: 'clay' }), undefined, new MeshBasicMaterial({ color: '#112233' }))
			.material as MeshBasicMaterial;
		expect(basic.color.getHexString()).toBe(CLAY_COLOR.slice(1));

		const normal = store.acquire(identity({ mesh: 2, treatment: 'clay' }), undefined, new MeshNormalMaterial())
			.material;
		expect(normal).toBeInstanceOf(MeshNormalMaterial);
		expect(store.stats()).toMatchObject({ treated: 1, treatmentSkipped: 1 });
		store.dispose();
	});
});

describe('T2.S6 — default Layout surfaces', () => {
	it('re-leases Wall surfaces when the Treatment changes', () => {
		const store = createMaterialStore();
		const geometry = compileWallFirstLayoutGeometry(buildScaleFixture(SCALE_FIXTURE_SEEDS.small)).geometry;
		const walls = createWallRepresentation(store);
		walls.update(geometry);
		const wallId = geometry.walls[0]!.wallId;
		const meshOf = (): import('three').Mesh => walls.objectOf(wallId) as import('three').Mesh;
		const materialOf = (target: import('three').Mesh): MeshStandardMaterial =>
			(Array.isArray(target.material) ? target.material[0] : target.material) as MeshStandardMaterial;
		const before = meshOf();
		const natural = materialOf(before);
		const naturalColor = natural.color.getHexString();

		expect(walls.setTreatment('clay')).toBe(true);
		// A material-only swap: the mesh object and its buffers never move.
		expect(meshOf()).toBe(before);
		expect(meshOf().geometry).toBe(before.geometry);
		const clay = materialOf(meshOf());
		expect(clay).not.toBe(natural);
		expect(clay.color.getHexString()).toBe(CLAY_COLOR.slice(1));
		expect(clay.roughness).toBe(CLAY_ROUGHNESS);
		// The old lease went back: one Wall material is held, not two.
		expect(store.stats().live).toBe(1);
		expect(walls.setTreatment('clay')).toBe(false);

		expect(walls.setTreatment(undefined)).toBe(true);
		expect(materialOf(meshOf()).color.getHexString()).toBe(naturalColor);
		walls.dispose();
		store.dispose();
	});

	it('targets the retained mesh after an incremental Wall edit, then cycles every Treatment', () => {
		const store = createMaterialStore();
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const session = createLayoutCompileSession();
		const base = session.compile(document).geometry;
		const target = document.walls[0]!.id;
		const walls = createWallRepresentation(store);
		walls.update(base);
		const retained = walls.objectOf(target) as Mesh;

		// A planned move reaches the incremental patch path, which copies the
		// rebuilt mesh into the retained object and keeps that object attached.
		const plan = withLayoutCompileSession(session, () =>
			planRigidWallMove(document, { wallId: target, delta: [0, 0.01] })
		);
		if (plan.kind !== 'success') throw new Error(plan.rejection.message);
		const stats = walls.update(plan.acceptance!.geometry);
		expect(stats.built).toBeGreaterThan(0);
		expect(walls.objectOf(target)).toBe(retained);

		const materialOf = (mesh: Mesh): MeshStandardMaterial =>
			(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
		const natural = materialOf(retained);
		const naturalColor = natural.color.getHexString();
		let disposed = false;
		natural.addEventListener('dispose', () => { disposed = true; });

		expect(walls.setTreatment('clay')).toBe(true);
		expect(materialOf(retained).color.getHexString()).toBe(CLAY_COLOR.slice(1));
		// The visible Wall held the old lease; it must not be released underneath it.
		expect(disposed).toBe(true);
		expect(store.stats().live).toBe(1);

		expect(walls.setTreatment('flat-colour')).toBe(true);
		expect(materialOf(retained).roughness).toBeGreaterThanOrEqual(FLAT_MIN_ROUGHNESS);
		expect(walls.setTreatment(undefined)).toBe(true);
		expect(materialOf(retained).color.getHexString()).toBe(naturalColor);
		expect(store.stats().live).toBe(1);
		walls.dispose();
		store.dispose();
	});

	it('re-leases the default Room floor and ceiling when the Treatment changes', () => {
		const store = createMaterialStore();
		const geometry = compileWallFirstLayoutGeometry(buildScaleFixture(SCALE_FIXTURE_SEEDS.small)).geometry;
		const rooms = createRoomRepresentation(store);
		rooms.update(geometry);
		const floor = rooms.objectOf(geometry.rooms[0]!.roomId) as import('three').Mesh;
		expect(rooms.setTreatment('clay')).toBe(true);
		expect((floor.material as MeshBasicMaterial).color.getHexString()).toBe(CLAY_COLOR.slice(1));
		expect(rooms.setTreatment('clay')).toBe(false);
		expect(rooms.setTreatment('flat-colour')).toBe(true);
		rooms.dispose();
		store.dispose();
	});

	it('tunes a Wall tint through the one factory', () => {
		const store = createMaterialStore();
		const { factory, dispose } = createVisitorWallMaterialFactory(
			store,
			() => '#4b4b52',
			0,
			'flat-colour'
		);
		const material = factory('surface', { roomId: 'room' } as never).material as MeshStandardMaterial;
		expect(material.roughness).toBeGreaterThanOrEqual(FLAT_MIN_ROUGHNESS);
		expect(material.metalness).toBe(0);
		expect(material.color.getHexString()).toBe('4b4b52');
		dispose();
		store.dispose();
	});
});
