/**
 * Pure binding: turn effective Finish inputs plus target facts into a sampling
 * plan for a real draw, or into target diagnostics.
 *
 * Binding never changes an authored value and never applies a Treatment. It
 * answers one question: for this target, which native UV set and which affine
 * transform actually samples each bound image? A mapping that cannot be
 * satisfied is refused with a code, a path, the role and the target key.
 */
import {
	dedupeMaterialIssues,
	sortMaterialIssues,
	type MaterialIssue
} from './issues';
import { materialMetricRepeat } from './recipe';
import {
	intersectTargetAvailability,
	targetHasDraws,
	type AvailabilityIntersection
} from './target';
import type {
	BindingTarget,
	BoundFinish,
	FinishBinding,
	FinishResolution,
	MapRole,
	SamplingEntry,
	TargetFacts
} from './types';

const IDENTITY_REPEAT: readonly [number, number] = [1, 1];
const ZERO_OFFSET: readonly [number, number] = [0, 0];

function issue(
	code: MaterialIssue['code'],
	path: string,
	action: string,
	role: MapRole | undefined,
	target: string | undefined
): MaterialIssue {
	return {
		code,
		path,
		...(role === undefined ? {} : { role }),
		...(target === undefined ? {} : { target }),
		action
	};
}

function samplingFor(
	role: MapRole,
	binding: {
		readonly image: { readonly hash: string; readonly source: unknown } | null;
		readonly mapping: import('./types').Mapping;
		readonly convention?: '+Y' | '-Y';
		readonly component?: import('./types').ScalarComponent;
		readonly invert?: boolean;
	},
	facts: TargetFacts,
	subject: string,
	issues: MaterialIssue[]
): SamplingEntry | null {
	if (binding.image === null) return null;
	const mapping = binding.mapping;
	if (mapping.kind === 'uv') {
		return {
			role,
			image: binding.image as SamplingEntry['image'],
			uvSet: mapping.set,
			basis: 'identity',
			repeat: [mapping.repeat[0], mapping.repeat[1]],
			rotation: mapping.rotation,
			offset: [mapping.offset[0], mapping.offset[1]],
			...(binding.convention === undefined ? {} : { convention: binding.convention }),
			...(binding.component === undefined ? {} : { component: binding.component }),
			...(binding.invert === undefined ? {} : { invert: binding.invert })
		};
	}
	if (mapping.kind === 'surface' && facts.metricBasis === undefined) {
		issues.push(
			issue(
				'mapping-requires-metric-basis',
				`$.maps.${role}.mapping`,
				'Use target or uv mapping for this target, or supply a metric basis.',
				role,
				subject
			)
		);
		return null;
	}
	const metric = mapping.metric;
	const basis = facts.metricBasis;
	const repeat =
		basis === undefined
			? IDENTITY_REPEAT
			: materialMetricRepeat(basis.surfaceMeters, metric.tileMeters);
	const rotation = basis === undefined ? 0 : metric.rotation;
	const offset = basis === undefined ? ZERO_OFFSET : metric.offset;
	return {
		role,
		image: binding.image as SamplingEntry['image'],
		uvSet: 0,
		basis: basis === undefined ? 'identity' : 'metric',
		repeat: [repeat[0], repeat[1]],
		rotation,
		offset: [offset[0], offset[1]],
		...(binding.convention === undefined ? {} : { convention: binding.convention }),
		...(binding.component === undefined ? {} : { component: binding.component }),
		...(binding.invert === undefined ? {} : { invert: binding.invert })
	};
}

function qualifySamples(
	samples: readonly SamplingEntry[],
	facts: TargetFacts,
	subject: string
): MaterialIssue[] {
	const issues: MaterialIssue[] = [];
	for (const draw of facts.draws) {
		for (const sample of samples) {
			const target = `${subject}#${draw.drawKey}`;
			if (!draw.uvSets.includes(sample.uvSet)) {
				issues.push(
					issue(
						'missing-uv',
						`$.maps.${sample.role}.mapping`,
						`Provide UV${sample.uvSet} on this draw or choose a mapping it supports.`,
						sample.role,
						target
					)
				);
				continue;
			}
			if (sample.role === 'normal' && !draw.normalFrameSets.includes(sample.uvSet)) {
				issues.push(
					issue(
						'missing-normal-frame',
						`$.maps.${sample.role}.mapping`,
						'Provide a non-singular UV frame on this draw or remove the normal map.',
						sample.role,
						target
					)
				);
			}
		}
	}
	return issues;
}

