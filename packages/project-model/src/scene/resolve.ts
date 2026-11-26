import { SceneDocumentValidationError } from '../scene-codec/types';
import { validateSceneDocument } from '../scene-codec/validate';
import type { SceneValidationOptions } from '../scene-validation';
import type {
	NavigationGraph,
	NavigationNodeData,
	RuntimeConnection,
	RuntimePathAnchor,
	SceneDocument,
	SceneObjectPlacement,
} from './contracts';
import { SCENE_WORLD_LOCAL_FORMAT_VERSION } from './contracts';
import type { RuntimeNavigation, RuntimeScene } from './model';
import {
	cloneSceneEntity,
	cloneVec3,
	listSceneModelEntities,
	modelEntityToPlacement,
	resolveViewKeyframe,
	resolveWaypoint,
} from './model';

/**
 * Resolve a Scene document into the runtime Scene.
 *
 * The current format is the only accepted one, and its
 * physical values are already project/world coordinates, so there is no Room
 * registry and no Room-frame resolution: every value is cloned once, exactly,
 * with no transform and no second pass.
 *
 * The returned value is Camera-free. A document that also carries navigation is
 * still validated as one document (so an invalid endpoint is still refused), but
 * its Camera half resolves through {@link resolveNavigationDocument} into its own
 * value rather than into this one.
 */
export function resolveSceneDocument(
	input: unknown,
	options: SceneValidationOptions = {},
): RuntimeScene {
	const validation = validateSceneDocument(input, options);
	if (!validation.success) throw new SceneDocumentValidationError(validation.issues[0]!);
	const document = validation.document;

	const entities = document.entities.map(cloneSceneEntity);
	const textures = document.textures.map((texture) => ({ ...texture }));
	const materials = document.materials.map((material) => ({ ...material }));
	const objects = listSceneModelEntities(document).map(
		(entity): SceneObjectPlacement => ({
			...modelEntityToPlacement(entity),
			position: cloneVec3(entity.position),
			rotation: cloneVec3(entity.rotation),
		}),
	);

	return { textures, materials, entities, objects };
}

/**
 * Resolve one Camera unit's navigation records into the runtime navigation value.
 *
 * The records are validated through the same Scene document validator the Camera
 * unit is admitted through, with the unit's connectivity policy supplied by the
 * caller, so the runtime cannot accept a navigation graph the authored unit could
 * not carry. Only the navigation half is resolved: no entity, material or texture
 * value is read here.
 */
export function resolveNavigationDocument(
	input: Pick<SceneDocument, 'navigationNodes' | 'connections'>,
	options: SceneValidationOptions = {},
): RuntimeNavigation {
	const validation = validateSceneDocument(
		{
			formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION,
			textures: [],
			materials: [],
			entities: [],
			navigationNodes: [...input.navigationNodes],
			connections: [...input.connections],
		},
		options,
	);
	if (!validation.success) throw new SceneDocumentValidationError(validation.issues[0]!);
	return resolveNavigation(validation.document);
}

function resolveNavigation(document: SceneDocument): RuntimeNavigation {
	const navigationNodes = document.navigationNodes.map(
		(node): NavigationNodeData => ({
			...node,
			position: cloneVec3(node.position),
			cameraTarget: cloneVec3(node.cameraTarget),
			connectedNodeIds: [...node.connectedNodeIds],
		}),
	);
	const resolvedNodeById = new Map(navigationNodes.map((node) => [node.id, node]));

	const getResolvedNode = (id: string) => {
		const node = resolvedNodeById.get(id);
		if (!node) throw new Error(`Unknown navigation node in scene connection: ${id}`);
		return node;
	};

	const connections = document.connections.map((connection): RuntimeConnection => {
		const fromNode = getResolvedNode(connection.fromNodeId);
		const toNode = getResolvedNode(connection.toNodeId);
		const interiorAnchors = connection.positionPath.anchors.map(
			(anchor): RuntimePathAnchor => ({
				id: anchor.id,
				position: resolveWaypoint(anchor),
			}),
		);
		const resolved: RuntimeConnection = {
			id: connection.id,
			fromNodeId: connection.fromNodeId,
			toNodeId: connection.toNodeId,
			clearance: connection.clearance,
			positionPath: {
				kind: connection.positionPath.kind,
				anchors: [
					{ id: `node:${fromNode.id}:position`, position: cloneVec3(fromNode.position) },
					...interiorAnchors,
					{ id: `node:${toNode.id}:position`, position: cloneVec3(toNode.position) },
				],
			},
		};

		if (connection.targetWaypoints) {
			resolved.targetWaypoints = [
				cloneVec3(fromNode.cameraTarget),
				...connection.targetWaypoints.map((waypoint) => resolveWaypoint(waypoint)),
				cloneVec3(toNode.cameraTarget),
			];
		}

		if (connection.viewTracks) {
			resolved.viewTracks = {
				forward: connection.viewTracks.forward.map((keyframe) => resolveViewKeyframe(keyframe)),
				reverse: connection.viewTracks.reverse.map((keyframe) => resolveViewKeyframe(keyframe)),
				...(connection.viewTracks.framingEnvelope?.forward === undefined &&
				connection.viewTracks.framingEnvelope?.reverse === undefined
					? {}
					: {
							framingEnvelope: {
								...(connection.viewTracks.framingEnvelope.forward === undefined
									? {}
									: { forward: { ...connection.viewTracks.framingEnvelope.forward } }),
								...(connection.viewTracks.framingEnvelope.reverse === undefined
									? {}
									: { reverse: { ...connection.viewTracks.framingEnvelope.reverse } }),
							},
						}),
			};
		}

		const timing = connection.timing;
		if (timing?.forward !== undefined || timing?.reverse !== undefined) {
			resolved.timing = {
				...(timing?.forward === undefined ? {} : { forward: { ...timing.forward } }),
				...(timing?.reverse === undefined ? {} : { reverse: { ...timing.reverse } }),
			};
		}

		return resolved;
	});

	return { navigationNodes, connections };
}

/** Index one resolved navigation value for the one Camera evaluator. */
export function createNavigationGraph(
	navigation: Pick<RuntimeNavigation, 'navigationNodes' | 'connections'>,
): NavigationGraph {
	return {
		navigationNodes: navigation.navigationNodes,
		connections: navigation.connections,
		nodeById: new Map(navigation.navigationNodes.map((node) => [node.id, node])),
	};
}

export function assertNavigationGraphMatchesNavigation(
	graph: NavigationGraph,
	navigation: RuntimeNavigation,
) {
	if (
		graph.navigationNodes !== navigation.navigationNodes ||
		graph.connections !== navigation.connections
	) {
		throw new Error('Navigation state must use the same resolved navigation value');
	}
}
