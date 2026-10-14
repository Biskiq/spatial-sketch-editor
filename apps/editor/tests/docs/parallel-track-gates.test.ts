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
 * This file enforces exactly those relationships, with the *same* markdown-table helper as the
 * register it reads (`tests/helpers/markdown-tables.ts`), in-memory negative fixtures for every
 * rule, and positive controls — so a checker that stopped detecting one of them fails here instead
 * of passing vacuously.
 *
 * What it deliberately does NOT do: no generic workflow engine, no status store, no scheduler. It
 * reads the registers, resolves their rows, and reports. Truth a checker cannot infer stays with
 * review: that a slice's declared `Consumes` and `Effects` are truthful, and that a new persisted
 * format names its F amendment and owner in the reviewed plan.
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
	'Commit'
] as const;
const PHASE_COLUMNS = ['Phase', 'Status', 'Depends on', 'Workspace'] as const;
const SLICE_COLUMNS = [
	'Slice',
	'Status',
	'Consumes',
	'Effects',
	'Plan',
	'Acceptance',
	'Authorization'
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
/** Qualified ids (§9.1): `T1.P01.S01`, `R115.S01`. */
const SLICE_ID = /^(?:[A-Z]\d+\.P\d+|R\d+)\.S\d+$/;
const PHASE_ID = /^(?:[A-Z]\d+\.P\d+|R\d+)$/;
const CAMERA_EFFECT = 'camera-authoring-migration';
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
/** A listed exposure row starts with its slice id; `id …` may add the `discharged` marker. */
const EXPOSURE_ROW = /^((?:[A-Z]\d+\.P\d+|R\d+)\.S\d+)/;
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
};

export type SliceRow = {
	id: string;
	status: string;
	consumes: string;
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
		if (track.status === 'shipped' && !track.trackComplete) {
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
	if (cycle.readiness === 'ready' && !configured) {
		problems.push('cycle: readiness "ready" requires at least one listed exposure slice');
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
	if (!assigned.includes('operations/current.md')) problems.push('router: ASSIGNED WORK must start at the baton');
	if (!assigned.includes('phase README')) problems.push('router: ASSIGNED WORK must route through the phase README');
	if (!(byKey.get('START IMPLEMENTATION') ?? '').includes('runbook')) {
		problems.push('router: START IMPLEMENTATION must name the track runbook start step');
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
		const text = stripDecoration(entry);
		const id = EXPOSURE_ROW.exec(text)?.[1];
		if (id === undefined) continue;
		rows.push({ id, discharged: /\bdischarged\b/i.test(text) });
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
			commit: stripDecoration(row['Commit'] ?? '')
		}));
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
	try {
		const base = execFileSync('git', ['merge-base', 'HEAD', 'main'], { cwd: REPO_ROOT }).toString().trim();
		trustedBase = gateRowsOf(execFileSync('git', ['show', `${base}:${ROADMAP}`], { cwd: REPO_ROOT }).toString());
	} catch {
		trustedBase = null;
	}

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
		ancestorOfHead
	};
}

// ---------------------------------------------------------------- fixtures

const FIXTURE_PLAN = 'docs/roadmap/t1-spatial-world/t1.p01-viewport/t1.p01.s01-viewport/implementation-plan.md';

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
		commit: 'HEAD'
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
		commit: '—'
	};
	const slice: SliceRow = {
		id: 'T1.P01.S01',
		status: 'in-progress',
		consumes: '—',
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
