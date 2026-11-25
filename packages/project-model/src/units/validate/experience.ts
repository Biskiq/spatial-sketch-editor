import { validateSemanticReference } from '../../references/validate';
import { ShapeReader, type ShapeValidation } from '../../strict-shape';
import { EXPERIENCE_TEXT_KINDS, EXPERIENCE_TEXT_MAX_LENGTH, EXPERIENCE_WELCOME_MAX_LENGTH, EXPERIENCE_GUIDE_PACINGS, EXPERIENCE_INVITATION_PROMPT_MAX_LENGTH, EXPERIENCE_STAY_MIN_SECONDS, presentationViewIds, stopEntryViewId, type ExperienceGuidePacing, type ExperienceInvitation, type ExperiencePresentationView, EXPERIENCE_TRANSITIONS, EXPERIENCE_UNIT_FORMAT_VERSION, type Experience, type ExperienceDetour, type ExperienceGuide, type ExperiencePresentation, type ExperiencePresentationText, type ExperienceStop, type ExperienceTransitionKind, type ExperienceUnitPayload } from '../types';
import { failed } from './shared';

export const EXPERIENCE_KEYS = [
	'id',
	'label',
	'entryGuideId',
	'welcome',
	'presentations',
	'stops',
	'guides',
	'detours'
] as const;
export const PRESENTATION_KEYS = ['id', 'label', 'views', 'subject', 'text', 'explorable'] as const;
export const PRESENTATION_VIEW_KEYS = ['viewId', 'transition'] as const;
export const PRESENTATION_TEXT_KEYS = ['kind', 'body'] as const;
export const STOP_KEYS = ['id', 'presentationId', 'entryViewId', 'staySeconds', 'invitation', 'transition'] as const;
export const INVITATION_KEYS = ['prompt'] as const;
export const GUIDE_KEYS = ['id', 'label', 'stopIds', 'pacing'] as const;
export const DETOUR_KEYS = ['id', 'fromStopId', 'toStopId', 'returnToStopId'] as const;
export const EXPERIENCE_PAYLOAD_KEYS = ['formatVersion', 'experiences'] as const;

/** An edge's authored Cut/Travel selector; absent means Cut. */
export function readTransition(reader: ShapeReader, input: unknown, path: string): ExperienceTransitionKind | null {
	if (input === undefined) return 'cut';
	const transition = reader.tag(input, path, EXPERIENCE_TRANSITIONS);
	return transition as ExperienceTransitionKind | null;
}

/** One Presentation's bounded plain text; `null` input is the explicit no-text state. */
export function readExperienceText(
	reader: ShapeReader,
	input: unknown,
	path: string,
	maxLength = EXPERIENCE_TEXT_MAX_LENGTH
): ExperiencePresentationText | null {
	const record = reader.object(input, path, PRESENTATION_TEXT_KEYS);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, EXPERIENCE_TEXT_KINDS);
	const body = reader.string(record.body, `${path}.body`);
	if (kind === null || body === null) return null;
	const length = [...body].length;
	if (length > maxLength) {
		reader.problem(
			`${path}.body`,
			'text-too-long',
			`${path}.body carries ${length} code points; text is bounded at ${maxLength}`
		);
		return null;
	}
	return { kind: 'plain', body };
}

/**
 * Read a Presentation's ordered Views: distinct ids, no step into the first
 * View, and a Cut/Travel selector (absent means Cut) on each later one.
 */
export function readPresentationViews(
	reader: ShapeReader,
	input: unknown,
	path: string
): ExperiencePresentationView[] | null {
	const views = readCollection(reader, input, path, (entry, entryPath) => {
		const record = reader.object(entry, entryPath, PRESENTATION_VIEW_KEYS);
		if (record === null) return null;
		const viewId = reader.opaqueId(record.viewId, `${entryPath}.viewId`);
		const transition = record.transition === undefined
			? undefined
			: readTransition(reader, record.transition, `${entryPath}.transition`);
		if (viewId === null || transition === null) return null;
		return { viewId, ...(transition === undefined ? {} : { transition }) };
	});
	if (views === null) return null;
	if (new Set(views.map((view) => view.viewId)).size !== views.length) {
		reader.problem(path, 'duplicate-identity', `${path} names a View twice`);
		return null;
	}
	// A step leaves the View it is authored on, so only the last View has none.
	if (views.at(-1)?.transition === 'travel') {
		reader.problem(
			`${path}[${views.length - 1}].transition`,
			'travel-after-last',
			'The last View has no next View, so it cannot leave by a Travel'
		);
		return null;
	}
	return views;
}

/** A Stop's stay: finite seconds, at least the minimum. */
export function readStaySeconds(reader: ShapeReader, input: unknown, path: string): number | null {
	return reader.numberAtLeast(input, path, EXPERIENCE_STAY_MIN_SECONDS, false);
}

