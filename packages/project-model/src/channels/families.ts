/**
 * F.3 — the v1 channel families and the host that admits them.
 *
 * AM-3 admits exactly two families at version 1: Layout's ordinary Plan
 * inspection parameters and the Camera session inspection output. A family is a
 * declaration (properties, required properties, capability), not an evaluator:
 * Layout evaluates representation from its canonical output, and Camera evaluates
 * pose and projection. Declaring a family here publishes a contract; it computes
 * nothing.
 *
 * Additional families stay on this gate as compatible, optional admissions
 * (`T3.P01.S03` adds `camera-handoff-v1` through the same protocol) — they join
 * `createChannelHost` rather than minting a parallel channel format.
 */

import { CAMERA_OUTPUT_ROLES } from './camera-output';
import {
	INSPECTION_VERSION,
	type ChannelDescriptor,
	type ChannelFamily,
	type ChannelFamilyId
} from './types';

/** Layout's ordinary Plan inspection parameters (AM-3, Layout ordinary Plan family). */
export const LAYOUT_PLAN_FAMILY_ID: ChannelFamilyId = 'layout.plan@1';

/**
 * Camera's session inspection output (AM-3, Camera session inspection family).
 *
 * Every property is `camera-output`-arbitrated and `output`-scoped: it belongs to
 * the run that holds the Camera output named by `scopeId`, and is admitted only
 * from that live claim. The Camera-output ticket protocol is therefore the one
 * ownership authority — acquiring, replacing, handing off, returning or cancelling
 * the output is what changes who may contribute — and the channel reflects it
 * instead of running a second ordered-replacement path. The `controller` property
 * is the one resolved controller per output: its value must be the claim's role.
 *
 * No property declares generic interpolation (`none`): AM-3 forbids generic Camera
 * pose/FOV interpolation, so target, azimuth, elevation and frame height change
 * only by a new contribution and are moved only by Camera's own evaluation. The
 * family is addressed to the project's Camera authority root (`camera`), because a
 * session output is not an authored navigation node.
 *
 * The family also publishes the ratified **policy inputs**: the reading/projection
 * policy the output is read and projected under, and the motion policy its pose
 * evaluation runs under. They are declared here because the family's contents are
 * this gate's contract — the owning domain decides which policy values exist
 * (an open declared set, `values: null`) and Camera's evaluator, not this reader,
 * acts on them. An absent policy means the authority's own declared default, so
 * neither is a required property.
 */
export const CAMERA_SESSION_INSPECTION_FAMILY_ID: ChannelFamilyId = 'camera.session-inspection@1';

const PLAN_INVALIDATION = ['accepted-revision', 'parameters', 'generation', 'frame'] as const;
const CAMERA_INTENT_INVALIDATION = ['intent', 'clock', 'viewport-rect', 'source-extent', 'epoch'] as const;

function descriptor(descriptor: Omit<ChannelDescriptor, 'version'>): ChannelDescriptor {
	return { version: INSPECTION_VERSION, ...descriptor };
}

export const LAYOUT_PLAN_FAMILY: ChannelFamily = {
	id: LAYOUT_PLAN_FAMILY_ID,
	domain: 'layout',
	capability: { id: 'layout.plan-inspection', required: true },
	// Ordinary Plan inspection belongs to a Layout level (the current single floor), in
	// project-world or a Layout-owned frame the owner resolves; no address qualification.
	admission: { ownerSubjectKinds: ['level'], frameKinds: ['project-world', 'owner-frame'], qualifiedAddresses: false },
	requiredProperties: ['depth'],
	controllerProperty: null,
	properties: [
		descriptor({
			family: LAYOUT_PLAN_FAMILY_ID,
			propertyId: 'cut-height',
			valueKind: 'number',
			units: 'meters',
			range: { min: null, max: null, minExclusive: false, maxExclusive: false },
			values: null,
			scope: 'viewport',
			arbitration: 'exclusive',
			interpolation: 'none',
			invalidation: [...PLAN_INVALIDATION],
			capability: { id: 'layout.plan-inspection', required: true },
			validator: 'layout.plan.cut-height@1'
		}),
		descriptor({
			family: LAYOUT_PLAN_FAMILY_ID,
			propertyId: 'depth',
			valueKind: 'number',
			units: 'meters',
			range: { min: 0, max: null, minExclusive: true, maxExclusive: false },
			values: null,
			scope: 'viewport',
			arbitration: 'exclusive',
			interpolation: 'none',
			invalidation: [...PLAN_INVALIDATION],
			capability: { id: 'layout.plan-inspection', required: true },
			validator: 'layout.plan.depth@1'
		}),
		descriptor({
			family: LAYOUT_PLAN_FAMILY_ID,
			propertyId: 'lateral-span',
			valueKind: 'number',
			units: 'meters',
			range: { min: 0, max: null, minExclusive: true, maxExclusive: false },
			values: null,
			scope: 'viewport',
			arbitration: 'exclusive',
			interpolation: 'none',
			invalidation: [...PLAN_INVALIDATION],
			capability: { id: 'layout.plan-inspection', required: true },
			validator: 'layout.plan.lateral-span@1'
		}),
		descriptor({
			family: LAYOUT_PLAN_FAMILY_ID,
			propertyId: 'source-kind-filter',
			valueKind: 'identifier-set',
			units: null,
			range: null,
			values: null,
			scope: 'viewport',
			arbitration: 'exclusive',
			interpolation: 'none',
			invalidation: ['accepted-revision', 'parameters', 'source-kind-filter'],
			capability: { id: 'layout.plan-inspection', required: true },
			validator: 'layout.plan.source-kind-filter@1'
		}),
		descriptor({
			family: LAYOUT_PLAN_FAMILY_ID,
			propertyId: 'reveal',
			// A source-qualified Reveal set: set union over declared source identities only,
			// and explicitly not permission to invent an inverse or select obscured handles.
			valueKind: 'source-set',
			units: null,
			range: null,
			values: null,
			scope: 'viewport',
			arbitration: 'union',
			interpolation: 'none',
			invalidation: ['accepted-revision', 'reveal-set'],
			capability: { id: 'layout.plan-inspection', required: true },
			validator: 'layout.plan.reveal@1'
		})
	]
};

