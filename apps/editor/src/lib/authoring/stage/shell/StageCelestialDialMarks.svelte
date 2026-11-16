<script lang="ts">
	import type { Vec3, ViewportEvaluation } from '@portfolio/camera-core';
	import { skyKind } from '$lib/render/sky-time';
	import { dialStagePoint, type CelestialDialModel } from '../../look/celestial-dial';
	import { skyGlyph } from '../../environment/sky-glyphs';

	let { dial, camera, haze, owner }: {
		dial: CelestialDialModel;
		camera: ViewportEvaluation;
		haze: number;
		owner: string | null;
	} = $props();

	const project = (point: Vec3) => dialStagePoint(point, camera);
	const glyph = $derived(project(dial.glyph));
	const shadow = $derived(dial.shadow ? project(dial.shadow) : null);
	const noon = $derived(project(dial.noon));
	const anchor = $derived(project(dial.placement.anchor));
	const origin = $derived(project(dial.placement.origin));
	const tagAt = $derived(owner === 'dial-heading' ? noon : owner === 'dial-time' ? glyph : null);
	const tag = $derived(owner === 'dial-heading' ? dial.noonTag : dial.tag);
</script>

<g aria-hidden="true" data-celestial-dial fill={dial.ink}>
	{#if anchor && origin && (anchor[0] !== origin[0] || anchor[1] !== origin[1])}
		<path d={`M${origin[0]} ${origin[1]} L${anchor[0]} ${anchor[1]}`} stroke={dial.ink} stroke-dasharray="2 4" />
		<circle cx={origin[0]} cy={origin[1]} r="3" />
	{/if}
	{#each dial.labels as label (label.text)}
		{@const point = project(label.point)}
		{#if point}
			<text x={point[0]} y={point[1] + 16} text-anchor="middle">{camera.rect.width < 360 && dial.body.body !== 'none' ? label.text.slice(0, 5) : label.text}</text>
		{/if}
	{/each}
	{#if glyph}
		{@html skyGlyph(glyph[0], glyph[1], dial.body.body === 'moon' ? 11 : 10, skyKind(dial.body, haze))}
		{#if owner === 'dial-time'}<circle cx={glyph[0]} cy={glyph[1]} r="17" fill="none" stroke="#f5b400" />{/if}
	{/if}
	{#if shadow}<circle cx={shadow[0]} cy={shadow[1]} r="4" fill="#fbfaf6" stroke={dial.ink} />{/if}
	{#if noon}
		<rect x={noon[0] - 4} y={noon[1] - 4} width="8" height="8" transform={`rotate(45 ${noon[0]} ${noon[1]})`}
			fill={owner === 'dial-heading' ? '#f5b400' : dial.ink} />
	{/if}
	{#if tagAt}
		<g transform={`translate(${tagAt[0]} ${tagAt[1] - 32})`}>
			<rect x={-tag.length * 3.5} width={tag.length * 7} height="20" rx="4" fill="#263e31" />
			<text y="14" text-anchor="middle" fill="#fff">{tag}</text>
		</g>
	{/if}
</g>

<style>
	text { font: 11px var(--shell-mono); paint-order: stroke; stroke: rgb(128 128 128 / 0.2); stroke-width: 1px; }
</style>
