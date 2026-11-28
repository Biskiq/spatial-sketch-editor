/**
 * T2 D8p — the one group-copy placement session.
 *
 * A curated fixture and a saved group enter the Stage through this session and
 * nowhere else. It carries one `GroupTemplate`, the name captured with it and
 * one origin mode (`support`, `overhead`, `wall`), and it owns the placement
 * lifecycle the D8s specimen accepted:
 *
 * - **One ghost, one write.** The preview is `prepareGroupCopyCandidate` — the
 *   same D8b preparation `place-group-copy` re-runs on acceptance — invoked with
 *   the captured template, ids, contacts and origin the intent will carry. The
 *   ghost is the composed member set that planner returns, so the pose on screen
 *   is the pose acceptance installs, and a refused copy still shows the planner's
 *   own composed members in refusal ink.
 * - **Origins use existing authorities.** `support` and `overhead` are resolved
 *   by the planner from the compiled Layout (an overhead face comes from T1's
 *   downward query); `wall` is the editor-derived pose the Artwork precedent
 *   uses, with the pointer's own wall normal as its facing. No ceiling, wall or
 *   slope authority lives here.
 * - **One gesture lease, one intent.** `begin` acquires the Stage's lease,
 *   `commit` submits exactly one `place-group-copy` and releases it, and `cancel`
 *   (Escape) releases it without writing. Placement stays armed after a commit
 *   and mints fresh identities for the next copy; a pointer interruption only
 *   withdraws the proposal.
 * - **The new group is selected.** Acceptance reports the captured cluster id
 *   through `selectGroup`, so the caller selects the group canonically.
 * - **No frame and no relation.** The template and the copy are ordinary Scene
 *   source; nothing here stores a mount, a parent or a group frame.
 */
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneEntity, Vec3 } from '@portfolio/project-model/scene';
import type { SceneGroupCopyOrigin } from '@portfolio/project-model/scene-planning';
import {
	prepareGroupCopyCandidate,
	shippedAssetGrantRefusal,
} from '@portfolio/project-model/scene-planning';
import type {
	GestureAcquisition,
	StageAdapterContext,
	StageCandidatePreview,
	StageGhostMesh,
} from '$lib/authoring/stage/stage-adapter-host';
import { snapDraftingPlacement } from '$lib/authoring/stage/stage-adapter-host';
import { nextGroupName } from './group-names';
import type { ArmedGroupCopy } from './group-copy-arm';
import type {
	GroupCopyCandidate,
	GroupCopyOutcome,
	GroupCopyPlacementPorts,
	GroupCopyPlacementSession,
	GroupCopyPointer,
} from './group-copy-contract';
import { resolveArm, type ResolvedArm } from './group-copy-arm-resolution';
import {
	creatorWords,
	pointerRefusal,
	type GroupCopyRefusal,
	type RefusalLike,
} from './group-copy-refusals';
import { ghostForMember, modelFootprint, mountLabel } from './group-copy-presentation';
import type { SceneWriteOutcome } from './placement';
import { FRAME, PROJECT_WORLD } from './scene-placement-support';

export {
	armGroupCopy,
	clearArmedGroupCopy,
	peekArmedGroupCopy,
	type ArmedGroupCopy,
	type GroupCopyOriginMode,
} from './group-copy-arm';
export type {
	GroupCopyCandidate,
	GroupCopyOutcome,
	GroupCopyPlacementPorts,
	GroupCopyPlacementSession,
	GroupCopyPlacementSource,
	GroupCopyPointer,
} from './group-copy-contract';
export { groupCopyPointerAt } from './group-copy-pointer';

const PLACEMENT_OWNER = 'scene-group-copy';
const WALL_MAX_NORMAL_Y = 0.2;

type CapturedIdentities = {
	readonly entityIds: readonly string[];
	readonly clusterId: string;
};

type DisplayProposal = { readonly members: readonly SceneEntity[] };

