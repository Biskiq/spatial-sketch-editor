import { countWork, p2311Measure } from '@portfolio/layout-core/kernel';
import { resolveLayoutSurface, surfaceKey } from '@portfolio/layout-core/plan';
import { shippedImage } from '../../materials/catalogue';
import { MATERIAL_CAPABILITY, MATERIAL_MAP_ROLES } from '../../materials/types';
import { validateAcceptedRevision } from '../../references/validate';
import { ShapeReader } from '../../strict-shape';
import { stopEntryViewId, UNIT_DOMAINS, UNIT_ENVELOPE_FORMAT_VERSION, type DependencyLock, type ExperienceStop, type ProjectUnits, type RequiredCapability, type TypedResource } from '../types';
import { isDeeplyFrozenPlainJson, freezePlainJsonSubgraph } from './frozen-json';
import { validateDependencyLock, samePin } from './lock';
import { readDomainUnit } from './payload';
import { ENVELOPE_KEYS, type EnvelopeDiagnostic, type EnvelopeClosureFinding, type EnvelopeValidation } from './shared';

export function sameCapabilities(
	actual: readonly RequiredCapability[],
	expected: RequiredCapability
): boolean {
	return (
		actual.length === 1 &&
		actual[0]!.id === expected.id &&
		actual[0]!.version === expected.version
	);
}

/**
 * Read one complete envelope.
 *
 * The blocking rules are structural. `diagnostics` names bindings that are
 * authored but not resolved yet, and `closure` names executable requirements the
 * envelope cannot satisfy — most importantly a lock entry whose resource the
 * registry does not carry, which makes publication refuse while admission stays
 * possible.
 */
export const VALIDATED_ENVELOPE_CACHE = new WeakMap<object, EnvelopeValidation>();

export function validateProjectEnvelope(input: unknown): EnvelopeValidation {
	countWork('envelope:validate');
	if (typeof input === 'object' && input !== null && isDeeplyFrozenPlainJson(input)) {
		const cached = VALIDATED_ENVELOPE_CACHE.get(input);
		if (cached !== undefined) return cached;
	}
	return p2311Measure('envelope-validate', () => {
		const result = validateProjectEnvelopeOnce(input);
		if (result.success) {
			freezePlainJsonSubgraph(result.envelope);
			if (typeof input === 'object' && input !== null && isDeeplyFrozenPlainJson(input)) {
				VALIDATED_ENVELOPE_CACHE.set(input, result);
			}
			VALIDATED_ENVELOPE_CACHE.set(result.envelope, result);
		}
		return result;
	});
}

export function validateProjectEnvelopeOnce(input: unknown): EnvelopeValidation {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', ENVELOPE_KEYS);
	if (record === null) return { success: false, issues: reader.issues };
	if (record.formatVersion !== UNIT_ENVELOPE_FORMAT_VERSION) {
		reader.problem('$.formatVersion', 'unsupported_format_version', `$.formatVersion must be ${UNIT_ENVELOPE_FORMAT_VERSION}`);
		return { success: false, issues: reader.issues };
	}
	const id = reader.opaqueId(record.id, '$.id');
	const name = reader.string(record.name, '$.name');
	const acceptedRevision = validateAcceptedRevision(record.acceptedRevision);
	if (!acceptedRevision.success) {
		for (const issue of acceptedRevision.issues) reader.problem(`$.acceptedRevision${issue.path.slice(1)}`, issue.code, issue.message);
	}
	const lock = validateDependencyLock(record.dependencyLock);
	if (!lock.success) {
		for (const issue of lock.issues) reader.problem(`$.dependencyLock${issue.path.slice(1)}`, issue.code, issue.message);
	}
	const unitsRecord = reader.object(record.units, '$.units', UNIT_DOMAINS);
	if (unitsRecord === null) return { success: false, issues: reader.issues };
	const layout = readDomainUnit(reader, unitsRecord.layout, '$.units.layout', 'layout');
	const scene = readDomainUnit(reader, unitsRecord.scene, '$.units.scene', 'scene');
	const camera = readDomainUnit(reader, unitsRecord.camera, '$.units.camera', 'camera');
	const experience = readDomainUnit(reader, unitsRecord.experience, '$.units.experience', 'experience');
	const resources = readDomainUnit(reader, unitsRecord.resources, '$.units.resources', 'resources');
	if (
		reader.issues.length > 0 ||
		id === null ||
		name === null ||
		!acceptedRevision.success ||
		!lock.success ||
		layout === null ||
		scene === null ||
		camera === null ||
		experience === null ||
		resources === null
	) {
		return { success: false, issues: reader.issues };
	}
	if (acceptedRevision.value.projectId !== id) {
		reader.problem('$.acceptedRevision.projectId', 'project-mismatch', 'the accepted revision must belong to this envelope');
		return { success: false, issues: reader.issues };
	}
	const units: ProjectUnits = { layout, scene, camera, experience, resources };
	const found = envelopeFindings(units, lock.value);
	return {
		success: true,
		envelope: {
			formatVersion: UNIT_ENVELOPE_FORMAT_VERSION,
			id,
			name,
			acceptedRevision: acceptedRevision.value,
			dependencyLock: lock.value,
			units
		},
		diagnostics: found.diagnostics,
		closure: found.closure,
		ignoredOptionalExtensions: acceptedRevision.ignoredOptionalExtensions
	};
}

