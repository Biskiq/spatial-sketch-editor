/**
 * P23B measurement-only step — DEV identity probe for the commit-time wall-mesh
 * cache miss.
 *
 * THE QUESTION. The clean-tree containment capture measures the full 40-Wall
 * wall-mesh set being built twice for every accepted edit: once inside
 * `plan-apply` (keyed on the compile's own geometry object) and again inside the
 * commit's restore, which is a cache MISS. The cache is a `WeakMap` keyed by
 * geometry object identity, so the two builds must be receiving different object
 * identities. This probe records which identity each phase hands in — the
 * compile output, the live read, and the restore's snapshot geometry — so the
 * miss can be attributed instead of guessed at.
 *
 * WHAT IT RECORDS. One bounded ring buffer, published on
 * `globalThis.__P2311_MESH_IDENTITY__`:
 *
 *   phase            `install` (applyCompiledLayout) · `install-bundle`
 *                    (derivePreviewBundle) · `capture`
 *                    (captureLayoutPreviewSnapshot) · `commit-replace` (the
 *                    history boundary's own marker) · `restore`
 *                    (restoreLayoutPreviewSnapshotUnmeasured) · `prebuild-hit`
 *                    / `prebuild-miss` (resolveWallMeshes)
 *   geometryId       a stable id per geometry object identity (WeakMap)
 *   stateProxy       whether that object is a Svelte `$state` proxy — see the
 *                    note on HOW it is tested below
 *   walls            `geometry.walls.length` when present, else rooms, else null
 *   liveId           for `restore`: the identity id of `state.geometry`
 *   sameAsLive       for `restore`: `snapshot.geometry === state.geometry`
 *   lastInstallId    the most recent `install`/`install-bundle` geometry id
 *   sameAsInstall    whether this object is that one
 *
 * HOW `stateProxy` IS TESTED, stated exactly: `structuredClone(object)` throws a
 * `DataCloneError` for a Proxy exotic object and succeeds for the plain object
 * behind it, so "throws" is recorded as `stateProxy: true`. The test is memoized
 * per object identity, so each unique geometry is cloned at most once, and the
 * clone is discarded. This is a DEV-only diagnostic: it never changes a value,
 * never caches anything, and is inert unless Vite says DEV and
 * `__P2311_PERF__` is on — the same gate `p2311Measure` uses.
 */

export type P23BMeshIdentityPhase =
	| 'install'
	| 'install-bundle'
	| 'capture'
	| 'commit-replace'
	| 'restore'
	| 'prebuild-hit'
	| 'prebuild-miss';

export type P23BMeshIdentityRecord = {
	seq: number;
	at: number;
	phase: P23BMeshIdentityPhase;
	geometryId: number | null;
	stateProxy: boolean | null;
	walls: number | null;
	liveId: number | null;
	sameAsLive: boolean | null;
	lastInstallId: number | null;
	sameAsInstall: boolean | null;
};

/**
 * Room for a whole scripted capture (three fixtures, ~150 measured actions): the
 * run must keep its FIRST records, not just its last, because the owner fixture
 * is driven first. At ~12 rows per action this holds everything with room to
 * spare, and rows are plain scalars.
 */
export const P23B_MESH_IDENTITY_LIMIT = 20_000;
const ids = new WeakMap<object, number>();
const proxyChecks = new WeakMap<object, boolean>();
const records: P23BMeshIdentityRecord[] = [];
let nextId = 1;
let sequence = 0;
let lastInstallId: number | null = null;

function enabled(): boolean {
	const viteDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV;
	return viteDev !== false && (globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__ === true;
}

function idOf(value: object): number {
	const existing = ids.get(value);
	if (existing !== undefined) return existing;
	const id = nextId++;
	ids.set(value, id);
	return id;
}

function isStateProxy(value: object): boolean {
	const cached = proxyChecks.get(value);
	if (cached !== undefined) return cached;
	let proxied = false;
	try {
		structuredClone(value);
	} catch {
		proxied = true;
	}
	proxyChecks.set(value, proxied);
	return proxied;
}

function wallCount(value: object): number | null {
	const walls = (value as { walls?: unknown }).walls;
	if (Array.isArray(walls)) return walls.length;
	const rooms = (value as { rooms?: unknown }).rooms;
	if (Array.isArray(rooms)) return rooms.length;
	return null;
}

/**
 * Record one identity observation. Inert unless the DEV gate is on. A call with
 * no geometry is still recorded — that is how the `commit-replace` boundary
 * marker works — with every identity field `null`; a non-object geometry is
 * treated the same way rather than throwing.
 */
export function p2311ObserveMeshIdentity(
	phase: P23BMeshIdentityPhase,
	geometry?: unknown,
	live?: unknown
): void {
	if (!enabled()) return;
	const hasGeometry = typeof geometry === 'object' && geometry !== null;
	const geometryId = hasGeometry ? idOf(geometry as object) : null;
	const hasLive = typeof live === 'object' && live !== null;
	if (phase === 'install' || phase === 'install-bundle') {
		if (geometryId !== null) lastInstallId = geometryId;
	}
	records.push({
		seq: sequence++,
		at: performance.now(),
		phase,
		geometryId,
		stateProxy: hasGeometry ? isStateProxy(geometry as object) : null,
		walls: hasGeometry ? wallCount(geometry as object) : null,
		liveId: hasLive ? idOf(live as object) : null,
		sameAsLive: hasGeometry && hasLive ? geometry === live : null,
		lastInstallId,
		sameAsInstall: geometryId !== null ? geometryId === lastInstallId : null
	});
	if (records.length > P23B_MESH_IDENTITY_LIMIT) records.shift();
	(globalThis as { __P2311_MESH_IDENTITY__?: unknown }).__P2311_MESH_IDENTITY__ = records;
}

/** The probe's own records, for tests and for a DEV reader. */
export function p2311MeshIdentityRecords(): readonly P23BMeshIdentityRecord[] {
	return records;
}

/** Test seam only: forget every recorded id, record and memoized proxy check. */
export function p2311ResetMeshIdentity(): void {
	records.length = 0;
	sequence = 0;
	lastInstallId = null;
}
