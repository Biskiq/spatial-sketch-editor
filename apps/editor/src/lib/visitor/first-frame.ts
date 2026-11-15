/**
 * First rendered frame, observed once per surface entry.
 *
 * The product already has `visitor:mounted` (the component mounted) and
 * `visitor:entry-frame` (two scheduling opportunities after an active run
 * starts). Neither observes a renderer frame: a mount can precede the first
 * draw, and a rAF is a scheduling opportunity, not proof that the surface drew.
 *
 * This observer watches `renderer.info.render.frame`. The callback runs at the
 * next frame opportunity after that counter has advanced, which is the
 * earliest point the browser could have presented the draw. It is still a
 * scheduling proxy — physical scanout is not observable here — and callers must
 * label it as such.
 *
 * The helper is scheduler-injected so the unit test can drive it without rAF,
 * timers or a WebGL context.
 */

export type RenderedFrameSource = {
	readonly info: { readonly render: { readonly frame: number } };
};

export type FirstRenderedFrameObserver = {
	/** Stop observing; a pending callback never runs after this. */
	cancel(): void;
};

export function observeFirstRenderedFrame(input: {
	readonly source: RenderedFrameSource;
	readonly onFrame: (renderFrame: number) => void;
	readonly requestFrame: (callback: () => void) => number;
	readonly cancelFrame: (handle: number) => void;
	/** A bounded wait: a surface that never draws must not poll forever. */
	readonly maxFrames?: number;
}): FirstRenderedFrameObserver {
	const baseline = input.source.info.render.frame;
	const maxFrames = input.maxFrames ?? 120;
	let done = false;
	let attempts = 0;
	let handle: number | null = null;

	const tick = (): void => {
		if (done) return;
		handle = null;
		const frame = input.source.info.render.frame;
		if (frame > baseline) {
			done = true;
			input.onFrame(frame);
			return;
		}
		attempts += 1;
		if (attempts >= maxFrames) {
			done = true;
			return;
		}
		handle = input.requestFrame(tick);
	};

	handle = input.requestFrame(tick);

	return {
		cancel() {
			if (done) return;
			done = true;
			if (handle !== null) input.cancelFrame(handle);
			handle = null;
		}
	};
}
