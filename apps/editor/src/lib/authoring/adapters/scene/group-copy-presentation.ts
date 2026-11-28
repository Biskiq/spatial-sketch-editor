/**
 * The group copy's presentation facts: the approved mount line and one composed
 * member's ghost body.
 *
 * A ghost is a pose and an extent in the one Canvas, never a second renderer.
 * Every solid member of the compound proposal is drawn from the entity the
 * planner composed, seated by its own contact and footprint; a light has no body
 * ghost, exactly as in the specimen.
 */
import type { LayoutUnitPayload } from '@portfolio/project-model/units';
import type { SceneEntity, Vec3 } from '@portfolio/project-model/scene';
import type {
	NormalizedPlacementDefinition,
	SceneGroupCopyCandidate,
} from '@portfolio/project-model/scene-planning';
import type { StageGhostMesh } from '$lib/authoring/stage/stage-adapter-host';
import { candidateGhost } from './candidate-ghost';
import type { GroupCopyOriginMode } from './group-copy-arm';

export type SupportEvidence = NonNullable<SceneGroupCopyCandidate['support']>;

function metersOf(value: number): string {
	return `${value.toFixed(2)} m`;
}

/** The authored name of one Layout region, when it has one. */
function regionName(layout: LayoutUnitPayload, regionId: string): string | null {
	const region = layout.regions.find((candidate) => candidate.id === regionId);
	const name = region?.name?.trim();
	return name === undefined || name.length === 0 ? null : name;
}

/**
 * The surface name a mount line uses. A named region is its authored name; a
 * room witness is the floor or the ceiling; an unnamed region stays honest
 * rather than inventing a name.
 */
function supportSurfaceName(
	layout: LayoutUnitPayload,
	evidence: SupportEvidence,
	kind: 'floor' | 'overhead',
): string {
	for (const witness of evidence.witnesses) {
		if (witness.source.kind !== 'region') continue;
		return (
			regionName(layout, witness.source.regionId) ??
			(kind === 'overhead' ? 'an overhead' : 'a platform')
		);
	}
	return kind === 'overhead' ? 'the ceiling' : 'the floor';
}

/** The approved mount line for one resolved candidate. */
export function mountLabel(input: {
	readonly mode: GroupCopyOriginMode;
	readonly layout: LayoutUnitPayload;
	readonly anchor: Vec3;
	readonly evidence: SupportEvidence | undefined;
}): string {
	if (input.mode === 'wall') return `On the wall · ${metersOf(input.anchor[1])} · faces out`;
	const surface = input.mode === 'overhead' ? 'overhead' : 'floor';
	const name =
		input.evidence === undefined
			? surface === 'overhead'
				? 'the ceiling'
				: 'the floor'
			: supportSurfaceName(input.layout, input.evidence, surface);
	if (input.mode === 'overhead') return `Hangs from ${name} · ${metersOf(input.anchor[1])}`;
	return Math.abs(input.anchor[1]) < 1e-9
		? `On ${name}`
		: `On ${name} · ${metersOf(input.anchor[1])}`;
}

/** The declared footprint of one model asset, or `null` when it is unknown. */
export function modelFootprint(
	definitions: readonly NormalizedPlacementDefinition[],
	assetId: string,
): { readonly width: number; readonly depth: number } | null {
	const definition = definitions.find(
		(entry) =>
			entry.creationDefaults.kind === 'model' && entry.creationDefaults.assetId === assetId,
	);
	if (definition === undefined) return null;
	const xs = definition.footprintMeters.map(([x]) => x);
	const zs = definition.footprintMeters.map(([, z]) => z);
	return {
		width: Math.max(...xs) - Math.min(...xs),
		depth: Math.max(...zs) - Math.min(...zs),
	};
}

/** One composed member's body at the planner's own pose, or `null` for a light. */
export function ghostForMember(
	member: SceneEntity,
	contact: number | null,
	footprint: { readonly width: number; readonly depth: number } | null,
	treatment: StageGhostMesh['treatment'] | undefined,
): StageGhostMesh | null {
	if (member.kind === 'light') return null;
	const scale =
		member.kind === 'primitive' || member.kind === 'model'
			? typeof member.scale === 'number' && Number.isFinite(member.scale)
				? member.scale
				: 1
			: 1;
	const ghost = candidateGhost(
		member,
		{
			kind: 'move',
			entityId: member.id,
			primitive: null,
			position: [...member.position] as Vec3,
			rotation: [...member.rotation] as Vec3,
			worldXZ: [member.position[0], member.position[2]],
			yaw: member.rotation[1],
			scale,
			snappedStep: null,
			...(member.kind === 'form' ? { form: member.form } : {}),
			...(footprint === null ? {} : { footprint, modelContactMinY: contact ?? 0 }),
		},
		{
			modelFootprint: footprint,
			modelContactMinY: contact,
			...(treatment === undefined ? {} : { treatment }),
		},
	);
	return ghost === null ? null : { ...ghost, id: `scene-group-copy:${member.id}` };
}