export const CAMERA_SESSION_INSPECTION_FAMILY: ChannelFamily = {
	id: CAMERA_SESSION_INSPECTION_FAMILY_ID,
	domain: 'camera',
	capability: { id: 'camera.session-inspection', required: true },
	// A session output is owned by the Camera authority root; its target is project-world.
	admission: { ownerSubjectKinds: ['camera'], frameKinds: ['project-world'], qualifiedAddresses: false },
	requiredProperties: ['controller'],
	controllerProperty: 'controller',
	properties: [
		descriptor({
			family: CAMERA_SESSION_INSPECTION_FAMILY_ID,
			propertyId: 'target',
			valueKind: 'vector3',
			units: 'meters',
			range: { min: null, max: null, minExclusive: false, maxExclusive: false },
			values: null,
			scope: 'output',
			arbitration: 'camera-output',
			interpolation: 'none',
			invalidation: [...CAMERA_INTENT_INVALIDATION],
			capability: { id: 'camera.session-inspection', required: true },
			validator: 'camera.session.target@1'
		}),
		descriptor({
			family: CAMERA_SESSION_INSPECTION_FAMILY_ID,
			propertyId: 'azimuth',
			valueKind: 'number',
			units: 'radians',
			range: { min: null, max: null, minExclusive: false, maxExclusive: false },
			values: null,
			scope: 'output',
			arbitration: 'camera-output',
			interpolation: 'none',
			invalidation: [...CAMERA_INTENT_INVALIDATION],
			capability: { id: 'camera.session-inspection', required: true },
			validator: 'camera.session.azimuth@1'
		}),
		descriptor({
			family: CAMERA_SESSION_INSPECTION_FAMILY_ID,
			propertyId: 'elevation',
			valueKind: 'number',
			units: 'radians',
			range: { min: null, max: null, minExclusive: false, maxExclusive: false },
			values: null,
			scope: 'output',
			arbitration: 'camera-output',
			interpolation: 'none',
			invalidation: [...CAMERA_INTENT_INVALIDATION],
			capability: { id: 'camera.session-inspection', required: true },
			validator: 'camera.session.elevation@1'
		}),
		descriptor({
			family: CAMERA_SESSION_INSPECTION_FAMILY_ID,
			propertyId: 'frame-height',
			valueKind: 'number',
			units: 'meters',
			range: { min: 0, max: null, minExclusive: true, maxExclusive: false },
			values: null,
			scope: 'output',
			arbitration: 'camera-output',
			interpolation: 'none',
			invalidation: [...CAMERA_INTENT_INVALIDATION],
			capability: { id: 'camera.session-inspection', required: true },
			validator: 'camera.session.frame-height@1'
		}),
		descriptor({
			family: CAMERA_SESSION_INSPECTION_FAMILY_ID,
			propertyId: 'controller',
			valueKind: 'identifier',
			units: null,
			range: null,
			values: [...CAMERA_OUTPUT_ROLES],
			scope: 'output',
			// The one resolved controller per output: the live claim's role.
			arbitration: 'camera-output',
			interpolation: 'none',
			invalidation: ['intent', 'epoch'],
			capability: { id: 'camera.session-inspection', required: true },
			validator: 'camera.session.controller@1'
		}),
		descriptor({
			family: CAMERA_SESSION_INSPECTION_FAMILY_ID,
			propertyId: 'reading-projection-policy',
			valueKind: 'identifier',
			units: null,
			range: null,
			// An open declared set: Camera owns which reading/projection policies exist.
			values: null,
			scope: 'output',
			arbitration: 'camera-output',
			interpolation: 'none',
			invalidation: [...CAMERA_INTENT_INVALIDATION],
			capability: { id: 'camera.session-inspection', required: true },
			validator: 'camera.session.reading-projection-policy@1'
		}),
		descriptor({
			family: CAMERA_SESSION_INSPECTION_FAMILY_ID,
			propertyId: 'motion-policy',
			valueKind: 'identifier',
			units: null,
			range: null,
			// An open declared set: Camera owns which motion policies exist.
			values: null,
			scope: 'output',
			arbitration: 'camera-output',
			interpolation: 'none',
			invalidation: [...CAMERA_INTENT_INVALIDATION],
			capability: { id: 'camera.session-inspection', required: true },
			validator: 'camera.session.motion-policy@1'
		})
	]
};

