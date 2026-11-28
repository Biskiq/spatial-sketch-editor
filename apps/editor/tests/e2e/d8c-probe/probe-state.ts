/** The browser-visible probe record the Playwright driver waits on. */
export type ProbeRecord = {
	status: 'booting' | 'preparing' | 'rendering' | 'ready' | 'failed';
	backend: string | null;
	generation: number | null;
	modelDrawn: boolean;
	frames: number;
	drawCalls: number | null;
	triangles: number | null;
	programs: number | null;
	textures: number | null;
	meshes: number | null;
	renderFrame: number | null;
	materials: unknown[];
	error: string | null;
	readyAt: number | null;
	scenario: Record<string, unknown> | null;
};

const KEY = '__D8C_PROBE__';

type WindowWithProbe = Window & { [KEY]?: ProbeRecord };

export const probe: ProbeRecord = (() => {
	const target = window as WindowWithProbe;
	target[KEY] ??= {
		status: 'booting',
		backend: null,
		generation: null,
		modelDrawn: false,
		frames: 0,
		drawCalls: null,
		triangles: null,
		programs: null,
		textures: null,
		meshes: null,
		renderFrame: null,
		materials: [],
		error: null,
		readyAt: null,
		scenario: null
	};
	return target[KEY]!;
})();

let settleUntil = 0;

export function markModelDrawn(): void {
	probe.modelDrawn = true;
	settleUntil = performance.now() + 650;
}

export function markFrame(): void {
	if (probe.status === 'failed') return;
	probe.frames += 1;
	if (
		probe.status !== 'ready' &&
		probe.backend !== null &&
		probe.modelDrawn &&
		probe.frames > 0 &&
		performance.now() >= settleUntil
	) {
		probe.status = 'ready';
		probe.readyAt = performance.now();
	}
}

export function markFailed(message: string): void {
	if (probe.status === 'ready') return;
	probe.status = 'failed';
	probe.error = message;
}

window.addEventListener('error', (event) => markFailed(event.message));
window.addEventListener('unhandledrejection', (event) => {
	const reason = event.reason;
	markFailed(reason instanceof Error ? reason.message : String(reason));
});
