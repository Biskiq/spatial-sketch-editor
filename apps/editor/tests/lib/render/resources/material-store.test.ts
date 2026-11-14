/**
 * E6/R2a — the material store's identity and reference-count contract.
 *
 * The obligations, as facts rather than shapes:
 *
 * - equal descriptors yield **one** instance, however the descriptor is spelled;
 * - the canonical key is order-independent and default-equivalent, so a look
 *   written two ways is one look;
 * - a lease is a claim: releasing it cannot free a material another lease holds,
 *   and the last release disposes exactly once;
 * - `dispose()` ends every remaining claim, and the store refuses to serve after.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	BasicDepthPacking,
	MeshBasicMaterial,
	MeshDepthMaterial,
	MeshDistanceMaterial,
	MeshLambertMaterial,
	MeshStandardMaterial,
	RGBADepthPacking,
	Texture
} from 'three';
import {
	canonicalColor,
	materialKey,
	type MaterialDescriptor
} from '$lib/render/resources/material-descriptor';
import { createMaterialStore } from '$lib/render/resources/material-store';

describe('E7/R2b — a textured descriptor is one material per variant', () => {
	it('shares one instance between equal textured keys and binds the supplied maps', () => {
		const store = createMaterialStore();
		const map = new Texture();
		const descriptor: MaterialDescriptor = {
			kind: 'standard',
			color: '#c4b4a0',
			roughness: 0.6,
			metalness: 0,
			toneMapped: true,
			textures: { map: 'eff|seed|1.0000|1.0000|0.0000' }
		};
		const first = store.acquire(descriptor, { map });
		const second = store.acquire(descriptor, { map });
		expect(first.material).toBe(second.material);
		expect((first.material as MeshStandardMaterial).map).toBe(map);
		expect(store.stats()).toMatchObject({ created: 1, live: 1, acquired: 2 });

		// A different bound variant is a different surface, not the same one relabelled.
		const otherVariant = store.acquire({ ...descriptor, textures: { map: 'eff|other|1.0000|1.0000|0.0000' } }, { map });
		expect(otherVariant.material).not.toBe(first.material);
		expect(otherVariant.key).not.toBe(first.key);
		expect(store.stats().created).toBe(2);
		store.dispose();
	});

	it('refuses to construct a descriptor whose declared slot has no map', () => {
		const store = createMaterialStore();
		expect(() =>
			store.acquire({
				kind: 'standard',
				color: '#c4b4a0',
				roughness: 0.6,
				metalness: 0,
				textures: { map: 'eff|seed|1.0000|1.0000|0.0000' }
			})
		).toThrow(/no texture/);
		expect(store.stats().created).toBe(0);
	});
});

const WALL: MaterialDescriptor = {
	kind: 'standard',
	color: '#f1e6cf',
	roughness: 0.92,
	metalness: 0.02,
	emissive: '#f1e6cf',
	emissiveIntensity: 0.5,
	toneMapped: false
};

describe('the canonical material key', () => {
	it('is order-independent', () => {
		const a: MaterialDescriptor = { kind: 'standard', color: '#123456', roughness: 0.5, metalness: 0.1 };
		const b = { ...({ metalness: 0.1, roughness: 0.5, color: '#123456', kind: 'standard' } as const) };
		expect(materialKey(a)).toBe(materialKey(b));
	});

	it('treats an omitted field as its constructor default', () => {
		const named: MaterialDescriptor = { kind: 'basic', color: '#abcdef', wireframe: false, toneMapped: true };
		const omitted: MaterialDescriptor = { kind: 'basic', color: '#abcdef' };
		expect(materialKey(omitted)).toBe(materialKey(named));
	});

	it('treats a packed number and a hex string as one colour', () => {
		expect(canonicalColor(0xe7e4dd)).toBe('#e7e4dd');
		expect(canonicalColor('#E7E4DD')).toBe('#e7e4dd');
		expect(canonicalColor('#abc')).toBe('#aabbcc');
		expect(materialKey({ kind: 'basic', color: 0xe7e4dd })).toBe(materialKey({ kind: 'basic', color: '#e7e4dd' }));
	});

	it('keeps a shadow catcher one key however its off offset is spelled', () => {
		const bare: MaterialDescriptor = { kind: 'shadow', opacity: 0.3, depthWrite: false };
		const spelled: MaterialDescriptor = {
			kind: 'shadow',
			opacity: 0.3,
			depthWrite: false,
			polygonOffset: false,
			polygonOffsetFactor: -1,
			polygonOffsetUnits: -1
		};
		expect(materialKey(spelled)).toBe(materialKey(bare));
	});

	it('refuses a colour it cannot canonically read', () => {
		expect(() => canonicalColor('rgb(1,2,3)')).toThrow(/not #rgb or #rrggbb/);
		expect(() => canonicalColor(0x1_000000)).toThrow(/packed 24-bit RGB/);
	});
});

describe('the material store', () => {
	it('hands equal descriptors one instance and counts both leases', () => {
		const store = createMaterialStore();
		const first = store.acquire(WALL);
		const second = store.acquire({ ...WALL });
		expect(second.material).toBe(first.material);
		expect(second.key).toBe(first.key);
		expect(store.stats()).toEqual({ live: 1, created: 1, disposed: 0, acquired: 2 });
		first.release();
		expect(store.stats()).toMatchObject({ live: 1, disposed: 0 });
		second.release();
		expect(store.stats()).toMatchObject({ live: 0, disposed: 1 });
		store.dispose();
	});

	it('constructs the descriptor as data, not as a caller-supplied object', () => {
		const store = createMaterialStore();
		const material = store.acquire(WALL).material as MeshStandardMaterial;
		expect(material).toBeInstanceOf(MeshStandardMaterial);
		expect(material.color.getHexString()).toBe('f1e6cf');
		expect(material.roughness).toBe(0.92);
		expect(material.metalness).toBe(0.02);
		expect(material.emissive.getHexString()).toBe('f1e6cf');
		expect(material.emissiveIntensity).toBe(0.5);
		expect(material.toneMapped).toBe(false);
		store.dispose();
	});

	it('never lets one consumer free another consumer’s lease', () => {
		const store = createMaterialStore();
		const shared: MaterialDescriptor = { kind: 'basic', color: 0xff2fd4, wireframe: true };
		const a = store.acquire(shared);
		const b = store.acquire(shared);
		const disposeSpy = vi.spyOn(a.material, 'dispose');
		a.release();
		a.release();
		expect(disposeSpy).not.toHaveBeenCalled();
		expect(store.peek(shared)).toBe(b.material);
		b.release();
		expect(disposeSpy).toHaveBeenCalledTimes(1);
		expect(store.peek(shared)).toBeNull();
		store.dispose();
	});

	it('disposes every remaining claim once and refuses later acquires', () => {
		const store = createMaterialStore();
		const a = store.acquire({ kind: 'basic', color: '#000000' });
		const b = store.acquire({ kind: 'shadow', opacity: 0.2 });
		const disposed = new Set<unknown>();
		for (const lease of [a, b]) {
			const original = lease.material.dispose.bind(lease.material);
			lease.material.dispose = () => {
				disposed.add(lease.material);
				original();
			};
		}
		store.dispose();
		expect(disposed.size).toBe(2);
		expect(store.stats()).toMatchObject({ live: 0, disposed: 2 });
		// A lease taken before disposal releases harmlessly afterwards.
		expect(() => a.release()).not.toThrow();
		expect(() => store.acquire({ kind: 'basic', color: '#000000' })).toThrow(/disposed/);
	});

	it('is per renderer: two stores share nothing', () => {
		const one = createMaterialStore();
		const other = createMaterialStore();
		const a = one.acquire(WALL);
		const b = other.acquire(WALL);
		expect(a.material).not.toBe(b.material);
		expect(one.stats().created).toBe(1);
		expect(other.stats().created).toBe(1);
		one.dispose();
		other.dispose();
	});

	it('builds the three Layout Room surfaces from descriptors alone', () => {
		const store = createMaterialStore();
		const floor = store.acquire({ kind: 'basic', color: '#e5e8e1', toneMapped: false });
		const shadow = store.acquire({
			kind: 'shadow',
			opacity: 0.3,
			depthWrite: false,
			polygonOffset: true,
			polygonOffsetFactor: -1,
			polygonOffsetUnits: -1
		});
		const ceiling = store.acquire({ kind: 'standard', color: '#111018', roughness: 0.92, metalness: 0.02, toneMapped: true });
		expect(floor.material).toBeInstanceOf(MeshBasicMaterial);
		expect((floor.material as MeshBasicMaterial).toneMapped).toBe(false);
		expect(shadow.material.type).toBe('ShadowMaterial');
		expect(ceiling.material).toBeInstanceOf(MeshStandardMaterial);
		expect(store.stats().created).toBe(3);
		store.dispose();
	});
});

describe('E9/R2c — Lambert, shadow-pass and vertex-colour kinds', () => {
	it('keys a Lambert surface by its constructor defaults and its bound texture identity', () => {
		expect(materialKey({ kind: 'lambert' })).toBe(
			materialKey({ kind: 'lambert', color: '#fff', transparent: false, opacity: 1, depthWrite: true, vertexColors: false })
		);
		expect(materialKey({ kind: 'lambert', map: 'artwork:a' })).not.toBe(materialKey({ kind: 'lambert', map: 'artwork:b' }));
		expect(materialKey({ kind: 'depth', map: 'a', alphaTest: 0.5, packing: 'rgba' })).not.toBe(
			materialKey({ kind: 'distance', map: 'a', alphaTest: 0.5 })
		);
		expect(materialKey({ kind: 'basic', color: 0xffffff })).toBe(
			materialKey({ kind: 'basic', color: '#ffffff', vertexColors: false, depthWrite: true })
		);
	});

	it('constructs each kind with exactly the descriptor’s properties', () => {
		const store = createMaterialStore();
		const map = new Texture();
		const lambert = store.acquire({ kind: 'lambert', map: 'artwork:t', transparent: true, depthWrite: false, opacity: 0.65 }, { map });
		expect(lambert.material).toBeInstanceOf(MeshLambertMaterial);
		const surface = lambert.material as MeshLambertMaterial;
		expect([surface.map, surface.transparent, surface.depthWrite, surface.opacity, surface.vertexColors]).toEqual([map, true, false, 0.65, false]);
		expect(surface.color.getHexString()).toBe('ffffff');
		const depth = store.acquire({ kind: 'depth', map: 'artwork:t', alphaTest: 0.5, packing: 'rgba' }, { map }).material as MeshDepthMaterial;
		expect([depth.map, depth.alphaTest, depth.depthPacking]).toEqual([map, 0.5, RGBADepthPacking]);
		const plain = store.acquire({ kind: 'depth' }).material as MeshDepthMaterial;
		expect([plain.map, plain.alphaTest, plain.depthPacking]).toEqual([null, 0, BasicDepthPacking]);
		const distance = store.acquire({ kind: 'distance', map: 'artwork:t', alphaTest: 0.5 }, { map }).material as MeshDistanceMaterial;
		expect(distance).toBeInstanceOf(MeshDistanceMaterial);
		expect([distance.map, distance.alphaTest]).toEqual([map, 0.5]);
		const ground = store.acquire({ kind: 'basic', color: 0xffffff, vertexColors: true, toneMapped: false, depthWrite: false }).material as MeshBasicMaterial;
		expect([ground.vertexColors, ground.toneMapped, ground.depthWrite]).toEqual([true, false, false]);
		const lit = store.acquire({ kind: 'lambert', vertexColors: true }).material as MeshLambertMaterial;
		expect([lit.vertexColors, lit.transparent, lit.depthWrite, lit.opacity]).toEqual([true, false, true, 1]);
		store.dispose();
	});

	it('refuses a mapped Lambert, depth or distance descriptor without its texture', () => {
		const store = createMaterialStore();
		expect(() => store.acquire({ kind: 'lambert', map: 'artwork:t' })).toThrow(/binds "map"/);
		expect(() => store.acquire({ kind: 'depth', map: 'artwork:t' })).toThrow(/binds "map"/);
		expect(() => store.acquire({ kind: 'distance', map: 'artwork:t' })).toThrow(/binds "map"/);
		store.dispose();
	});

	it('builds the environment, paper ground and plinth looks from descriptors alone', () => {
		const store = createMaterialStore();
		const plinth = store.acquire({ kind: 'standard', color: '#0e0d11', roughness: 0.92, metalness: 0 }).material as MeshStandardMaterial;
		// Equal to the removed `<T.MeshStandardMaterial color="#0e0d11" roughness={0.92} />`.
		const reference = new MeshStandardMaterial({ color: '#0e0d11', roughness: 0.92 });
		expect([plinth.color.getHex(), plinth.roughness, plinth.metalness]).toEqual([reference.color.getHex(), 0.92, reference.metalness]);
		const paper = store.acquire({ kind: 'lambert', color: '#e2e5de' }).material as MeshLambertMaterial;
		expect(paper.color.getHex()).toBe(new MeshLambertMaterial({ color: '#e2e5de' }).color.getHex());
		store.dispose();
	});
});