/**
 * Bind one Finish to one target.
 *
 * `bound` is null whenever the Finish cannot be drawn correctly on that target;
 * `inputs` is still returned so inspection can show the authored values and the
 * corrective actions.
 */
export function bindFinish(
	resolution: FinishResolution,
	target: BindingTarget
): FinishBinding {
	const issues: MaterialIssue[] = [...resolution.issues];
	const inputs = resolution.inputs;
	if (inputs === null) {
		return { inputs: null, bound: null, issues: sortMaterialIssues(issues) };
	}
	const facts = target.facts;
	if (facts === null) {
		issues.push(
			issue(
				'target-pending',
				'$.target',
				'Derive target facts for the exact geometry revision, then requalify.',
				undefined,
				target.subject
			)
		);
		return { inputs, bound: null, issues: sortMaterialIssues(issues) };
	}
	if (
		target.expectedGeometryRevision !== undefined &&
		target.expectedGeometryRevision !== facts.geometryRevision
	) {
		issues.push(
			issue(
				'stale-target-facts',
				'$.target.geometryRevision',
				`Recompute target facts for revision ${target.expectedGeometryRevision}.`,
				undefined,
				`${target.subject}@${facts.geometryRevision}`
			)
		);
		return { inputs, bound: null, issues: sortMaterialIssues(issues) };
	}
	if (!targetHasDraws(facts)) {
		issues.push(
			issue(
				'target-pending',
				'$.target.draws',
				'Derive target facts with at least one active draw, then requalify.',
				undefined,
				target.subject
			)
		);
		return { inputs, bound: null, issues: sortMaterialIssues(issues) };
	}

	const samples: SamplingEntry[] = [];
	for (const role of ['color', 'normal', 'roughness', 'metalness', 'occlusion'] as const) {
		const binding = inputs.maps[role];
		if (binding === undefined) continue;
		const sample = samplingFor(role, binding, facts, target.subject, issues);
		if (sample !== null) samples.push(sample);
	}
	issues.push(...qualifySamples(samples, facts, target.subject));
	if (issues.length > 0) {
		return { inputs, bound: null, issues: sortMaterialIssues(issues) };
	}
	const bound: BoundFinish = {
		subject: target.subject,
		geometryRevision: facts.geometryRevision,
		samples,
		draws: facts.draws.map((draw) => draw.drawKey)
	};
	return { inputs, bound, issues: [] };
}

export type TargetQualification = {
	readonly subject: string;
	readonly issues: readonly MaterialIssue[];
};

export type AcrossTargetsQualification = {
	readonly inputs: FinishResolution['inputs'];
	/** The intersection across every affected target and draw. */
	readonly common: AvailabilityIntersection;
	readonly issues: readonly MaterialIssue[];
	readonly perTarget: readonly TargetQualification[];
};

/**
 * The acceptance reading for a shared Finish: qualify every affected target,
 * from an unused Finish up to a native Form plus an imported mesh.
 *
 * A Finish with no targets is authorable and reports no issue; it simply has no
 * draw yet. A target whose analysis is missing reports `target-pending`.
 */
export function qualifyAcrossTargets(
	resolution: FinishResolution,
	targets: readonly BindingTarget[]
): AcrossTargetsQualification {
	const issues: MaterialIssue[] = [...resolution.issues];
	const perTarget: TargetQualification[] = [];
	for (const target of targets) {
		const binding = bindFinish(resolution, target);
		perTarget.push({ subject: target.subject, issues: binding.issues });
		issues.push(...binding.issues);
	}
	const facts = targets
		.map((target) => target.facts)
		.filter((value): value is TargetFacts => value !== null);
	return {
		inputs: resolution.inputs,
		common: intersectTargetAvailability(facts),
		issues: dedupeMaterialIssues(issues),
		perTarget
	};
}