type SessionState = {
	readonly ports: GroupCopyPlacementPorts;
	readonly mint: () => string;
	armed: ArmedGroupCopy | null;
	resolved: ResolvedArm | null;
	captured: CapturedIdentities | null;
	lease: GestureAcquisition | null;
	candidate: GroupCopyCandidate | null;
	proposal: DisplayProposal | null;
	refusal: GroupCopyRefusal | null;
};

function releaseLease(state: SessionState): void {
	if (state.lease !== null && state.lease.kind === 'granted') state.lease.lease.release();
	state.lease = null;
}

function live(state: SessionState): boolean {
	return state.lease !== null && state.lease.kind === 'granted' && state.lease.lease.active;
}

function withdraw(state: SessionState): void {
	releaseLease(state);
	state.candidate = null;
	state.proposal = null;
	state.refusal = null;
}

function disarm(state: SessionState): void {
	withdraw(state);
	state.armed = null;
	state.resolved = null;
	state.captured = null;
}

function currentArm(state: SessionState): ResolvedArm | null {
	if (state.armed === null) return null;
	const resolution = resolveArm(state.armed, state.ports.read());
	if (resolution.kind === 'refused') {
		state.resolved = null;
		state.refusal = resolution.refusal;
		return null;
	}
	state.resolved = resolution.arm;
	return state.resolved;
}

function capturedIdentities(state: SessionState, memberCount: number): CapturedIdentities {
	if (state.captured === null) {
		state.captured = {
			entityIds: Array.from({ length: memberCount }, () => `entity-${state.mint()}`),
			clusterId: `cluster-${state.mint()}`,
		};
	}
	return state.captured;
}

function refuse(
	state: SessionState,
	code: string,
	message: string,
	at: Vec3 | null,
): GroupCopyOutcome {
	state.candidate = null;
	state.proposal = null;
	state.refusal = { code, message, at };
	return { kind: 'refused', code, message };
}

