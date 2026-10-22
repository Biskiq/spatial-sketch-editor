/**
 * Execution-structure gate (arch lane) — PR #115 §9.4 and §11.
 *
 * PR #115 replaced sequential capability planning with tracks, phases and slices whose status is
 * authored as Markdown tables a human reads. Nothing compiles those tables, so the relationships
 * that matter had no enforcement: a slice consuming a gate version that is not accepted, a consumer
 * satisfying its own prerequisite by editing the register in its own diff, two rows claiming one
 * gate version, a phase closed with an unshipped final child, a slice plan that quietly narrows
 * acceptance without an integration route, and an exposure window opened too late or never.
 *
 * This file enforces exactly those relationships, plus the capability-readiness rule the gate
 * checker could not prove before (T1.P01.S01): the `Accepted capabilities` field on each
 * gate/version row and `Requires` on each consumer slice row, resolved through the prerequisite
 * closure, accepted in the current tree **and** at the trusted base, `active` and not retired.
 * Overall gate state alone cannot prove incremental capability scope, so a green gate row no
 * longer stands in for a specific accepted capability.
 *
 * It does so with the *same* markdown-table helper as the register it reads
 * (`tests/helpers/markdown-tables.ts`), in-memory negative fixtures for every rule, and positive
 * controls — so a checker that stopped detecting one of them fails here instead of passing
 * vacuously.
 *
 * What it deliberately does NOT do: no generic workflow engine, no status store, no scheduler. It
 * reads the registers, resolves their rows, and reports. Truth a checker cannot infer stays with
 * review: that a slice's declared `Consumes`, `Requires` and `Effects` are truthful, and that a new
 * persisted format names its F amendment and owner in the reviewed plan.
 *
 * Run whole (part of `npm run test:arch`, never path-gated), or alone:
 *
 *   cd apps/editor && npx vitest run --config vitest.arch.config.ts tests/docs/parallel-track-gates.test.ts
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT, resolveReference } from '../helpers/docs-references';
import {
	columnProblems,
	isSentinel,
	linkTarget,
	routeLines,
	rowObjects,
	stripDecoration,
	tableUnderHeading,
	tokens
} from '../helpers/markdown-tables';

const ROADMAP = 'docs/roadmap/README.md';
const CYCLE = 'docs/operations/architecture-cycle.md';
const ROUTER = 'docs/README.md';
const R115_PHASE = 'docs/roadmap/parallel-track-cutover';
const SKILL_CLOSEOUT = '.agents/skills/slice-closeout/SKILL.md';
const SKILL_PHASE = '.agents/skills/phase-closeout/SKILL.md';

/** Register column sets, in order. A mismatch is reported, never silently tolerated. */
const TRACK_COLUMNS = ['Track', 'Status', 'Roadmap'] as const;
const GATE_COLUMNS = [
	'Gate',
	'Version',
	'Kind',
	'Owner',
	'Contract anchor',
	'State',
	'Provider slice',
	'Exports',
	'Conformance',
	'Acceptance',
	'Commit',
	'Accepted capabilities'
] as const;
const PHASE_COLUMNS = ['Phase', 'Status', 'Depends on', 'Workspace'] as const;
const SLICE_COLUMNS = [
	'Slice',
	'Status',
	'Consumes',
	'Requires',
	'Effects',
	'Plan',
	'Acceptance',
	'Authorization'
] as const;
/** The durable capability record's table, under its heading in the linked record. */
const CAPABILITY_RECORD_HEADING = 'Accepted capability';
const CAPABILITY_RECORD_COLUMNS = [
	'Capability',
	'Anchor',
	'Source kinds',
	'Prerequisites',
	'Extension slice',
	'Exports',
	'Conformance',
	'Acceptance',
	'Commit'
] as const;
const CYCLE_STATE_COLUMNS = [
	'Stage',
	'Readiness',
	'Window',
	'Exposure slices (≤3)',
	'Opener (expected)',
	'Terminal',
	'Opened by',
	'Exposure rows',
	'Closed by'
] as const;
const CYCLE_MECHANISM_COLUMNS = ['Mechanism', 'Status', 'Proof route', 'Verdict'] as const;

const TRACK_STATUSES = ['proposed', 'planning', 'approved', 'in-progress', 'shipped', 'archived'];
const SLICE_STATUSES = [...TRACK_STATUSES, 'accepted'];
const GATE_STATES = ['undrafted', 'ratified', 'implemented', 'accepted', 'superseded'];
const GATE_KINDS = ['foundation', 'capability'];
const STAGES = [
	'WAITING',
	'PHASE_0_DUE',
	'PHASE_0_ACTIVE',
	'ADJUDICATION',
	'PHASE_1',
	'PHASE_2_VALIDATING',
	'PHASE_3_EVALUATE',
	'STEADY'
];
const READINESS = [
	'awaiting-bounded-slice-window-plan',
	'ready',
	'open',
	'owner-verdict-owed',
	'steady',
	'diagnosis-due'
];
const MECHANISM_STATUSES = ['installed', 'dormant'];
const VERIFICATION_TIERS = ['iteration', 'affected-subsystem', 'architecture-integration', 'exhaustive'];
const SETTLED_SLICE_STATUSES = ['accepted', 'shipped'];
const GATE_REFERENCE = /^[A-Za-z][A-Za-z0-9._-]*@\d+$/;
/** An exact Accepted-capabilities scope: `Gate@Version:capability-vN`. */
const CAPABILITY_REFERENCE = /^([A-Za-z][A-Za-z0-9._-]*)@(\d+):([A-Za-z][A-Za-z0-9._-]*)$/;
/**
 * One `Accepted capabilities` cell entry: `<capability> active|retired — <record path>`.
 * The status is required, so a scope can never be admitted by omission.
 */
const CAPABILITY_ENTRY = /^([A-Za-z][A-Za-z0-9._-]*@\d+:[A-Za-z][A-Za-z0-9._-]*)[ \t]+(active|retired)(?:[ \t]*—[ \t]*(.+))?$/;
/** Qualified ids (§9.1): `T1.P01.S01`, `R115.S01`. */
const SLICE_ID = /^(?:[A-Z]\d+\.P\d+|R\d+)\.S\d+$/;
const PHASE_ID = /^(?:[A-Z]\d+\.P\d+|R\d+)$/;
const CAMERA_EFFECT = 'camera-authoring-migration';
/**
 * A repository phase registered directly in the global register (`R115`), not a track. It has no
 * parent track, so it writes no `TRACK COMPLETE` record: its closure is `PHASE CLOSE` plus its own
 * `shipped` row (phase-closeout step 5).
 */
const REPOSITORY_PHASE = /^R\d+$/;
/** The exposure window's bound. Changing it requires an owner amendment (§11). */
const EXPOSURE_BOUND = 3;
/** The §9.4 seed rows: gate identity is contractual, so the register keeps every one of them. */
const SEEDED_GATES = [
	'F1.reference',
	'F2.unit-envelope',
	'F3.channels',
	'F4.intent-acceptance',
	'F5.release-envelope',
	'T1.viewport-projection',
	'T3.camera-experience-cutover',
	'T4.prepared-reader'
];
/** Every registered track and repository phase (§9.1). */
const SEEDED_TRACKS = ['T1', 'T2', 'T3', 'T4', 'R115'];
/** The §11 mechanism register's fixed identities. */
const SEEDED_MECHANISMS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
/**
 * A listed exposure row: its slice id, then optionally the `discharged` marker and a reason. The
 * marker is anchored to that position, so negated prose (`… not discharged — awaiting review`) is
 * never read as a discharge.
 */
const EXPOSURE_ROW = /^((?:[A-Z]\d+\.P\d+|R\d+)\.S\d+)(?:[ \t]+(.*))?$/;
/** A `TRACK COMPLETE` entry naming its track: `TRACK COMPLETE T1 — owner · date · evidence`. */
const TRACK_COMPLETE_ENTRY = /^[ \t]*(?:[-*][ \t]+)?\*{0,2}TRACK COMPLETE\*{0,2}[ \t]*:?[ \t]+([A-Z]\d+)\b(.*)$/i;

// ---------------------------------------------------------------- model

export type GateRow = {
	gate: string;
	version: string;
	kind: string;
	owner: string;
	anchor: string;
	state: string;
	provider: string;
	exports: string;
	conformance: string;
	acceptance: string;
	commit: string;
	/** Parsed `Accepted capabilities` entries: the accepted scopes of this version. */
	capabilities: AcceptedCapabilityEntry[];
};

/** One `Accepted capabilities` entry, with the fields the readiness rule resolves. */
export type AcceptedCapabilityEntry = {
	/** The cell text as written, for a diagnostics line. */
	raw: string;
	/** The exact `Gate@Version:capability` string `Requires` names. */
	capability: string;
	gateVersion: string;
	scope: string;
	status: string;
	/** The durable record that owns this capability's evidence. */
	record: string;
	/** False when the entry does not match the written grammar. */
	wellFormed: boolean;
};

/** The durable record's own row: what one accepted capability actually landed. */
export type CapabilityRecord = {
	capability: string;
	anchor: string;
	/** The source kinds this scope admits, as declared tokens. */
	sourceKinds: string;
	prerequisites: string;
	/** The slice that authored or extended this scope. */
	extensionSlice: string;
	exports: string;
	conformance: string;
	acceptance: string;
	commit: string;
};

export type SliceRow = {
	id: string;
	status: string;
	consumes: string;
	/** Exact `Gate@Version:capability` scopes this slice requires, or `—`. */
	requires: string;
	effects: string;
	plan: string;
	planFile: string;
	acceptance: string;
	authorization: string;
	/** `VERIFICATION:` declaration in the slice plan, or ''. */
	verification: string;
	/** `INTEGRATION ROUTE:` declaration in the slice plan, or ''. */
	integrationRoute: string;
};

/** One cycle exposure row: the listed slice, and whether the row records a discharge. */
export type ExposureRow = { id: string; discharged: boolean };

export type PhaseModel = {
	id: string;
	file: string;
	finalGateSlice: string;
	finalGateArtifact: string;
	stage: string;
	closed: string;
	slices: SliceRow[];
};

export type TrackRow = {
	id: string;
	status: string;
	roadmap: string;
	/** Phase ids its phase register lists. */
	phaseIds: string[];
	/** True only for a present, complete `TRACK COMPLETE` record (§9.3). */
	trackComplete: boolean;
	/** Missing parts of a present record (owner, date, evidence); empty when absent or complete. */
	completionGaps: string[];
};

export type CycleModel = {
	stage: string;
	readiness: string;
	window: string;
	exposures: string[];
	opener: string;
	terminal: string;
	openedBy: string;
	exposureRows: string;
	closedBy: string;
	mechanisms: Array<{ id: string; status: string; verdict: string }>;
};

export type StructureModel = {
	gates: GateRow[];
	/** The gate register as it exists at the trusted base; `null` when it cannot be read. */
	trustedBase: GateRow[] | null;
	tracks: TrackRow[];
	phases: PhaseModel[];
	cycle: CycleModel;
	exists: (path: string) => boolean;
	resolves: (fromFile: string, target: string) => boolean;
	ancestorOfHead: (commit: string) => boolean;
	/** A repository file's text, or `null` when it does not exist. */
	readText: (path: string) => string | null;
	/**
	 * A slice's status as recorded in its phase README at the trusted base, or `''`. A consumer
	 * already accepted there keeps its recorded scopes: a later retirement is not retroactive.
	 */
	trustedSliceStatus: (file: string, sliceId: string) => string;
};

// ---------------------------------------------------------------- rules

