<script lang="ts">
	/**
	 * Object Studio's World context: every body that is not the scoped root is drawn
	 * quiet, so the object reads against the room it belongs to without the room
	 * competing for the eye.
	 *
	 * This is **display only**. It writes no source, selection or `visible` flag and is
	 * not a pick filter (the pick path is scoped separately, so a muted body is also
	 * non-pickable). Looks are shared across entities by the render resources, so a
	 * muted mesh gets its **own cloned material** and the shared one is never touched:
	 * the scoped root, which may use the same look, keeps drawing exactly as authored.
	 * Every clone is undone when the posture leaves or a mesh's material is replaced.
	 */
	import { useThrelte } from '@threlte/core';
	import { Mesh, type Material, type Object3D } from 'three';
	import type { ScenePickSource } from '$lib/authoring/scene/scene-pick-source';

	let {
		scenePick,
		entityIds,
		scopedId,
		contextRoots = [],
		revision
	}: {
		scenePick: ScenePickSource;
		/** Every entity id the Scene draws; the scoped root is skipped. */
		entityIds: readonly string[];
		scopedId: string | null;
		/** Non-entity context drawn quiet too: the architectural shell (walls, floors, openings). */
		contextRoots?: readonly Object3D[];
		/** Bumped when a root or its lazy body arrives; applies the mute to new meshes. */
		revision: number | string;
	} = $props();

	const { invalidate } = useThrelte();
	const MUTED_OPACITY = 0.22;
	type MuteRecord = { readonly original: Material | Material[]; readonly clone: Material | Material[] };
	const applied = new Map<Mesh, MuteRecord>();

	function mute(material: Material): Material {
		const clone = material.clone();
		clone.transparent = true;
		clone.opacity = Math.min(material.opacity, MUTED_OPACITY);
		clone.depthWrite = false;
		return clone;
	}
	function muteAll(material: Material | Material[]): Material | Material[] {
		return Array.isArray(material) ? material.map(mute) : mute(material);
	}
	function disposeAll(material: Material | Material[]): void {
		for (const one of Array.isArray(material) ? material : [material]) one.dispose();
	}
	function release(mesh: Mesh, record: MuteRecord): void {
		if (mesh.material === record.clone) mesh.material = record.original;
		disposeAll(record.clone);
		applied.delete(mesh);
	}
	function apply(root: Object3D): void {
		root.traverse((node) => {
			if (!(node instanceof Mesh)) return;
			const existing = applied.get(node);
			if (existing !== undefined) {
				if (node.material === existing.clone) return;
				// The representation replaced the material under us: take the new one.
				disposeAll(existing.clone);
				applied.delete(node);
			}
			const original = node.material;
			const clone = muteAll(original);
			applied.set(node, { original, clone });
			node.material = clone;
		});
	}

	$effect(() => {
		revision;
		const muted = new Set<Object3D>();
		for (const id of entityIds) {
			if (id === scopedId) continue;
			const root = scenePick.entityObject(id);
			if (root !== null) {
				muted.add(root);
				apply(root);
			}
		}
		for (const root of contextRoots) {
			muted.add(root);
			apply(root);
		}
		// A body that became the scoped root (or unmounted) is released.
		for (const [mesh, record] of [...applied]) {
			let inside = false;
			for (let node: Object3D | null = mesh; node !== null; node = node.parent) {
				if (muted.has(node)) { inside = true; break; }
			}
			if (!inside) release(mesh, record);
		}
		invalidate();
	});
	$effect(() => () => {
		for (const [mesh, record] of [...applied]) release(mesh, record);
		invalidate();
	});
</script>