function buildCandidate(
	state: SessionState,
	arm: ResolvedArm,
	pointer: GroupCopyPointer,
	snappedStep: number | null,
): GroupCopyOutcome {
	const source = state.ports.read();
	const preparedFor = {
		revisionId: state.ports.acceptedRevisionId(),
		sourceContentId: source.sourceContentId,
	};
	const mode = arm.copy.origin;
	const visibleSupport = mode === 'support' ? pointer.support : null;
	const step = snappedStep !== null && snappedStep > 0 ? snappedStep : null;
	let origin: SceneGroupCopyOrigin;
	let yaw = 0;
	if (mode === 'wall') {
		const normal = pointer.wallNormal;
		if (
			normal === null ||
			!normal.every(Number.isFinite) ||
			Math.abs(normal[1]) > WALL_MAX_NORMAL_Y
		) {
			return refuse(state, 'not-a-wall', 'Point at a wall', pointer.point);
		}
		origin = { kind: 'wall', position: [pointer.point[0], pointer.point[1], pointer.point[2]] };
		yaw = Math.atan2(normal[0], normal[2]);
	} else if (mode === 'support') {
		// The visible support Place would commit: already snapped and pinned to
		// the witness the creator saw, never the raw ray hit or a re-snap.
		if (visibleSupport === null) {
			const words = pointerRefusal('support');
			return refuse(state, words.code, words.message, pointer.point);
		}
		origin = {
			kind: 'support',
			worldXZ: [visibleSupport.x, visibleSupport.z],
			choice: visibleSupport.choice,
		};
	} else {
		// Overhead keeps the deliberate any-hit X/Z: the pointer may be over a body
		// while the face above it resolves, and only the visible floor choice is
		// carried so the planner reads the same datum.
		const snapped = snapDraftingPlacement([pointer.point[0], pointer.point[2]], step);
		origin = {
			kind: 'overhead',
			worldXZ: [snapped.x, snapped.z],
			...(pointer.support === null ? {} : { choice: pointer.support.choice }),
		};
	}
	const identities = capturedIdentities(state, arm.template.members.length);
	const name = nextGroupName(source.scene, arm.name);
	let proposed: readonly SceneEntity[] = [];
	const prepared = prepareGroupCopyCandidate({
		context: {
			layout: source.layout,
			scene: source.scene,
			sourceContentId: source.sourceContentId,
		},
		template: arm.template,
		name,
		origin,
		yaw,
		frame: FRAME,
		entityIds: identities.entityIds,
		clusterId: identities.clusterId,
		contacts: arm.contacts,
		definitions: source.definitions,
		onProposed: (members) => {
			proposed = members;
		},
	});
	if (prepared.kind === 'rejected') {
		const words = creatorWords({
			refusal: prepared,
			template: arm.template,
			entityIds: identities.entityIds,
			name,
		});
		state.candidate = null;
		state.proposal = proposed.length === 0 ? null : { members: proposed };
		state.refusal = { code: prepared.code, message: words, at: pointer.point };
		return { kind: 'refused', code: prepared.code, message: words };
	}
	const members = prepared.entityIds.flatMap((entityId) => {
		const entity = prepared.scene.entities.find((entry) => entry.id === entityId);
		return entity === undefined ? [] : [entity];
	});
	// The D8a grant rule is read here, before anything is committable. A held
	// asset or orphan lock that acceptance refuses must refuse the preview with
	// the same reason instead of drawing a ghost the install could never take.
	const grantRefusal = shippedAssetGrantRefusal(source.envelope, prepared.assets);
	if (grantRefusal !== null) {
		const words = creatorWords({
			refusal: grantRefusal,
			template: arm.template,
			entityIds: identities.entityIds,
			name,
		});
		state.candidate = null;
		state.proposal = members.length === 0 ? null : { members };
		state.refusal = { code: grantRefusal.code, message: words, at: pointer.point };
		return { kind: 'refused', code: grantRefusal.code, message: words };
	}
	const anchor: Vec3 =
		origin.kind === 'wall'
			? [origin.position[0], origin.position[1], origin.position[2]]
			: [
					origin.worldXZ[0],
					prepared.support?.elevation ?? visibleSupport?.elevation ?? pointer.point[1],
					origin.worldXZ[1],
				];
	const next: GroupCopyCandidate = {
		template: arm.template,
		name,
		origin,
		yaw,
		anchor,
		mount: mountLabel({ mode, layout: source.layout, anchor, evidence: prepared.support }),
		entityIds: [...identities.entityIds],
		clusterId: identities.clusterId,
		contacts: [...arm.contacts],
		preparedFor,
		members,
	};
	state.candidate = next;
	state.proposal = null;
	state.refusal = null;
	return { kind: 'candidate', candidate: next };
}

function drawnMembers(state: SessionState): readonly SceneEntity[] {
	return state.candidate?.members ?? state.proposal?.members ?? [];
}

function armCopy(state: SessionState, copy: ArmedGroupCopy | null): GroupCopyOutcome {
	disarm(state);
	if (copy === null) return { kind: 'idle' };
	state.armed = copy;
	const resolution = resolveArm(copy, state.ports.read());
	if (resolution.kind === 'refused') {
		state.refusal = resolution.refusal;
		return {
			kind: 'refused',
			code: resolution.refusal.code,
			message: resolution.refusal.message,
		};
	}
	state.resolved = resolution.arm;
	return { kind: 'idle' };
}

function beginCopy(
	state: SessionState,
	copy: ArmedGroupCopy,
	pointer: GroupCopyPointer | null,
	evaluationId: string,
	snappedStep: number | null,
): GroupCopyOutcome {
	const armedOutcome = armCopy(state, copy);
	if (armedOutcome.kind === 'refused') return armedOutcome;
	releaseLease(state);
	const acquisition = state.ports.acquireGesture({
		owner: PLACEMENT_OWNER,
		evaluationId,
		policy: 'cancel-on-reading-change',
	});
	if (acquisition.kind === 'refused') {
		return {
			kind: 'refused',
			code: acquisition.code,
			message:
				acquisition.code === 'gesture-held'
					? `Another ${acquisition.owner} gesture is live.`
					: 'This editing session is stale.',
		};
	}
	state.lease = acquisition;
	if (pointer !== null) return buildCandidate(state, state.resolved!, pointer, snappedStep);
	const words = pointerRefusal(copy.origin);
	return refuse(state, words.code, words.message, null);
}

