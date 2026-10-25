/**
 * `F4.intent-acceptance@1:conditional-save-units-v1` — the F.2 half of the
 * conditional Save protocol (T3.P01.S05).
 *
 * The protocol itself is the landed `SaveAcceptedSource@1`; this module only
 * supplies the F.2 source: the canonical envelope bytes, the envelope
 * source-content digest and the strict reader the server uses before it trusts
 * anything. It never writes, never activates a route and never mints a saved
 * base — those stay in the landed persistence path.
 *
 * **Accepted revision stamping.** An F.2 envelope embeds `acceptedRevision`, but
 * the landed coordinator keeps the accepted revision as its own token and does
 * not rewrite the source it installs: that embedded value is the **baseline**
 * revision the candidate was prepared from, and byte-exact history restoration
 * depends on it staying untouched. Revision authority is
 * `AcceptedSnapshot.acceptedRevision`, so this persistence boundary stamps that
 * revision onto the envelope before serializing. The envelope source digest
 * excludes the field (AM-2), so two captures of identical authored content under
 * different revisions share one content identity — while the saved bytes name
 * the revision they were saved under. `readUnitEnvelopeForSave` and the server
 * handler still require the captured bytes to carry the captured revision, so a
 * Save that would persist a different revision refuses.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */

import { fullSourceHash, type SaveAcceptedSource, type SavePrecondition } from '../save/protocol';
import type { PreparedSaveSource, SaveSourceHandler, SaveSourcePreparation } from '../save/admission';
import type { ShapeIssue } from '../strict-shape';
import type { AcceptedSnapshot } from '../f4/types';
import {
	computeEnvelopeSourceContentId,
	verifyUnitContentRevisions,
	type SaveWorkInstrumentation
} from './canonical';
import { verifyUnitDependencyLocks } from './acceptance';
import { serializeProjectEnvelope, validateProjectEnvelope } from './validate';
import { normalizeUnitEnvelope, UNIT_ENVELOPE_SOURCE_KIND, UNIT_ENVELOPE_SOURCE_VERSION } from './acceptance';
import type { ProjectEnvelope } from './types';

export const UNIT_SAVE_SOURCE_KIND = UNIT_ENVELOPE_SOURCE_KIND;
export const UNIT_SAVE_SOURCE_VERSION = UNIT_ENVELOPE_SOURCE_VERSION;

/** The exact capability scope this module provides. */
export const UNIT_SAVE_SCOPE = 'conditional-save-units-v1' as const;

export type UnitSaveRefusal = {
	readonly kind: 'refused';
	readonly code: 'invalid-project' | 'content-identity-mismatch' | 'invalid-save-request';
	readonly message: string;
	readonly issues: readonly ShapeIssue[];
};

export type UnitSaveCapture = { readonly kind: 'captured'; readonly capture: SaveAcceptedSource } | UnitSaveRefusal;

/**
 * Read one captured canonical envelope. `canonicalJson` must be exactly what
 * `serializeProjectEnvelope` produces for its contents; a reordered or
 * reformatted envelope is refused rather than hashed into a different identity.
 */
export async function readUnitEnvelopeForSave(
	canonicalJson: string
): Promise<{ readonly kind: 'read'; readonly envelope: ProjectEnvelope } | UnitSaveRefusal> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(canonicalJson);
	} catch {
		return { kind: 'refused', code: 'invalid-project', message: 'The captured envelope is not valid JSON', issues: [] };
	}
	const validated = validateProjectEnvelope(parsed);
	if (!validated.success) {
		return { kind: 'refused', code: 'invalid-project', message: 'The captured envelope is not a valid F.2 envelope', issues: validated.issues };
	}
	const mismatches = await verifyUnitContentRevisions(validated.envelope);
	if (mismatches.length > 0) {
		return {
			kind: 'refused',
			code: 'content-identity-mismatch',
			message: 'A unit content revision does not match its canonical data',
			issues: mismatches.map((mismatch) => ({
				path: mismatch.path,
				code: 'content-revision-mismatch',
				message: `declared ${mismatch.declared}, recomputed ${mismatch.recomputed}`
			}))
		};
	}
	if (serializeProjectEnvelope(validated.envelope) !== canonicalJson) {
		return {
			kind: 'refused',
			code: 'content-identity-mismatch',
			message: 'The captured envelope is not the canonical encoding of its contents',
			issues: []
		};
	}
	if (validated.closure.length > 0) {
		return {
			kind: 'refused',
			code: 'invalid-project',
			message: 'The envelope cannot satisfy an executable resource requirement',
			issues: validated.closure.map((finding) => ({ path: finding.path, code: finding.code, message: finding.message }))
		};
	}
	const lockIssues = await verifyUnitDependencyLocks(validated.envelope);
	if (lockIssues.length > 0) {
		return { kind: 'refused', code: 'invalid-project', message: 'The dependency lock does not resolve', issues: lockIssues };
	}
	return { kind: 'read', envelope: validated.envelope };
}

