import { type SceneConnection } from '../../../scene';
import { normalizeTransitions, requiredTravelPairs, type ExperienceNormalisedCut } from '../../experience-structure';
import { CAMERA_CONNECTION_DEFAULT_CLEARANCE, sameUnorderedPair } from '../camera-connection';
import { withStraightConnections } from './presentation';
import { withExperience } from './update';
import { allIds } from '../shared';
import { CAMERA_UNIT_FORMAT_VERSION, type ProjectEnvelope } from '../../types';

/**
 * The straight Camera path a Travel needs, added to `candidate` unless the pair
 * is already joined. Shared by the Stop update so Travel and its path are one
 * accepted change; the standalone create planner keeps its own refusal for an
 * existing pair.
 */
export function withStraightConnection(
	_envelope: ProjectEnvelope,
	candidate: ProjectEnvelope,
	pair: { readonly fromViewId: string; readonly toViewId: string },
	connectionId: string | null
):
	| { readonly kind: 'joined'; readonly envelope: ProjectEnvelope; readonly connection: SceneConnection | null }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string } {
	const views = candidate.units.camera.data.views;
	const fromView = views.find((view) => view.id === pair.fromViewId);
	const toView = views.find((view) => view.id === pair.toViewId);
	if (fromView === undefined || toView === undefined) {
		return { kind: 'refused', code: 'missing-target', message: 'A View this Travel needs is not in this envelope' };
	}
	if (candidate.units.camera.data.connections.some((connection) => sameUnorderedPair(connection, fromView.id, toView.id))) {
		return { kind: 'joined', envelope: candidate, connection: null };
	}
	if (connectionId === null || allIds(candidate).has(connectionId)) {
		return { kind: 'refused', code: 'invalid-identity', message: 'The captured Camera connection id is missing or already used' };
	}
	const connection: SceneConnection = {
		id: connectionId,
		fromNodeId: fromView.id,
		toNodeId: toView.id,
		clearance: CAMERA_CONNECTION_DEFAULT_CLEARANCE,
		positionPath: { kind: 'auto-bezier', anchors: [] }
	};
	const connected = views.map((view) => {
		const other = view.id === fromView.id ? toView.id : view.id === toView.id ? fromView.id : null;
		if (other === null || view.connectedViewIds.includes(other)) return view;
		return { ...view, connectedViewIds: [...view.connectedViewIds, other] };
	});
	return {
		kind: 'joined',
		connection,
		envelope: {
			...candidate,
			units: {
				...candidate.units,
				camera: {
					header: { ...candidate.units.camera.header },
					data: {
						formatVersion: CAMERA_UNIT_FORMAT_VERSION,
						views: connected,
						connections: [...candidate.units.camera.data.connections, connection]
					}
				}
			}
		}
	};
}

export type RequiredTravelJoin =
	| {
			readonly kind: 'joined';
			readonly envelope: ProjectEnvelope;
			readonly connections: SceneConnection[];
			readonly cuts: readonly ExperienceNormalisedCut[];
	  }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string };

/**
 * G1–G5, G7, D-12 — reconcile one edited Experience in the same accepted change:
 * write a Cut wherever a Travel can no longer mean anything, then join every
 * pair this edit newly leaves without a Camera connection with one straight path
 * from the captured id pool. The planner refuses rather than leave a new gap.
 */
export function travelPairKey(pair: { readonly fromViewId: string; readonly toViewId: string }): string {
	return pair.fromViewId < pair.toViewId
		? `${pair.fromViewId}\u0000${pair.toViewId}`
		: `${pair.toViewId}\u0000${pair.fromViewId}`;
}

export function withRequiredTravelPaths(
	envelope: ProjectEnvelope,
	candidate: ProjectEnvelope,
	experienceId: string,
	connectionIds: readonly string[]
): RequiredTravelJoin {
	const experience = candidate.units.experience.data.experiences.find((entry) => entry.id === experienceId);
	if (experience === undefined) {
		return { kind: 'refused', code: 'missing-target', message: `experience "${experienceId}" is not in this envelope` };
	}
	// Join only a pair this edit newly requires. An imported file may already carry
	// an unjoined Travel; unrelated edits keep it reported by the problems chip and
	// do not need a connection id pool to succeed.
	const before = envelope.units.experience.data.experiences.find((entry) => entry.id === experienceId);
	const beforePairs = new Set(
		(before === undefined ? [] : requiredTravelPairs(before, envelope.units.camera.data.connections)).map(travelPairKey)
	);
	const normalized = normalizeTransitions(experience);
	const reconciled = normalized.experience === experience ? candidate : withExperience(candidate, normalized.experience);
	const pairs = requiredTravelPairs(normalized.experience, reconciled.units.camera.data.connections).filter(
		(pair) => !beforePairs.has(travelPairKey(pair))
	);
	const joined = withStraightConnections(envelope, reconciled, pairs, connectionIds);
	if (joined.kind === 'refused') return joined;
	return { kind: 'joined', envelope: joined.envelope, connections: joined.connections, cuts: normalized.cuts };
}

