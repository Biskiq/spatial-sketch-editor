/**
 * P2 configuration set. One-factor sweeps, not a full factorial.
 *
 * The base point is fixed by the task: 1,000 meshes · 12 triangles ·
 * MeshStandardMaterial · shared material · 1 directional sun · shadows off ·
 * 1280×720 · DPR 1.
 *
 * `point` and `spot` are unshadowed lights added to the sun. `shadowCount`
 * selects a deterministic mix of shadow-casting lights; `shadowPasses` prices
 * point lights at six cube faces each.
 */

const BASE = Object.freeze({
	n: 1000,
	tris: 12,
	mode: 'separate-shared',
	material: 'standard',
	view: 'grid',
	point: 0,
	spot: 0,
	shadowCount: 0,
	shadowPolicy: 'every-frame',
	shadowMapSize: 1024
});

function config(id, group, label, overrides = {}) {
	return { ...BASE, ...overrides, id, group, label };
}

/** The deterministic shadow-casting mix per count. */
export function shadowLights(count) {
	if (count <= 0) return [];
	if (count === 1) return ['directional'];
	if (count === 2) return ['directional', 'spot'];
	if (count === 4) return ['directional', 'spot', 'spot', 'point'];
	if (count === 8) return ['directional', 'spot', 'spot', 'spot', 'spot', 'point', 'point', 'point'];
	throw new Error(`no shadow mix for ${count} lights`);
}

export function shadowPasses(cfg) {
	return shadowLights(cfg.shadowCount).reduce((sum, kind) => sum + (kind === 'point' ? 6 : 1), 0);
}

const modes = [
	['separate-unique', 'separate + unique materials'],
	['separate-shared', 'separate + shared material'],
	['instanced', 'InstancedMesh'],
	['batched', 'BatchedMesh']
];

function submissionGroup(n) {
	return modes.map(([mode, label]) =>
		config(`submission-${mode}-${n}`, 'submission', `N=${n} · ${label}`, { n, mode })
	);
}

export function allConfigs() {
	const list = [];

	list.push(config('base', 'base', 'Base point'));

	for (const n of [100, 500, 1000, 2500, 5000, 10000]) {
		list.push(config(`mesh-count-${n}`, 'mesh-count', `N=${n}`, { n }));
	}

	list.push(...submissionGroup(1000), ...submissionGroup(5000));

	for (const tris of [12, 1000, 5000]) {
		list.push(config(`triangles-${tris}`, 'triangles', `${tris} triangles/mesh`, { tris }));
	}

	list.push(config('material-lambert', 'material', 'MeshLambertMaterial', { material: 'lambert' }));

	for (const point of [0, 2, 4, 8, 16, 32, 64]) {
		list.push(
			config(`lights-point-1000-${point}`, 'lights-point', `${point} unshadowed point lights`, {
				point
			})
		);
	}

	for (const point of [0, 2, 4, 8, 16, 32, 64]) {
		list.push(
			config(`lights-point-5000-${point}`, 'lights-point-n5000', `${point} unshadowed point lights`, {
				n: 5000,
				point
			})
		);
	}

	for (const n of [1000, 5000]) {
		for (const spot of [4, 16]) {
			list.push(
				config(`lights-spot-${n}-${spot}`, `lights-spot`, `${spot} unshadowed spot lights`, {
					n,
					spot
				})
			);
		}
	}

	for (const point of [0, 2, 4, 8, 16, 32, 64]) {
		list.push(
			config(`lights-fill-${point}`, 'lights-fill', `${point} unshadowed point lights, fill view`, {
				n: 9,
				view: 'fill',
				point
			})
		);
	}
	for (const spot of [4, 16]) {
		list.push(
			config(`lights-fill-spot-${spot}`, 'lights-fill', `${spot} unshadowed spot lights, fill view`, {
				n: 9,
				view: 'fill',
				spot
			})
		);
	}

	for (const count of [0, 1, 2, 4, 8]) {
		list.push(
			config(`shadows-1000-${count}`, 'shadows', `${count} shadowed lights`, { shadowCount: count })
		);
	}
	for (const count of [0, 2, 4, 8]) {
		list.push(
			config(`shadows-5000-${count}`, 'shadows-n5000', `${count} shadowed lights`, {
				n: 5000,
				shadowCount: count
			})
		);
	}

	for (const n of [1000, 5000]) {
		for (const count of [2, 4]) {
			list.push(
				config(`shadow-cache-${n}-${count}`, 'shadow-cache', `${count} shadowed lights, cached`, {
					n,
					shadowCount: count,
					shadowPolicy: 'static'
				})
			);
		}
	}

	for (const size of [512, 1024, 2048]) {
		list.push(
			config(`shadow-map-${size}`, 'shadow-map', `2 shadowed lights, ${size}² map`, {
				shadowCount: 2,
				shadowMapSize: size
			})
		);
	}

	return list;
}

/** The dedicated 4 → 5 unshadowed-light compile step. */
export function compileStepConfig() {
	return config('compile-step-4-to-5', 'compile', 'First frame after 4 → 5 point lights', {
		point: 4
	});
}

export const BASE_CONFIG = config('base', 'base', 'Base point');
