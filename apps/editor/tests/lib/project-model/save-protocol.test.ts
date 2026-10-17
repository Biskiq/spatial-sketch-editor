/**
 * `SaveAcceptedSource@1` protocol conformance (T3.P01.S02).
 *
 * The golden digest is the scheme pin: if the single content-identity export
 * changes its canonical bytes, this test fails until the scheme constant is
 * bumped. That is deliberate — a silent canonicalization change would turn every
 * Save into a false conflict or a false match (R8).
 */
import { describe, expect, it } from 'vitest';

import {
	canonicalSourceJson,
	createEmptyWallFirstProject,
	sourceContentIdForCanonicalJson
} from '@portfolio/project-model';
import {
	SAVE_ACCEPTED_SOURCE_VERSION,
	SAVE_CONTENT_IDENTITY_SCHEME,
	createSavedBaseToken,
	fullSourceHash,
	isSavedBaseToken,
	readSaveRequest,
	samePrecondition,
	type SaveRequest
} from '@portfolio/project-model/save';

const GOLDEN_DIGEST = 'sha256-794ff6c9722991377649dbf15cfe4ea9624d446f3d28f32321ac24d2bd47255d';
const GOLDEN_FULL_SOURCE_HASH = 'sha256-9a203a106501d88044887db0aa4a323f77cfb5c498592824f7b116cd73c894b7';

async function request(): Promise<SaveRequest> {
	const project = createEmptyWallFirstProject({ id: 'project:save-golden', name: 'Save golden' });
	const canonical = canonicalSourceJson(project);
	if (canonical.kind === 'rejected') throw new Error('fixture was not canonical');
	return {
		contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME,
		capture: {
			protocol: SAVE_ACCEPTED_SOURCE_VERSION,
			projectId: project.id,
			operationId: 'operation-1',
			precondition: { kind: 'create-only' },
			sourceKind: 'current-source',
			sourceVersion: 5,
			acceptedRevision: { projectId: project.id, revisionId: 'revision-1' },
			sourceContentId: await sourceContentIdForCanonicalJson(canonical.canonicalJson),
			canonicalJson: canonical.canonicalJson
		}
	};
}

describe('SaveAcceptedSource@1', () => {
	it('pins the content-identity scheme to the landed digest and full-source hash', async () => {
		const { capture } = await request();
		expect(SAVE_CONTENT_IDENTITY_SCHEME).toBe('project-model/canonical-authored-json@1');
		expect(capture.sourceContentId).toBe(GOLDEN_DIGEST);
		expect(await fullSourceHash(capture.canonicalJson)).toBe(GOLDEN_FULL_SOURCE_HASH);
	});

	it('reads the exact capture and transport scheme', async () => {
		const input = await request();
		const parsed = readSaveRequest(input);
		expect(parsed.kind).toBe('valid');
		if (parsed.kind !== 'valid') throw new Error('expected valid');
		expect(parsed.request).toEqual(input);
	});

	it('rejects unknown keys, a bad protocol, namespace mismatch and malformed tokens', async () => {
		const input = await request();
		const cases: unknown[] = [
			{ ...input, extra: true },
			{
				...input,
				capture: { ...input.capture, protocol: 'SaveAcceptedSource@2' }
			},
			{
				...input,
				capture: { ...input.capture, acceptedRevision: { projectId: 'project:other', revisionId: 'revision-1' } }
			},
			{
				...input,
				capture: { ...input.capture, precondition: { kind: 'create-only', token: 'saved-base:whatever' } }
			},
			{
				...input,
				capture: { ...input.capture, precondition: { kind: 'expected-saved-base', token: 'not-a-token' } }
			},
			{
				...input,
				capture: { ...input.capture, operationId: 'has whitespace' }
			},
			{
				...input,
				capture: { ...input.capture, sourceContentId: 'sha256-nope' }
			},
			{
				...input,
				capture: { ...input.capture, canonicalJson: '' }
			},
			{
				...input,
				capture: { ...input.capture, sourceVersion: 0 }
			}
		];
		for (const candidate of cases) {
			expect(readSaveRequest(candidate).kind, JSON.stringify(candidate)).toBe('invalid');
		}
	});

	it('keeps the create-only and expected-saved-base conditions distinct', () => {
		expect(samePrecondition({ kind: 'create-only' }, { kind: 'create-only' })).toBe(true);
		expect(
			samePrecondition(
				{ kind: 'expected-saved-base', token: 'saved-base:11111111-1111-4111-8111-111111111111' },
				{ kind: 'expected-saved-base', token: 'saved-base:11111111-1111-4111-8111-111111111111' }
			)
		).toBe(true);
		expect(
			samePrecondition(
				{ kind: 'expected-saved-base', token: 'saved-base:11111111-1111-4111-8111-111111111111' },
				{ kind: 'expected-saved-base', token: 'saved-base:22222222-2222-4222-8222-222222222222' }
			)
		).toBe(false);
		expect(samePrecondition({ kind: 'create-only' }, { kind: 'expected-saved-base', token: 'saved-base:11111111-1111-4111-8111-111111111111' })).toBe(false);
	});

	it('mints a durable saved-base token that is not a revision or SQL version', () => {
		const token = createSavedBaseToken(() => '11111111-1111-4111-8111-111111111111');
		expect(token).toBe('saved-base:11111111-1111-4111-8111-111111111111');
		expect(isSavedBaseToken(token)).toBe(true);
		expect(isSavedBaseToken('1')).toBe(false);
	});
});
