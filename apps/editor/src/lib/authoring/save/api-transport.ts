/**
 * Platform adapter for the framework-free Save state: maps the client API's
 * typed errors onto the state machine's transport cases. Editor-only, and still
 * free of Svelte/host/route imports.
 */

import { ProjectPersistenceError, type ProjectApi } from '$lib/platform/project-persistence';
import type { SaveRefusalCode } from '@portfolio/project-model/save';

import type { SaveTransport, SaveTransportResult } from './save-state';

const REFUSAL_CODES: readonly SaveRefusalCode[] = [
	'unconditioned-body',
	'invalid-save-request',
	'identity-scheme-mismatch',
	'source-version-mismatch',
	'content-identity-mismatch',
	'revision-reuse',
	'retry-payload-mismatch',
	'conflict',
	'collision',
	'not-found',
	'invalid-project'
];

export function createApiSaveTransport(api: ProjectApi): SaveTransport {
	return async (request, signal): Promise<SaveTransportResult> => {
		try {
			return { kind: 'saved', acknowledgement: await api.saveAcceptedSource(request, signal) };
		} catch (failure) {
			if (!(failure instanceof ProjectPersistenceError)) {
				return {
					kind: 'error',
					message: failure instanceof Error ? failure.message : 'Save failed',
					retryable: false
				};
			}
			switch (failure.code) {
				case 'auth':
					return { kind: 'auth-required' };
				case 'conflict':
					return { kind: 'conflict' };
				case 'collision':
					return { kind: 'refused', code: 'collision', message: failure.message };
				case 'not-found':
					return { kind: 'refused', code: 'not-found', message: failure.message };
				case 'network':
				case 'server':
					return { kind: 'error', message: failure.message, retryable: true };
				default: {
					const code = REFUSAL_CODES.find((candidate) => candidate === failure.serverCode) ?? 'invalid';
					return { kind: 'refused', code, message: failure.message, issues: failure.issues };
				}
			}
		}
	};
}
