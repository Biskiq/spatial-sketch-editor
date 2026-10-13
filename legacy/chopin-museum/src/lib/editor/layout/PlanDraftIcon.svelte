<!-- P23.13 S9 — repo drafting icons (Designer-D family, verbatim paths).
     Editor-only asset: imported only by LayoutDraftToolbar, never by visitor
     chunks. Under the 2026-09-17 owner ruling the five kept originals (Wall,
     Rect Room, Poly Room, Door, Window) stay on their lucide marks — this
     component carries every other toolbar drafting mark, so the Door 3-dash /
     Window-parallel redesigns are not adopted. All glyphs are native 20×20,
     1.5 px optical stroke, square corners, butt ends. -->
<script lang="ts">
	let {
		name,
		size = 14
	}: {
		name:
			| 'select'
			| 'column-preset'
			| 'platform-preset'
			| 'plinth-preset'
			| 'snap'
			| 'grid';
		size?: number;
	} = $props();

	const PATHS = {
		select: 'M5 3L17 12H11L8 18Z',
		'column-preset': 'M10 3A7 7 0 1 0 10 17A7 7 0 1 0 10 3Z',
		'platform-preset': 'M2 6H18V14H2ZM5 10H15',
		'plinth-preset': 'M4 4H16V16H4ZM7 7H13V13H7Z',
		snap: 'M4 4V11A6 6 0 0 0 16 11V4M4 7H7M13 7H16',
		grid: 'M3 3H17V17H3ZM3 8H17M3 13H17M8 3V17M13 3V17'
	} as const;
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 20 20"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linejoin="miter"
	stroke-linecap="butt"
	aria-hidden="true"
	style="vertical-align: -2px;"
><path d={PATHS[name]} /></svg>
