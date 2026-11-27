// @vitest-environment jsdom
/**
 * The entry route's sign-in return is its own recovery surface.
 *
 * A pending Save that outlives the redirect is validated there, not only on the
 * Stage, so the notice must name the unit and stamp the capture actually carries
 * rather than assuming Layout. The capture itself must survive the visit.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { UNIT_ENVELOPE_FORMAT_VERSION } from '@portfolio/project-model/units';
import {
	SAVE_ACCEPTED_SOURCE_VERSION,
	SAVE_CONTENT_IDENTITY_SCHEME
} from '@portfolio/project-model/save';
import { PENDING_CLOUD_SAVE_KEY } from '$lib/platform/project-pending-save';
import { page } from '../authoring/fixtures/app-state';
import Page from '../../../src/routes/+page.svelte';

const PROJECT_ID = 'project-1';
const REVISION_ID = 'revision-1';

/** A shape-valid pending capture stamped under the previous Scene format. */
function sceneTwelveCapture(): string {
	const canonicalJson = `${JSON.stringify(
		{
			formatVersion: UNIT_ENVELOPE_FORMAT_VERSION,
			id: PROJECT_ID,
			acceptedRevision: { projectId: PROJECT_ID, revisionId: REVISION_ID },
			units: {
				scene: {
					header: { domain: 'scene', formatVersion: 12 },
					data: { formatVersion: 12 }
				}
			}
		},
		null,
		2
	)}\n`;
	return JSON.stringify(
		{
			createdAt: Date.now(),
			save: {
				contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME,
				capture: {
					protocol: SAVE_ACCEPTED_SOURCE_VERSION,
					projectId: PROJECT_ID,
					operationId: 'op-scene-12',
					precondition: { kind: 'create-only' },
					sourceKind: 'unit-project',
					sourceVersion: 1,
					acceptedRevision: { projectId: PROJECT_ID, revisionId: REVISION_ID },
					sourceContentId: `sha256-${'0'.repeat(64)}`,
					canonicalJson
				}
			}
		},
		null,
		2
	);
}

describe('entry route — incompatible pending Save on sign-in return', () => {
	beforeEach(() => {
		sessionStorage.clear();
		page.url = new URL('http://localhost/?auth=success&intent=save');
	});

	afterEach(() => {
		sessionStorage.clear();
		page.url = new URL('http://localhost/project/project-1/spatial');
	});

	it('names the detected unit and stamp and keeps the exact capture', async () => {
		const raw = sceneTwelveCapture();
		sessionStorage.setItem(PENDING_CLOUD_SAVE_KEY, raw);
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(Page, { target });
		try {
			let alert: Element | null = null;
			for (let attempt = 0; attempt < 20 && alert === null; attempt += 1) {
				await new Promise((resolve) => setTimeout(resolve, 0));
				await tick();
				alert = target.querySelector('[role="alert"]');
			}
			expect(alert).not.toBeNull();
			const text = alert?.textContent ?? '';
			expect(text).toContain('scene');
			expect(text).toContain('12');
			expect(text).not.toContain('Layout');
			expect(sessionStorage.getItem(PENDING_CLOUD_SAVE_KEY)).toBe(raw);
		} finally {
			await unmount(component);
			target.remove();
		}
	});
});
