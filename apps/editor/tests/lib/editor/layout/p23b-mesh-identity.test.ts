/**
 * P23B measurement-only step — the DEV identity probe.
 *
 * The probe is a diagnostic, so the contract to pin is small and exact: it is
 * inert unless Vite says DEV and `__P2311_PERF__` is on; with the gate on it
 * records one row per observation with a stable id per object identity; and it
 * never keeps more than its bound.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	P23B_MESH_IDENTITY_LIMIT,
	p2311MeshIdentityRecords,
	p2311ObserveMeshIdentity,
	p2311ObserveWallMeshStats,
	p2311ResetMeshIdentity
} from '$lib/editor/layout/p23b-mesh-identity';

const gate = globalThis as { __P2311_PERF__?: boolean; __P2311_MESH_IDENTITY__?: unknown };

beforeEach(() => {
	delete gate.__P2311_PERF__;
	delete gate.__P2311_MESH_IDENTITY__;
	p2311ResetMeshIdentity();
});

afterEach(() => {
	delete gate.__P2311_PERF__;
	delete gate.__P2311_MESH_IDENTITY__;
	p2311ResetMeshIdentity();
});

describe('P23B DEV mesh-identity probe', () => {
	it('records nothing while the perf gate is off', () => {
		p2311ObserveMeshIdentity('install', { walls: [] });
		expect(p2311MeshIdentityRecords()).toHaveLength(0);
		expect(gate.__P2311_MESH_IDENTITY__).toBeUndefined();
	});

	it('gives one stable id per object identity and compares a restore to the last install', () => {
		gate.__P2311_PERF__ = true;
		const installed = { walls: [1, 2, 3] };
		const other = { walls: [1, 2, 3] };

		p2311ObserveMeshIdentity('install', installed);
		p2311ObserveMeshIdentity('capture', installed, installed);
		p2311ObserveMeshIdentity('restore', other, installed);

		const records = p2311MeshIdentityRecords();
		expect(records.map((record) => record.phase)).toEqual(['install', 'capture', 'restore']);
		// Same object, same id; a structurally equal but distinct object is a
		// DIFFERENT id — which is the whole point of an identity-keyed cache.
		expect(records[0]?.geometryId).toBe(records[1]?.geometryId);
		expect(records[2]?.geometryId).not.toBe(records[0]?.geometryId);
		expect(records[1]?.sameAsInstall).toBe(true);
		expect(records[2]?.sameAsInstall).toBe(false);
		expect(records[2]?.sameAsLive).toBe(false);
		expect(records[2]?.liveId).toBe(records[0]?.geometryId);
		expect(records[2]?.walls).toBe(3);
		expect(gate.__P2311_MESH_IDENTITY__).toBe(records);
	});

	it('reports stateProxy false for a plain object and true for a Proxy', () => {
		gate.__P2311_PERF__ = true;
		p2311ObserveMeshIdentity('install', { walls: [] });
		p2311ObserveMeshIdentity('restore', new Proxy({ walls: [] }, {}));
		const records = p2311MeshIdentityRecords();
		expect(records[0]?.stateProxy).toBe(false);
		expect(records[1]?.stateProxy).toBe(true);
	});

	it('publishes one preparation\'s own built/reused accounting on its own row', () => {
		gate.__P2311_PERF__ = true;
		const geometry = { walls: [1, 2, 3] };
		const stats = { built: 4, reused: 36, refusedByReason: { 'compiled-wall-changed': 4 } };

		// The identity rows of a preparation keep `stats: null`: the accounting is a
		// fact about the preparation, not about the identity it ran for.
		p2311ObserveMeshIdentity('prebuild-miss', geometry);
		p2311ObserveWallMeshStats(stats, geometry);

		const records = p2311MeshIdentityRecords();
		expect(records.map((record) => record.phase)).toEqual(['prebuild-miss', 'prebuild-stats']);
		expect(records[0]?.stats).toBeNull();
		expect(records[1]?.stats).toEqual({
			built: 4,
			reused: 36,
			refusedByReason: { 'compiled-wall-changed': 4 }
		});
		// The row carries the identity too, so a stats row says WHICH generation
		// prepared 40 meshes out of 40 Walls.
		expect(records[1]?.geometryId).toBe(records[0]?.geometryId);
		// The recorded copy is the probe's own: a caller mutating its object
		// afterwards must not rewrite what was recorded.
		stats.built = 40;
		stats.refusedByReason['compiled-wall-changed'] = 40;
		expect(records[1]?.stats).toEqual({
			built: 4,
			reused: 36,
			refusedByReason: { 'compiled-wall-changed': 4 }
		});
	});

	it('records no preparation accounting while the perf gate is off', () => {
		p2311ObserveWallMeshStats({ built: 1, reused: 0, refusedByReason: {} }, { walls: [] });
		expect(p2311MeshIdentityRecords()).toHaveLength(0);
		expect(gate.__P2311_MESH_IDENTITY__).toBeUndefined();
	});

	it('keeps a bounded log, and records a boundary marker that carries no geometry', () => {
		gate.__P2311_PERF__ = true;
		for (let index = 0; index < P23B_MESH_IDENTITY_LIMIT + 1; index += 1) {
			p2311ObserveMeshIdentity('prebuild-hit', { walls: [] });
		}
		p2311ObserveMeshIdentity('commit-replace');
		const records = p2311MeshIdentityRecords();
		expect(records).toHaveLength(P23B_MESH_IDENTITY_LIMIT);
		expect(records.slice(0, -1).every((record) => record.phase === 'prebuild-hit')).toBe(true);
		expect(records.at(-1)).toMatchObject({
			phase: 'commit-replace',
			geometryId: null,
			stateProxy: null,
			sameAsInstall: null
		});
	});
});
