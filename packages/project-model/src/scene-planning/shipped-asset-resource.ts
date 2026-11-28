/**
 * Shipped catalogue assets as typed resources, and the one grant rule.
 *
 * A catalogue model entity needs a `{kind:'asset'}` resource in the accepted
 * envelope before any project can place it. This module is the production form
 * of the fixture-only construction: the content revision is the shipped pin's
 * own `sha256-…` identity, so a pure planner can grant the exact revision the
 * registry ships.
 *
 * **The record is never rewritten.** An existing asset resource is reusable only
 * when it is resolved at the pin's revision; an existing lock is reusable only
 * when it pins that same revision. Anything else refuses `incompatible-resource`
 * before the caller installs a candidate, so Undo and history keep the accepted
 * bytes and no silently repaired record can change a copy's appearance.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */
import type { DependencyLockEntry, ProjectEnvelope, TypedResource } from '../units/types';
import { shippedModelContentRevision } from '../shipped-model-pins';
import { getShippedModelByAssetId } from '../shipped-static';

export const SHIPPED_ASSET_LOCK_DOMAIN = 'resource:asset' as const;

/** One shipped asset's resource record and the lock that pins its bytes. */
export type ShippedAssetResourceEntry = {
	readonly resource: TypedResource;
	readonly lock: DependencyLockEntry;
};

/**
 * The production resource record for one pinned shipped model.
 *
 * Returns `null` for an unknown id or a fallback-only placeholder: neither has
 * production bytes, so neither can become a resolved `asset` resource.
 */
export function shippedModelResourceEntry(assetId: string): ShippedAssetResourceEntry | null {
	const entry = getShippedModelByAssetId(assetId);
	if (entry === undefined || entry.pin === null || entry.productionFile === null) return null;
	const resource: TypedResource = {
		kind: 'asset',
		id: assetId,
		contentRevision: shippedModelContentRevision(entry.pin),
		pin: null,
		unresolved: null,
	};
	return { resource, lock: shippedAssetLockEntry(resource) };
}

/** The one dependency-lock entry that pins an asset resource's revision. */
export function shippedAssetLockEntry(resource: TypedResource): DependencyLockEntry {
	if (resource.kind !== 'asset' || resource.contentRevision === null) {
		throw new Error('An asset lock entry needs a resolved asset resource.');
	}
	return {
		domain: SHIPPED_ASSET_LOCK_DOMAIN,
		subjectKind: 'resource',
		subjectId: resource.id,
		instancePath: [],
		contentRevision: resource.contentRevision,
		requiredCapabilities: [],
		pin: null,
	};
}

export type ShippedAssetGrantRefusal = {
	readonly kind: 'refused';
	readonly code: 'incompatible-resource';
	readonly message: string;
	readonly diagnostics: readonly string[];
};

/**
 * The accepted result of applying the grant rule.
 *
 * `envelope` is the input envelope itself when nothing was added, so callers can
 * cheaply detect a pure reuse. `addedResources` and `addedLocks` name exactly
 * what the accepted result introduced.
 */
export type ShippedAssetGrant = {
	readonly kind: 'granted';
	readonly envelope: ProjectEnvelope;
	readonly assetIds: readonly string[];
	readonly addedResources: readonly TypedResource[];
	readonly addedLocks: readonly DependencyLockEntry[];
};

export type ShippedAssetGrantResult = ShippedAssetGrant | ShippedAssetGrantRefusal;

/**
 * Whether the §4.1 grant rule would accept these assets, without applying it.
 *
 * The live preview asks this exact question, so a held resource or an orphan
 * lock that acceptance would refuse never draws a committable ghost. It is the
 * same rule `grantShippedAssetResources` applies; the planning result remains
 * the only authority for the accepted envelope.
 */
export function shippedAssetGrantRefusal(
	envelope: ProjectEnvelope,
	assetIds: readonly string[],
): ShippedAssetGrantRefusal | null {
	const resources = envelope.units.resources.data.resources;
	const locks = envelope.dependencyLock.entries;
	for (const assetId of new Set(assetIds)) {
		const entry = shippedModelResourceEntry(assetId);
		if (entry === null) return refuse(assetId, 'unknown-shipped-asset');
		const expected = entry.lock.contentRevision;
		const held = resources.find((resource) => resource.kind === 'asset' && resource.id === assetId);
		const subjectLocks = locks.filter(
			(lock) =>
				lock.domain === SHIPPED_ASSET_LOCK_DOMAIN &&
				lock.subjectKind === 'resource' &&
				lock.subjectId === assetId &&
				lock.instancePath.length === 0,
		);
		for (const lock of subjectLocks) {
			if (lock.contentRevision !== expected) return refuse(assetId, 'lock-pins-another-revision');
		}
		if (held === undefined) continue;
		if (held.unresolved !== null) return refuse(assetId, 'unresolved-resource');
		const revision = held.contentRevision ?? held.pin?.hash ?? null;
		if (revision === null) return refuse(assetId, 'no-content-revision');
		if (revision !== expected) return refuse(assetId, 'revision-differs');
	}
	return null;
}

