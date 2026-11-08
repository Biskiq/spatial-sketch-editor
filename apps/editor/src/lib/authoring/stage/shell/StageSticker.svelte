<script lang="ts">
	import { STAGE_ARROW_GLYPH, STAGE_MOVE_GLYPH } from '../stage-glyphs';

	type Point = readonly [number, number];
	let {
		kind, at, angle = 0, scale = 1, flip = false, emphasised = false, held = false, stem = null
	}: {
		kind: 'move' | 'curved' | 'two' | 'hex' | 'hexSmall' | 'arrow' | 'point' | 'corner';
		at: Point;
		angle?: number;
		scale?: number;
		flip?: boolean;
		emphasised?: boolean;
		held?: boolean;
		stem?: Point | null;
	} = $props();
	/** The sticker glyph set. Each path is drawn about its own origin. */
	const GLYPH = {
		/** A chunky arrow, tail at the origin, pointing +x. */
		arrow: STAGE_ARROW_GLYPH,
		/** A two-way arrow centred on the origin. */
		two: 'M-15.5,0 L-7.5,-6.8 V-2.7 H7.5 V-6.8 L15.5,0 L7.5,6.8 V2.7 H-7.5 V6.8 Z',
		/** The four-way move cross. */
		move: STAGE_MOVE_GLYPH,
		hex: hexPath(7),
		hexSmall: hexPath(5.6),
		curved: curvedArrowPath()
	} as const;

	function hexPath(radius: number): string {
		return `M${[0, 1, 2, 3, 4, 5].map((k) => {
			const angle = ((k * 60 - 90) * Math.PI) / 180;
			return `${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`;
		}).join('L')}Z`;
	}

	/** One curved two-way arrow; its middle sits at the origin with tangent +x and it bends toward +y. */
	function curvedArrowPath(): string {
		const R = 21, half = 36, width = 5.4, flare = 3.8, head = 17, rad = Math.PI / 180;
		const at = (rho: number, angle: number) => `${(rho * Math.cos(angle * rad)).toFixed(2)},${(R + rho * Math.sin(angle * rad)).toFixed(2)}`;
		const a0 = -90 - half, a1 = -90 + half;
		const points = [at(R, a0 - head), at(R + width / 2 + flare, a0)];
		for (let angle = a0; angle <= a1 + 0.01; angle += 6) points.push(at(R + width / 2, angle));
		points.push(at(R + width / 2 + flare, a1), at(R, a1 + head), at(R - width / 2 - flare, a1));
		for (let angle = a1; angle >= a0 - 0.01; angle -= 6) points.push(at(R - width / 2, angle));
		points.push(at(R - width / 2 - flare, a0));
		return `M${points.join('L')}Z`;
	}

	function glyphTransform(at: readonly [number, number], angle: number): string {
		return `translate(${at[0]} ${at[1]}) rotate(${angle.toFixed(1)})`;
	}

	/**
	 * A glyph's path at a size: the coordinates themselves are scaled (absolute
	 * M/L/H/V only), so no SVG transform ever scales anything on the Stage.
	 * Emphasis (hover/held) grows the glyph by 15 %.
	 */
	function sized(d: string, emphasised: boolean, sx = 1, sy = sx): string {
		const k = emphasised ? 1.15 : 1;
		let command = '';
		let index = 0;
		return d.replace(/([MLHVZ])|(-?\d*\.?\d+)/g, (_match, letter: string | undefined, number: string | undefined) => {
			if (letter !== undefined) {
				command = letter;
				index = 0;
				return letter;
			}
			const factor = command === 'H' ? sx : command === 'V' ? sy : index++ % 2 === 0 ? sx : sy;
			return String(Number((Number(number) * factor * k).toFixed(2)));
		});
	}

</script>

{#if stem}
	<line class="stem" x1={stem[0]} y1={stem[1]} x2={at[0]} y2={at[1]} />
{/if}
{#if kind === 'point'}
	<circle class="glyph knob" class:held cx={at[0]} cy={at[1]} r={emphasised ? 6.4 : 5.4} />
{:else if kind === 'corner'}
	{@const radius = emphasised ? 5.2 : 4.5}
	<rect class="glyph" class:held x={at[0] - radius} y={at[1] - radius} width={radius * 2} height={radius * 2} rx="2.2" />
{:else}
	<path class="glyph" class:held d={sized(GLYPH[kind], emphasised, scale, flip ? -scale : scale)} transform={glyphTransform(at, angle)} />
{/if}

<style>
	.glyph {
		fill: var(--shell-white);
		stroke: var(--shell-ink);
		stroke-width: 1.1;
		stroke-linejoin: round;
		filter: drop-shadow(0 1.2px 1.3px rgba(20,24,20,.3));
		pointer-events: none;
	}
	.glyph.held { fill: var(--shell-gold-tint); }
	.stem {
		stroke: var(--shell-ink);
		stroke-width: 1.5;
		stroke-linecap: round;
		filter: drop-shadow(0 0 .7px rgba(255,255,255,.95));
		pointer-events: none;
	}
</style>