/** A Stop's invitation: `null` (off) or `{ prompt }`, the prompt bounded or `null`. */
export function readInvitation(
	reader: ShapeReader,
	input: unknown,
	path: string
): { readonly ok: true; readonly value: ExperienceInvitation | null } | { readonly ok: false } {
	if (input === null) return { ok: true, value: null };
	const record = reader.object(input, path, INVITATION_KEYS);
	if (record === null) return { ok: false };
	if (record.prompt === null) return { ok: true, value: { prompt: null } };
	const prompt = reader.string(record.prompt, `${path}.prompt`);
	if (prompt === null) return { ok: false };
	const length = [...prompt].length;
	if (length > EXPERIENCE_INVITATION_PROMPT_MAX_LENGTH) {
		reader.problem(
			`${path}.prompt`,
			'text-too-long',
			`${path}.prompt carries ${length} code points; a prompt is bounded at ${EXPERIENCE_INVITATION_PROMPT_MAX_LENGTH}`
		);
		return { ok: false };
	}
	return { ok: true, value: { prompt } };
}

export function readExperience(reader: ShapeReader, input: unknown, path: string): Experience | null {
	const record = reader.object(input, path, EXPERIENCE_KEYS);
	if (record === null) return null;
	const id = reader.opaqueId(record.id, `${path}.id`);
	const label = reader.string(record.label, `${path}.label`);
	const entryGuideId =
		record.entryGuideId === null ? null : reader.opaqueId(record.entryGuideId, `${path}.entryGuideId`);

	const welcome = record.welcome === null
		? null
		: readExperienceText(reader, record.welcome, `${path}.welcome`, EXPERIENCE_WELCOME_MAX_LENGTH);
	const presentations = readCollection(reader, record.presentations, `${path}.presentations`, (entry, entryPath) => {
		const value = reader.object(entry, entryPath, PRESENTATION_KEYS);
		if (value === null) return null;
		const presentationId = reader.opaqueId(value.id, `${entryPath}.id`);
		const presentationLabel = value.label === null ? null : reader.string(value.label, `${entryPath}.label`);
		const views = readPresentationViews(reader, value.views, `${entryPath}.views`);
		const text = value.text === null ? null : readExperienceText(reader, value.text, `${entryPath}.text`);
		const explorable = reader.boolean(value.explorable, `${entryPath}.explorable`);
		let subject: ExperiencePresentation['subject'] = null;
		if (value.subject !== null) {
			const read = validateSemanticReference(value.subject);
			if (!read.success) {
				for (const issue of read.issues) {
					reader.problem(`${entryPath}.subject${issue.path.slice(1)}`, issue.code, issue.message);
				}
				return null;
			}
			if (read.value.componentId !== null) {
				reader.problem(
					`${entryPath}.subject.componentId`,
					'component-not-admitted',
					'a Presentation subject names a whole subject; a component-scoped reference is not admitted'
				);
				return null;
			}
			if (read.value.capabilityId !== null) {
				reader.problem(
					`${entryPath}.subject.capabilityId`,
					'component-not-admitted',
					'a Presentation subject names a whole subject; a capability-scoped reference is not admitted'
				);
				return null;
			}
			if (read.value.domain !== 'scene' && read.value.domain !== 'layout') {
				reader.problem(
					`${entryPath}.subject.domain`,
					'unsupported-subject-domain',
					`a Presentation subject resolves to a Scene entity or a Layout element; "${read.value.domain}" is neither`
				);
				return null;
			}
			subject = read.value;
		}
		// A following name is only meaningful with a linked Scene entity (G24).
		if (
			presentationLabel === null &&
			value.label === null &&
			(subject === null || subject.domain !== 'scene' || subject.subject.kind !== 'entity')
		) {
			reader.problem(`${entryPath}.label`, 'label-follows-subject', 'A Presentation follows its object\'s name only when it names a Scene entity; every other Presentation needs its own name.');
			return null;
		}
		if (
			presentationId === null ||
			(value.label !== null && presentationLabel === null) ||
			views === null ||
			explorable === null ||
			(value.text !== null && text === null)
		) {
			return null;
		}
		return {
			id: presentationId,
			label: presentationLabel,
			views,
			subject,
			text,
			explorable
		} satisfies ExperiencePresentation;
	});

	const stops = readCollection(reader, record.stops, `${path}.stops`, (entry, entryPath) => {
		const value = reader.object(entry, entryPath, STOP_KEYS);
		if (value === null) return null;
		const stopId = reader.opaqueId(value.id, `${entryPath}.id`);
		const presentationId = reader.opaqueId(value.presentationId, `${entryPath}.presentationId`);
		const entryViewId = value.entryViewId === null
			? null
			: reader.opaqueId(value.entryViewId, `${entryPath}.entryViewId`);
		const staySeconds = readStaySeconds(reader, value.staySeconds, `${entryPath}.staySeconds`);
		const invitation = readInvitation(reader, value.invitation, `${entryPath}.invitation`);
		const transition = value.transition === undefined
			? undefined
			: reader.tag(value.transition, `${entryPath}.transition`, EXPERIENCE_TRANSITIONS) as ExperienceTransitionKind | null;
		if (
			stopId === null ||
			presentationId === null ||
			(value.entryViewId !== null && entryViewId === null) ||
			staySeconds === null ||
			!invitation.ok ||
			transition === null
		) {
			return null;
		}
		return {
			id: stopId,
			presentationId,
			entryViewId,
			staySeconds,
			invitation: invitation.value,
			...(transition === undefined ? {} : { transition })
		} satisfies ExperienceStop;
	});

	const guides = readCollection(reader, record.guides, `${path}.guides`, (entry, entryPath) => {
		const value = reader.object(entry, entryPath, GUIDE_KEYS);
		if (value === null) return null;
		const guideId = reader.opaqueId(value.id, `${entryPath}.id`);
		const guideLabel = reader.string(value.label, `${entryPath}.label`);
		const stopIds = reader.opaqueIdArray(value.stopIds, `${entryPath}.stopIds`);
		const pacing = reader.tag(value.pacing, `${entryPath}.pacing`, EXPERIENCE_GUIDE_PACINGS) as ExperienceGuidePacing | null;
		if (guideId === null || guideLabel === null || stopIds === null || pacing === null) return null;
		if (new Set(stopIds).size !== stopIds.length) {
			reader.problem(`${entryPath}.stopIds`, 'duplicate-identity', 'repeated guided placements require distinct Stop identities');
			return null;
		}
		return { id: guideId, label: guideLabel, stopIds, pacing } satisfies ExperienceGuide;
	});

	const detours = readCollection(reader, record.detours, `${path}.detours`, (entry, entryPath) => {
		const value = reader.object(entry, entryPath, DETOUR_KEYS);
		if (value === null) return null;
		const detourId = reader.opaqueId(value.id, `${entryPath}.id`);
		const fromStopId = reader.opaqueId(value.fromStopId, `${entryPath}.fromStopId`);
		const toStopId = reader.opaqueId(value.toStopId, `${entryPath}.toStopId`);
		const returnToStopId = reader.opaqueId(value.returnToStopId, `${entryPath}.returnToStopId`);
		if (detourId === null || fromStopId === null || toStopId === null || returnToStopId === null) return null;
		return { id: detourId, fromStopId, toStopId, returnToStopId } satisfies ExperienceDetour;
	});

	// `entryGuideId` is deliberately absent from this gate: `null` is the legal
	// "this Experience enters nothing" value of a Guide-free Experience. A
	// malformed value is already reported by the reader and fails below.
	if (
		id === null ||
		label === null ||
		presentations === null ||
		stops === null ||
		guides === null ||
		detours === null
	) {
		return null;
	}
	const presentationById = new Map(presentations.map((entry) => [entry.id, entry]));
	const viewsByPresentation = new Map(presentations.map((entry) => [entry.id, new Set(presentationViewIds(entry))]));
	// A-5 — one Guide per Stop, exactly once. A Stop no Guide orders has no place
	// in any route; a Stop in two Guides would give one stored Cut/Travel two
	// different meanings.
	const memberships = new Map<string, number>();
	for (const guide of guides) {
		for (const stopId of guide.stopIds) memberships.set(stopId, (memberships.get(stopId) ?? 0) + 1);
	}
	for (const stop of stops) {
		const count = memberships.get(stop.id) ?? 0;
		if (count !== 1) {
			reader.problem(
				`${path}.guides`,
				'stop-guide-membership',
				count === 0
					? `Stop "${stop.id}" is in no Guide; every Stop belongs to exactly one Guide`
					: `Stop "${stop.id}" is listed ${count} times; every Stop belongs to exactly one Guide, exactly once`
			);
			return null;
		}
	}
	// A-1 / D-12 — a step leaves the item it is authored on, so a Guide's last
	// Stop has none, and a Travel is never a View joined to itself.
	const stopById = new Map(stops.map((stop) => [stop.id, stop]));
	const entryViewOfStop = (stopId: string): string | null => {
		const stop = stopById.get(stopId);
		return stop === undefined ? null : stopEntryViewId(stop, presentationById.get(stop.presentationId));
	};
	for (const guide of guides) {
		const lastStopId = guide.stopIds.at(-1);
		if (lastStopId !== undefined && stopById.get(lastStopId)?.transition === 'travel') {
			reader.problem(
				`${path}.guides`,
				'travel-after-last',
				`the last Stop of Guide "${guide.id}" has no next Stop, so it cannot leave by a Travel`
			);
			return null;
		}
		for (let index = 0; index + 1 < guide.stopIds.length; index += 1) {
			const from = stopById.get(guide.stopIds[index]!);
			const to = stopById.get(guide.stopIds[index + 1]!);
			if (from?.transition !== 'travel' || to === undefined) continue;
			const fromView = entryViewOfStop(from.id);
			const toView = entryViewOfStop(to.id);
			if (fromView !== null && fromView === toView) {
				reader.problem(
					`${path}.guides`,
					'travel-same-view',
					`the Travel from Stop "${from.id}" to "${to.id}" joins View "${fromView}" to itself; both Stops show that View, so the step is a Cut`
				);
				return null;
			}
		}
	}
	for (const [position, stop] of stops.entries()) {
		const views = viewsByPresentation.get(stop.presentationId);
		if (stop.entryViewId !== null && views !== undefined && !views.has(stop.entryViewId)) {
			reader.problem(
				`${path}.stops[${position}].entryViewId`,
				'entry-view-not-in-presentation',
				`Stop "${stop.id}" enters at View "${stop.entryViewId}", which its Presentation does not carry`
			);
			return null;
		}
	}

	const duplicate = firstDuplicate([
		presentations.map((item) => item.id),
		stops.map((item) => item.id),
		guides.map((item) => item.id),
		detours.map((item) => item.id)
	]);
	if (duplicate !== null) {
		reader.problem(path, 'duplicate-identity', `${path} declares "${duplicate}" twice`);
		return null;
	}
	if (guides.length === 0) {
		// An Experience with no Guide is legal — a free-only source produces
		// Presentations and no order — but then it enters nothing, explicitly.
		if (entryGuideId !== null) {
			reader.problem(`${path}.entryGuideId`, 'missing-entry-guide', `${path}.entryGuideId must be null when the Experience carries no guide`);
			return null;
		}
	} else if (entryGuideId === null || !guides.some((guide) => guide.id === entryGuideId)) {
		reader.problem(`${path}.entryGuideId`, 'missing-entry-guide', `${path}.entryGuideId "${entryGuideId ?? 'null'}" names no guide`);
		return null;
	}
	return { id, label, entryGuideId, welcome, presentations, stops, guides, detours };
}

