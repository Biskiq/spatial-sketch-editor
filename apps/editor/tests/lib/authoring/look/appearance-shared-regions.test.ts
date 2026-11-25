// @vitest-environment jsdom
/**
 * The Appearance issues drawer is a shared region: it mounts in every workspace
 * while the editor is in ordinary editing and must not draw over Preview.
 *
 * The host supplies `previewing`; the component owns the mount condition. The
 * regression this pins is the inverted host argument: `preview === null` made
 * the drawer visible only while Preview was open.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AppearanceSharedRegions from '$lib/authoring/look/AppearanceSharedRegions.svelte';
import { EDITOR_ROOT } from '../../../helpers/import-closure';

let host: HTMLElement | null = null;
let component: ReturnType<typeof mount> | null = null;

function render(previewing: boolean): void {
	host = document.createElement('div');
	document.body.append(host);
	component = mount(AppearanceSharedRegions, {
		target: host,
		props: { previewing, repair: { open: true } }
	});
	flushSync();
}

afterEach(() => {
	if (component !== null) unmount(component);
	host?.remove();
	host = null;
	component = null;
});

describe('Appearance shared regions', () => {
	it('mounts the repair drawer during ordinary editing', () => {
		render(false);
		expect(host?.querySelector('[data-repair-drawer]')).not.toBeNull();
	});

	it('keeps the repair drawer out of Preview', () => {
		render(true);
		expect(host?.querySelector('[data-repair-drawer]')).toBeNull();
	});

	it('is wired to the Preview state, not to the absence of a preview', () => {
		const source = readFileSync(
			join(EDITOR_ROOT, 'src/lib/authoring/workspace/host/WorkspaceHost.svelte'),
			'utf8'
		);
		expect(source).toContain('<AppearanceSharedRegions previewing={preview !== null}');
	});
});