/** The v1 families this reader admits. */
export const DEFAULT_CHANNEL_FAMILIES: readonly ChannelFamily[] = [
	LAYOUT_PLAN_FAMILY,
	CAMERA_SESSION_INSPECTION_FAMILY
];

export type ChannelHost = {
	readonly families: readonly ChannelFamily[];
	/** Structural problems in the admitted families; empty for the v1 set. */
	readonly problems: readonly string[];
};

/**
 * Structural check over a family set: one declaration per family id, one
 * descriptor per property, and every required property actually declared. A
 * family that names a required property it does not publish could never be
 * satisfied, so it is a declaration defect rather than a runtime state.
 */
export function familyProblems(families: readonly ChannelFamily[]): string[] {
	const problems: string[] = [];
	const ids = new Set<string>();
	for (const family of families) {
		if (ids.has(family.id)) problems.push(`channel family "${family.id}" is declared more than once`);
		ids.add(family.id);
		const propertyIds = new Set<string>();
		for (const property of family.properties) {
			if (property.family !== family.id) {
				problems.push(`${family.id}: property "${property.propertyId}" declares family "${property.family}"`);
			}
			if (propertyIds.has(property.propertyId)) {
				problems.push(`${family.id}: property "${property.propertyId}" is declared more than once`);
			}
			propertyIds.add(property.propertyId);
		}
		for (const property of family.properties) {
			if (property.arbitration === 'union' && property.valueKind !== 'identifier-set' && property.valueKind !== 'source-set') {
				problems.push(`${family.id}: property "${property.propertyId}" unions declared identities and must hold a set value`);
			}
			if (property.arbitration === 'camera-output' && (family.domain !== 'camera' || property.scope !== 'output')) {
				problems.push(`${family.id}: property "${property.propertyId}" reflects a Camera output and must be a Camera output-scoped property`);
			}
			// Domain invariants bind after arbitration: no generic channel interpolates Camera pose/FOV.
			if (family.domain === 'camera' && property.interpolation !== 'none') {
				problems.push(`${family.id}: property "${property.propertyId}" may not declare generic interpolation; Camera evaluates pose and projection`);
			}
		}
		if (family.controllerProperty !== null) {
			const controller = family.properties.find((property) => property.propertyId === family.controllerProperty);
			if (controller === undefined || controller.arbitration !== 'camera-output' || controller.valueKind !== 'identifier') {
				problems.push(`${family.id}: controller property "${family.controllerProperty}" must be a declared camera-output identifier`);
			}
		}
		if (family.admission.ownerSubjectKinds.length === 0 || family.admission.frameKinds.length === 0) {
			problems.push(`${family.id}: a family admits at least one owner subject kind and one frame kind`);
		}
		for (const required of family.requiredProperties) {
			if (!propertyIds.has(required)) {
				problems.push(`${family.id}: required property "${required}" is not declared`);
			}
		}
		if (family.properties.length === 0) problems.push(`${family.id}: a family declares at least one property`);
	}
	return problems;
}

/** Build the host that admits a family set. */
export function createChannelHost(families: readonly ChannelFamily[] = DEFAULT_CHANNEL_FAMILIES): ChannelHost {
	return { families, problems: familyProblems(families) };
}

/** The declared property of a family, or `null` when the family does not publish it. */
export function declaredProperty(family: ChannelFamily, propertyId: string): ChannelDescriptor | null {
	return family.properties.find((property) => property.propertyId === propertyId) ?? null;
}
