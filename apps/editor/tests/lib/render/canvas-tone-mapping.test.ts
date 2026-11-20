// @vitest-environment jsdom
/**
 * T2 Stage/Preview tone-mapping correction — what each product Canvas actually runs.
 *
 * T2 S0 Gate A accepted `NoToneMapping` at exposure 1.0 with sRGB output and an
 * `srgb-linear` working space. Threlte's `<Canvas>` assigns its own `AgXToneMapping`
 * default to whatever renderer `createRenderer` returns, so the Stage, the Visitor
 * Preview and the published visit all name the accepted value at the one host they
 * share.
 *
 * The factory check below reads the renderer the product constructs, which is the
 * same object Threlte then configures. The source checks hold the fix explicit, so
 * a future Threlte default change cannot make a correct runtime result pass by
 * accident.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { ColorManagement, LinearSRGBColorSpace, NoToneMapping, SRGBColorSpace } from 'three';

import {
	CANVAS_TONE_MAPPING,
	createProductRenderer,
	type RendererSurface
} from '$lib/render/renderer-backend';

/** The vitest root is `apps/editor`; the same read the other render guards use. */
function source(path: string): string {
	return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('the product renderer pipeline', () => {
	it.each(['stage', 'preview'] as const)(
		'runs NoToneMapping at exposure 1 with sRGB output on the %s surface',
		(surface: RendererSurface) => {
			const renderer = createProductRenderer(document.createElement('canvas'), 'auto', surface);
			expect(CANVAS_TONE_MAPPING).toBe(NoToneMapping);
			expect(renderer.toneMapping).toBe(NoToneMapping);
			expect(renderer.toneMappingExposure).toBe(1);
			expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
			expect(ColorManagement.enabled).toBe(true);
			expect(ColorManagement.workingColorSpace).toBe(LinearSRGBColorSpace);
		}
	);
});

/**
 * The runtime check above would also pass if Threlte one day changed its own
 * default, leaving the product's pipeline to a dependency. These hold the
 * decision where it belongs: one named constant, one host.
 */
describe('tone mapping is named, not inherited', () => {
	const CANVASES = [
		{
			name: 'Stage',
			path: 'src/lib/authoring/stage/shell/StageCanvas.svelte'
		},
		{
			name: 'Preview',
			path: 'src/lib/visitor/VisitorPreviewSurface.svelte'
		}
	] as const;

	it('defines the accepted value once, in the shared renderer module', () => {
		const file = source('src/lib/render/renderer-backend.ts');
		expect(file).toContain('export const CANVAS_TONE_MAPPING = NoToneMapping;');
	});

	it.each(CANVASES)('$name mounts the one Canvas host', ({ path }) => {
		expect(source(path)).toContain('<CanvasHost');
	});

	it('names the constant exactly once, in the host both surfaces share', () => {
		const host = source('src/lib/render/CanvasHost.svelte');
		expect(host).toMatch(
			/import \{[^}]*\bCANVAS_TONE_MAPPING\b[^}]*\} from '\.\/renderer-backend'/
		);
		expect(host).toContain('toneMapping={CANVAS_TONE_MAPPING}');
		expect(host.match(/\btoneMapping=/g) ?? []).toHaveLength(1);
	});
});