/**
 * Capture one accepted envelope for persistence.
 *
 * The snapshot is the accepted source; its `acceptedRevision` is the revision
 * the Save is recorded under, and the authored content is copied unchanged.
 */
export async function captureUnitSave(input: {
	readonly snapshot: AcceptedSnapshot<ProjectEnvelope>;
	readonly operationId: string;
	readonly precondition: SavePrecondition;
}, instrumentation?: SaveWorkInstrumentation): Promise<UnitSaveCapture> {
	const source = input.snapshot.domain.source;
	const stamped: ProjectEnvelope = { ...source, acceptedRevision: input.snapshot.acceptedRevision };
	const validated = instrumentation
		? instrumentation.sync('save.capture-validate', () => validateProjectEnvelope(stamped))
		: validateProjectEnvelope(stamped);
	if (!validated.success) {
		return { kind: 'refused', code: 'invalid-project', message: 'The accepted envelope does not validate', issues: validated.issues };
	}
	// Executable closure is the same answer the Save reader gives: an envelope the
	// registry cannot satisfy must not become a captured write. Repairable authored
	// diagnostics remain non-blocking, exactly as F.2 defines them.
	if (validated.closure.length > 0) {
		return {
			kind: 'refused',
			code: 'invalid-project',
			message: 'The envelope cannot satisfy an executable resource requirement',
			issues: validated.closure.map((finding) => ({ path: finding.path, code: finding.code, message: finding.message }))
		};
	}
	// The accepted source installed by the unit adapter is already normalized; this
	// re-derives the same headers defensively, so a host that hands a raw envelope
	// cannot capture a revision that disagrees with its data.
	const normalized = await normalizeUnitEnvelope(validated.envelope, instrumentation);
	const canonicalJson = instrumentation
		? instrumentation.sync('save.capture-serialize-envelope', () => serializeProjectEnvelope(normalized))
		: serializeProjectEnvelope(normalized);
	const lockIssues = await verifyUnitDependencyLocks(normalized, instrumentation);
	if (lockIssues.length > 0) {
		return { kind: 'refused', code: 'invalid-project', message: 'The dependency lock does not resolve', issues: lockIssues };
	}
	const sourceContentId = await computeEnvelopeSourceContentId(normalized, instrumentation, 'save.capture-source-id');
	return {
		kind: 'captured',
		capture: {
			protocol: 'SaveAcceptedSource@1',
			projectId: normalized.id,
			operationId: input.operationId,
			precondition: input.precondition,
			sourceKind: UNIT_SAVE_SOURCE_KIND,
			sourceVersion: UNIT_SAVE_SOURCE_VERSION,
			acceptedRevision: normalized.acceptedRevision,
			sourceContentId,
			canonicalJson
		}
	};
}

async function prepareUnitSource(capture: SaveAcceptedSource): Promise<SaveSourcePreparation> {
	const read = await readUnitEnvelopeForSave(capture.canonicalJson);
	if (read.kind === 'refused') return read;
	const envelope = { ...read.envelope, acceptedRevision: capture.acceptedRevision };
	const canonicalJson = serializeProjectEnvelope(envelope);
	if (canonicalJson !== capture.canonicalJson) {
		return {
			kind: 'refused',
			code: 'content-identity-mismatch',
			message: 'The captured envelope does not carry the captured accepted revision'
		};
	}
	if (envelope.id !== capture.projectId) {
		return { kind: 'refused', code: 'invalid-save-request', message: 'The captured envelope belongs to a different project' };
	}
	const sourceContentId = await computeEnvelopeSourceContentId(envelope);
	if (sourceContentId !== capture.sourceContentId) {
		return {
			kind: 'refused',
			code: 'content-identity-mismatch',
			message: 'The recomputed envelope content identity does not match the capture'
		};
	}
	const prepared: PreparedSaveSource = {
		canonicalJson,
		document: JSON.parse(canonicalJson) as unknown,
		projectId: envelope.id,
		name: envelope.name,
		sourceContentId,
		fullSourceHash: await fullSourceHash(canonicalJson)
	};
	return { kind: 'prepared', source: prepared };
}

/**
 * The F.2 Save source handler.
 *
 * The server-side reader is the same one the capture uses, and it refuses any
 * canonical byte string that does not re-encode to itself. There is no baseline:
 * an envelope is validated as a whole on every attempt, so a previously saved
 * envelope can never relax a later admission.
 */
export function createUnitSaveHandler(): SaveSourceHandler {
	return {
		sourceKind: UNIT_SAVE_SOURCE_KIND,
		sourceVersion: UNIT_SAVE_SOURCE_VERSION,
		prepare: prepareUnitSource,
		async validate({ capture, prepared }) {
			const again = await prepareUnitSource(capture);
			if (again.kind === 'refused') return again;
			if (
				again.source.canonicalJson !== prepared.canonicalJson ||
				again.source.sourceContentId !== prepared.sourceContentId ||
				again.source.fullSourceHash !== prepared.fullSourceHash
			) {
				return { kind: 'refused', code: 'content-identity-mismatch', message: 'The envelope changed between capture and admission' };
			}
			return again;
		},
		baseline: async () => []
	};
}
