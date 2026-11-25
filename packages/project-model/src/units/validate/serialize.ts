import { countWork } from '@portfolio/layout-core/kernel';
import { type ProjectEnvelope } from '../types';
import { validateProjectEnvelope } from './envelope';

/** Serialize a validated envelope in its canonical field order. */
export function serializeProjectEnvelope(envelope: ProjectEnvelope): string {
	countWork('envelope:serialize');
	const result = validateProjectEnvelope(envelope);
	if (!result.success) {
		const first = result.issues[0]!;
		throw new Error(`${first.path} (${first.code}): ${first.message}`);
	}
	return serializeValidatedProjectEnvelope(result.envelope);
}

/**
 * The serialization half, for a caller holding a value this module already
 * validated.
 *
 * `serializeProjectEnvelope` validates because any caller may hand it a value
 * straight from the network; an admission path that just validated the same
 * envelope would otherwise validate it again purely to serialize it. Passing the
 * **validated** envelope — the value the check returned, not the raw input — is
 * what proves the check happened, exactly as with `prepareValidatedUnitRuntime`.
 */
export function serializeValidatedProjectEnvelope(envelope: ProjectEnvelope): string {
	countWork('envelope:serialize-validated');
	const json = JSON.stringify(envelope, null, 2) + '\n';
	countWork('envelope:serialized-utf16', json.length);
	return json;
}