export function envelopeFindings(
	units: ProjectUnits,
	lock: DependencyLock
): { diagnostics: EnvelopeDiagnostic[]; closure: EnvelopeClosureFinding[] } {
	const diagnostics: EnvelopeDiagnostic[] = [];
	const closure: EnvelopeClosureFinding[] = [];
	const views = new Set(units.camera.data.views.map((view) => view.id));
	const connectionPairs = new Set<string>();
	for (const connection of units.camera.data.connections) {
		connectionPairs.add(`${connection.fromNodeId}\0${connection.toNodeId}`);
		connectionPairs.add(`${connection.toNodeId}\0${connection.fromNodeId}`);
	}
	const supportedTravel = (fromViewId: string | null, toViewId: string | null): boolean =>
		fromViewId !== null &&
		toViewId !== null &&
		connectionPairs.has(`${fromViewId}\0${toViewId}`);
	const sceneEntities = new Set(units.scene.data.entities.map((entity) => entity.id));
	for (const [index, assignment] of (units.scene.data.surfaceFinishes ?? []).entries()) {
		if (resolveLayoutSurface(units.layout.data, assignment.surface) === 'retired') {
			diagnostics.push({
				path: `$.units.scene.data.surfaceFinishes[${index}].surface`,
				code: 'unresolved-surface',
				message: `surface "${surfaceKey(assignment.surface)}" is retired in the authored Layout`
			});
		}
	}

	units.experience.data.experiences.forEach((experience, index) => {
		const path = `$.units.experience.data.experiences[${index}]`;
		for (const [position, presentation] of experience.presentations.entries()) {
			for (const [viewPosition, view] of presentation.views.entries()) {
				const viewPath = `${path}.presentations[${position}].views[${viewPosition}]`;
				if (!views.has(view.viewId)) {
					diagnostics.push({
						path: `${viewPath}.viewId`,
						code: 'unresolved-view',
						message: `presentation "${presentation.id}" names camera view "${view.viewId}", which this envelope does not carry`
					});
				}
				// A step leaves the View it is authored on and arrives at the next one.
				const next = presentation.views[viewPosition + 1];
				if (view.transition === 'travel' && next && !supportedTravel(view.viewId, next.viewId)) {
					diagnostics.push({
						path: `${viewPath}.transition`,
						code: 'travel-gap',
						message: `the Travel from "${view.viewId}" to "${next.viewId}" has no Camera connection`
					});
				}
			}
			if (presentation.subject !== null) {
				const subject = presentation.subject.subject;
				if (presentation.subject.domain === 'scene') {
					if (subject.kind !== 'entity') {
						diagnostics.push({
							path: `${path}.presentations[${position}].subject`,
							code: 'unresolved-subject',
							message: `presentation "${presentation.id}" names a scene subject of kind "${subject.kind}"; Preview resolves scene entities only`
						});
					} else if (!sceneEntities.has(subject.id)) {
						diagnostics.push({
							path: `${path}.presentations[${position}].subject`,
							code: 'unresolved-subject',
							message: `presentation "${presentation.id}" names scene entity "${subject.id}", which this envelope does not carry`
						});
					}
				} else {
					// A Layout-element subject is admitted by the format, but Preview does
					// not resolve it yet: disclose that it stays authored rather than
					// implying the run presents it.
					diagnostics.push({
						path: `${path}.presentations[${position}].subject`,
						code: 'unresolved-subject',
						message: `presentation "${presentation.id}" names layout "${subject.kind}" subject "${subject.id}", which Preview does not resolve yet`
					});
				}
			}
		}
		const presentationIds = new Set(experience.presentations.map((presentation) => presentation.id));
		const presentationById = new Map(experience.presentations.map((presentation) => [presentation.id, presentation]));
		const entryOf = (stop: ExperienceStop): string | null => stopEntryViewId(stop, presentationById.get(stop.presentationId));
		const stopById = new Map<string, ExperienceStop>();
		for (const stop of experience.stops) {
			if (!stopById.has(stop.id)) stopById.set(stop.id, stop);
		}
		const stops = new Set(experience.stops.map((stop) => stop.id));
		const successorIdsByStopId = new Map<string, string[]>();
		for (const guide of experience.guides) {
			// Match `guide.stopIds.indexOf(stop.id)` exactly: only the first occurrence
			// of a stopId inside one Guide contributes its immediate successor.
			const seenInGuide = new Set<string>();
			for (let idx = 0; idx + 1 < guide.stopIds.length; idx += 1) {
				const sId = guide.stopIds[idx]!;
				if (seenInGuide.has(sId)) continue;
				seenInGuide.add(sId);
				const list = successorIdsByStopId.get(sId);
				if (list) list.push(guide.stopIds[idx + 1]!);
				else successorIdsByStopId.set(sId, [guide.stopIds[idx + 1]!]);
			}
		}
		/**
		 * The Stops that follow `stop` under `sequence-next`. Lowering resolves that
		 * edge through the Guide orders it was asked to lower, and `guide-order`
		 * rewrites a Guide without rewriting this array, so adjacency follows the
		 * authored Guide order here too.
		 *
		 * There is no array-order fallback: a Stop no Guide orders is not part of any
		 * lowered program, and an Experience with Stops but no Guide is refused by
		 * lowering before its edges are traversed.
		 */
		const adjacentTargets = (stop: ExperienceStop): (ExperienceStop | undefined)[] =>
			(successorIdsByStopId.get(stop.id) ?? []).map((id) => stopById.get(id));
		for (const [position, stop] of experience.stops.entries()) {
			if (!presentationIds.has(stop.presentationId)) {
				diagnostics.push({
					path: `${path}.stops[${position}].presentationId`,
					code: 'unresolved-presentation',
					message: `stop "${stop.id}" names presentation "${stop.presentationId}", which this Experience does not carry`
				});
			}
			const entryViewId = stopEntryViewId(stop, presentationById.get(stop.presentationId));
			if (entryViewId !== null && !views.has(entryViewId)) {
				diagnostics.push({
					path: `${path}.stops[${position}].entryViewId`,
					code: 'unresolved-view',
					message: `stop "${stop.id}" enters at camera view "${entryViewId}", which this envelope does not carry`
				});
			}
			if (stop.transition === 'travel') {
				// Experience never infers a Cut and never searches the Camera graph: an
				// unsupported Travel stays authored and is reported as a gap. Adjacency
				// follows the Guide orders lowering reads, not this array's order.
				const reported = new Set<string>();
				for (const target of adjacentTargets(stop)) {
					if (target === undefined || reported.has(target.id)) continue;
					reported.add(target.id);
					if (!supportedTravel(entryOf(stop), entryOf(target))) {
						diagnostics.push({
							path: `${path}.stops[${position}].transition`,
							code: 'travel-gap',
							message: `the Travel from stop "${stop.id}" has no Camera connection to the View of stop "${target.id}"`
						});
					}
				}
			}
		}
		for (const [position, guide] of experience.guides.entries()) {
			for (const stopId of guide.stopIds) {
				if (!stops.has(stopId)) {
					diagnostics.push({
						path: `${path}.guides[${position}].stopIds`,
						code: 'unresolved-stop',
						message: `guide "${guide.id}" orders stop "${stopId}", which this Experience does not carry`
					});
				}
			}
		}
		for (const [position, detour] of experience.detours.entries()) {
			for (const [field, stopId] of [
				['fromStopId', detour.fromStopId],
				['toStopId', detour.toStopId],
				['returnToStopId', detour.returnToStopId]
			] as const) {
				if (!stops.has(stopId)) {
					diagnostics.push({
						path: `${path}.detours[${position}].${field}`,
						code: 'unresolved-stop',
						message: `detour "${detour.id}" names stop "${stopId}", which this Experience does not carry`
					});
				}
			}
		}
	});

	const resources = units.resources.data.resources;
	const resourceByKindAndId = new Map<string, TypedResource>();
	for (const [index, resource] of resources.entries()) {
		const key = `${resource.kind}\0${resource.id}`;
		if (!resourceByKindAndId.has(key)) resourceByKindAndId.set(key, resource);
		if (resource.unresolved !== null) diagnostics.push({
			path: `$.units.resources.data.resources[${index}].unresolved`,
			code: resource.unresolved.status, message: resource.unresolved.message
		});
	}
	const modelResourceIds = new Set(resources.filter((resource) => resource.kind === 'model').map((resource) => resource.id));
	// A Scene model names either a catalogue asset or a `model` resource of this
	// envelope. The envelope cannot know the host's catalogue, so a catalogue id
	// keeps the landed asset requirement while a `model` resource id is satisfied
	// by that entry instead — one id space, resolved against the registry.
	const requiredResources = [
		...units.scene.data.textures.map((texture) => ({ kind: 'texture', id: texture.id })),
		...units.scene.data.entities
			.filter((entity) => entity.kind === 'model')
			.map((entity) => (modelResourceIds.has(entity.assetId)
				? { kind: 'model', id: entity.assetId }
				: { kind: 'asset', id: entity.assetId })),
		// A Finish can only reach a resource-backed definition through its
		// digest. The definition itself, its local image mappings and its exact
		// lock are checked below; this entry is the executable reference.
		...units.scene.data.materials.flatMap((material) =>
			'material' in material.base ? [{ kind: 'material', id: material.base.material }] : []
		)
	];
	for (const required of requiredResources) {
		const resource = resourceByKindAndId.get(`${required.kind}\0${required.id}`);
		if (resource === undefined || resource.unresolved !== null) closure.push({
			path: '$.units.resources.data.resources', code: resource === undefined ? 'missing-resource' : 'unresolved-resource',
			message: `Scene requires ${required.kind} "${required.id}" with resolved bytes`
		});
	}

	// A creator model is an approved external revision: the envelope must pin the
	// exact revision it was authored against. The resource entry alone is not a
	// binding, so a `model` resource without its lock entry is an executable
	// closure failure (a lock without its resource is reported below).
	const pinnedModelResourceIds = new Set<string>();
	for (const entry of lock.entries) {
		if (
			entry.domain === 'resource:model' &&
			entry.subjectKind === 'resource' &&
			entry.instancePath.length === 0
		) {
			pinnedModelResourceIds.add(entry.subjectId);
		}
	}
	for (const resource of resources) {
		if (resource.kind !== 'model') continue;
		if (!pinnedModelResourceIds.has(resource.id)) {
			closure.push({
				path: '$.dependencyLock.entries',
				code: 'missing-lock',
				message: `model resource "${resource.id}" is not pinned by a dependency-lock entry`
			});
		}
	}

	// A material definition is immutable content with its own exact lock and
	// capability. Its local mappings are the only answer for each recipe digest,
	// and every project mapping must agree with the Scene texture record and pin.
	// An instance override may name a shipped image directly; it must be in the
	// same frozen allowlist as a definition image, not merely a root-relative URI.
	for (const [index, material] of units.scene.data.materials.entries()) {
		for (const role of MATERIAL_MAP_ROLES) {
			const binding = material.overrides?.maps?.[role];
			if (binding === undefined || binding === null || !('shipped' in binding.image)) continue;
			const shipped = shippedImage(binding.image.shipped);
			if (shipped === undefined) {
				closure.push({
					path: `$.units.scene.data.materials[${index}].overrides.maps.${role}.image.shipped`,
					code: 'unknown-static-image',
					message: `Finish "${material.id}" names shipped image "${binding.image.shipped}" outside the frozen manifest`
				});
			}
		}
	}
	const materialLocks = new Map<string, typeof lock.entries[number][]>();
	for (const entry of lock.entries) {
		if (entry.domain !== 'resource:material') continue;
		const entries = materialLocks.get(entry.subjectId) ?? [];
		entries.push(entry);
		materialLocks.set(entry.subjectId, entries);
	}
	for (const resource of resources) {
		if (resource.kind !== 'material') continue;
		const detail = resource.material;
		const path = `$.units.resources.data.resources`;
		if (detail === undefined) continue;
		const materialLockEntries = materialLocks.get(resource.id) ?? [];
		if (materialLockEntries.length !== 1) {
			closure.push({
				path: '$.dependencyLock.entries',
				code: 'missing-lock',
				message: `material resource "${resource.id}" must have exactly one resource:material lock`
			});
		} else {
			const entry = materialLockEntries[0]!;
			if (entry.subjectKind !== 'resource' || entry.instancePath.length !== 0 || entry.pin !== null) {
				closure.push({ path: '$.dependencyLock.entries', code: 'material-lock-invalid', message: `material lock "${resource.id}" must be a root resource lock without an external pin` });
			}
			if (entry.contentRevision !== resource.id || entry.contentRevision !== resource.contentRevision) {
				closure.push({ path: '$.dependencyLock.entries', code: 'resource-revision-mismatch', message: `material lock "${resource.id}" must pin the recipe identity` });
			}
			if (!sameCapabilities(entry.requiredCapabilities, MATERIAL_CAPABILITY)) {
				closure.push({ path: '$.dependencyLock.entries', code: 'unsupported-capability', message: `material lock "${resource.id}" must require exactly ${MATERIAL_CAPABILITY.id}@${MATERIAL_CAPABILITY.version}` });
			}
		}
		for (const image of detail.images) {
			if ('shipped' in image.source) {
				const shipped = shippedImage(image.source.shipped);
				if (shipped === undefined || shipped.hash !== image.hash) {
					closure.push({
						path,
						code: 'unknown-static-image',
						message: `material "${resource.id}" names shipped image "${image.source.shipped}" outside the frozen manifest or with a different digest`
					});
			}
				continue;
			}
			const textureId = image.source.textureId;
			const textureRecord = units.scene.data.textures.find((texture) => texture.id === textureId);
			if (textureRecord === undefined || textureRecord.uri !== `/project-assets/${textureId}`) {
				closure.push({
					path,
					code: 'missing-texture-record',
					message: `material "${resource.id}" maps ${image.hash} to texture "${textureId}" with no agreeing Scene texture record`
				});
				continue;
			}
			const textureResource = resourceByKindAndId.get(`texture\0${textureId}`);
			if (textureResource === undefined || textureResource.unresolved !== null || textureResource.pin === null) {
				closure.push({
					path,
					code: 'missing-resource',
					message: `material "${resource.id}" maps ${image.hash} to texture "${textureId}" with no resolved pin`
				});
				continue;
			}
			if (textureResource.pin.hash !== image.hash) {
				closure.push({
					path,
					code: 'material-image-pin-mismatch',
					message: `material "${resource.id}" binds ${image.hash} and texture "${textureId}" pins ${textureResource.pin.hash}`
				});
			}
		}
	}

	// Executable closure: every lock entry whose scope is a resource must be
	// satisfied by a registry record, and a pinned entry must agree with the
	// registry's own pin. This is a closure failure, not a structural defect.
	for (const [index, entry] of lock.entries.entries()) {
		if (!entry.domain.startsWith('resource:')) continue;
		const kind = entry.domain.slice('resource:'.length);
		const path = `$.dependencyLock.entries[${index}]`;
		const record = entry.subjectKind === 'resource' && entry.instancePath.length === 0
			? resourceByKindAndId.get(`${kind}\0${entry.subjectId}`) : undefined;
		if (record === undefined) {
			closure.push({
				path,
				code: 'missing-resource',
				message: `the lock requires ${entry.domain} "${entry.subjectId}" and the resource unit carries no such resource`
			});
			continue;
		}
		if (record.unresolved !== null) closure.push({ path, code: 'unresolved-resource', message: record.unresolved.message });
		const revision = record.contentRevision ?? record.pin?.hash ?? null;
		if (revision !== null && revision !== entry.contentRevision) {
			closure.push({
				path,
				code: 'resource-revision-mismatch',
				message: `the lock pins "${entry.subjectId}" to ${entry.contentRevision} and the resource unit declares ${revision}`
			});
		}
		if (!samePin(record.pin, entry.pin)) {
			closure.push({
				path,
				code: 'resource-pin-mismatch',
				message: `the lock and the resource unit pin different bytes for "${entry.subjectId}"`
			});
		}
	}
	return { diagnostics, closure };
}