function previewCopy(
	state: SessionState,
	pointer: GroupCopyPointer | null,
	snappedStep: number | null,
): GroupCopyOutcome {
	// A gesture whose lease ended (a reading change) must not keep showing a
	// candidate that `commit` would refuse.
	if (state.lease !== null && !live(state)) {
		withdraw(state);
		return { kind: 'idle' };
	}
	const arm = currentArm(state);
	if (arm === null) {
		if (state.refusal !== null) {
			return { kind: 'refused', code: state.refusal.code, message: state.refusal.message };
		}
		return { kind: 'idle' };
	}
	if (pointer === null) {
		const words = pointerRefusal(arm.copy.origin);
		return refuse(state, words.code, words.message, null);
	}
	return buildCandidate(state, arm, pointer, snappedStep);
}

function intentOf(state: SessionState, shown: GroupCopyCandidate): AuthoringIntent {
	return {
		version: 1,
		kind: 'place-group-copy',
		operationId: state.mint(),
		expectedRevision: {
			projectId: state.ports.read().projectId,
			// The revision the ghost was prepared against, never a newer one read
			// at submit time.
			revisionId: shown.preparedFor.revisionId,
		},
		targets: [],
		payload: {
			kind: 'place-group-copy',
			template: shown.template,
			name: shown.name,
			origin:
				shown.origin.kind === 'wall'
					? { kind: 'wall', position: [...shown.origin.position] }
					: {
							kind: shown.origin.kind,
							worldXZ: [...shown.origin.worldXZ],
							...(shown.origin.choice === undefined ? {} : { supportChoice: shown.origin.choice }),
						},
			yaw: shown.yaw,
			frame: FRAME,
			frameReference: PROJECT_WORLD,
			entityIds: [...shown.entityIds],
			clusterId: shown.clusterId,
			contacts: [...shown.contacts],
		},
		capturedInputs: [],
		allocatedIds: [],
	};
}

function holdAcceptRefusal(
	state: SessionState,
	shown: GroupCopyCandidate,
	refusal: RefusalLike,
): void {
	releaseLease(state);
	state.refusal = {
		code: refusal.code,
		message: creatorWords({
			refusal,
			template: shown.template,
			entityIds: shown.entityIds,
			name: shown.name,
		}),
		at: shown.anchor,
	};
	state.proposal = { members: shown.members };
	state.candidate = null;
	state.ports.notify();
}

async function commitCopy(state: SessionState): Promise<GroupCopyOutcome> {
	const shown = state.candidate;
	if (shown === null) {
		releaseLease(state);
		return {
			kind: 'refused',
			code: 'no-candidate',
			message: 'Preview a valid placement before committing.',
		};
	}
	if (!live(state)) {
		withdraw(state);
		return {
			kind: 'refused',
			code: 'no-candidate',
			message: 'The preview was cancelled by a reading change.',
		};
	}
	// A candidate is bound to the accepted revision it previewed. If the source
	// changed under it, refuse instead of silently re-targeting newer bytes.
	const current = state.ports.read();
	if (
		shown.preparedFor.revisionId !== state.ports.acceptedRevisionId() ||
		shown.preparedFor.sourceContentId !== current.sourceContentId
	) {
		withdraw(state);
		return {
			kind: 'refused',
			code: 'stale-revision',
			message: 'The Scene changed since this preview. Preview again.',
		};
	}
	let outcome: SceneWriteOutcome;
	try {
		outcome = await state.ports.accept(intentOf(state, shown));
	} catch (error) {
		const message = error instanceof Error ? error.message : 'The accepted install failed.';
		holdAcceptRefusal(state, shown, { code: 'accept-failed', message });
		return { kind: 'failed', code: 'accept-failed', message };
	}
	if (outcome.kind === 'refused') {
		holdAcceptRefusal(state, shown, { code: outcome.code, message: outcome.message });
		return {
			kind: 'refused',
			code: outcome.code,
			message: state.refusal?.message ?? outcome.message,
		};
	}
	releaseLease(state);
	state.candidate = null;
	state.proposal = null;
	state.refusal = null;
	// The arm and its contacts stay; the next copy captures fresh ids.
	state.captured = null;
	state.ports.selectGroup(shown.clusterId);
	state.ports.notify();
	return { kind: 'committed', clusterId: shown.clusterId };
}

