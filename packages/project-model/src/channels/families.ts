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
 * The `controller` property is the one exclusive resolved controller per output;
 * its value names the declared role the Camera output owner admitted.
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
	requiredProperties: ['depth'],
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
	requiredProperties: ['controller'],
	properties: [
		descriptor({
			family: CAMERA_SESSION_INSPECTION_FAMILY_ID,
			propertyId: 'target',
			valueKind: 'vector3',
			units: 'meters',
			range: { min: null, max: null, minExclusive: false, maxExclusive: false },
			values: null,
			scope: 'viewport',
			arbitration: 'exclusive',
			interpolation: 'linear',
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
			scope: 'viewport',
			arbitration: 'exclusive',
			interpolation: 'linear',
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
			scope: 'viewport',
			arbitration: 'exclusive',
			interpolation: 'linear',
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
			scope: 'viewport',
			arbitration: 'exclusive',
			interpolation: 'linear',
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
			scope: 'viewport',
			// One exclusive resolved controller per output; accepted ordered replacement.
			arbitration: 'ordered-replacement',
			interpolation: 'none',
			invalidation: ['intent', 'epoch'],
			capability: { id: 'camera.session-inspection', required: true },
			validator: 'camera.session.controller@1'
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
