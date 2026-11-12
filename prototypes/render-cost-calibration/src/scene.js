import * as THREE from '../vendor/three.module.js';
import { shadowLights } from './configs.js';

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const DPR = 1;

const SPACING = 1.35;

function geometryForTriangles(tris) {
	if (tris === 12) return new THREE.BoxGeometry(1, 1, 1);
	// Sphere triangles = 2 × widthSegments × heightSegments.
	if (tris === 1000) return new THREE.SphereGeometry(0.55, 32, 16); // 1024 triangles
	if (tris === 5000) return new THREE.SphereGeometry(0.55, 50, 50); // 5000 triangles
	throw new Error(`no geometry for ${tris} triangles`);
}

export function trianglesPerMesh(geometry) {
	return geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
}

function materialFor(kind, color) {
	if (kind === 'lambert') return new THREE.MeshLambertMaterial({ color });
	return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0 });
}

function gridLayout(n) {
	const columns = Math.ceil(Math.sqrt(n));
	const rows = Math.ceil(n / columns);
	const width = (columns - 1) * SPACING;
	const height = (rows - 1) * SPACING;
	const extent = Math.max(width, height, 1) / 2;
	return { columns, rows, extent, positions: { width, height } };
}

function fillLayout() {
	// 3 × 3 large quads covering the whole 1280×720 viewport: fill-bound,
	// negligible draw count. The task's "large lit surfaces covering the screen".
	return { extent: 5.4, size: 3.6, gap: 3.5 };
}

/**
 * Build one scene. The returned `addPointLight` lets the compile probe add a
 * fifth light to the same scene, which is exactly the 4 → 5 variant change.
 */
