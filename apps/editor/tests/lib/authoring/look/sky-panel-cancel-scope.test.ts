import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const panel = readFileSync(
	fileURLToPath(new URL('../../../../src/lib/authoring/environment/SkyPanel.svelte', import.meta.url)),
	'utf8'
);

// Pressing one Sky control begins its gesture before focus leaves the previous
// control. An unscoped blur would cancel the new gesture, and the next Esc would
// close the panel instead of cancelling the drag (browser QA, 2026-11-16).
it('ends only the Sky gesture the blurred or cancelled control owns', () => {
	expect(panel).not.toMatch(/on(blur|pointercancel)=\{cancel\}/);
	for (const owner of ['label', "'time'", "'heading'"]) {
		expect(panel).toContain(`onblur={() => cancelOwn(${owner})}`);
	}
	expect(panel).toContain('if (gesture.owner === owner) cancel();');
});