/**
 * Apply the §4.1 grant rule for each distinct shipped asset id.
 *
 * | Held `asset` resource | Result |
 * | --- | --- |
 * | none | add the resource; add the lock unless a matching one already pins the revision |
 * | resolved at the pin (with or without a lock) | reuse unchanged; add the lock if absent |
 * | resolved at another revision, or a lock pins another revision | refuse; never rewrite |
 * | unresolved, or no revision | refuse; never resolve silently |
 *
 * The whole grant is atomic: one refusing id yields no partial envelope.
 */
export function grantShippedAssetResources(
	envelope: ProjectEnvelope,
	assetIds: readonly string[],
): ShippedAssetGrantResult {
	const uniqueAssetIds = [...new Set(assetIds)];
	if (uniqueAssetIds.length === 0) {
		return {
			kind: 'granted',
			envelope,
			assetIds: [],
			addedResources: [],
			addedLocks: [],
		};
	}
	const refusal = shippedAssetGrantRefusal(envelope, uniqueAssetIds);
	if (refusal !== null) return refusal;
	const resources = [...envelope.units.resources.data.resources];
	const locks = [...envelope.dependencyLock.entries];
	const addedResources: TypedResource[] = [];
	const addedLocks: DependencyLockEntry[] = [];
	for (const assetId of uniqueAssetIds) {
		const entry = shippedModelResourceEntry(assetId);
		if (entry === null) return refuse(assetId, 'unknown-shipped-asset');
		const expected = entry.lock.contentRevision;
		const held = resources.find((resource) => resource.kind === 'asset' && resource.id === assetId);
		const subjectLocks = locks.filter(
			(lock) =>
				lock.domain === SHIPPED_ASSET_LOCK_DOMAIN &&
				lock.subjectKind === 'resource' &&
				lock.subjectId === assetId &&
				lock.instancePath.length === 0,
		);
		for (const lock of subjectLocks) {
			if (lock.contentRevision !== expected) return refuse(assetId, 'lock-pins-another-revision');
		}
		if (held !== undefined) {
			if (held.unresolved !== null) return refuse(assetId, 'unresolved-resource');
			const revision = held.contentRevision ?? held.pin?.hash ?? null;
			if (revision === null) return refuse(assetId, 'no-content-revision');
			if (revision !== expected) return refuse(assetId, 'revision-differs');
			if (subjectLocks.length === 0) {
				locks.push(entry.lock);
				addedLocks.push(entry.lock);
			}
			continue;
		}
		resources.push(entry.resource);
		addedResources.push(entry.resource);
		if (subjectLocks.length === 0) {
			locks.push(entry.lock);
			addedLocks.push(entry.lock);
		}
	}
	if (addedResources.length === 0 && addedLocks.length === 0) {
		return {
			kind: 'granted',
			envelope,
			assetIds: uniqueAssetIds,
			addedResources: [],
			addedLocks: [],
		};
	}
	return {
		kind: 'granted',
		envelope: {
			...envelope,
			units: {
				...envelope.units,
				resources: {
					header: { ...envelope.units.resources.header },
					data: {
						formatVersion: envelope.units.resources.data.formatVersion,
						resources,
					},
				},
			},
			dependencyLock: { ...envelope.dependencyLock, entries: locks },
		},
		assetIds: uniqueAssetIds,
		addedResources,
		addedLocks,
	};
}

function refuse(assetId: string, reason: string): ShippedAssetGrantRefusal {
	return {
		kind: 'refused',
		code: 'incompatible-resource',
		message: `This project holds a different copy of "${assetId}".`,
		diagnostics: [assetId, reason],
	};
}

/**
 * Append exactly what a grant added to an envelope that already carries other
 * accepted changes (a creator model resource, an Experience unlink).
 */
export function withShippedAssetGrant(
	envelope: ProjectEnvelope,
	grant: ShippedAssetGrant,
): ProjectEnvelope {
	if (grant.addedResources.length === 0 && grant.addedLocks.length === 0) return envelope;
	return {
		...envelope,
		units: {
			...envelope.units,
			resources: {
				header: { ...envelope.units.resources.header },
				data: {
					formatVersion: envelope.units.resources.data.formatVersion,
					resources: [...envelope.units.resources.data.resources, ...grant.addedResources],
				},
			},
		},
		dependencyLock: {
			...envelope.dependencyLock,
			entries: [...envelope.dependencyLock.entries, ...grant.addedLocks],
		},
	};
}