export function buildScene(cfg) {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x0b0e12);

	const camera = new THREE.PerspectiveCamera(50, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 5000);
	const shadowsEnabled = cfg.shadowCount > 0;
	let extent;
	let geometry;
	let placements = [];

	if (cfg.view === 'fill') {
		const layout = fillLayout();
		extent = layout.extent;
		geometry = new THREE.PlaneGeometry(layout.size, layout.size);
		const offsets = [-layout.gap, 0, layout.gap];
		for (const x of offsets) {
			for (const y of offsets) placements.push({ x, y, z: 0 });
		}
		camera.position.set(0, 0, 6.2);
	} else {
		const layout = gridLayout(cfg.n);
		extent = layout.extent;
		geometry = geometryForTriangles(cfg.tris);
		const startX = -layout.positions.width / 2;
		const startY = -layout.positions.height / 2;
		for (let i = 0; i < cfg.n; i += 1) {
			const column = i % layout.columns;
			const row = Math.floor(i / layout.columns);
			placements.push({ x: startX + column * SPACING, y: startY + row * SPACING, z: 0 });
		}
		const halfHeight = (layout.positions.height / 2) * 1.05 + 1;
		const halfWidth = (layout.positions.width / 2) * 1.05 + 1;
		const distance = Math.max(halfHeight, halfWidth / camera.aspect) / Math.tan((camera.fov * Math.PI) / 360);
		camera.position.set(0, 0, distance + 4);
	}
	camera.lookAt(0, 0, 0);
	camera.updateMatrixWorld();

	const material = materialFor(cfg.material, 0xb8bec7);
	const meshes = [];
	const matrix = new THREE.Matrix4();
	const instances = Math.min(cfg.n, placements.length);

	if (cfg.mode === 'instanced') {
		const instanced = new THREE.InstancedMesh(geometry, material, instances);
		for (let i = 0; i < instances; i += 1) {
			const p = placements[i];
			matrix.makeTranslation(p.x, p.y, p.z);
			instanced.setMatrixAt(i, matrix);
		}
		instanced.instanceMatrix.needsUpdate = true;
		instanced.castShadow = shadowsEnabled;
		instanced.receiveShadow = shadowsEnabled;
		instanced.computeBoundingSphere();
		scene.add(instanced);
		meshes.push(instanced);
	} else if (cfg.mode === 'batched') {
		const vertexCount = geometry.attributes.position.count;
		const indexCount = geometry.index ? geometry.index.count : 0;
		const batched = new THREE.BatchedMesh(instances, vertexCount, indexCount, material);
		const geometryId = batched.addGeometry(geometry);
		for (let i = 0; i < instances; i += 1) {
			const p = placements[i];
			const instanceId = batched.addInstance(geometryId);
			matrix.makeTranslation(p.x, p.y, p.z);
			batched.setMatrixAt(instanceId, matrix);
		}
		batched.castShadow = shadowsEnabled;
		batched.receiveShadow = shadowsEnabled;
		batched.computeBoundingSphere();
		scene.add(batched);
		meshes.push(batched);
	} else {
		const unique = cfg.mode === 'separate-unique';
		for (let i = 0; i < instances; i += 1) {
			const p = placements[i];
			let meshMaterial = material;
			if (unique) {
				const shade = 0.55 + ((i * 37) % 90) / 200;
				meshMaterial = materialFor(cfg.material, new THREE.Color(shade, shade, shade));
			}
			const mesh = new THREE.Mesh(geometry, meshMaterial);
			mesh.position.set(p.x, p.y, p.z);
			mesh.castShadow = shadowsEnabled;
			mesh.receiveShadow = shadowsEnabled;
			scene.add(mesh);
			meshes.push(mesh);
		}
	}

	// The directional sun is present in every configuration; it casts only when
	// that configuration has shadow-casting lights.
	const sun = new THREE.DirectionalLight(0xffffff, 2.6);
	const sunDistance = Math.max(extent * 1.4, 6);
	sun.position.set(sunDistance * 0.55, sunDistance * 0.75, sunDistance * 0.9);
	sun.target.position.set(0, 0, 0);
	sun.castShadow = shadowsEnabled;
	if (shadowsEnabled) {
		const half = extent * 1.15 + 2;
		sun.shadow.camera.left = -half;
		sun.shadow.camera.right = half;
		sun.shadow.camera.top = half;
		sun.shadow.camera.bottom = -half;
		sun.shadow.camera.near = 0.1;
		sun.shadow.camera.far = sunDistance * 3 + extent * 4;
		sun.shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
		sun.shadow.bias = -0.0006;
	}
	scene.add(sun);
	scene.add(sun.target);

	const ringRadius = Math.max(extent * 0.55, 2.5);
	const ringHeight = Math.max(extent * 0.35, 1.6);

	function placeOnRing(light, index, total) {
		const angle = (index / Math.max(total, 1)) * Math.PI * 2;
		light.position.set(Math.cos(angle) * ringRadius, ringHeight, Math.sin(angle) * ringRadius);
	}

	// Ranged grid layout (lighting-system sweep): lights spread over the mesh
	// plane, each reaching about 1.5 grid cells, so a clustered system can cull.
	const rangedColumns = Math.max(1, Math.ceil(Math.sqrt(Math.max(cfg.point, 1))));
	const rangedCell = (extent * 2 + 2) / rangedColumns;
	function placeRanged(light, index) {
		const column = index % rangedColumns;
		const row = Math.floor(index / rangedColumns) % rangedColumns;
		light.position.set(
			-extent - 1 + (column + 0.5) * rangedCell,
			-extent - 1 + (row + 0.5) * rangedCell,
			1.2
		);
		light.distance = rangedCell * 1.5;
	}

	const points = [];
	for (let i = 0; i < cfg.point; i += 1) {
		const light = new THREE.PointLight(0xffe3bd, 45, 0, 2);
		if (cfg.lightLayout === 'grid-ranged') placeRanged(light, i);
		else placeOnRing(light, i, cfg.point);
		scene.add(light);
		points.push(light);
	}
	const spots = [];
	for (let i = 0; i < cfg.spot; i += 1) {
		const light = new THREE.SpotLight(0xfff0d0, 140, 0, 0.55, 0.35, 2);
		placeOnRing(light, i, cfg.spot);
		light.target.position.set(0, 0, 0);
		scene.add(light);
		scene.add(light.target);
		spots.push(light);
	}

	// Shadow-casting mix. The sun is index 0 for directional; extra spots and
	// points are separate objects from the unshadowed sweeps.
	const shadowLightsAdded = [];
	if (shadowsEnabled) {
		const mix = shadowLights(cfg.shadowCount);
		let spotIndex = 0;
		let pointIndex = 0;
		for (const kind of mix) {
			if (kind === 'directional') {
				shadowLightsAdded.push(sun);
				continue;
			}
			if (kind === 'spot') {
				const light = new THREE.SpotLight(0xfff0d0, 140, 0, 0.55, 0.35, 2);
				placeOnRing(light, 2 + spotIndex, 10);
				light.target.position.set(0, 0, 0);
				light.castShadow = true;
				light.shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
				light.shadow.bias = -0.0006;
				scene.add(light);
				scene.add(light.target);
				shadowLightsAdded.push(light);
				spotIndex += 1;
				continue;
			}
			const light = new THREE.PointLight(0xffe3bd, 45, 0, 2);
			placeOnRing(light, 5 + pointIndex, 12);
			light.castShadow = true;
			light.shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
			light.shadow.bias = -0.0006;
			scene.add(light);
			shadowLightsAdded.push(light);
			pointIndex += 1;
		}
	}

	let nextPointIndex = 0;
	function addPointLight() {
		const light = new THREE.PointLight(0xffe3bd, 45, 0, 2);
		if (cfg.lightLayout === 'grid-ranged') placeRanged(light, cfg.point + nextPointIndex);
		else placeOnRing(light, nextPointIndex, 12);
		nextPointIndex += 1;
		scene.add(light);
		return light;
	}

	return {
		scene,
		camera,
		meshes,
		extent,
		lights: { sun, points, spots, shadowLights: shadowLightsAdded },
		addPointLight,
		trianglesPerMesh: trianglesPerMesh(geometry)
	};
}

export function disposeScene(built) {
	const materials = new Set();
	const geometries = new Set();
	built.scene.traverse((object) => {
		if (object.geometry) geometries.add(object.geometry);
		if (object.material) {
			if (Array.isArray(object.material)) for (const m of object.material) materials.add(m);
			else materials.add(object.material);
		}
	});
	for (const geometry of geometries) geometry.dispose();
	for (const material of materials) material.dispose();
}
