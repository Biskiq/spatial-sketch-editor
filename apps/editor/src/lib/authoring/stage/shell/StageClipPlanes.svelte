<script lang="ts">
	/**
	 * Applies the live Slice reading to the Canvas's one clip, **and asks for a frame**.
	 *
	 * It lives inside the Stage Canvas because `invalidate` is the renderer's. The Slice ink
	 * layer also applies nothing — it only draws — so this is the single writer, and it
	 * stays mounted even when the ink is unmounted (Look Through) or the Slice ends.
	 * That is the bug this exists for: Put back under Look Through left the last frame
	 * on screen, because nothing requested a redraw after the planes changed.
	 */
	import { useThrelte } from '@threlte/core';
	import type { ResolvedSlice } from '../slice/slice-cut';
	import type { StageClip } from '../slice/stage-clip';

	type Props = {
		clip: StageClip;
		reading?: ResolvedSlice | null;
	};
	let { clip, reading = null }: Props = $props();

	const { invalidate } = useThrelte();

	$effect(() => {
		clip.apply(reading ?? null);
		invalidate();
	});
</script>

{@html ''}