/** Gate-register rules: structure, exact versions, readiness, eligibility, self-satisfaction. */
export function gateProblems(model: StructureModel): string[] {
	const problems: string[] = [];
	const rows = new Map(model.gates.map((row) => [`${row.gate}@${row.version}`, row]));
	const currentByGate = new Map<string, GateRow[]>();
	for (const row of model.gates) {
		currentByGate.set(row.gate, [...(currentByGate.get(row.gate) ?? []), row]);
	}
	const sliceStatus = new Map<string, string>();
	for (const phase of model.phases) for (const slice of phase.slices) sliceStatus.set(slice.id, slice.status);
	const trackIds = new Set(model.tracks.map((track) => track.id));

	const seen = new Set<string>();
	for (const row of model.gates) {
		const reference = `${row.gate}@${row.version}`;
		if (seen.has(reference)) problems.push(`gate register: ${reference} appears on more than one row`);
		seen.add(reference);
		if (!GATE_KINDS.includes(row.kind)) problems.push(`${row.gate}: kind "${row.kind}" is not one of ${GATE_KINDS.join(' | ')}`);
		if (!GATE_STATES.includes(row.state)) problems.push(`${row.gate}: state "${row.state}" is not one of ${GATE_STATES.join(' | ')}`);
		if (row.state === 'undrafted' && !isSentinel(row.version)) {
			problems.push(`${row.gate}: an undrafted gate has no version (found "${row.version}")`);
		}
		if (row.state !== 'undrafted' && isSentinel(row.version)) {
			problems.push(`${row.gate}: state "${row.state}" requires a version`);
		}
		if (!isSentinel(row.version) && !/^\d+$/.test(row.version)) {
			problems.push(`${row.gate}: version "${row.version}" is not an integer`);
		}

		// Owner: a registered track or the owning contract file, never empty.
		if (isSentinel(row.owner)) problems.push(`${row.gate}: owner is required`);
		else if (/^[A-Z]\d+/.test(row.owner)) {
			if (!trackIds.has(row.owner)) problems.push(`${row.gate}: owner "${row.owner}" is not a registered track`);
		} else if (!model.exists(row.owner) && !model.exists(`docs/reference/${basename(row.owner)}`)) {
			problems.push(`${row.gate}: owner "${row.owner}" is not a track id or an existing contract file`);
		}
		if (!isSentinel(row.anchor) && !model.resolves(ROADMAP, row.anchor)) {
			problems.push(`${row.gate}: contract anchor "${row.anchor}" does not resolve`);
		}

		// Provider identity: at most one, existing, and required once implemented.
		if (!isSentinel(row.provider) && !sliceStatus.has(row.provider)) {
			problems.push(`${row.gate}: provider slice "${row.provider}" is not registered in any phase README`);
		}
		if ((row.state === 'implemented' || row.state === 'accepted') && isSentinel(row.provider)) {
			problems.push(`${row.gate}: state "${row.state}" requires exactly one registered provider slice`);
		}

		// Readiness evidence: implemented needs real shared code, accepted needs evidence and a commit.
		if (row.state === 'implemented' || row.state === 'accepted') {
			for (const [column, value] of [
				['Exports', row.exports],
				['Conformance', row.conformance]
			] as const) {
				const paths = tokens(value);
				if (paths.length === 0) problems.push(`${row.gate}: state "${row.state}" requires a ${column.toLowerCase()} path`);
				for (const path of paths) {
					if (!model.exists(path)) problems.push(`${row.gate}: ${column} path "${path}" does not exist`);
				}
			}
		}
		if (row.state === 'accepted') {
			const records = tokens(row.acceptance);
			if (records.length === 0) problems.push(`${row.gate}: state "accepted" requires an acceptance record`);
			for (const path of records) {
				if (!model.exists(path)) problems.push(`${row.gate}: acceptance record "${path}" does not exist`);
			}
			if (isSentinel(row.commit)) problems.push(`${row.gate}: state "accepted" requires a reviewed implementation commit`);
			else if (!model.ancestorOfHead(row.commit)) problems.push(`${row.gate}: commit "${row.commit}" is not an ancestor of HEAD`);
		}
	}

	// Version runs: contiguous from 1, with exactly one current row per gate.
	for (const [gate, gateRows] of currentByGate) {
		const versions = gateRows
			.map((row) => row.version)
			.filter((version) => !isSentinel(version))
			.map(Number)
			.sort((a, b) => a - b);
		if (gateRows.filter((row) => row.state !== 'superseded').length > 1) {
			problems.push(`${gate}: more than one current (non-superseded) version row`);
		}
		versions.forEach((version, index) => {
			if (version !== index + 1) problems.push(`${gate}: version ${version} breaks the run from 1`);
		});
		for (const row of gateRows.filter((entry) => entry.state === 'superseded')) {
			if (versions.length > 0 && Number(row.version) === Math.max(...versions)) {
				problems.push(`${gate}: the newest version ${row.version} cannot be superseded without a replacement row`);
			}
		}
	}

	// Exact versions, eligibility and anti-self-satisfaction at the slice side.
	const trusted = model.trustedBase;
	if (trusted === null) {
		problems.push(
			'gate register: the trusted base is unreadable — run `git fetch origin main` (this check reads `git merge-base HEAD main`) and re-run; it never skips'
		);
	}
	const trustedRows = new Map((trusted ?? []).map((row) => [`${row.gate}@${row.version}`, row.state]));

	for (const phase of model.phases) {
		for (const slice of phase.slices) {
			const consumed = tokens(slice.consumes);
			const effects = tokens(slice.effects);
			for (const reference of consumed) {
				if (!GATE_REFERENCE.test(reference)) {
					problems.push(
						`${slice.id}: consumes "${reference}" is not an exact Gate@Version (a bare gate name, a track id or a phase id is invalid)`
					);
					continue;
				}
				const row = rows.get(reference);
				if (row === undefined) {
					problems.push(`${slice.id}: consumes "${reference}", which is not a registered gate version`);
					continue;
				}
				if (slice.status === 'in-progress' || slice.status === 'accepted') {
					if (row.state === 'superseded') {
						problems.push(`${slice.id}: consumes superseded "${reference}" — re-declare the current version`);
					} else if (row.state !== 'accepted') {
						problems.push(`${slice.id}: state "${slice.status}" requires an accepted "${reference}" (found "${row.state}")`);
					}
					if (trusted !== null && trustedRows.get(reference) !== 'accepted') {
						problems.push(
							`${slice.id}: "${reference}" is not accepted at the trusted base — a consumer cannot satisfy its own prerequisite in its own diff`
						);
					}
				}
			}
			for (const effect of effects) {
				if (effect !== CAMERA_EFFECT) problems.push(`${slice.id}: effect "${effect}" is outside the documented effects grammar`);
			}
			if (effects.includes(CAMERA_EFFECT)) {
				for (const required of ['T1.viewport-projection', 'T3.camera-experience-cutover']) {
					const declared = consumed.find((reference) => reference.startsWith(`${required}@`));
					if (declared === undefined) {
						problems.push(`${slice.id}: effect ${CAMERA_EFFECT} requires an exact accepted ${required}@<version> in Consumes`);
					} else if (rows.get(declared)?.state !== 'accepted') {
						problems.push(`${slice.id}: effect ${CAMERA_EFFECT} requires ${declared} to be accepted`);
					}
				}
			}
		}
	}
	return problems;
}

/**
 * The seeded structure's non-vacuity, stated as an invariant rather than as the state of the day:
 * every seeded gate identity, track and mechanism is registered as such, and R115 keeps its
 * registered child. Status, version, provider assignment and phase population stay free, so the
 * first legitimate T-track phase or ratified gate arrives without failing the lane (§9.4).
 */
export function seedProblems(model: StructureModel): string[] {
	const problems: string[] = [];
	for (const gate of SEEDED_GATES) {
		if (!model.gates.some((row) => row.gate === gate)) {
			problems.push(`gate register: the seeded gate ${gate} is missing`);
		}
	}
	for (const track of SEEDED_TRACKS) {
		if (model.tracks.filter((row) => row.id === track).length !== 1) {
			problems.push(`track register: ${track} is not registered exactly once`);
		}
	}
	for (const mechanism of SEEDED_MECHANISMS) {
		if (model.cycle.mechanisms.filter((row) => row.id === mechanism).length !== 1) {
			problems.push(`cycle: mechanism ${mechanism} is not registered exactly once`);
		}
	}
	if (!STAGES.includes(model.cycle.stage)) problems.push(`cycle: stage "${model.cycle.stage}" is not part of the stage vocabulary`);
	if (!model.phases.some((phase) => phase.id === 'R115' && phase.slices.some((slice) => slice.id === 'R115.S01'))) {
		problems.push('R115: the repository phase register lost its R115.S01 child');
	}
	return problems;
}

/** Phase/track rules: parents, final gates, verification tiers, closure blocks. */
export function phaseProblems(model: StructureModel): string[] {
	const problems: string[] = [];
	const sliceOwners = new Map<string, string[]>();

	for (const phase of model.phases) {
		if (!PHASE_ID.test(phase.id)) problems.push(`${phase.file}: phase id "${phase.id}" does not match the qualified id grammar`);
		for (const slice of phase.slices) {
			if (!SLICE_ID.test(slice.id)) problems.push(`${phase.file}: slice id "${slice.id}" does not match the qualified id grammar`);
			sliceOwners.set(slice.id, [...(sliceOwners.get(slice.id) ?? []), phase.id]);
			if (!SLICE_STATUSES.includes(slice.status)) {
				problems.push(`${slice.id}: status "${slice.status}" is not one of ${SLICE_STATUSES.join(' | ')}`);
			}
			for (const [column, cell] of [
				['Plan', slice.plan],
				['Acceptance', slice.acceptance]
			] as const) {
				const target = linkTarget(cell);
				if (target === null) problems.push(`${slice.id}: ${column} must route to its artifact`);
				else if (!model.resolves(phase.file, target)) problems.push(`${slice.id}: ${column} target "${target}" does not resolve`);
			}
			// A narrowed acceptance must resolve its replacement integration route (§7.7).
			if (slice.verification !== '' && !VERIFICATION_TIERS.includes(slice.verification)) {
				problems.push(`${slice.id}: verification tier "${slice.verification}" is not one of ${VERIFICATION_TIERS.join(' | ')}`);
			}
			if (slice.verification !== '' && slice.verification !== 'exhaustive') {
				if (slice.integrationRoute === '') {
					problems.push(
						`${slice.id}: a "${slice.verification}" slice plan must declare its replacement integration route (INTEGRATION ROUTE:)`
					);
				} else if (!model.resolves(slice.planFile, slice.integrationRoute)) {
					problems.push(`${slice.id}: integration route "${slice.integrationRoute}" does not resolve`);
				}
			}
		}
		if (phase.slices.length === 0) continue;

		if (phase.finalGateSlice === '') {
			problems.push(`${phase.file}: a phase with a slice register must declare exactly one FINAL PHASE GATE`);
		} else {
			const gateSlice = phase.slices.find((slice) => slice.id === phase.finalGateSlice);
			if (gateSlice === undefined) {
				problems.push(`${phase.file}: FINAL PHASE GATE names "${phase.finalGateSlice}", which is not a child in its slice register`);
			} else if (gateSlice.verification !== 'exhaustive') {
				problems.push(
					`${phase.file}: the final gate's plan must declare exhaustive verification (found "${gateSlice.verification || 'none'}")`
				);
			}
			if (phase.stage === 'closed') {
				if (gateSlice !== undefined && gateSlice.status !== 'shipped') {
					problems.push(`${phase.file}: stage "closed" requires the final child shipped (found "${gateSlice.status}")`);
				}
				if (isSentinel(phase.closed)) problems.push(`${phase.file}: stage "closed" requires an owner Closed block`);
			}
		}
		if (phase.finalGateArtifact === '') problems.push(`${phase.file}: FINAL PHASE GATE must name its artifact`);
		else if (!model.resolves(phase.file, phase.finalGateArtifact)) {
			problems.push(`${phase.file}: the final-gate artifact "${phase.finalGateArtifact}" does not resolve`);
		}
		if (!['active', 'closable', 'closed'].includes(phase.stage)) {
			problems.push(`${phase.file}: PHASE CLOSE stage "${phase.stage}" is not active | closable | closed`);
		}
	}

	for (const [slice, owners] of sliceOwners) {
		if (owners.length > 1) problems.push(`${slice}: registered under more than one phase (${owners.join(', ')})`);
	}

	for (const track of model.tracks) {
		if (!TRACK_STATUSES.includes(track.status)) {
			problems.push(`track register: ${track.id} status "${track.status}" is not one of ${TRACK_STATUSES.join(' | ')}`);
		}
		if (!model.exists(track.roadmap)) problems.push(`track register: ${track.id} roadmap "${track.roadmap}" does not exist`);
		// A repository phase is not a track: phase-closeout moves its own register row to `shipped`
		// without invoking the separate track-completion event, so the record is not required there.
		// Every `PHASE CLOSE` rule still applies to it through its phase README.
		if (track.status === 'shipped' && !track.trackComplete && !REPOSITORY_PHASE.test(track.id)) {
			problems.push(`track register: ${track.id} is shipped without a TRACK COMPLETE owner/evidence block`);
		}
		if (track.completionGaps.length > 0) {
			problems.push(
				`track register: ${track.id} TRACK COMPLETE is missing ${track.completionGaps.join(', ')} (owner · date · evidence)`
			);
		}
		for (const phaseId of track.phaseIds) {
			if (!phaseId.startsWith(`${track.id}.`)) {
				problems.push(`${track.roadmap}: phase ${phaseId} is registered under track ${track.id}`);
			}
		}
	}

	// One track per phase (R115 is a repository phase registered in the global roadmap).
	for (const phase of model.phases) {
		if (phase.id.startsWith('R')) continue;
		if (!model.tracks.some((track) => track.id === phase.id.split('.')[0])) {
			problems.push(`${phase.file}: phase ${phase.id} belongs to no registered track`);
		}
	}
	return problems;
}

