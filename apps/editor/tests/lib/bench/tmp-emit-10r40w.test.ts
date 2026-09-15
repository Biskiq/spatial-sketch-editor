import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';

import { p2311Fixture, P2311_FIXTURES } from '$lib/bench/p2311-bend-fixtures';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';

describe('temp fixture emit', () => {
	it('writes the 10 room / 40 wall layout for the smoke', () => {
		const spec = P2311_FIXTURES.find((entry) => entry.id === 'bend-10-room');
		if (!spec) throw new Error('missing fixture');
		const json = serializeWallFirstLayoutDocument(p2311Fixture(spec));
		writeFileSync(
			new URL('../../../static/p2311-10r40w.json', import.meta.url).pathname,
			json
		);
	});
});
