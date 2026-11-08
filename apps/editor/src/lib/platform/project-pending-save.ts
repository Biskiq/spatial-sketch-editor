/**
 * TD-9 — the session-storage slot for a Save capture that outlives the sign-in
 * redirect.
 *
 * The capture is not a document and not an automatic write: it records the exact
 * operation the creator chose, the precondition it was minted against and the
 * source bytes it would save. Validation lives here, beside the slot, so the
 * project API surface never loads the unit-envelope closure (and its Camera /
 * Three dependency) for a route that only lists or opens projects.
 */
import { serializeProjectEnvelope, validateProjectEnvelope } from '@portfolio/project-model/units/validate';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { readSaveRequest, type SaveRequest } from '@portfolio/project-model/save';
import type { SessionStorageLike } from './project-persistence';

/**
 * The pending draft carries the whole `SaveAcceptedSource@1` request
 * (precondition, operation ID and canonical source), not a bare document: a
 * resumed save can never become an unconditioned write. `v1` entries are legacy
 * and read as invalid.
 */
export const PENDING_CLOUD_SAVE_KEY = 'museum:pending-cloud-save:v2';
export const LEGACY_PENDING_CLOUD_SAVE_KEY = 'museum:pending-cloud-save:v1';
export const PENDING_CLOUD_SAVE_MAX_AGE_MS = 15 * 60 * 1000;

export type PendingCloudSaveResult =
	| { status: 'missing' }
	| { status: 'invalid' | 'expired' }
	/** `project` keeps the `/` route's existing reader shape compatible. */
	| { status: 'ready'; project: ProjectEnvelope; save: SaveRequest };

/**
 * A draft pairs one capture with the exact document it will re-admit. The
 * envelope must name the capture's project **and** revision, and the bytes must
 * be the canonical encoding of that envelope: a draft that only happens to
 * parse is not the source the server will accept under this operation ID.
 */
function captureDescribesEnvelope(
	capture: SaveRequest['capture'],
	envelope: ProjectEnvelope
): boolean {
	if (envelope.id !== capture.projectId) return false;
	if (
		envelope.acceptedRevision.projectId !== capture.acceptedRevision.projectId ||
		envelope.acceptedRevision.revisionId !== capture.acceptedRevision.revisionId
	) {
		return false;
	}
	try {
		return serializeProjectEnvelope(envelope) === capture.canonicalJson;
	} catch {
		return false;
	}
}

export function writePendingCloudSave(
	save: SaveRequest,
	storage: SessionStorageLike | null = browserSessionStorage(),
	createdAt = Date.now()
): boolean {
	if (!storage || !Number.isFinite(createdAt)) return false;
	// The draft is a capture, not a document: validate the protocol shape and the
	// captured project before persisting, so a resumed save can only reach the
	// server with its precondition and operation ID intact.
	const parsed = readSaveRequest(save);
	if (parsed.kind === 'invalid') return false;
	let project: unknown;
	try {
		project = JSON.parse(parsed.request.capture.canonicalJson);
	} catch {
		return false;
	}
	const validation = validateProjectEnvelope(project);
	if (!validation.success) return false;
	// The draft pairs this capture with the document it names. A capture whose
	// project, revision or canonical bytes disagree with its own document would
	// resume a different write than the creator captured.
	if (!captureDescribesEnvelope(parsed.request.capture, validation.envelope)) return false;
	try {
		storage.setItem(PENDING_CLOUD_SAVE_KEY, JSON.stringify({ createdAt, save: parsed.request }));
		return true;
	} catch {
		return false;
	}
}

export function readPendingCloudSave(
	storage: SessionStorageLike | null = browserSessionStorage(),
	now = Date.now()
): PendingCloudSaveResult {
	if (!storage) return { status: 'missing' };
	const raw = storage.getItem(PENDING_CLOUD_SAVE_KEY);
	if (!raw) {
		// A v1 entry held only a document and cannot become a conditional Save.
		// Read it as invalid (and clear it) rather than pretending it is absent.
		if (storage.getItem(LEGACY_PENDING_CLOUD_SAVE_KEY) !== null) {
			safeRemove(storage, LEGACY_PENDING_CLOUD_SAVE_KEY);
			return { status: 'invalid' };
		}
		return { status: 'missing' };
	}
	try {
		const value: unknown = JSON.parse(raw);
		if (
			!isRecord(value) ||
			Object.keys(value).length !== 2 ||
			Object.keys(value).some((key) => !['createdAt', 'save'].includes(key))
		) {
			throw new Error('invalid handoff');
		}
		if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt) || value.createdAt > now) {
			throw new Error('invalid timestamp');
		}
		if (now - value.createdAt > PENDING_CLOUD_SAVE_MAX_AGE_MS) {
			storage.removeItem(PENDING_CLOUD_SAVE_KEY);
			return { status: 'expired' };
		}
		const parsed = readSaveRequest(value.save);
		if (parsed.kind === 'invalid') throw new Error('invalid capture');
		const validation = validateProjectEnvelope(JSON.parse(parsed.request.capture.canonicalJson));
		if (!validation.success) throw new Error('invalid envelope');
		// Same rule on the read side: the capture, its stamped revision and the
		// canonical document must describe one write, or the entry is invalid and
		// cleared rather than offered as a misleading resume.
		if (!captureDescribesEnvelope(parsed.request.capture, validation.envelope)) {
			throw new Error('capture mismatch');
		}
		return {
			status: 'ready',
			project: validation.envelope,
			save: parsed.request
		};
	} catch {
		safeRemove(storage, PENDING_CLOUD_SAVE_KEY);
		return { status: 'invalid' };
	}
}

export function clearPendingCloudSave(storage: SessionStorageLike | null = browserSessionStorage()): void {
	safeRemove(storage, PENDING_CLOUD_SAVE_KEY);
	safeRemove(storage, LEGACY_PENDING_CLOUD_SAVE_KEY);
}

function safeRemove(storage: SessionStorageLike | null, key: string): void {
	try {
		storage?.removeItem(key);
	} catch {
		// Best-effort cleanup; the slot is session-scoped and expires on read.
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function browserSessionStorage(): SessionStorageLike | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.sessionStorage;
	} catch {
		return null;
	}
}