export function firstDuplicate(groups: readonly (readonly string[])[]): string | null {
	const seen = new Set<string>();
	for (const group of groups) {
		for (const id of group) {
			if (seen.has(id)) return id;
			seen.add(id);
		}
	}
	return null;
}

export function readCollection<T>(
	reader: ShapeReader,
	input: unknown,
	path: string,
	read: (entry: unknown, entryPath: string) => T | null
): T[] | null {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array`);
		return null;
	}
	const values: T[] = [];
	for (const [index, entry] of input.entries()) {
		const value = read(entry, `${path}[${index}]`);
		if (value === null) return null;
		values.push(value);
	}
	return values;
}

/**
 * Strict read of the Experience 4 payload. The payload is a collection because
 * several Experiences share one world; an empty collection is explicit. Stop,
 * Presentation and Guide identity are independent: repeated visits create fresh
 * runs of a Stop, and repeated guided placements use distinct Stop IDs.
 *
 * Format 4 is a strict cutover (pre-beta, no converter): an older payload is
 * refused as an unsupported version, never negotiated or upgraded in place.
 */
export function validateExperiencePayload(input: unknown): ShapeValidation<ExperienceUnitPayload> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', EXPERIENCE_PAYLOAD_KEYS);
	if (record === null) return failed(reader);
	if (record.formatVersion !== EXPERIENCE_UNIT_FORMAT_VERSION) {
		reader.problem('$.formatVersion', 'unsupported_format_version', `$.formatVersion must be ${EXPERIENCE_UNIT_FORMAT_VERSION}`);
		return failed(reader);
	}
	if (!Array.isArray(record.experiences)) {
		reader.problem('$.experiences', 'not-an-array', '$.experiences must be an array');
		return failed(reader);
	}
	const experiences: Experience[] = [];
	const ids = new Set<string>();
	for (const [index, entry] of record.experiences.entries()) {
		const path = `$.experiences[${index}]`;
		const experience = readExperience(reader, entry, path);
		if (experience === null) return failed(reader);
		if (ids.has(experience.id)) reader.problem(`${path}.id`, 'duplicate-identity', `experience "${experience.id}" is declared twice`);
		ids.add(experience.id);
		experiences.push(experience);
	}
	if (reader.issues.length > 0) return failed(reader);
	return {
		success: true,
		value: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences },
		ignoredOptionalExtensions: []
	};
}
