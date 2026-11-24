/**
 * Appearance issues service (T2.S8 · U6).
 *
 * Merges two sources into one session-only model feeding the Head pill,
 * Repair drawer, Card diagnostic strip, Subject-card *Needs repair* badge and
 * Stage amber hatch layer:
 *
 * 1. **Static** — `inspectFinish` per accepted revision (`missing-image`,
 *    `missing-pin`, `missing-uv`, `missing-normal-frame`,
 *    `mapping-requires-metric-basis`).
 * 2. **Runtime** — per-target outcomes from the four Stage `acquireFinishViews`
 *    callers (`image-unavailable`, `image-unreachable`, `image-mismatch`,
 *    `image-undecodable`). `pending` and `budget` targets never count as
 *    issues and are never hatched.
 *
 * `affected` is strictly the failing/named subset of a Finish's users.
 * A session-owned fix list feeds *Repaired (…)*; entries with
 * `history: 'authored'` drop if Undo brings their issue back, while
 * `history: 'none'` (exact-byte `Relink…`) entries stay. Never serialized;
 * cleared on project switch.
 */
import type { MapRole, TargetAnalysis } from '@portfolio/project-model/materials';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import {
	analysisSubjectOf,
	catalogueBaseOf,
	entityUserKey,
	finishKeyOfRef,
	finishKeyOfSurface,
	finishRefOfKey,
	inspectFinish,
	isFinishPaintable,
	isPristineInstance,
	surfaceUserKey,
	type FinishKey,
	type InspectedFinishUser
} from '@portfolio/project-model/scene-planning';
import type { FinishTargetOutcome } from '$lib/render/resources/finish-outcome-sink';
import type { FinishViewIssue } from '$lib/render/resources/finish-views';

export type StaticRepairCode =
	| 'missing-image'
	| 'missing-pin'
	| 'missing-uv'
	| 'missing-normal-frame'
	| 'mapping-requires-metric-basis';

export type RuntimeRepairCode =
	| 'image-unavailable'
	| 'image-unreachable'
	| 'image-mismatch'
	| 'image-undecodable';

export type AppearanceIssueCode = StaticRepairCode | RuntimeRepairCode;

const STATIC_REPAIR_CODES = new Set<string>([
	'missing-image',
	'missing-pin',
	'missing-uv',
	'missing-normal-frame',
	'mapping-requires-metric-basis'
]);

