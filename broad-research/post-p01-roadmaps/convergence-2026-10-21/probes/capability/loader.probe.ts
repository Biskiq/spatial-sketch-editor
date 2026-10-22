/**
 * Probe 2 (loader column). What the installed three@0.186.1 GLTFLoader exposes for the synthesized
 * part specimen, and what the current renderer closure (SkeletonUtils clone, as in model-utils.ts)
 * keeps. Distinguishes "loader exposes" from "Biskiq admits": nothing here is an admission.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/part-specimen.glb', import.meta.url));

async function load() {
	const bytes = readFileSync(FIXTURE);
	const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
	return new GLTFLoader().parseAsync(buffer, '');
}

function names(root: Object3D): string[] {
	const out: string[] = [];
	root.traverse((object) => out.push(`${object.type}:${object.name}`));
	return out;
}

describe('installed GLTFLoader over the part specimen', () => {
	it('keeps hierarchy, empties and extras but renames duplicate names', async () => {
		const gltf = await load();
		const trace = names(gltf.scene);
		console.log('LOADER TREE', JSON.stringify(trace));
		// Duplicate glTF node names become unique runtime names: a name is not even a stable
		// locator between the file and the loaded object within one revision.
		expect(trace).toEqual([
			'Group:Specimen', 'Object3D:Specimen_1', 'Mesh:Body', 'Object3D:LidHinge', 'Mesh:Lid',
			'Mesh:Foot', 'Mesh:Foot_1', 'Object3D:AnchorDial'
		]);
		// Names are also sanitized ('Anchor.Dial' -> 'AnchorDial') and deduplicated against the
		// scene name ('Specimen' -> 'Specimen_1'). The empty annotation marker survives with extras.
		const anchor = gltf.scene.getObjectByName('AnchorDial')!;
		// The original glTF name is kept only as userData.name.
		expect(anchor.userData).toEqual({ name: 'Anchor.Dial', note: 'author annotation marker' });
		expect(gltf.scene.getObjectByName('Body')!.userData.partHint).toBe('body');
	});

	it('exposes node indices only through parser.associations, which a clone does not carry', async () => {
		const gltf = await load();
		const assoc = gltf.parser.associations;
		const indexByName: Record<string, number | undefined> = {};
		gltf.scene.traverse((object) => {
			const mapping = assoc.get(object) as { nodes?: number } | undefined;
			if (mapping?.nodes !== undefined) indexByName[object.name] = mapping.nodes;
		});
		console.log('NODE INDEX ASSOCIATIONS', JSON.stringify(indexByName));
		expect(indexByName['Foot']).toBe(3);
		expect(indexByName['Foot_1']).toBe(4);
		expect(indexByName['AnchorDial']).toBe(5);
		expect(indexByName['Specimen_1']).toBe(6);
		const instance = clone(gltf.scene);
		let clonedAssociated = 0;
		instance.traverse((object) => {
			if (assoc.has(object)) clonedAssociated += 1;
		});
		// cloneModelScene() uses this clone: per-instance objects lose the node-index mapping
		// unless a provider maps it explicitly (e.g. by parallel traversal).
		expect(clonedAssociated).toBe(0);
	});

	it('loads the clip and leaves KHR_materials_variants as raw unknown-extension userData', async () => {
		const gltf = await load();
		expect(gltf.animations.map((clip) => clip.name)).toEqual(['LidOpen']);
		const tracks = gltf.animations[0]!.tracks.map((track) => track.name);
		console.log('CLIP TRACKS', JSON.stringify(tracks), 'duration', gltf.animations[0]!.duration);
		// Track binding is by runtime node NAME (PropertyBinding), so the clip's target identity
		// is the renamed runtime name, not the glTF node index.
		expect(tracks).toEqual(['LidHinge.quaternion']);
		// No variants plugin is registered: the root declaration and primitive mappings surface
		// only as raw JSON in userData.gltfExtensions; no variant material is constructed.
		const root = (gltf.userData as { gltfExtensions?: Record<string, unknown> }).gltfExtensions;
		expect(Object.keys(root ?? {})).toEqual(['KHR_materials_variants']);
		const body = gltf.scene.getObjectByName('Body')!;
		const mesh = body instanceof Mesh ? body : (body.children.find((child) => child instanceof Mesh) as Mesh | undefined);
		console.log('BODY USERDATA', JSON.stringify(mesh?.userData ?? body.userData));
		const raw = (mesh?.userData as { gltfExtensions?: Record<string, unknown> } | undefined)?.gltfExtensions;
		expect(raw && 'KHR_materials_variants' in raw).toBe(true);
		const materialNames = new Set<string>();
		gltf.scene.traverse((object) => {
			if (object instanceof Mesh) materialNames.add((object.material as { name: string }).name);
		});
		expect([...materialNames]).toEqual(['Default']);
	});
});