/** Cycle rules (§11): the bounded window, the opening rule and the verdict gate. */
export function cycleProblems(model: StructureModel): string[] {
	const problems: string[] = [];
	const cycle = model.cycle;
	const statusOf = new Map<string, string>();
	for (const phase of model.phases) for (const slice of phase.slices) statusOf.set(slice.id, slice.status);

	if (!STAGES.includes(cycle.stage)) problems.push(`cycle: stage "${cycle.stage}" is not part of the stage vocabulary`);
	if (!READINESS.includes(cycle.readiness)) problems.push(`cycle: readiness "${cycle.readiness}" is not part of the readiness vocabulary`);
	for (const mechanism of cycle.mechanisms) {
		const status = mechanism.status.replace(/`/g, '').split(/[\s(]/)[0] ?? '';
		if (!MECHANISM_STATUSES.includes(status)) {
			problems.push(`cycle: mechanism ${mechanism.id} status "${mechanism.status}" is not installed or dormant`);
		}
	}

	const configured = cycle.exposures.length > 0;
	if (cycle.exposures.length > EXPOSURE_BOUND) {
		problems.push(`cycle: ${cycle.exposures.length} exposure slices exceed the bound of ${EXPOSURE_BOUND}`);
	}
	// A ready or open window is a configured window: the document calls an open window with an empty
	// exposure list a defect, not an unconfigured window waiting for its plan.
	if (!configured && (cycle.readiness === 'ready' || cycle.readiness === 'open')) {
		problems.push(`cycle: readiness "${cycle.readiness}" requires at least one listed exposure slice`);
	}
	if (configured) {
		// The window is a closed set: the terminal and the expected opener are listed exposures, so
		// a window cannot look configured or closable around a slice outside its own list.
		if (isSentinel(cycle.terminal)) problems.push('cycle: a configured window requires a terminal');
		else if (!cycle.exposures.includes(cycle.terminal)) {
			problems.push(`cycle: the terminal "${cycle.terminal}" is not one of the listed exposure slices`);
		}
		if (isSentinel(cycle.opener)) problems.push('cycle: a configured window requires an expected opener');
		else if (!cycle.exposures.includes(cycle.opener)) {
			problems.push(`cycle: the expected opener "${cycle.opener}" is not one of the listed exposure slices`);
		}
		for (const id of cycle.exposures) {
			if (!statusOf.has(id)) problems.push(`cycle: listed exposure "${id}" is not a slice in any phase README`);
		}
	}
	// The opening slice is one of the listed exposures (`open-window`: any listed slice may open).
	if (!isSentinel(cycle.openedBy) && !cycle.exposures.includes(cycle.openedBy)) {
		problems.push(`cycle: "Opened by" names "${cycle.openedBy}", which is not one of the listed exposure slices`);
	}

	// Exposure rows: one row per listed exposure, carrying the `discharged` marker when a
	// nonterminal exposure closes without acceptance (§11). The terminal is never discharged —
	// closure still requires it accepted.
	const exposureRows = exposureRowsOf(cycle.exposureRows);
	const recorded = new Set(exposureRows.map((row) => row.id));
	const discharged = new Set(exposureRows.filter((row) => row.discharged).map((row) => row.id));
	const settled = (id: string): boolean => SETTLED_SLICE_STATUSES.includes(statusOf.get(id) ?? '');
	const resolved = (id: string): boolean => settled(id) || (id !== cycle.terminal && discharged.has(id));
	if (discharged.has(cycle.terminal)) {
		problems.push(`cycle: the terminal "${cycle.terminal}" cannot be discharged — closure requires it accepted`);
	}

	if (configured) {
		const started = cycle.exposures.filter(
			(id) => statusOf.get(id) === 'in-progress' || SETTLED_SLICE_STATUSES.includes(statusOf.get(id) ?? '')
		);
		if (started.length > 0 && (isSentinel(cycle.openedBy) || cycle.stage === 'PHASE_1')) {
			problems.push(
				`cycle: exposure "${started[0]}" has started while Opened by is empty or the stage is still PHASE_1 — a missed opening`
			);
		}
		for (const id of cycle.exposures) {
			if (settled(id) && !recorded.has(id)) {
				problems.push(`cycle: exposure "${id}" is ${statusOf.get(id)} with no exposure row`);
			}
		}
		const predicateSatisfied =
			resolved(cycle.terminal) && cycle.exposures.every((id) => id === cycle.terminal || resolved(id));
		if (predicateSatisfied && cycle.stage !== 'PHASE_3_EVALUATE' && cycle.stage !== 'STEADY') {
			problems.push('cycle: the closure predicate is satisfied while the stage is stale');
		}
		if (
			(cycle.stage === 'PHASE_3_EVALUATE' || cycle.stage === 'STEADY' || !isSentinel(cycle.closedBy)) &&
			cycle.exposures.some((id) => !resolved(id))
		) {
			const pending = cycle.exposures.filter((id) => !resolved(id));
			problems.push(
				`cycle: the window is closed or closing while a listed exposure is still pending — ${pending.join(', ')} (no discharge row)`
			);
		}
	}

	if (cycle.stage === 'STEADY') {
		for (const mechanism of cycle.mechanisms) {
			if (isSentinel(mechanism.verdict)) {
				problems.push(`cycle: STEADY requires a verdict row for every mechanism (${mechanism.id} has none)`);
			}
		}
	}
	return problems;
}

/**
 * The `Accepted capabilities` cell of one gate row: one entry per accepted scope.
 * Entries are separated by `;` or `,`; an entry that does not match the written grammar is
 * kept as `wellFormed: false` so the rule reports it instead of silently dropping a scope.
 */
export function acceptedCapabilitiesOf(cell: string): AcceptedCapabilityEntry[] {
	const entries: AcceptedCapabilityEntry[] = [];
	for (const chunk of cell.split(/[;,]/)) {
		if (isSentinel(chunk)) continue;
		const raw = stripDecoration(chunk);
		const match = CAPABILITY_ENTRY.exec(raw);
		if (match === null) {
			entries.push({ raw, capability: raw, gateVersion: '', scope: '', status: '', record: '', wellFormed: false });
			continue;
		}
		const capability = match[1]!;
		entries.push({
			raw,
			capability,
			gateVersion: capability.slice(0, capability.lastIndexOf(':')),
			scope: capability.slice(capability.lastIndexOf(':') + 1),
			status: match[2]!,
			record: (match[3] ?? '').trim(),
			wellFormed: true
		});
	}
	return entries;
}

/** The durable record's row for one capability, or `null` plus the report of what is missing. */
export function capabilityRecord(source: string, file: string): { record: CapabilityRecord | null; problems: string[] } {
	const problems: string[] = [];
	const table = tableUnderHeading(source, CAPABILITY_RECORD_HEADING);
	if (table === null) return { record: null, problems: [`${file}: no ${CAPABILITY_RECORD_HEADING} table`] };
	problems.push(...columnProblems(table, file, CAPABILITY_RECORD_COLUMNS));
	const row = rowObjects(table, file).rows.find((entry) => !Object.values(entry).every((cell) => isSentinel(cell)));
	if (row === undefined) return { record: null, problems: [...problems, `${file}: the ${CAPABILITY_RECORD_HEADING} table has no row`] };
	return {
		record: {
			capability: stripDecoration(row['Capability'] ?? ''),
			anchor: linkTarget(row['Anchor'] ?? '') ?? stripDecoration(row['Anchor'] ?? ''),
			sourceKinds: row['Source kinds'] ?? '',
			prerequisites: row['Prerequisites'] ?? '',
			extensionSlice: stripDecoration(row['Extension slice'] ?? ''),
			exports: row['Exports'] ?? '',
			conformance: row['Conformance'] ?? '',
			acceptance: row['Acceptance'] ?? '',
			commit: stripDecoration(row['Commit'] ?? '')
		},
		problems
	};
}

/**
 * The capability-readiness rule (T1.P01.S01 installed enforcement).
 *
 * Overall gate state cannot prove incremental capability scope, so two additive fields carry it:
 * `Accepted capabilities` on each gate/version row and `Requires` on each consumer slice row. A
 * consumer is eligible only when the exact gate **and every required scope**, with its
 * prerequisite closure, is `accepted` in the current tree **and** at the trusted base, and every
 * required scope is `active`. Each entry is filed on the gate row whose version it names, and its
 * durable record carries the ratified fields — including the admitted source kinds and the
 * extension slice that authored the scope. `ratified` or `implemented` alone is not acceptance, a retired scope
 * is ineligible for a new or in-progress consumer, a consumer cannot supply its own prerequisite,
 * and a scope accepted only at the trusted base is historical evidence rather than current
 * eligibility.
 */
export function capabilityProblems(model: StructureModel): string[] {
	const problems: string[] = [];
	const registered = new Map<string, GateRow>();
	for (const row of model.gates) {
		if (!isSentinel(row.version)) registered.set(`${row.gate}@${row.version}`, row);
	}
	const trustedActive = new Set<string>();
	for (const row of model.trustedBase ?? []) {
		for (const entry of row.capabilities) if (entry.status === 'active') trustedActive.add(entry.capability);
	}
	const sliceIds = new Set(model.phases.flatMap((phase) => phase.slices.map((slice) => slice.id)));

	// Fields: every entry is a well-formed scope of a registered version with a real record.
	const current = new Map<string, { entry: AcceptedCapabilityEntry; row: GateRow }>();
	for (const row of model.gates) {
		for (const entry of row.capabilities) {
			if (!entry.wellFormed) {
				problems.push(
					`${row.gate}: accepted capability "${entry.raw}" is not written as "<Gate@Version>:<capability> active|retired — <record path>"`
				);
				continue;
			}
			const gateRow = registered.get(entry.gateVersion);
			if (gateRow === undefined) {
				problems.push(`${row.gate}: accepted capability "${entry.capability}" names an unregistered gate version`);
				continue;
			}
			// An entry is written on the row whose version it names: a scope recorded on another
			// gate's row would be evidence filed against the wrong contract.
			if (isSentinel(row.version)) {
				problems.push(`${row.gate}: accepted capability "${entry.capability}" sits on a gate row with no version`);
			} else if (entry.gateVersion !== `${row.gate}@${row.version}`) {
				problems.push(
					`${row.gate}: accepted capability "${entry.capability}" names "${entry.gateVersion}" and sits on "${row.gate}@${row.version}" — an entry belongs to the version it is written on`
				);
			}
			if (current.has(entry.capability)) problems.push(`${row.gate}: accepted capability "${entry.capability}" appears on more than one row`);
			current.set(entry.capability, { entry, row });
			if (gateRow.state !== 'accepted') {
				problems.push(
					`${row.gate}: accepted capability "${entry.capability}" requires the gate row state "accepted" (found "${gateRow.state}")`
				);
			}
			if (entry.record === '') {
				problems.push(`${row.gate}: accepted capability "${entry.capability}" requires a durable record path`);
				continue;
			}
			const source = model.readText(entry.record);
			if (source === null) {
				problems.push(`${row.gate}: accepted capability "${entry.capability}" record "${entry.record}" does not exist`);
				continue;
			}
			const parsed = capabilityRecord(source, entry.record);
			problems.push(...parsed.problems);
			if (parsed.record === null) continue;
			if (parsed.record.capability !== entry.capability) {
				problems.push(
					`${entry.record}: the record declares capability "${parsed.record.capability}", not "${entry.capability}"`
				);
			}
			if (!isSentinel(parsed.record.anchor) && !model.resolves(entry.record, parsed.record.anchor)) {
				problems.push(`${entry.record}: the contract anchor "${parsed.record.anchor}" does not resolve`);
			}
			for (const [column, value] of [
				['Exports', parsed.record.exports],
				['Conformance', parsed.record.conformance],
				['Acceptance', parsed.record.acceptance]
			] as const) {
				const paths = tokens(value);
				if (paths.length === 0) problems.push(`${entry.capability}: the record requires a ${column.toLowerCase()} path`);
				for (const path of paths) {
					if (!model.exists(path)) problems.push(`${entry.record}: ${column} path "${path}" does not exist`);
				}
			}
			// The ratified record also carries which source kinds the scope admits and the slice
			// that authored or extended it, so a scope's breadth and provenance are evidence too.
			if (tokens(parsed.record.sourceKinds).length === 0) {
				problems.push(`${entry.capability}: the record requires its admitted source kinds`);
			}
			if (isSentinel(parsed.record.extensionSlice)) {
				problems.push(`${entry.capability}: the record requires the extension slice that authored the scope`);
			} else if (!sliceIds.has(parsed.record.extensionSlice)) {
				problems.push(
					`${entry.record}: extension slice "${parsed.record.extensionSlice}" is not a slice in any phase register`
				);
			}
			if (isSentinel(parsed.record.commit)) problems.push(`${entry.capability}: the record requires a reviewed implementation commit`);
			else if (!model.ancestorOfHead(parsed.record.commit)) {
				problems.push(`${entry.record}: commit "${parsed.record.commit}" is not an ancestor of HEAD`);
			}
			for (const prerequisite of capabilityTokens(parsed.record.prerequisites)) {
				if (prerequisite === entry.capability) problems.push(`${entry.capability}: a capability cannot be its own prerequisite`);
				else if (!registered.has(prerequisite.slice(0, prerequisite.lastIndexOf(':')))) {
					problems.push(`${entry.capability}: prerequisite "${prerequisite}" names an unregistered gate version`);
				}
			}
		}
	}

	// Consumers: `Requires` is the capability refinement of `Consumes`, enforced with the same
	// trusted-base rule. A `shipped` slice, or one already settled at the trusted base, keeps its
	// recorded scopes and evidence.
	for (const phase of model.phases) {
		for (const slice of phase.slices) {
			const requires = capabilityTokens(slice.requires);
			if (requires.length === 0) continue;
			if (slice.status === 'shipped') continue;
			if (SETTLED_SLICE_STATUSES.includes(model.trustedSliceStatus(phase.file, slice.id))) continue;
			const enforced = slice.status === 'in-progress' || slice.status === 'accepted';
			const consumed = tokens(slice.consumes);
			for (const reference of requires) {
				const match = CAPABILITY_REFERENCE.exec(reference);
				if (match === null) {
					if (enforced) problems.push(`${slice.id}: Requires "${reference}" is not an exact Gate@Version:capability`);
					continue;
				}
				const gateVersion = `${match[1]}@${match[2]}`;
				if (!registered.has(gateVersion)) {
					if (enforced) problems.push(`${slice.id}: Requires "${reference}", whose gate version is not registered`);
					continue;
				}
				if (!enforced) continue;
				if (!consumed.includes(gateVersion)) {
					problems.push(
						`${slice.id}: Requires "${reference}" but Consumes does not declare "${gateVersion}" — the capability refines a consumed gate`
					);
				}
				for (const member of capabilityClosure(reference, current, model, problems)) {
					const entry = current.get(member);
					const trusted = trustedActive.has(member);
					if (entry === undefined || entry.entry.status !== 'active') {
						problems.push(
							trusted
								? `${slice.id}: "${member}" is accepted only at the trusted base (historical evidence), never current eligibility`
								: entry === undefined
									? `${slice.id}: Requires "${member}", which has no Accepted-capabilities entry in the gate register`
									: `${slice.id}: Requires the retired scope "${member}" — no new or in-progress consumer may require it`
						);
					}
					if (!trusted) {
						problems.push(
							`${slice.id}: "${member}" is not accepted at the trusted base — a consumer cannot satisfy its own prerequisite in its own diff`
						);
					}
				}
			}
		}
	}
	return problems;
}

/**
 * A `Requires` / prerequisite cell's capability list: bare `Gate@Version:capability` tokens,
 * sentinels removed. Prose is not filtered out — a decorated entry fails the exact-match rule
 * instead of being silently ignored.
 */
function capabilityTokens(cell: string): string[] {
	return tokens(cell);
}

/**
 * A capability plus its declared prerequisites, transitively. A prerequisite that is not itself an
 * accepted-and-active entry is reported and does not extend the walk; a cycle is reported once.
 */
function capabilityClosure(
	root: string,
	current: Map<string, { entry: AcceptedCapabilityEntry; row: GateRow }>,
	model: StructureModel,
	problems: string[]
): Set<string> {
	const closure = new Set<string>([root]);
	const pending = [root];
	const visited = new Set<string>([root]);
	while (pending.length > 0) {
		const capability = pending.pop()!;
		const holder = current.get(capability);
		if (holder === undefined) continue;
		const source = model.readText(holder.entry.record);
		if (source === null) continue;
		const parsed = capabilityRecord(source, holder.entry.record);
		if (parsed.record === null) continue;
		for (const prerequisite of capabilityTokens(parsed.record.prerequisites)) {
			if (prerequisite === root) {
				problems.push(`${root}: the prerequisite closure is cyclic (${prerequisite})`);
				continue;
			}
			closure.add(prerequisite);
			if (visited.has(prerequisite)) continue;
			visited.add(prerequisite);
			pending.push(prerequisite);
		}
	}
	return closure;
}

/** The fresh-agent routing block must not route ordinary work into a phase, program or cycle document. */
export const ROUTE_KEYS = [
	'START',
	'ASSIGNED WORK',
	'UNASSIGNED PLANNING',
	'F-INTERFACE GAP',
	'START IMPLEMENTATION',
	'VERIFY',
	'SLICE CLOSE',
	'PHASE CLOSE',
	'TRACK / PROGRAM / REPLAN',
	'STOP'
] as const;

export function routeProblems(source: string): string[] {
	const problems: string[] = [];
	const block = routingBlock(source);
	const routes = routeLines(block);
	const byKey = new Map(routes.map((route) => [route.key, route.value]));
	for (const key of ROUTE_KEYS) {
		if (!byKey.has(key)) problems.push(`router: the fresh-agent routing block has no ${key} route`);
	}
	for (const route of routes) {
		// The explicit-event routes may name their procedures; every other route stays out of the
		// phase-close, program and cycle documents, which is what keeps ordinary slice work from
		// loading them.
		if (route.key === 'TRACK / PROGRAM / REPLAN' || route.key === 'PHASE CLOSE') continue;
		for (const forbidden of ['operations/README.md', 'architecture-cycle.md', 'phase-closeout']) {
			if (route.value.includes(forbidden)) {
				problems.push(`router: ${route.key} routes into ${forbidden}, which belongs to an explicit event`);
			}
		}
	}
	const assigned = byKey.get('ASSIGNED WORK') ?? '';
	if (!assigned.includes('operations/current.md')) problems.push('router: ASSIGNED WORK must start at the baton navigation');
	// The global baton routes; the owning track's baton is the handoff a task reads and replaces.
	if (!/operations\/(<track>|[a-z0-9-]+)\/current\.md/.test(assigned)) {
		problems.push("router: ASSIGNED WORK must route through the owning track's baton");
	}
	if (!assigned.includes('phase README')) problems.push('router: ASSIGNED WORK must route through the phase README');
	if (!(byKey.get('START IMPLEMENTATION') ?? '').includes('runbook')) {
		problems.push('router: START IMPLEMENTATION must name the track runbook start step');
	}
	return problems;
}

/** The four operational runbooks whose per-track baton wiring is part of the execution structure. */
export const TRACK_RUNBOOKS = [
	't1-spatial-world',
	't2-composition',
	't3-experience',
	't4-release'
] as const;

/**
 * Baton wiring. Current work is track-local: each runbook names its own `./current.md`, that file
 * exists, and the global `docs/operations/current.md` is navigation only — it routes to every track
 * baton and carries no slice status of its own. A runbook pointed back at the global baton, or a
 * global baton turned into a status store, is exactly the coordination drift this rule catches, so a
 * task never has to synchronize another parallel track.
 */
export function batonProblems(
	batons: Array<{ track: string; runbook: string; exists: boolean }>,
	global: string
): string[] {
	const problems: string[] = [];
	if (!global.toLowerCase().includes('navigation only')) {
		problems.push('baton: docs/operations/current.md must be navigation only');
	}
	for (const baton of batons) {
		if (!/BATON:[ \t]*\.\/current\.md/.test(baton.runbook)) {
			problems.push(`baton: the ${baton.track} runbook does not point at its own ./current.md`);
		}
		if (!baton.exists) problems.push(`baton: ${baton.track} has no operations/${baton.track}/current.md`);
		if (!global.includes(`./${baton.track}/current.md`)) {
			problems.push(`baton: the navigation file does not route to the ${baton.track} baton`);
		}
	}
	return problems;
}

/** The fenced block that carries the fresh-agent routes. */
function routingBlock(source: string): string {
	for (const chunk of source.split('```text')) {
		const block = chunk.split('```')[0] ?? '';
		if (block.includes('ASSIGNED WORK:')) return block;
	}
	return '';
}

/** Skills must carry the evidence preflight WP5 installed and must not keep the retired procedure. */
export function skillProblems(skills: { closeout: string; phase: string }): string[] {
	const problems: string[] = [];
	const required: Array<[keyof typeof skills, string[]]> = [
		[
			'closeout',
			[
				'verification tier',
				'integration route',
				'architecture-cycle.md',
				'documentation-references.test.ts',
				'unowned remaining shim'
			]
		],
		['phase', ['FINAL PHASE GATE', 'integration', 'owner-invoked', 'PHASE CLOSE', 'track phase row']]
	];
	const forbidden: Array<[keyof typeof skills, string, string]> = [
		[
			'closeout',
			'`npm run check`, `npm run build`',
			'the unconditional verification trio is retired: the slice plan owns its tier'
		],
		['phase', 'CYCLE TARGET', 'phase close performs no cycle transition: the cycle owns its own window states']
	];
	for (const [skill, needles] of required) {
		for (const needle of needles) {
			if (!skills[skill].includes(needle)) problems.push(`${skill}: missing required evidence-preflight text "${needle}"`);
		}
	}
	for (const [skill, needle, why] of forbidden) {
		if (skills[skill].includes(needle)) problems.push(`${skill}: still carries "${needle}" — ${why}`);
	}
	return problems;
}

// ---------------------------------------------------------------- real-tree model

/**
 * The cycle's `Exposure rows` cell: one entry per listed exposure, with `discharged` marking an
 * explicit discharge (§11 closure). Other text in an entry is a human reason, never a status.
 */
export function exposureRowsOf(cell: string): ExposureRow[] {
	const rows: ExposureRow[] = [];
	for (const entry of cell.split(/[,;]/)) {
		if (isSentinel(entry)) continue;
		const match = EXPOSURE_ROW.exec(stripDecoration(entry));
		if (match === null) continue;
		rows.push({ id: match[1]!, discharged: /^discharged\b/i.test((match[2] ?? '').trim()) });
	}
	return rows;
}

/** The track register's section: from its heading to the next second-level heading. */
function trackRegisterSection(source: string): string {
	const lines = source.split('\n');
	const start = lines.findIndex((line) => /^##[ \t]+Track register[ \t]*$/.test(line));
	if (start === -1) return '';
	const end = lines.findIndex((line, index) => index > start && /^##[ \t]/.test(line));
	return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

/**
 * A track's `TRACK COMPLETE` record (§9.3): an entry inside the global track register that names
 * the track and carries owner, date and evidence. A mention elsewhere in the file is prose, not a
 * completion record, so a stray sentence never marks a track shipped. `null` when absent.
 */
export function trackCompletion(
	source: string,
	trackId: string
): { owner: string; date: string; evidence: string } | null {
	for (const line of trackRegisterSection(source).split('\n')) {
		const entry = TRACK_COMPLETE_ENTRY.exec(line);
		if (entry === null || entry[1] !== trackId) continue;
		const rest = stripDecoration(entry[2] ?? '');
		return {
			owner: /owner:?[ \t]*([^·|;]+)/i.exec(rest)?.[1]?.trim() ?? '',
			date: /\bdate:?[ \t]*(\d{4}-\d{2}-\d{2})/i.exec(rest)?.[1]?.trim() ?? '',
			evidence: /evidence:?[ \t]*(.+)$/i.exec(rest)?.[1]?.trim() ?? ''
		};
	}
	return null;
}

function repoPath(fromFile: string, target: string): string {
	const withoutFragment = target.split('#')[0]!.trim();
	return relative(REPO_ROOT, resolve(REPO_ROOT, dirname(fromFile), withoutFragment)).split(sep).join('/');
}

function gateRowsOf(source: string): GateRow[] {
	const table = tableUnderHeading(source, 'Gate register');
	if (table === null) return [];
	return rowObjects(table, ROADMAP)
		.rows.filter((row) => !Object.values(row).every((cell) => isSentinel(cell)))
		.map((row) => ({
			gate: stripDecoration(row['Gate'] ?? ''),
			version: stripDecoration(row['Version'] ?? ''),
			kind: stripDecoration(row['Kind'] ?? ''),
			owner: stripDecoration(row['Owner'] ?? ''),
			// The anchor column states a route, so its link target is the value (a bare path is
			// still read as written when no link is used).
			anchor: linkTarget(row['Contract anchor'] ?? '') ?? stripDecoration(row['Contract anchor'] ?? ''),
			state: stripDecoration(row['State'] ?? ''),
			provider: stripDecoration(row['Provider slice'] ?? ''),
			exports: row['Exports'] ?? '',
			conformance: row['Conformance'] ?? '',
			acceptance: row['Acceptance'] ?? '',
			commit: stripDecoration(row['Commit'] ?? ''),
			capabilities: acceptedCapabilitiesOf(row['Accepted capabilities'] ?? '')
		}));
}

/** One slice's status in a phase README at some revision, or `''` when it is not registered there. */
function sliceStatusOf(source: string, sliceId: string): string {
	const table = tableUnderHeading(source, 'Slice register');
	if (table === null) return '';
	const row = rowObjects(table, 'phase README').rows.find((entry) => stripDecoration(entry['Slice'] ?? '') === sliceId);
	return row === undefined ? '' : stripDecoration(row['Status'] ?? '');
}

function schemaProblems(source: string, heading: string, file: string, expected: readonly string[]): string[] {
	const table = tableUnderHeading(source, heading);
	if (table === null) return [`${file}: no ${heading} table`];
	return columnProblems(table, file, expected);
}

/**
 * A slice plan owns its verification tier and, when it narrows acceptance, the integration route
 * that carries the deferred proof (`implementation-plan.md` §7.7).
 */
function planDeclarations(source: string | null): { verification: string; route: string } {
	if (source === null) return { verification: '', route: '' };
	return {
		verification: /^VERIFICATION:[ \t]*([A-Za-z-]+)[ \t]*$/m.exec(source)?.[1] ?? '',
		route: /^INTEGRATION ROUTE:[ \t]*(.+)$/m.exec(source)?.[1]?.trim() ?? ''
	};
}

/** The structure as it exists in the tree. */
export function readStructure(): StructureModel {
	const read = (path: string): string => readFileSync(resolve(REPO_ROOT, path), 'utf8');
	// An empty path would resolve to the repository root, which exists: guard it so an unresolved
	// register cell reads as absent rather than as a directory read error.
	const readOrNull = (path: string): string | null =>
		path !== '' && existsSync(resolve(REPO_ROOT, path)) ? read(path) : null;
	const exists = (path: string): boolean => path !== '' && existsSync(resolve(REPO_ROOT, path));
	const resolves = (fromFile: string, target: string): boolean =>
		resolveReference(resolve(REPO_ROOT, fromFile), { line: 1, raw: target, kind: 'link' }) === null;
	const ancestorOfHead = (commit: string): boolean => {
		try {
			execFileSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], { cwd: REPO_ROOT, stdio: 'ignore' });
			return true;
		} catch {
			return false;
		}
	};

	const roadmapSource = readOrNull(ROADMAP) ?? '';
	const trackTable = tableUnderHeading(roadmapSource, 'Track register');
	const tracks: TrackRow[] = [];
	for (const row of trackTable === null ? [] : rowObjects(trackTable, ROADMAP).rows) {
		if (Object.values(row).every((cell) => isSentinel(cell))) continue;
		const target = linkTarget(row['Roadmap'] ?? '');
		const id = stripDecoration(row['Track'] ?? '');
		const record = trackCompletion(roadmapSource, id);
		const completionGaps =
			record === null ? [] : (['owner', 'date', 'evidence'] as const).filter((part) => record[part] === '');
		tracks.push({
			id,
			status: stripDecoration(row['Status'] ?? ''),
			roadmap: target === null ? '' : repoPath(ROADMAP, target),
			phaseIds: [],
			trackComplete: record !== null && completionGaps.length === 0,
			completionGaps: [...completionGaps]
		});
	}
	for (const track of tracks) {
		const source = readOrNull(track.roadmap);
		if (source === null) continue;
		const table = tableUnderHeading(source, 'Phase register');
		for (const row of table === null ? [] : rowObjects(table, track.roadmap).rows) {
			if (Object.values(row).every((cell) => isSentinel(cell))) continue;
			track.phaseIds.push(stripDecoration(row['Phase'] ?? ''));
		}
	}

	// Phase workspaces: named by a track's phase register, plus the repository phase R115.
	const phaseFiles = new Set<string>();
	for (const track of tracks) {
		const source = readOrNull(track.roadmap);
		if (source === null) continue;
		const table = tableUnderHeading(source, 'Phase register');
		for (const row of table === null ? [] : rowObjects(table, track.roadmap).rows) {
			if (Object.values(row).every((cell) => isSentinel(cell))) continue;
			const target = linkTarget(row['Workspace'] ?? '');
			if (target === null) continue;
			const path = repoPath(track.roadmap, target);
			phaseFiles.add(path.endsWith('.md') ? path : `${path}/README.md`);
		}
	}
	phaseFiles.add(`${R115_PHASE}/README.md`);

	const phases: PhaseModel[] = [];
	for (const file of phaseFiles) {
		const source = readOrNull(file);
		if (source === null) continue;
		const table = tableUnderHeading(source, 'Slice register');
		const slices: SliceRow[] = [];
		for (const row of table === null ? [] : rowObjects(table, file).rows) {
			if (Object.values(row).every((cell) => isSentinel(cell))) continue;
			const planCell = row['Plan'] ?? '';
			const planTarget = linkTarget(planCell);
			const planFile = planTarget === null ? '' : repoPath(file, planTarget);
			const declarations = planDeclarations(planFile === '' ? null : readOrNull(planFile));
			slices.push({
				id: stripDecoration(row['Slice'] ?? ''),
				status: stripDecoration(row['Status'] ?? ''),
				consumes: row['Consumes'] ?? '',
				requires: row['Requires'] ?? '',
				effects: row['Effects'] ?? '',
				plan: planCell,
				planFile,
				acceptance: row['Acceptance'] ?? '',
				authorization: stripDecoration(row['Authorization'] ?? ''),
				verification: declarations.verification,
				integrationRoute: declarations.route
			});
		}
		const finalGate = /^FINAL PHASE GATE:[ \t]*(\S+)[ \t]*→[ \t]*(\S+)/m.exec(source);
		phases.push({
			id: stripDecoration(/^\*\*Phase:\*\*[ \t]*([^\s·]+)/m.exec(source)?.[1] ?? '') ||
				(file === `${R115_PHASE}/README.md` ? 'R115' : ''),
			file,
			finalGateSlice: stripDecoration(finalGate?.[1] ?? ''),
			finalGateArtifact: finalGate?.[2] ?? '',
			stage: (/^Stage:[ \t]*(.+)$/m.exec(source)?.[1] ?? '').trim().toLowerCase(),
			closed: (/^Closed:[ \t]*(.+)$/m.exec(source)?.[1] ?? '').trim(),
			slices
		});
	}

	const cycleSource = readOrNull(CYCLE) ?? '';
	const stateTable = tableUnderHeading(cycleSource, 'State');
	const stateRow: Record<string, string> =
		(stateTable === null ? [] : rowObjects(stateTable, CYCLE).rows)[0] ?? {};
	const mechanismTable = tableUnderHeading(cycleSource, 'Mechanism register');
	const mechanisms = (mechanismTable === null ? [] : rowObjects(mechanismTable, CYCLE).rows).map((row) => ({
		id: stripDecoration(row['Mechanism'] ?? '').split(' ')[0] ?? '',
		status: row['Status'] ?? '',
		verdict: stripDecoration(row['Verdict'] ?? '')
	}));

	let trustedBase: GateRow[] | null = null;
	let base = '';
	try {
		base = execFileSync('git', ['merge-base', 'HEAD', 'main'], { cwd: REPO_ROOT }).toString().trim();
		trustedBase = gateRowsOf(execFileSync('git', ['show', `${base}:${ROADMAP}`], { cwd: REPO_ROOT }).toString());
	} catch {
		trustedBase = null;
	}
	// The trusted base's phase registers, read lazily: only a slice that declares `Requires`
	// needs them, and only to decide whether it was already accepted there.
	const trustedPhases = new Map<string, string | null>();
	const trustedSource = (path: string): string | null => {
		if (base === '') return null;
		if (!trustedPhases.has(path)) {
			try {
				trustedPhases.set(path, execFileSync('git', ['show', `${base}:${path}`], { cwd: REPO_ROOT }).toString());
			} catch {
				trustedPhases.set(path, null);
			}
		}
		return trustedPhases.get(path) ?? null;
	};

	return {
		gates: gateRowsOf(roadmapSource),
		trustedBase,
		tracks,
		phases,
		cycle: {
			stage: stripDecoration(stateRow['Stage'] ?? ''),
			readiness: stripDecoration(stateRow['Readiness'] ?? ''),
			window: stripDecoration(stateRow['Window'] ?? ''),
			exposures: tokens(stateRow['Exposure slices (≤3)'] ?? ''),
			opener: stripDecoration(stateRow['Opener (expected)'] ?? ''),
			terminal: stripDecoration(stateRow['Terminal'] ?? ''),
			openedBy: stripDecoration(stateRow['Opened by'] ?? ''),
			exposureRows: stateRow['Exposure rows'] ?? '',
			closedBy: stripDecoration(stateRow['Closed by'] ?? ''),
			mechanisms
		},
		exists,
		resolves,
		ancestorOfHead,
		readText: readOrNull,
		trustedSliceStatus: (file, sliceId) => {
			const source = trustedSource(file);
			return source === null ? '' : sliceStatusOf(source, sliceId);
		}
	};
}

// ---------------------------------------------------------------- fixtures

const FIXTURE_PLAN = 'docs/roadmap/t1-spatial-world/t1.p01-viewport/t1.p01.s01-viewport/implementation-plan.md';
/** The durable record a fixture's accepted capability points at. */
const FIXTURE_CAPABILITY_RECORD = 'docs/roadmap/t1-spatial-world/t1.p01-viewport/acceptance.md';
const FIXTURE_CAPABILITY = 'F4.intent-acceptance@1:local-single-domain-v1';
const FIXTURE_PREREQUISITE = 'F1.reference@1:references-v1';

/**
 * The record's own table, as the fixture's `readText` returns it. One field can be mutated per
 * negative fixture, because each rule must fail for its own reason.
 */
function recordSource(
	capability: string,
	prerequisites: string,
	overrides: Partial<Record<string, string>> = {}
): string {
	const fields: Record<string, string> = {
		Capability: `\`${capability}\``,
		Anchor: './reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1',
		'Source kinds': 'layout-unit',
		Prerequisites: prerequisites,
		'Extension slice': 'T1.P01.S01',
		Exports: 'packages/project-model/src',
		Conformance: 'apps/editor/tests/lib/project-model-boundary.test.ts',
		Acceptance: FIXTURE_CAPABILITY_RECORD,
		Commit: 'HEAD',
		...overrides
	};
	return [
		`## ${CAPABILITY_RECORD_HEADING}`,
		'',
		`| ${CAPABILITY_RECORD_COLUMNS.join(' | ')} |`,
		`| ${CAPABILITY_RECORD_COLUMNS.map(() => '---').join(' | ')} |`,
		`| ${CAPABILITY_RECORD_COLUMNS.map((column) => fields[column]!).join(' | ')} |`,
		''
	].join('\n');
}

/** One parsed `Accepted capabilities` entry. */
function acceptedEntry(
	capability: string,
	overrides: Partial<AcceptedCapabilityEntry> = {}
): AcceptedCapabilityEntry {
	return {
		raw: `${capability} active — ${FIXTURE_CAPABILITY_RECORD}`,
		capability,
		gateVersion: capability.slice(0, capability.lastIndexOf(':')),
		scope: capability.slice(capability.lastIndexOf(':') + 1),
		status: 'active',
		record: FIXTURE_CAPABILITY_RECORD,
		wellFormed: true,
		...overrides
	};
}

/** A minimal, internally consistent model that individual rules can be mutated in memory. */
export function fixture(overrides: Partial<StructureModel> = {}): StructureModel {
	const gate: GateRow = {
		gate: 'F4.intent-acceptance',
		version: '1',
		kind: 'foundation',
		owner: 'composition-execution.md',
		anchor: './reference/composition-execution.md#f4-compound-acceptance',
		state: 'accepted',
		provider: 'T1.P01.S02',
		exports: 'packages/project-model/src',
		conformance: 'apps/editor/tests/lib/project-model-boundary.test.ts',
		acceptance: 'docs/roadmap/t1-spatial-world/t1.p01-viewport/README.md',
		commit: 'HEAD',
		capabilities: []
	};
	const undrafted: GateRow = {
		gate: 'T3.camera-experience-cutover',
		version: '—',
		kind: 'capability',
		owner: 'T3',
		anchor: '—',
		state: 'undrafted',
		provider: '—',
		exports: '—',
		conformance: '—',
		acceptance: '—',
		commit: '—',
		capabilities: []
	};
	const slice: SliceRow = {
		id: 'T1.P01.S01',
		status: 'in-progress',
		consumes: '—',
		requires: '—',
		effects: '—',
		plan: '[plan.md](./t1.p01.s01-viewport/implementation-plan.md)',
		planFile: FIXTURE_PLAN,
		acceptance: '[acceptance.md](./t1.p01.s01-viewport/acceptance.md)',
		authorization: 'owner-authorized',
		verification: 'exhaustive',
		integrationRoute: ''
	};
	const phase: PhaseModel = {
		id: 'T1.P01',
		file: 'docs/roadmap/t1-spatial-world/t1.p01-viewport/README.md',
		finalGateSlice: 'T1.P01.S01',
		finalGateArtifact: './acceptance.md',
		stage: 'active',
		closed: '—',
		slices: [slice, { ...slice, id: 'T1.P01.S02', status: 'proposed' }]
	};
	return {
		gates: [gate, undrafted],
		trustedBase: [{ ...gate }],
			tracks: [
				{
					id: 'T1',
					status: 'planning',
					roadmap: 'docs/roadmap/t1-spatial-world/README.md',
					phaseIds: ['T1.P01'],
					trackComplete: false,
					completionGaps: []
				},
				{
					id: 'T3',
					status: 'planning',
					roadmap: 'docs/roadmap/t3-experience/README.md',
					phaseIds: [],
					trackComplete: false,
					completionGaps: []
				}
			],
		phases: [phase],
		cycle: {
			stage: 'PHASE_1',
			readiness: 'awaiting-bounded-slice-window-plan',
			window: 'selected, not open',
			exposures: [],
			opener: '—',
			terminal: '—',
			openedBy: '—',
			exposureRows: '—',
			closedBy: '—',
			mechanisms: [{ id: 'M3', status: 'installed', verdict: '—' }]
		},
		exists: () => true,
		resolves: () => true,
		ancestorOfHead: () => true,
		readText: (path) => (path === FIXTURE_CAPABILITY_RECORD ? recordSource(FIXTURE_CAPABILITY, '—') : null),
		trustedSliceStatus: () => '',
		...overrides
	};
}

/** The fixture phase with a mutated first slice. */
function withSlice(overrides: Partial<SliceRow>, model = fixture()): StructureModel {
	const phase = model.phases[0]!;
	return {
		...model,
		phases: [{ ...phase, slices: [{ ...phase.slices[0]!, ...overrides }, ...phase.slices.slice(1)] }]
	};
}

/**
 * A model where one capability is accepted on a gate row and (unless mutated) also at the trusted
 * base, with a consumer slice that Requires it. Individual rules mutate one field each.
 */
function capabilityFixture(overrides: Partial<StructureModel> = {}): StructureModel {
	const entry = acceptedEntry(FIXTURE_CAPABILITY);
	const base = fixture();
	const acceptedGate: GateRow = { ...base.gates[0]!, capabilities: [entry] };
	return {
		...base,
		gates: [acceptedGate, base.gates[1]!],
		trustedBase: [{ ...acceptedGate }],
		...overrides
	};
}

/** That model with a consumer slice that declares `Requires`. */
function consuming(overrides: Partial<SliceRow> = {}, model = capabilityFixture()): StructureModel {
	return withSlice(
		{ status: 'in-progress', consumes: 'F4.intent-acceptance@1', requires: FIXTURE_CAPABILITY, ...overrides },
		model
	);
}

/** The fixture phase with a mutated second slice (never the final gate). */
function withSecondSlice(overrides: Partial<SliceRow>, model = fixture()): StructureModel {
	const phase = model.phases[0]!;
	return { ...model, phases: [{ ...phase, slices: [phase.slices[0]!, { ...phase.slices[1]!, ...overrides }] }] };
}

/** A configured, open window whose terminal and only other exposure are still pending. */
function configuredCycle(overrides: Partial<CycleModel> = {}): CycleModel {
	return {
		...fixture().cycle,
		readiness: 'ready',
		window: 'T1 spatial foundation — selected, not open',
		exposures: ['T1.P01.S01', 'T1.P01.S02'],
		opener: 'T1.P01.S01',
		terminal: 'T1.P01.S02',
		openedBy: 'T1.P01.S01',
		exposureRows: 'T1.P01.S01',
		closedBy: '—',
		...overrides
	};
}

/** The fixture with both listed exposure slices registered at the given statuses. */
function withExposures(first: string, second: string, model = fixture()): StructureModel {
	const phase = model.phases[0]!;
	return {
		...model,
		phases: [
			{
				...phase,
				slices: [
					{ ...phase.slices[0]!, id: 'T1.P01.S01', status: first },
					{ ...phase.slices[0]!, id: 'T1.P01.S02', status: second }
				]
			}
		]
	};
}

// ---------------------------------------------------------------- verification

describe('execution structure is registered, exact and eligible', () => {
	const model = readStructure();
	const roadmap = readFile(ROADMAP);

	it('finds the registers and schemas the gate exists to protect', () => {
		// A silently empty parse would make every rule below vacuous, so the walk is held to named
		// coverage rather than to a row count.
		expect(schemaProblems(roadmap, 'Track register', ROADMAP, TRACK_COLUMNS)).toEqual([]);
		expect(schemaProblems(roadmap, 'Gate register', ROADMAP, GATE_COLUMNS)).toEqual([]);
		expect(schemaProblems(readFile(CYCLE), 'State', CYCLE, CYCLE_STATE_COLUMNS)).toEqual([]);
		expect(schemaProblems(readFile(CYCLE), 'Mechanism register', CYCLE, CYCLE_MECHANISM_COLUMNS)).toEqual([]);
		expect(schemaProblems(readFile(`${R115_PHASE}/README.md`), 'Slice register', `${R115_PHASE}/README.md`, SLICE_COLUMNS)).toEqual([]);
		for (const track of ['t1-spatial-world', 't2-composition', 't3-experience', 't4-release']) {
			const file = `docs/roadmap/${track}/README.md`;
			expect(schemaProblems(readFile(file), 'Phase register', file, PHASE_COLUMNS)).toEqual([]);
		}
		// Non-vacuity without freezing the initial state: the seeded identities are contractual and
		// are checked as an invariant, while status, version, provider and phase population stay
		// free (§9.4). An assertion that the register is all-`undrafted`, or that `R115.S01` is the
		// only slice, would fail the first legitimate T1 phase or ratified gate — the lane exists to
		// enable those, not to prohibit them.
		expect(seedProblems(model)).toEqual([]);
		expect(model.trustedBase).not.toBeNull();
	});

	it('reports nothing for the tree as written', () => {
		expect(gateProblems(model)).toEqual([]);
		expect(phaseProblems(model)).toEqual([]);
		expect(cycleProblems(model)).toEqual([]);
		expect(capabilityProblems(model)).toEqual([]);
	});

	it('keeps the lane green when a ratified gate, a track phase and an open window arrive', () => {
		// The defect class this replaces: a checkpoint asserting "all undrafted" and "only R115.S01"
		// reds the lane exactly when the execution system starts being used. This control advances
		// the real structure — a ratified first version, a registered T1 phase, an accepted second
		// R115 child and an open window — and the invariant must hold.
		const real = readStructure();
		const frontier: StructureModel = {
			...real,
			gates: [{ ...real.gates[0]!, version: '1', state: 'ratified' }, ...real.gates.slice(1)],
			tracks: real.tracks.map((track) =>
				track.id === 'T1' ? { ...track, phaseIds: [...track.phaseIds, 'T1.P01'] } : track
			),
			phases: real.phases.map((phase) =>
				phase.id === 'R115'
					? { ...phase, slices: [...phase.slices, { ...phase.slices[0]!, id: 'R115.S02', status: 'accepted' }] }
					: phase
			),
			cycle: {
				...real.cycle,
				stage: 'PHASE_2_VALIDATING',
				readiness: 'open',
				exposures: ['R115.S01'],
				opener: 'R115.S01',
				terminal: 'R115.S01',
				openedBy: 'R115.S01'
			}
		};
		// The control is a real advance, not a renaming of the initial state.
		expect(frontier.gates.some((row) => row.state !== 'undrafted')).toBe(true);
		expect(frontier.phases.flatMap((phase) => phase.slices).length).toBeGreaterThan(1);
		expect(seedProblems(frontier)).toEqual([]);
		expect(
			seedProblems({ ...frontier, gates: frontier.gates.filter((row) => row.gate !== 'F1.reference') }).join('\n')
		).toContain('the seeded gate F1.reference is missing');
		expect(
			seedProblems({ ...frontier, tracks: frontier.tracks.filter((row) => row.id !== 'T3') }).join('\n')
		).toContain('track register: T3 is not registered exactly once');
	});

	it('refuses a consumed version that is not registered, accepted and accepted at the trusted base', () => {
		expect(gateProblems(withSlice({ consumes: 'F4.intent-acceptance@1' }))).toEqual([]);
		expect(gateProblems(withSlice({ consumes: 'F9.nothing@1' })).join('\n')).toContain('is not a registered gate version');
		expect(gateProblems(withSlice({ consumes: 'F4.intent-acceptance' })).join('\n')).toContain('is not an exact Gate@Version');
		expect(gateProblems(withSlice({ consumes: 'T1.viewport-projection' })).join('\n')).toContain('is not an exact Gate@Version');

		const ratifiedOnly = fixture({ gates: [{ ...fixture().gates[0]!, state: 'ratified' }] });
		expect(gateProblems(withSlice({ consumes: 'F4.intent-acceptance@1' }, ratifiedOnly)).join('\n')).toContain(
			'requires an accepted "F4.intent-acceptance@1"'
		);

		// Self-satisfaction: accepted in the working register, absent at the trusted base.
		const selfSatisfied = fixture({ trustedBase: [] });
		expect(gateProblems(withSlice({ consumes: 'F4.intent-acceptance@1' }, selfSatisfied)).join('\n')).toContain(
			'is not accepted at the trusted base'
		);

		expect(gateProblems(fixture({ trustedBase: null })).join('\n')).toContain('git fetch origin main');
	});

	it('refuses a superseded consumer and keeps a shipped consumer on its historical version', () => {
		const superseded = fixture({
			gates: [
				{ ...fixture().gates[0]!, state: 'superseded' },
				{ ...fixture().gates[0]!, version: '2', state: 'accepted', provider: 'T1.P01.S01' }
			],
			trustedBase: []
		});
		expect(gateProblems(withSlice({ consumes: 'F4.intent-acceptance@1' }, superseded)).join('\n')).toContain('consumes superseded');
		expect(gateProblems(withSlice({ consumes: 'F4.intent-acceptance@1', status: 'shipped' }, superseded))).toEqual([]);
	});

	it('refuses a gate row without one registered, existing provider and real readiness evidence', () => {
		expect(gateProblems(fixture({ gates: [{ ...fixture().gates[0]!, provider: '—' }] })).join('\n')).toContain(
			'requires exactly one registered provider slice'
		);
		expect(gateProblems(fixture({ gates: [{ ...fixture().gates[0]!, provider: 'T1.P09.S09' }] })).join('\n')).toContain(
			'is not registered in any phase README'
		);
		expect(gateProblems(fixture({ exists: (path) => path !== 'packages/project-model/src' })).join('\n')).toContain(
			'Exports path "packages/project-model/src" does not exist'
		);
		expect(gateProblems(fixture({ ancestorOfHead: () => false })).join('\n')).toContain('is not an ancestor of HEAD');
		expect(gateProblems(fixture({ gates: [{ ...fixture().gates[0]!, state: 'implemented', version: '—' }] })).join('\n')).toContain(
			'requires a version'
		);
		expect(gateProblems(fixture({ resolves: () => false })).join('\n')).toContain('contract anchor');
		expect(gateProblems(fixture({ gates: [{ ...fixture().gates[0]!, state: 'undrafted', version: '1' }] })).join('\n')).toContain(
			'has no version'
		);
		expect(gateProblems(fixture({ gates: [{ ...fixture().gates[0]!, owner: '—' }] })).join('\n')).toContain('owner is required');
	});

	it('refuses a duplicate row, a broken version run and two current versions', () => {
		expect(gateProblems(fixture({ gates: [fixture().gates[0]!, { ...fixture().gates[0]! }] })).join('\n')).toContain(
			'appears on more than one row'
		);
		const gapped = fixture({
			gates: [
				{ ...fixture().gates[0]!, version: '1', state: 'superseded' },
				{ ...fixture().gates[0]!, version: '3', state: 'accepted', provider: 'T1.P01.S01' }
			]
		});
		expect(gateProblems(gapped).join('\n')).toContain('breaks the run from 1');
		const twoCurrent = fixture({
			gates: [
				{ ...fixture().gates[0]!, version: '1', state: 'accepted', provider: 'T1.P01.S01' },
				{ ...fixture().gates[0]!, version: '2', state: 'accepted', provider: 'T1.P01.S01' }
			]
		});
		expect(gateProblems(twoCurrent).join('\n')).toContain('more than one current (non-superseded) version row');
	});

	it('keeps a provider eligible while it accepts its own gate, and parallel slices eligible', () => {
		const provider = withSlice(
			{ status: 'accepted' },
			fixture({ gates: [{ ...fixture().gates[0]!, provider: 'T1.P01.S01' }] })
		);
		expect(gateProblems(provider)).toEqual([]);

		const first = fixture().phases[0]!;
		const second: PhaseModel = {
			...first,
			id: 'T1.P02',
			file: 'docs/roadmap/t1-spatial-world/t1.p02-shell/README.md',
			finalGateSlice: 'T1.P02.S01',
			slices: [{ ...first.slices[0]!, id: 'T1.P02.S01' }]
		};
		// Two concurrent phases in one track, with a gate whose producing phase is still open.
		const concurrent = fixture({ phases: [first, second] });
		expect(gateProblems(concurrent)).toEqual([]);
		expect(phaseProblems(concurrent)).toEqual([]);
	});

	it('requires both accepted gates before a Camera authoring migration', () => {
		const incomplete = withSlice({ consumes: 'F4.intent-acceptance@1', effects: CAMERA_EFFECT });
		expect(gateProblems(incomplete).join('\n')).toContain(
			'effect camera-authoring-migration requires an exact accepted T1.viewport-projection'
		);

		const accepted: GateRow = {
			...fixture().gates[1]!,
			version: '1',
			state: 'accepted',
			provider: 'T1.P01.S02',
			exports: 'packages/camera-core/src',
			conformance: 'apps/editor/tests/lib/museum/camera-core-boundary.test.ts',
			acceptance: 'docs/roadmap/t3-experience/README.md',
			commit: 'HEAD'
		};
		const withBoth = fixture({
			gates: [
				fixture().gates[0]!,
				{ ...accepted, gate: 'T3.camera-experience-cutover' },
				{ ...accepted, gate: 'T1.viewport-projection', kind: 'capability', owner: 'T1' }
			],
			trustedBase: [
				fixture().gates[0]!,
				{ ...accepted, gate: 'T3.camera-experience-cutover' },
				{ ...accepted, gate: 'T1.viewport-projection', kind: 'capability', owner: 'T1' }
			]
		});
		const resolved = withSlice(
			{
				consumes: 'F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1',
				effects: CAMERA_EFFECT
			},
			withBoth
		);
		expect(gateProblems(resolved)).toEqual([]);

		const tagged = withSlice({ consumes: 'T1.viewport-projection, T3.camera-experience-cutover', effects: CAMERA_EFFECT });
		expect(gateProblems(tagged).join('\n')).toContain('is not an exact Gate@Version');

		expect(gateProblems(withSlice({ effects: 'editor-cutover' })).join('\n')).toContain('outside the documented effects grammar');
	});

	it('refuses a phase closed without a shipped final child, and a shipped track without TRACK COMPLETE', () => {
		const closed = (overrides: Partial<PhaseModel>) => fixture({ phases: [{ ...fixture().phases[0]!, ...overrides }] });
		expect(phaseProblems(closed({ stage: 'closed', closed: 'owner 2026-10-14' })).join('\n')).toContain(
			'requires the final child shipped'
		);
		const shippedChild = withSlice({ status: 'shipped' }, closed({ stage: 'closed', closed: '—' }));
		expect(phaseProblems(shippedChild).join('\n')).toContain('requires an owner Closed block');
		expect(phaseProblems(withSlice({ status: 'shipped' }, closed({ stage: 'closed', closed: 'owner 2026-10-14' })))).toEqual([]);

		expect(phaseProblems(fixture({ tracks: [{ ...fixture().tracks[0]!, status: 'shipped' }] })).join('\n')).toContain(
			'without a TRACK COMPLETE'
		);
		expect(phaseProblems(closed({ finalGateSlice: '' })).join('\n')).toContain('must declare exactly one FINAL PHASE GATE');
		expect(phaseProblems(closed({ finalGateSlice: 'T1.P01.S99' })).join('\n')).toContain('is not a child in its slice register');
		expect(phaseProblems(fixture({ tracks: [] })).join('\n')).toContain('belongs to no registered track');
		expect(phaseProblems(fixture({ tracks: [{ ...fixture().tracks[0]!, phaseIds: ['T2.P01'] }] })).join('\n')).toContain(
			'is registered under track T1'
		);
		expect(phaseProblems(fixture({ phases: [{ ...fixture().phases[0]!, stage: 'paused' }] })).join('\n')).toContain(
			'is not active | closable | closed'
		);
	});

	it('lets a repository phase close shipped, while a shipped track still needs TRACK COMPLETE', () => {
		// R115 is a repository phase: phase-closeout writes `shipped` on its own register row and
		// never invokes the track-completion event, so no completion record is owed there. Every
		// `PHASE CLOSE` rule still applies to it through its phase README.
		const closedRepositoryPhase = fixture({
			tracks: [
				...fixture().tracks,
				{
					id: 'R115',
					status: 'shipped',
					roadmap: 'docs/roadmap/parallel-track-cutover/README.md',
					phaseIds: [],
					trackComplete: false,
					completionGaps: []
				}
			],
			phases: [
				fixture().phases[0]!,
				{
					id: 'R115',
					file: 'docs/roadmap/parallel-track-cutover/README.md',
					finalGateSlice: 'R115.S01',
					finalGateArtifact: './acceptance.md',
					stage: 'closed',
					closed: 'owner 2026-10-14 — acceptance.md',
					slices: [
						{ ...fixture().phases[0]!.slices[0]!, id: 'R115.S01', status: 'shipped', consumes: '—' }
					]
				}
			]
		});
		expect(phaseProblems(closedRepositoryPhase)).toEqual([]);
		// The same state on a T-track still fails: a track closes only through track completion.
		expect(
			phaseProblems(
				fixture({
					tracks: [{ ...fixture().tracks[0]!, status: 'shipped' }],
					phases: [{ ...fixture().phases[0]!, stage: 'closed', closed: 'owner 2026-10-14' }]
				})
			).join('\n')
		).toContain('is shipped without a TRACK COMPLETE');
	});

	it('recognizes a TRACK COMPLETE record only on the track register with owner, date and evidence', () => {
		const source = readFile(ROADMAP);
		const entry = 'TRACK COMPLETE T1 — owner: owner-role · date: 2026-10-14 · evidence: ./t1-spatial-world/README.md';
		// No track is complete today, and the register must say so honestly.
		expect(trackCompletion(source, 'T1')).toBeNull();
		// A prose mention elsewhere in the file, even naming the track, is not a completion record.
		expect(trackCompletion(`${source}\n${entry}\n`, 'T1')).toBeNull();
		expect(trackCompletion(source.replace('- **R115 is a repository phase', `${entry}\n- **R115 is a repository phase`), 'T1')).toEqual({
			owner: 'owner-role',
			date: '2026-10-14',
			evidence: './t1-spatial-world/README.md'
		});
		// An incomplete record reports the parts it lacks, and marks no track complete.
		expect(
			trackCompletion(
				source.replace('- **R115 is a repository phase', 'TRACK COMPLETE T1 — owner: owner-role\n- **R115 is a repository phase'),
				'T1'
			)
		).toEqual({ owner: 'owner-role', date: '', evidence: '' });
		expect(
			phaseProblems(fixture({ tracks: [{ ...fixture().tracks[0]!, completionGaps: ['date', 'evidence'] }] })).join('\n')
		).toContain('TRACK COMPLETE is missing date, evidence');
		expect(
			phaseProblems(fixture({ tracks: [{ ...fixture().tracks[0]!, status: 'shipped', trackComplete: true }] })).join('\n')
		).not.toContain('TRACK COMPLETE');
	});

	it('refuses a narrowed slice plan without an integration route and a non-exhaustive final gate', () => {
		expect(phaseProblems(withSecondSlice({ verification: 'affected-subsystem' })).join('\n')).toContain(
			'must declare its replacement integration route'
		);
		// A narrowed slice carries its deferred proof through a route; the final gate stays
		// exhaustive, so the phase remains admissible.
		expect(
			phaseProblems(withSecondSlice({ verification: 'affected-subsystem', integrationRoute: './integration/plan.md' }))
		).toEqual([]);
		expect(phaseProblems(withSlice({ verification: 'iteration', integrationRoute: './integration/plan.md' })).join('\n')).toContain(
			"final gate's plan must declare exhaustive verification"
		);
		expect(phaseProblems(withSlice({ verification: 'quarterly' })).join('\n')).toContain('is not one of');
	});
});

describe('the capability-readiness rule', () => {
	const model = readStructure();

	it('installs the two fields and reports nothing for the tree as written', () => {
		// The readiness rule's two fields are installed and resolvable: every gate row parses its
		// `Accepted capabilities` cell, and no entry is malformed. The count is deliberately not
		// frozen — the field exists to advance as providers land, and `capabilityProblems` below is
		// what guards the advance; an assertion that no scope claims acceptance would fail the first
		// legitimate provider, exactly as an "all undrafted" assertion would.
		expect(model.gates.flatMap((row) => row.capabilities).every((entry) => entry.wellFormed)).toBe(true);
		// The `Requires` field is installed and populated: every registered unshipped slice declares
		// its exact scopes, and a registration changes this pin deliberately.
		const viewport = 'T1.viewport-projection@1:viewport-projection-v1';
		const local = 'F4.intent-acceptance@1:local-single-domain-v1';
		expect(sliceRequires(model)).toEqual({
			'T1.P01.S02': ['F1.reference@1:references-v1', 'F3.channels@1:inspection-v1'],
			'T1.P01.S03': ['F1.reference@1:references-v1'],
			'T1.P01.S04': [
				'F1.reference@1:references-v1',
				local,
				'F4.intent-acceptance@1:conditional-save-current-v1',
				viewport
			],
			'T1.P01.S05': ['F1.reference@1:references-v1', local, viewport],
			'T1.P01.S06': [
				'F1.reference@1:unit-resolution-v1',
				'F2.unit-envelope@1:unit-envelope-v1',
				'F4.intent-acceptance@1:unit-acceptance-v1',
				'F4.intent-acceptance@1:conditional-save-units-v1',
				viewport
			],
			'T1.P01.S07': ['F1.reference@1:references-v1', 'F3.channels@1:inspection-v1', local],
			'T2.P01.S01': ['F1.reference@1:references-v1'],
			'T2.P01.S02': ['F1.reference@1:references-v1', local],
			'T2.P01.S03': ['F1.reference@1:references-v1', local, viewport],
			'T2.P01.S04': [
				'F1.reference@1:references-v1',
				local,
				'F4.intent-acceptance@1:conditional-save-current-v1',
				viewport
			],
			'T3.P01.S01': ['F1.reference@1:references-v1', 'F3.channels@1:inspection-v1'],
			'T3.P01.S02': ['F1.reference@1:references-v1', local],
			'T3.P01.S03': [
				'F1.reference@1:unit-resolution-v1',
				'F2.unit-envelope@1:unit-envelope-v1',
				'F3.channels@1:inspection-v1',
				local,
				'F4.intent-acceptance@1:conditional-save-current-v1'
			],
			'T3.P01.S05': [
				'F1.reference@1:unit-resolution-v1',
				'F2.unit-envelope@1:unit-envelope-v1',
				'F4.intent-acceptance@1:acceptance-invariants-v1'
			],
			'T3.P01.S06': [
				'F1.reference@1:unit-resolution-v1',
				'F2.unit-envelope@1:unit-envelope-v1',
				'F3.channels@1:inspection-v1'
			],
			'T3.P01.S04': [
				'F1.reference@1:unit-resolution-v1',
				'F2.unit-envelope@1:unit-envelope-v1',
				'F3.channels@1:camera-handoff-v1',
				'F4.intent-acceptance@1:unit-acceptance-v1',
				'F4.intent-acceptance@1:conditional-save-units-v1'
			],
			// Batch D registration (2026-10-20): the first T3 authoring phase consumes the accepted
			// cutover plus the unit, handoff, acceptance, Save and viewport scopes. S02 is its declared
			// final gate and stays `proposed`.
			'T3.P02.S01': [
				'F1.reference@1:unit-resolution-v1',
				'F2.unit-envelope@1:unit-envelope-v1',
				'F3.channels@1:camera-handoff-v1',
				'F4.intent-acceptance@1:unit-acceptance-v1',
				'F4.intent-acceptance@1:conditional-save-units-v1',
				viewport
			],
			'T3.P02.S02': [
				'F1.reference@1:unit-resolution-v1',
				'F2.unit-envelope@1:unit-envelope-v1',
				'F3.channels@1:camera-handoff-v1',
				'F4.intent-acceptance@1:unit-acceptance-v1',
				'F4.intent-acceptance@1:conditional-save-units-v1',
				viewport
			],
			// Batch E registration (2026-10-22): H0 (T3.P03) consumes only the unit envelope and
			// unit acceptance it corrects; C1 (T1.P02) and C2 (T2.P02) consume the unit, acceptance,
			// Save and viewport scopes. No slice provides a gate.
			'T3.P03.S01': ['F2.unit-envelope@1:unit-envelope-v1', 'F4.intent-acceptance@1:unit-acceptance-v1'],
			'T3.P03.S02': ['F2.unit-envelope@1:unit-envelope-v1', 'F4.intent-acceptance@1:unit-acceptance-v1'],
			...Object.fromEntries(
				['T1.P02.S01', 'T1.P02.S02', 'T1.P02.S03', 'T1.P02.S04', 'T2.P02.S01', 'T2.P02.S02', 'T2.P02.S03'].map(
					(id) => [
						id,
						[
							'F1.reference@1:unit-resolution-v1',
							'F2.unit-envelope@1:unit-envelope-v1',
							'F4.intent-acceptance@1:unit-acceptance-v1',
							'F4.intent-acceptance@1:conditional-save-units-v1',
							viewport
						]
					]
				)
			)
		});
		expect(capabilityProblems(model)).toEqual([]);
	});

	it('reads an accepted scope only from an exact entry with a real durable record', () => {
		expect(acceptedCapabilitiesOf('—')).toEqual([]);
		const parsed = acceptedCapabilitiesOf(
			`\`${FIXTURE_CAPABILITY}\` active — ${FIXTURE_CAPABILITY_RECORD}; \`F1.reference@1:references-v1\` retired — docs/x.md`
		);
		expect(parsed.map((entry) => [entry.capability, entry.status, entry.record])).toEqual([
			[FIXTURE_CAPABILITY, 'active', FIXTURE_CAPABILITY_RECORD],
			['F1.reference@1:references-v1', 'retired', 'docs/x.md']
		]);
		// A status is required: a bare capability string is not an accepted entry.
		expect(acceptedCapabilitiesOf(`\`${FIXTURE_CAPABILITY}\``).map((entry) => entry.wellFormed)).toEqual([false]);

		const record = capabilityRecord(recordSource(FIXTURE_CAPABILITY, FIXTURE_PREREQUISITE), FIXTURE_CAPABILITY_RECORD);
		expect(record.problems).toEqual([]);
		expect(record.record?.capability).toBe(FIXTURE_CAPABILITY);
		expect(record.record?.commit).toBe('HEAD');
		// The record carries the scope's breadth and provenance, not only its evidence paths.
		expect(record.record?.sourceKinds).toBe('layout-unit');
		expect(record.record?.extensionSlice).toBe('T1.P01.S01');
	});

	it('keeps an eligible consumer green and refuses every way a scope can fail to be accepted', () => {
		// Positive control: accepted here and at the trusted base, `active`, with a real record.
		expect(capabilityProblems(consuming())).toEqual([]);

		// A malformed entry is a register defect, not a silently dropped scope.
		expect(
			capabilityProblems(consuming({}, capabilityFixture({ gates: [withCapabilities(acceptedEntry(FIXTURE_CAPABILITY, { wellFormed: false }))] }))).join('\n')
		).toContain('is not written as');
		// The scope must name a registered gate version.
		expect(
			capabilityProblems(
				consuming({}, capabilityFixture({ gates: [withCapabilities(acceptedEntry('F9.nothing@1:scope-v1'))] }))
			).join('\n')
		).toContain('names an unregistered gate version');
		// An accepted scope on a gate row that is not accepted is incoherent.
		expect(
			capabilityProblems(
				consuming({}, capabilityFixture({ gates: [withCapabilities(acceptedEntry(FIXTURE_CAPABILITY), 'implemented')] }))
			).join('\n')
		).toContain('requires the gate row state "accepted"');
		// A missing or unreadable record, a record for another capability, a missing evidence
		// path and an unreviewed commit all fail.
		expect(
			capabilityProblems(consuming({}, capabilityFixture({ readText: () => null }))).join('\n')
		).toContain('does not exist');
		expect(
			capabilityProblems(
				consuming({}, capabilityFixture({ readText: () => recordSource('F1.reference@1:references-v1', '—') }))
			).join('\n')
		).toContain('the record declares capability');
		expect(
			capabilityProblems(consuming({}, capabilityFixture({ exists: (path) => path !== 'packages/project-model/src' }))).join('\n')
		).toContain('Exports path "packages/project-model/src" does not exist');
		expect(
			capabilityProblems(consuming({}, capabilityFixture({ ancestorOfHead: () => false }))).join('\n')
		).toContain('is not an ancestor of HEAD');
		// A scope's breadth and provenance are recorded, and the slice that authored it exists.
		expect(
			capabilityProblems(
				consuming({}, capabilityFixture({ readText: () => recordSource(FIXTURE_CAPABILITY, '—', { 'Source kinds': '—' }) }))
			).join('\n')
		).toContain('requires its admitted source kinds');
		expect(
			capabilityProblems(
				consuming({}, capabilityFixture({ readText: () => recordSource(FIXTURE_CAPABILITY, '—', { 'Extension slice': '—' }) }))
			).join('\n')
		).toContain('requires the extension slice that authored the scope');
		expect(
			capabilityProblems(
				consuming({}, capabilityFixture({ readText: () => recordSource(FIXTURE_CAPABILITY, '—', { 'Extension slice': 'T9.P99.S99' }) }))
			).join('\n')
		).toContain('is not a slice in any phase register');
		// An entry is evidence filed against its own gate version, never another row's.
		expect(
			capabilityProblems(
				consuming(
					{},
					capabilityFixture({
						gates: [
							withCapabilities(acceptedEntry(FIXTURE_PREREQUISITE)),
							{ ...fixture().gates[1]!, gate: 'F1.reference', version: '1', state: 'accepted' }
						],
						readText: () => recordSource(FIXTURE_PREREQUISITE, '—')
					})
				)
			).join('\n')
		).toContain('an entry belongs to the version it is written on');
		// A capability cannot be its own prerequisite, and a cyclic closure is reported.
		expect(
			capabilityProblems(consuming({}, capabilityFixture({ readText: () => recordSource(FIXTURE_CAPABILITY, FIXTURE_CAPABILITY) }))).join('\n')
		).toContain('cannot be its own prerequisite');
	});

	it('refuses a Requires that is not an exact scope of a consumed gate', () => {
		expect(capabilityProblems(consuming({ requires: 'F4.intent-acceptance@1' })).join('\n')).toContain(
			'is not an exact Gate@Version:capability'
		);
		expect(capabilityProblems(consuming({ requires: 'F4.intent-acceptance@1:missing-scope-v1' })).join('\n')).toContain(
			'has no Accepted-capabilities entry'
		);
		expect(capabilityProblems(consuming({ consumes: 'F1.reference@1' })).join('\n')).toContain(
			'but Consumes does not declare'
		);
	});

	it('fails an acceptance recorded only in the current diff, and a retired scope', () => {
		// Self-satisfaction: the scope is accepted in the working register but absent at the
		// trusted base, so the consumer cannot supply its own prerequisite.
		expect(capabilityProblems(consuming({}, capabilityFixture({ trustedBase: [] }))).join('\n')).toContain(
			'is not accepted at the trusted base'
		);
		// A scope accepted only at the trusted base is historical evidence, not current eligibility.
		const trustedOnly = consuming(
			{},
			capabilityFixture({
				gates: [withCapabilities(acceptedEntry(FIXTURE_CAPABILITY, { status: 'retired' }))],
				trustedBase: [withCapabilities(acceptedEntry(FIXTURE_CAPABILITY))]
			})
		);
		expect(capabilityProblems(trustedOnly).join('\n')).toContain('accepted only at the trusted base');
		// Retirement is terminal for a new or in-progress consumer, at any epoch.
		const bothRetired = consuming(
			{},
			capabilityFixture({
				gates: [withCapabilities(acceptedEntry(FIXTURE_CAPABILITY, { status: 'retired' }))],
				trustedBase: [withCapabilities(acceptedEntry(FIXTURE_CAPABILITY, { status: 'retired' }))]
			})
		);
		expect(capabilityProblems(bothRetired).join('\n')).toContain('retired scope');
	});

	it('resolves the prerequisite closure and keeps non-consumers and settled slices eligible', () => {
		// A capability that itself requires an unaccepted scope is not ready either.
		const prerequisite = 'F1.reference@1:references-v1';
		const chained = capabilityFixture({
			gates: [
				withCapabilities(acceptedEntry(FIXTURE_CAPABILITY)),
				{ ...fixture().gates[0]!, gate: 'F1.reference', capabilities: [acceptedEntry(prerequisite)] }
			],
			trustedBase: [{ ...fixture().gates[0]!, gate: 'F1.reference', capabilities: [acceptedEntry(prerequisite)] }],
			readText: (path) => (path === FIXTURE_CAPABILITY_RECORD ? recordSource(FIXTURE_CAPABILITY, prerequisite) : null)
		});
		// F1.reference@1 is not registered in this model, so the prerequisite is unresolvable.
		expect(capabilityProblems(consuming({ requires: FIXTURE_CAPABILITY }, chained)).join('\n')).toContain(
			FIXTURE_CAPABILITY
		);

		// A `proposed` consumer is not yet eligible work, so it is not enforced.
		expect(capabilityProblems(consuming({ status: 'proposed' }))).toEqual([]);
		// A shipped slice, and one already accepted at the trusted base, keep their recorded
		// scopes: a later retirement is not retroactive.
		expect(capabilityProblems(consuming({ status: 'shipped' }, capabilityFixture({ trustedBase: [] })))).toEqual([]);
		expect(
			capabilityProblems(
				consuming({}, capabilityFixture({ trustedBase: [], trustedSliceStatus: () => 'accepted' }))
			)
		).toEqual([]);
		// A slice with no `Requires` declares no capability prerequisite at all.
		expect(capabilityProblems(consuming({ requires: '—' }, capabilityFixture({ trustedBase: [] })))).toEqual([]);
	});
});

/** The gate rows a capability fixture needs: the gate plus its registered version holder. */
function withCapabilities(entry: AcceptedCapabilityEntry, state = 'accepted'): GateRow {
	return { ...fixture().gates[0]!, state, capabilities: [entry] };
}

/** Every slice's declared `Requires`, for the register's current population. */
function sliceRequires(model: StructureModel): Record<string, string[]> {
	const declared: Record<string, string[]> = {};
	for (const phase of model.phases) {
		for (const slice of phase.slices) {
			if (isSentinel(slice.requires)) continue;
			declared[slice.id] = slice.requires
				.split(',')
				.map((token) => stripDecoration(token).trim())
				.filter((token) => token !== '');
		}
	}
	return declared;
}

describe('the architecture cycle opening rule', () => {
	const model = readStructure();

	it('reports nothing for the window as written, configured or not', () => {
		// The state row and mechanism register parsed, whatever the current stage: an unconfigured
		// window is as valid here as the configured one the first T1 phase plan installs.
		expect(STAGES).toContain(model.cycle.stage);
		expect(model.cycle.readiness).not.toBe('');
		expect(model.cycle.mechanisms.length).toBeGreaterThanOrEqual(SEEDED_MECHANISMS.length);
		expect(cycleProblems(model)).toEqual([]);
	});

	it('catches a missed opening, a stale stage, a missing exposure row and a premature close', () => {
		expect(cycleProblems(fixture({ cycle: configuredCycle({ openedBy: '—' }) })).join('\n')).toContain('a missed opening');
		expect(cycleProblems(fixture({ cycle: configuredCycle({ stage: 'PHASE_2_VALIDATING', openedBy: '—' }) })).join('\n')).toContain(
			'Opened by is empty'
		);

		const settled = withExposures('accepted', 'accepted');
		expect(cycleProblems({ ...settled, cycle: configuredCycle() }).join('\n')).toContain(
			'closure predicate is satisfied while the stage is stale'
		);
		expect(cycleProblems({ ...settled, cycle: configuredCycle({ stage: 'PHASE_3_EVALUATE' }) }).join('\n')).toContain(
			'with no exposure row'
		);
		const recorded = withExposures('accepted', 'accepted');
		expect(
			cycleProblems({ ...recorded, cycle: configuredCycle({ stage: 'PHASE_3_EVALUATE', exposureRows: 'T1.P01.S01, T1.P01.S02' }) })
		).toEqual([]);
		expect(cycleProblems({ ...withExposures('in-progress', 'in-progress'), cycle: configuredCycle({ stage: 'PHASE_3_EVALUATE' }) }).join('\n')).toContain(
			'while a listed exposure is still pending'
		);
	});

	it('requires the terminal and the expected opener to be listed exposure slices', () => {
		expect(cycleProblems(fixture({ cycle: configuredCycle({ terminal: 'T1.P01.S09' }) })).join('\n')).toContain(
			'the terminal "T1.P01.S09" is not one of the listed exposure slices'
		);
		expect(cycleProblems(fixture({ cycle: configuredCycle({ opener: 'T1.P01.S09' }) })).join('\n')).toContain(
			'the expected opener "T1.P01.S09" is not one of the listed exposure slices'
		);
		expect(cycleProblems(fixture({ cycle: configuredCycle({ terminal: '—' }) })).join('\n')).toContain(
			'a configured window requires a terminal'
		);
		expect(cycleProblems(fixture({ cycle: configuredCycle({ opener: '—' }) })).join('\n')).toContain(
			'a configured window requires an expected opener'
		);
	});

	it('closes on a discharged nonterminal exposure, and never on a discharged terminal', () => {
		const window = withExposures('approved', 'accepted');
		const closed = configuredCycle({
			stage: 'PHASE_3_EVALUATE',
			exposureRows: 'T1.P01.S02, T1.P01.S01 discharged — absorbed by the T1.P02 window'
		});
		// A recorded discharge carries closure even though that nonterminal slice stays `approved`.
		expect(cycleProblems({ ...window, cycle: closed })).toEqual([]);
		// Without its discharge row the same window is a premature close.
		expect(
			cycleProblems({ ...window, cycle: { ...closed, exposureRows: 'T1.P01.S02' } }).join('\n')
		).toContain('while a listed exposure is still pending');
		// The terminal cannot be discharged: closure still requires it accepted.
		expect(
			cycleProblems({ ...window, cycle: { ...closed, exposureRows: 'T1.P01.S01 discharged, T1.P01.S02 discharged' } }).join('\n')
		).toContain('cannot be discharged');
		// Negated prose is not a discharge: the marker must sit immediately after the slice id.
		expect(
			cycleProblems({ ...window, cycle: { ...closed, exposureRows: 'T1.P01.S02, T1.P01.S01 not discharged — awaiting owner review' } }).join('\n')
		).toContain('while a listed exposure is still pending');
		expect(exposureRowsOf('T1.P01.S01 not discharged — awaiting owner review')).toEqual([
			{ id: 'T1.P01.S01', discharged: false }
		]);
		expect(exposureRowsOf('T1.P01.S02 discharged — absorbed by the T1.P02 window')).toEqual([
			{ id: 'T1.P01.S02', discharged: true }
		]);
	});

	it('keeps the documented discharge examples aligned with the cycle checker', () => {
		// Read the owning document's actual examples, not parallel literals in this test. A
		// changed example must remain executable by the same parser used for cycle closure.
		const cycleContract = readFile(CYCLE);
		const acceptedExample =
			/`((?:T\d+\.P\d+|R\d+)\.S\d+ discharged[^`]+)`/.exec(cycleContract)?.[1];
		const negatedExample = /`… (not discharged[^`]+)`/.exec(cycleContract)?.[1];
		expect(acceptedExample).toBeDefined();
		expect(negatedExample).toBeDefined();
		const documentedId = acceptedExample!.split(' ')[0]!;
		expect(exposureRowsOf(acceptedExample!)).toEqual([{ id: documentedId, discharged: true }]);
		expect(exposureRowsOf(`T1.P01.S01 ${negatedExample!}`)).toEqual([
			{ id: 'T1.P01.S01', discharged: false }
		]);
	});

	it('requires a configured window once it is ready or open, and a listed opening slice', () => {
		const empty = { ...configuredCycle(), exposures: [], terminal: '—', opener: '—', openedBy: '—' };
		expect(cycleProblems(fixture({ cycle: { ...empty, readiness: 'ready' } })).join('\n')).toContain(
			'readiness "ready" requires at least one listed exposure slice'
		);
		expect(
			cycleProblems(fixture({ cycle: { ...empty, readiness: 'open', stage: 'PHASE_2_VALIDATING' } })).join('\n')
		).toContain('readiness "open" requires at least one listed exposure slice');
		// An opening slice is one of the listed exposures: a window cannot open around a slice it
		// does not list.
		expect(cycleProblems(fixture({ cycle: configuredCycle({ openedBy: 'T1.P01.S09' }) })).join('\n')).toContain(
			'"Opened by" names "T1.P01.S09", which is not one of the listed exposure slices'
		);
	});

	it('refuses an over-full window, an unregistered listing, a bad status and STEADY without verdicts', () => {
		expect(
			cycleProblems(fixture({ cycle: configuredCycle({ exposures: ['T1.P01.S01', 'T1.P01.S02', 'T1.P01.S03', 'T1.P01.S04'] }) })).join('\n')
		).toContain('exceed the bound of 3');
		expect(cycleProblems(fixture({ cycle: configuredCycle({ exposures: ['T9.P09.S09'], terminal: 'T9.P09.S09' }) })).join('\n')).toContain(
			'is not a slice in any phase README'
		);
		expect(cycleProblems(fixture({ cycle: configuredCycle({ stage: 'STEADY' }) })).join('\n')).toContain('STEADY requires a verdict row');
		expect(cycleProblems(fixture({ cycle: configuredCycle({ mechanisms: [{ id: 'M1', status: 'maybe', verdict: '—' }] }) })).join('\n')).toContain(
			'is not installed or dormant'
		);
		expect(cycleProblems(fixture({ cycle: configuredCycle({ stage: 'PHASE_9' }) })).join('\n')).toContain('is not part of the stage vocabulary');
		expect(cycleProblems(fixture({ cycle: configuredCycle({ readiness: 'whenever' }) })).join('\n')).toContain(
			'is not part of the readiness vocabulary'
		);
	});

	it('keeps a non-listed slice, a non-nominal opener and an unrelated track eligible', () => {
		// A slice that is not listed opens no window requirement of its own.
		expect(cycleProblems(fixture())).toEqual([]);

		// A listed slice other than the nominal opener may open the window.
		const otherOpener = withExposures('approved', 'in-progress');
		expect(cycleProblems({ ...otherOpener, cycle: configuredCycle({ openedBy: 'T1.P01.S02', stage: 'PHASE_2_VALIDATING' }) })).toEqual([]);

		// An unrelated T4 slice stays eligible while the T1 window is open.
		const otherTrack = fixture({
			tracks: [
				...fixture().tracks,
				{ id: 'T4', status: 'planning', roadmap: 'docs/roadmap/t4-release/README.md', phaseIds: ['T4.P01'], trackComplete: false, completionGaps: [] }
			],
			phases: [
				...fixture().phases,
				{
					id: 'T4.P01',
					file: 'docs/roadmap/t4-release/t4.p01-prepared-reader/README.md',
					finalGateSlice: 'T4.P01.S01',
					finalGateArtifact: './acceptance.md',
					stage: 'active',
					closed: '—',
					slices: [{ ...fixture().phases[0]!.slices[0]!, id: 'T4.P01.S01' }]
				}
			]
		});
		expect(gateProblems(otherTrack)).toEqual([]);
		expect(phaseProblems(otherTrack)).toEqual([]);
	});
});

describe('routing and skill preflights', () => {
	const router = readFile(ROUTER);
	const skills = { closeout: readFile(SKILL_CLOSEOUT), phase: readFile(SKILL_PHASE) };

	it('keeps ordinary slice routes out of the phase, program and cycle procedures', () => {
		expect(routeProblems(router)).toEqual([]);
		expect(routeProblems(router.replace('ASSIGNED WORK: operations/current.md', 'ASSIGNED WORK: architecture-cycle.md')).join('\n')).toContain(
			'belongs to an explicit event'
		);
		expect(routeProblems(router.replace('STOP: no more reading', 'HALT: nothing')).join('\n')).toContain('has no STOP route');
		expect(routeProblems(router.replace('F-INTERFACE GAP:', 'INTERFACE GAP:')).join('\n')).toContain(
			'has no F-INTERFACE GAP route'
		);
	});

	it('keeps each track baton track-local and the global baton navigation-only', () => {
		const batons = TRACK_RUNBOOKS.map((track) => ({
			track,
			runbook: readFile(`docs/operations/${track}/README.md`),
			exists: existsSync(resolve(REPO_ROOT, `docs/operations/${track}/current.md`))
		}));
		const global = readFile('docs/operations/current.md');
		expect(batonProblems(batons, global)).toEqual([]);
		// Sensitivity controls: the global baton as a status store, and a runbook
		// pointed back at the global baton, both fail.
		expect(batonProblems(batons, global.replace('Navigation only', 'STATUS')).join('\n')).toContain(
			'navigation only'
		);
		expect(
			batonProblems(
				batons.map((baton) => ({
					...baton,
					runbook: baton.runbook.replace('BATON:   ./current.md', 'BATON:   ../current.md')
				})),
				global
			).join('\n')
		).toContain('its own ./current.md');
		expect(batonProblems([{ ...batons[0]!, exists: false }], global).join('\n')).toContain('has no operations/');
	});

	it('carries the evidence preflight in both closeout skills', () => {
		expect(skillProblems(skills)).toEqual([]);
		expect(
			skillProblems({ ...skills, closeout: skills.closeout.replaceAll('verification tier', 'verification') }).join('\n')
		).toContain('missing required evidence-preflight text');
		expect(skillProblems({ ...skills, closeout: `${skills.closeout}\n1. run \`npm test\`, \`npm run check\`, \`npm run build\`` }).join('\n')).toContain(
			'unconditional verification trio is retired'
		);
		expect(skillProblems({ ...skills, phase: `${skills.phase}\nCYCLE TARGET: STEADY` }).join('\n')).toContain(
			'performs no cycle transition'
		);
	});
});

function readFile(path: string): string {
	return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}