const PROJECT_ASSET_URI = /^project-asset:\/\/([^/?#]+)/;

export type AppearanceIssueActionKind =
	| 'relink'
	| 'replace'
	| 'disable-role'
	| 'retry'
	| 'uv0'
	| 'surface-mapping';

export type AppearanceIssueAction = {
	readonly kind: AppearanceIssueActionKind;
	readonly label: string;
	readonly primary: boolean;
};

export type AppearanceIssue = {
	readonly id: string;
	readonly finishKey: FinishKey;
	readonly finishName: string;
	readonly code: AppearanceIssueCode;
	readonly role: MapRole | null;
	readonly source: 'static' | 'runtime';
	/** Target keys (`entity:<id>` or `surface:<surfaceKey>`) actually failing. */
	readonly affected: readonly string[];
	readonly title: string;
	readonly text: string;
	/** File / asset label when known (shown in monospace in the diagnostic strip). */
	readonly file: string | null;
	/** Project asset id when the failing image is a project-owned texture resource. */
	readonly assetId: string | null;
	/** Expected sha256 pin when the project holds one for `assetId` (enables Relink…). */
	readonly expectedPin: string | null;
	readonly actions: readonly AppearanceIssueAction[];
};

export type RepairedIssueEntry = {
	readonly id: string;
	readonly finishKey: FinishKey;
	readonly finishName: string;
	readonly code: AppearanceIssueCode;
	readonly role: MapRole | null;
	readonly action: string;
	readonly history: 'none' | 'authored';
};

export type AppearanceIssuesHost = {
	readonly envelope: () => ProjectEnvelope | null;
	readonly targetAnalysis?: () => TargetAnalysis | undefined;
	/** Exact-byte storage recovery (zero history entries). */
	readonly repairAsset?: (
		assetId: string,
		bytes: Uint8Array,
		expectedPin: string,
		signal?: AbortSignal
	) => Promise<{ readonly ok: true } | { readonly ok: false; readonly message: string }>;
	/** Invalidate cached GPU/store views for one project asset and trigger Stage re-acquire. */
	readonly invalidateAndReloadAsset?: (assetId: string) => void;
	/** Retry all failed textures on Stage and inspection preview. */
	readonly retryTextures?: () => void;
};

export function classifyRuntimeFailure(issue: FinishViewIssue): RuntimeRepairCode | null {
	if (issue.code !== 'image-load-failed') return null;
	if (issue.phase === 'verify') return 'image-mismatch';
	if (issue.phase === 'decode') return 'image-undecodable';
	if (issue.phase === 'acquire') {
		if (issue.httpStatus === 404 || issue.httpStatus === 410) return 'image-unavailable';
		return 'image-unreachable';
	}
	return 'image-unavailable';
}

function roleLabel(role: MapRole | null): string {
	switch (role) {
		case 'color': return 'colour';
		case 'normal': return 'relief';
		case 'roughness': return 'roughness';
		case 'metalness': return 'metal';
		case 'occlusion': return 'occlusion';
		default: return 'image';
	}
}

function disableLabelFor(role: MapRole | null): string {
	if (role === 'color') return 'Use colour instead';
	if (role === 'normal') return 'Turn off relief';
	if (role === 'roughness') return 'Turn off roughness';
	if (role === 'metalness') return 'Turn off metal';
	if (role === 'occlusion') return 'Turn off occlusion';
	return 'Turn off map';
}

function issueCopy(code: AppearanceIssueCode, role: MapRole | null): { readonly title: string; readonly text: string } {
	const channel = roleLabel(role);
	switch (code) {
		case 'missing-image':
		case 'image-unavailable':
			return {
				title: 'Missing image',
				text: `The ${channel} image is not available to this session.`
			};
		case 'image-unreachable':
			return {
				title: 'Image unreachable',
				text: `The ${channel} image could not be fetched right now.`
			};
		case 'image-mismatch':
			return {
				title: 'Image mismatch',
				text: `The ${channel} image bytes do not match the saved pin.`
			};
		case 'missing-pin':
			return {
				title: 'Unverified image',
				text: `The ${channel} image has no saved integrity pin.`
			};
		case 'image-undecodable':
			return {
				title: 'Unreadable image',
				text: `The ${channel} image could not be decoded.`
			};
		case 'missing-uv':
			return {
				title: 'Incompatible mapping',
				text: 'This model does not have the UV set this Finish expects.'
			};
		case 'missing-normal-frame':
			return {
				title: 'Missing relief frame',
				text: 'This surface has no tangent frame for relief.'
			};
		case 'mapping-requires-metric-basis':
			return {
				title: 'Incompatible mapping',
				text: 'Surface mapping needs metric UVs that this target does not provide.'
			};
	}
}

export function actionsForIssue(input: {
	readonly code: AppearanceIssueCode;
	readonly role: MapRole | null;
	readonly hasPin: boolean;
	readonly hasMetricBasis: boolean;
}): readonly AppearanceIssueAction[] {
	const { code, role, hasPin, hasMetricBasis } = input;
	const actions: AppearanceIssueAction[] = [];
	const push = (kind: AppearanceIssueActionKind, label: string) => {
		actions.push({ kind, label, primary: actions.length === 0 });
	};

	switch (code) {
		case 'missing-image':
		case 'image-unavailable':
		case 'image-mismatch':
			if (hasPin) push('relink', 'Relink…');
			push('replace', 'Replace image…');
			push('disable-role', disableLabelFor(role));
			return actions;
		case 'missing-pin':
		case 'image-undecodable':
			push('replace', 'Replace image…');
			push('disable-role', disableLabelFor(role));
			return actions;
		case 'image-unreachable':
			push('retry', 'Retry');
			return actions;
		case 'missing-uv':
			push('uv0', 'Use UV set 0');
			if (hasMetricBasis) push('surface-mapping', 'Surface mapping');
			return actions;
		case 'missing-normal-frame':
			push('disable-role', 'Turn off relief');
			return actions;
		case 'mapping-requires-metric-basis':
			push('uv0', 'Use UV set 0');
			return actions;
	}
}

function issueKey(finishKey: string, code: AppearanceIssueCode, role: MapRole | null): string {
	return `${finishKey}|${code}|${role ?? ''}`;
}

/**
 * Runtime callers name a project instance even when it is pristine.
 * A pristine instance renders exactly as its catalogue base, and
 * `inspectFinish` only lists users under that curated key, so the runtime key
 * must be canonicalised the same way or its issue is dropped.
 */
function canonicalFinishKey(envelope: ProjectEnvelope, key: FinishKey): FinishKey {
	if (!key.startsWith('project:')) return key;
	const id = key.slice('project:'.length);
	const instance = (envelope.units.scene.data.materials ?? []).find((entry) => entry.id === id);
	if (instance === undefined || !isPristineInstance(instance)) return key;
	const catalogue = catalogueBaseOf(instance);
	return catalogue === null ? key : `curated:${catalogue}`;
}

function activeFinishKeys(envelope: ProjectEnvelope): readonly FinishKey[] {
	const scene = envelope.units.scene.data;
	const keys = new Set<FinishKey>();
	for (const instance of scene.materials ?? []) {
		keys.add(`project:${instance.id}`);
		if (isPristineInstance(instance)) {
			const catalogue = catalogueBaseOf(instance);
			if (catalogue !== null) keys.add(`curated:${catalogue}`);
		}
	}
	for (const entity of scene.entities) {
		if (!isFinishPaintable(entity)) continue;
		if (entity.materialInstanceId !== undefined) {
			keys.add(`project:${entity.materialInstanceId}`);
		} else if (entity.kind !== 'model' || entity.materialId !== undefined) {
			const id = entity.materialId;
			if (id !== undefined) keys.add(`curated:${id}`);
		}
	}
	for (const assignment of scene.surfaceFinishes ?? []) {
		keys.add(finishKeyOfSurface(scene, assignment));
	}
	return [...keys];
}

function pinForAsset(
	envelope: ProjectEnvelope,
	assetId: string | null
): { readonly pin: string | null; readonly file: string | null } {
	if (assetId === null) return { pin: null, file: null };
	const resource = (envelope.units.resources?.data.resources ?? []).find(
		(entry) => entry.kind === 'texture' && entry.id === assetId
	);
	if (resource === undefined) return { pin: null, file: assetId };
	const record = resource as unknown as {
		readonly pin?: { readonly hash?: string } | null;
		readonly integrity?: { readonly hash?: string };
		readonly sha256?: string;
		readonly name?: string;
		readonly label?: string;
	};
	return {
		pin: record.pin?.hash ?? record.integrity?.hash ?? record.sha256 ?? null,
		file: record.name ?? record.label ?? assetId
	};
}

function assetIdForFinishRole(
	envelope: ProjectEnvelope,
	finishKey: FinishKey,
	role: MapRole | null
): string | null {
	if (role === null || !finishKey.startsWith('project:')) return null;
	const instanceId = finishKey.slice('project:'.length);
	const instance = (envelope.units.scene.data.materials ?? []).find((entry) => entry.id === instanceId);
	if (instance === undefined) return null;
	const override = instance.overrides?.maps?.[role];
	if (override !== undefined && override !== null && 'image' in override) {
		const image = override.image;
		if (image !== undefined && 'textureId' in image) return image.textureId;
	}
	if ('material' in instance.base) {
		const materialHash = instance.base.material;
		const def = (envelope.units.resources?.data.resources ?? []).find(
			(entry) => entry.kind === 'material' && entry.id === materialHash
		) as unknown as { readonly maps?: Partial<Record<MapRole, { readonly image?: { readonly textureId?: string } }>> } | undefined;
		const map = def?.maps?.[role];
		if (map?.image?.textureId !== undefined) return map.image.textureId;
	}
	return null;
}

/** Decode the canonical Layout surface key used in Finish issue targets. */
export function repairSurfaceRef(targetKey: string): import('@portfolio/layout-core').LayoutSurfaceRef | null {
	if (!targetKey.startsWith('surface:')) return null;
	try {
		const parts: unknown = JSON.parse(targetKey.slice('surface:'.length));
		if (!Array.isArray(parts) || typeof parts[1] !== 'string' || !parts[1]) return null;
		if (parts[0] === 'wall-side' && parts.length === 3 && (parts[2] === 'left' || parts[2] === 'right')) return { kind: 'wall-side', wallId: parts[1], side: parts[2] };
		if (parts[0] === 'room-floor' && parts.length === 2) return { kind: 'room-floor', roomId: parts[1] };
		if (parts[0] === 'room-lid' && parts.length === 2) return { kind: 'room-lid', roomId: parts[1] };
		if (parts[0] === 'region-face' && parts.length === 3 && (parts[2] === 'top' || parts[2] === 'underside')) return { kind: 'region-face', regionId: parts[1], face: parts[2] };
	} catch { /* Invalid target keys are not drawable surfaces. */ }
	return null;
}

export function createAppearanceIssues(host: AppearanceIssuesHost) {
	// Runtime outcomes keyed by targetKey (`entity:<id>` | `surface:<key>`).
	const runtimeByTarget = new Map<string, FinishTargetOutcome>();
	let runtimeVersion = $state(0);
	let repairGeneration = 0;
	const repairControllers = new Set<AbortController>();

	// Session-owned fix list for *Repaired (…)*. Never serialized.
	let repairedList = $state.raw<readonly RepairedIssueEntry[]>([]);

	// Inline refusal message for the last failed Relink / repair action, keyed by issue id.
	let refusal = $state.raw<{ readonly issueId: string; readonly message: string } | null>(null);

	function recordOutcome(outcome: FinishTargetOutcome): void {
		const previous = runtimeByTarget.get(outcome.targetKey);
		if (
			previous !== undefined &&
			previous.finishKey === outcome.finishKey &&
			previous.state === outcome.state &&
			previous.issues.length === outcome.issues.length &&
			previous.issues.every(
				(issue, index) =>
					issue.code === outcome.issues[index]?.code &&
					issue.role === outcome.issues[index]?.role &&
					issue.phase === outcome.issues[index]?.phase &&
					issue.httpStatus === outcome.issues[index]?.httpStatus &&
					issue.uri === outcome.issues[index]?.uri
			)
		) {
			return;
		}
		runtimeByTarget.set(outcome.targetKey, outcome);
		runtimeVersion += 1;
	}

	function clearTargetOutcome(targetKey: string): void {
		if (runtimeByTarget.delete(targetKey)) runtimeVersion += 1;
	}

	function cancelRepairs(): void {
		repairGeneration += 1;
		for (const controller of repairControllers) controller.abort();
		repairControllers.clear();
	}

	function reset(): void {
		cancelRepairs();
		runtimeByTarget.clear();
		runtimeVersion += 1;
		repairedList = [];
		refusal = null;
	}

	/** Compute the merged open issues for the current accepted revision + runtime outcomes. */
	const openIssues = $derived.by((): readonly AppearanceIssue[] => {
		// Subscribe to runtime outcome changes.
		void runtimeVersion;
		const envelope = host.envelope();
		if (envelope === null) return [];
		const targetAnalysis = host.targetAnalysis?.();
		const keys = activeFinishKeys(envelope);

		type Bucket = {
			finishKey: FinishKey;
			finishName: string;
			code: AppearanceIssueCode;
			role: MapRole | null;
			source: 'static' | 'runtime';
			affected: Set<string>;
			assetId: string | null;
			hasMetricBasis: boolean;
		};
		const buckets = new Map<string, Bucket>();
		const usersByFinish = new Map<FinishKey, readonly InspectedFinishUser[]>();
		const nameByFinish = new Map<FinishKey, string>();

		for (const finishKey of keys) {
			const ref = finishRefOfKey(finishKey);
			if (ref === null || ref === 'model-own') continue;
			const inspection = inspectFinish(envelope, ref, targetAnalysis === undefined ? {} : { analysis: targetAnalysis });
			if (inspection === null) continue;
			usersByFinish.set(finishKey, inspection.users);
			nameByFinish.set(finishKey, inspection.name);

			const userBySubject = new Map<string, InspectedFinishUser>();
			for (const user of inspection.users) {
				userBySubject.set(analysisSubjectOf(user), user);
			}

			for (const issue of inspection.issues) {
				if (!STATIC_REPAIR_CODES.has(issue.code)) continue;
				const code = issue.code as StaticRepairCode;
				const role = issue.role ?? null;
				const affectedUsers: InspectedFinishUser[] =
					issue.target !== undefined
						? (userBySubject.has(issue.target) ? [userBySubject.get(issue.target)!] : [])
						: [...inspection.users];
				if (affectedUsers.length === 0) continue;

				const id = issueKey(finishKey, code, role);
				let bucket = buckets.get(id);
				if (bucket === undefined) {
					bucket = {
						finishKey,
						finishName: inspection.name,
						code,
						role,
						source: 'static',
						affected: new Set(),
						assetId: assetIdForFinishRole(envelope, finishKey, role),
						hasMetricBasis: false
					};
					buckets.set(id, bucket);
				}
				for (const user of affectedUsers) {
					bucket.affected.add(user.key);
					if (user.kind === 'surface') {
						bucket.hasMetricBasis = true;
					} else if (targetAnalysis !== undefined) {
						const facts = targetAnalysis([
							{
								subject: analysisSubjectOf(user),
								domain: 'scene',
								entityId: user.entityId,
								expectedGeometryRevision: envelope.units.scene.header.contentRevision
							}
						]);
						if (facts?.[0]?.metricBasis !== undefined) bucket.hasMetricBasis = true;
					}
				}
			}
		}

		// Merge runtime failures — strictly for failing targets that still use that Finish.
		for (const outcome of runtimeByTarget.values()) {
			if (outcome.state !== 'failed') continue;
			const finishKey = canonicalFinishKey(envelope, outcome.finishKey);
			const users = usersByFinish.get(finishKey);
			if (users === undefined || !users.some((user) => user.key === outcome.targetKey)) continue;
			const finishName = nameByFinish.get(finishKey) ?? finishKey;
			for (const viewIssue of outcome.issues) {
				const code = classifyRuntimeFailure(viewIssue);
				if (code === null) continue;
				const role: MapRole | null = viewIssue.role ?? null;
				const id = issueKey(finishKey, code, role);
				const uriAssetId = viewIssue.uri ? (PROJECT_ASSET_URI.exec(viewIssue.uri)?.[1] ?? null) : null;
				let bucket = buckets.get(id);
				if (bucket === undefined) {
					bucket = {
						finishKey,
						finishName,
						code,
						role,
						source: 'runtime',
						affected: new Set(),
						assetId: uriAssetId ?? assetIdForFinishRole(envelope, finishKey, role),
						hasMetricBasis: false
					};
					buckets.set(id, bucket);
				}
				bucket.affected.add(outcome.targetKey);
			}
		}

		const result: AppearanceIssue[] = [];
		for (const [id, bucket] of buckets) {
			if (bucket.affected.size === 0) continue;
			const pinInfo = pinForAsset(envelope, bucket.assetId);
			const copy = issueCopy(bucket.code, bucket.role);
			result.push({
				id,
				finishKey: bucket.finishKey,
				finishName: bucket.finishName,
				code: bucket.code,
				role: bucket.role,
				source: bucket.source,
				affected: [...bucket.affected],
				title: copy.title,
				text: copy.text,
				file: pinInfo.file,
				assetId: bucket.assetId,
				expectedPin: pinInfo.pin,
				actions: actionsForIssue({
					code: bucket.code,
					role: bucket.role,
					hasPin: pinInfo.pin !== null,
					hasMetricBasis: bucket.hasMetricBasis
				})
			});
		}
		return result;
	});

	/** Visible *Repaired (…)* list: drops `history: 'authored'` entries whose issue is open again. */
	const repaired = $derived.by((): readonly RepairedIssueEntry[] => {
		const openIds = new Set(openIssues.map((issue) => issue.id));
		return repairedList.filter((entry) => entry.history === 'none' || !openIds.has(entry.id));
	});

	/** Union of all open issues' affected targets (drives the Stage amber hatch layer). */
	const hatchedTargets = $derived.by((): ReadonlySet<string> => {
		const set = new Set<string>();
		for (const issue of openIssues) {
			for (const targetKey of issue.affected) set.add(targetKey);
		}
		return set;
	});

	/** Targets currently in texture-budget state (not an issue; drives readiness line). */
	const budgetTargets = $derived.by((): ReadonlySet<string> => {
		void runtimeVersion;
		const set = new Set<string>();
		for (const outcome of runtimeByTarget.values()) {
			if (outcome.state === 'budget') set.add(outcome.targetKey);
		}
		return set;
	});

	function noteRepaired(entry: {
		readonly finishKey: FinishKey;
		readonly finishName: string;
		readonly code: AppearanceIssueCode;
		readonly role: MapRole | null;
		readonly action: string;
		readonly history: 'none' | 'authored';
	}): void {
		const id = issueKey(entry.finishKey, entry.code, entry.role);
		repairedList = [
			...repairedList.filter((item) => item.id !== id),
			{ id, ...entry }
		];
		if (refusal?.issueId === id) refusal = null;
	}

	function issuesForTarget(targetKey: string): readonly AppearanceIssue[] {
		return openIssues.filter((issue) => issue.affected.includes(targetKey));
	}

	function hasIssuesForTarget(targetKey: string): boolean {
		return hatchedTargets.has(targetKey);
	}

	function refusalFor(issueId: string): string | null {
		return refusal?.issueId === issueId ? refusal.message : null;
	}

	function setRefusal(issueId: string, message: string | null): void {
		refusal = message === null ? null : { issueId, message };
	}

	async function relink(
		issue: AppearanceIssue,
		file: File,
		signal?: AbortSignal
	): Promise<{ readonly ok: true } | { readonly ok: false; readonly message: string }> {
		if (issue.assetId === null || issue.expectedPin === null || host.repairAsset === undefined) {
			const message = 'Exact-byte relink is unavailable for this image.';
			refusal = { issueId: issue.id, message };
			return { ok: false, message };
		}
		const generation = repairGeneration;
		const controller = new AbortController();
		repairControllers.add(controller);
		const abort = () => controller.abort();
		if (signal?.aborted) abort();
		else signal?.addEventListener('abort', abort, { once: true });
		const cancelled = () => controller.signal.aborted || generation !== repairGeneration;
		let outcome: Awaited<ReturnType<NonNullable<AppearanceIssuesHost['repairAsset']>>>;
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			if (cancelled()) return { ok: false, message: 'Repair was cancelled.' };
			outcome = await host.repairAsset(issue.assetId, bytes, issue.expectedPin, controller.signal);
			if (cancelled()) return { ok: false, message: 'Repair was cancelled.' };
		} catch (error) {
			if (cancelled()) return { ok: false, message: 'Repair was cancelled.' };
			const message = error instanceof Error ? error.message : 'Could not read that file.';
			refusal = { issueId: issue.id, message };
			return { ok: false, message };
		} finally {
			repairControllers.delete(controller);
			signal?.removeEventListener('abort', abort);
		}
		if (!outcome.ok) {
			refusal = { issueId: issue.id, message: outcome.message };
			return outcome;
		}
		refusal = null;
		// Clear failing runtime entries for affected targets and re-acquire from repaired storage.
		for (const targetKey of issue.affected) {
			runtimeByTarget.delete(targetKey);
		}
		runtimeVersion += 1;
		host.invalidateAndReloadAsset?.(issue.assetId);
		noteRepaired({
			finishKey: issue.finishKey,
			finishName: issue.finishName,
			code: issue.code,
			role: issue.role,
			action: 'relinked',
			history: 'none'
		});
		return { ok: true };
	}

	function retry(issue: AppearanceIssue): void {
		refusal = null;
		for (const targetKey of issue.affected) {
			runtimeByTarget.delete(targetKey);
		}
		runtimeVersion += 1;
		if (issue.assetId !== null) {
			host.invalidateAndReloadAsset?.(issue.assetId);
		} else {
			host.retryTextures?.();
		}
	}

	return {
		get open(): readonly AppearanceIssue[] {
			return openIssues;
		},
		get repaired(): readonly RepairedIssueEntry[] {
			return repaired;
		},
		get count(): number {
			return openIssues.length;
		},
		get any(): boolean {
			return openIssues.length > 0 || repaired.length > 0;
		},
		get hatchedTargets(): ReadonlySet<string> {
			return hatchedTargets;
		},
		get budgetTargets(): ReadonlySet<string> {
			return budgetTargets;
		},
		recordOutcome,
		clearTargetOutcome,
		issuesForTarget,
		hasIssuesForTarget,
		refusalFor,
		setRefusal,
		noteRepaired,
		relink,
		retry,
		cancelRepairs,
		reset
	};
}

export type AppearanceIssuesService = ReturnType<typeof createAppearanceIssues>;
