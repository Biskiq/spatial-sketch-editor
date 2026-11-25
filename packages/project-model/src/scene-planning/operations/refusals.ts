import { type SceneOperationRefusalCode, type SceneOperationRefusal } from './types';

export function unsupportedTransform(entityId: string, operation: string): SceneOperationRefusal {
	return refusal(
		'unsupported-transform',
		`Entity "${entityId}" is not a truthful upright floor object, so ${operation} cannot own its transform.`,
		[entityId]
	);
}

export function invalidFrame(): SceneOperationRefusal {
	return refusal(
		'invalid-value',
		'The operation needs a finite yaw-only input frame and a finite yaw.',
		['frame', 'yaw']
	);
}

export function nonFinitePoint(): SceneOperationRefusal {
	return refusal(
		'invalid-value',
		'The destination X/Z (or its composed world point) is not finite.',
		['worldXZ']
	);
}

export function invalid(message: string, diagnostics: readonly string[]): SceneOperationRefusal {
	return refusal('invalid-value', message, diagnostics);
}

export function refusal(
	code: SceneOperationRefusalCode,
	message: string,
	diagnostics: readonly string[]
): SceneOperationRefusal {
	return {
		kind: 'rejected',
		code,
		message,
		diagnostics: diagnostics.map((entry) => ({
			path: '$.payload',
			code: 'operation-refusal',
			message: entry
		}))
	};
}