function ghostsOf(state: SessionState): readonly StageGhostMesh[] {
	const members = drawnMembers(state);
	if (members.length === 0) return [];
	const treatment: StageGhostMesh['treatment'] | undefined =
		state.refusal === null ? undefined : 'refused';
	const definitions = state.ports.read().definitions;
	return members.flatMap((member) => {
		const index = state.candidate?.entityIds.indexOf(member.id) ?? -1;
		const contact = index < 0 ? null : (state.candidate?.contacts[index] ?? null);
		const ghost = ghostForMember(
			member,
			contact,
			member.kind === 'model' ? modelFootprint(definitions, member.assetId) : null,
			treatment,
		);
		return ghost === null ? [] : [ghost];
	});
}

function previewsOf(
	state: SessionState,
	context: StageAdapterContext,
): readonly StageCandidatePreview[] {
	const outline = state.ports.outline;
	const members = drawnMembers(state);
	if (outline === undefined || members.length === 0) return [];
	if (context.evaluation.renderedReading !== 'plan') return [];
	const role = state.refusal === null ? 'subject' : 'refused';
	return members.flatMap((member): readonly StageCandidatePreview[] => {
		const preview = outline(context, member, role);
		return preview === null
			? []
			: [{ ...preview, id: `scene-group-copy-outline:${member.id}`, role }];
	});
}

export function createGroupCopyPlacementSession(
	ports: GroupCopyPlacementPorts,
): GroupCopyPlacementSession {
	const state: SessionState = {
		ports,
		mint: ports.mint ?? (() => globalThis.crypto.randomUUID()),
		armed: null,
		resolved: null,
		captured: null,
		lease: null,
		candidate: null,
		proposal: null,
		refusal: null,
	};
	return {
		arm: (copy) => armCopy(state, copy),
		armed: () => state.armed,
		begin: (copy, pointer, evaluationId, snappedStep = null) =>
			beginCopy(state, copy, pointer, evaluationId, snappedStep),
		preview: (pointer, snappedStep = null) => previewCopy(state, pointer, snappedStep),
		commit: () => commitCopy(state),
		cancel() {
			disarm(state);
			ports.notify();
		},
		abort() {
			// A pointer interruption releases the lease but keeps the refused words
			// and their red ghost on screen until the next press or Escape.
			releaseLease(state);
			state.candidate = null;
			state.captured = null;
			ports.notify();
		},
		candidate: () => state.candidate,
		refusal: () =>
			state.refusal === null ? null : { code: state.refusal.code, message: state.refusal.message },
		proposalLive: () => live(state),
		ghosts: () => ghostsOf(state),
		previews: (context) => previewsOf(state, context),
		overlays(context) {
			const label = state.refusal?.message ?? state.candidate?.mount;
			const at = state.refusal?.at ?? state.candidate?.anchor;
			if (label === undefined || at === undefined) return [];
			const css = context.project(at);
			return css === null ? [] : [{ id: 'scene-group-copy-mount', css, label }];
		},
		reset() {
			disarm(state);
		},
	};
}
