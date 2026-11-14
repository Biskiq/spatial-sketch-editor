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
import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import {
	canonicalColor,
	materialKey,
	type MaterialDescriptor
} from '$lib/render/resources/material-descriptor';
import { createMaterialStore } from '$lib/render/resources/material-store';

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
