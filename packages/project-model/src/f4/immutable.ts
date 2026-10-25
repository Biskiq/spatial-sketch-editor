import { countWork } from '@portfolio/layout-core';

/** Capture owned data before it can cross an async boundary or be published. */
export function immutableF4Data<T>(input: T): T {
	countWork('f4:clone');
	return freezeF4Data(structuredClone(input));
}

/** Freeze data already owned by this boundary. Never freezes caller-owned data. */
export function freezeF4Data<T>(input: T): T {
	if (input !== null && typeof input === 'object' && !Object.isFrozen(input)) {
		countWork('f4:freeze-object');
		for (const value of Object.values(input)) freezeF4Data(value);
		Object.freeze(input);
	}
	return input;
}
