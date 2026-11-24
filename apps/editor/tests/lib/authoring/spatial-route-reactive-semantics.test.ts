// @vitest-environment jsdom
import { mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { computeEnvelopeSourceContentId, type ProjectEnvelope } from '@portfolio/project-model/units';
import { interiorLift } from '$lib/authoring/layout/interior-lift-store.svelte';
import { resolvedCutawayNow } from '$lib/authoring/stage/cutaway/cutaway-resolved';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import { sliceReading } from '$lib/authoring/stage/slice/slice-reading.svelte';
import { resolvedSliceNow } from '$lib/authoring/stage/slice/slice-resolved';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { resetReloadOffer, setReloadOffer } from './fixtures/reload-offer';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

const harness = vi.hoisted(() => ({ document: null as ProjectEnvelope | null }));
vi.mock('$lib/authoring/stage/shell/EditorHead.svelte', async () => ({
	default: (await import('./fixtures/HeadProbe.svelte')).default
}));
vi.mock('$lib/authoring/stage/shell/StageCanvas.svelte', async () => ({
	default: (await import('./fixtures/StageCanvasProbe.svelte')).default
}));
vi.mock('$lib/platform/project-persistence', async (original) => {
	const actual = await original<typeof import('$lib/platform/project-persistence')>();
	return {
		...actual,
		createProjectAuth: () => ({
			getSession: async () => ({ authenticated: false }),
			signIn() {},
			async signOut() {}
		}),
		createProjectApi: () => ({
			async loadProject() {
				const source = harness.document;
				if (source === null) throw new Error('Expected a project fixture');
				return {
					document: source,
					savedBaseToken: 'base',
					savedRevision: source.acceptedRevision,
					savedSourceContentId: await computeEnvelopeSourceContentId(source)
				};
			}
		})
	};
});

let component: ReturnType<typeof mount> | null;
let target: HTMLElement;

async function click(selector: string) {
	const button = target.querySelector<HTMLButtonElement>(selector);
	if (button === null) throw new Error(`Missing button ${selector}`);
	button.click();
	await tick();
	return button;
}

beforeEach(async () => {
	vi.stubGlobal('requestAnimationFrame', () => 1);
	vi.stubGlobal('cancelAnimationFrame', () => {});
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query.includes('prefers-reduced-motion'),
		addEventListener() {},
		removeEventListener() {}
	}));
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
		new DOMRect(0, 0, 960, 720)
	);
	harness.document = await createUnitProject({
		id: 'project-1', name: 'Mounted project', layout: buildStarterEnclosureLayout()
	});
	target = document.createElement('div');
	document.body.append(target);
	component = mount(Page, { target });
	await vi.waitFor(() => expect(target.querySelector('[data-testid="stage-canvas"]')).not.toBeNull());
});

afterEach(async () => {
	if (component !== null) await unmount(component);
	component = null;
	target.remove();
	resetReloadOffer();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('clears Slice and nulls its mirror when leaving World', async () => {
	sliceReading.level();
	await tick();
	expect(sliceReading.isActive()).toBe(true);
	expect(resolvedSliceNow()).not.toBeNull();
	const experience = await click('[data-testid="lens-experience"]');
	expect(experience.getAttribute('aria-pressed')).toBe('true');
	expect(sliceReading.isActive()).toBe(false);
	expect(resolvedSliceNow()).toBeNull();
});

async function activateReadings() {
	await click('[data-reading-more]');
	await click('[data-reading-lift]');
	sliceReading.level();
	await tick();
	expect(interiorLift.reading).not.toBeNull();
	expect(sliceReading.reading).not.toBeNull();
	expect(resolvedSliceNow()).not.toBeNull();
}

it('keeps the active Lift and its scope through a lens round trip', async () => {
	await click('[data-reading-more]');
	await click('[data-reading-lift]');
	const reading = interiorLift.reading;
	expect(reading).not.toBeNull();
	const experience = await click('[data-testid="lens-experience"]');
	expect(experience.getAttribute('aria-pressed')).toBe('true');
	expect(interiorLift.reading).toBe(reading);
	expect(target.querySelector('[data-lift-pill]')).not.toBeNull();
	const world = await click('[data-testid="lens-world"]');
	expect(world.getAttribute('aria-pressed')).toBe('true');
	expect(interiorLift.reading).toBe(reading);
});

it('clears Lift, Slice and the resolved reading mirrors on an admitted replacement', async () => {
	await activateReadings();
	const replacement = await createUnitProject({ id: 'project-1', name: 'Replacement project' });
	setReloadOffer({
		kind: 'reload',
		projectId: 'project-1',
		document: replacement,
		savedRevision: replacement.acceptedRevision,
		savedBaseToken: 'replacement-base',
		savedSourceContentId: await computeEnvelopeSourceContentId(replacement)
	});
	const reload = [...target.querySelectorAll('button')].find((button) => button.textContent === 'Reload remote');
	if (reload === undefined) throw new Error('Expected the Head reload control');
	reload.click();
	await vi.waitFor(() => expect(target.querySelector('[data-testid="head"]')?.getAttribute('data-project')).toBe('Replacement project'));
	expect(interiorLift.reading).toBeNull();
	expect(sliceReading.reading).toBeNull();
	expect(resolvedSliceNow()).toBeNull();
	expect(resolvedCutawayNow()).toBeNull();
});

it('clears Lift, Slice and the resolved reading mirrors on project teardown', async () => {
	await activateReadings();
	if (component === null) throw new Error('Expected a mounted route');
	await unmount(component);
	component = null;
	expect(interiorLift.reading).toBeNull();
	expect(sliceReading.reading).toBeNull();
	expect(resolvedSliceNow()).toBeNull();
	expect(resolvedCutawayNow()).toBeNull();
});
