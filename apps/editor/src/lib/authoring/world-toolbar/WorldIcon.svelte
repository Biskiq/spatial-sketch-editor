<script lang="ts">
	/**
	 * The prototype's 16px line set, verbatim where the donor has a glyph.
	 *
	 * The icons are presentation only; the toolbar registry names them and the
	 * controllers still own every action.
	 */
	let { name = 'select', size = 24 }: { name: string; size?: number } = $props();

	const paths: Record<string, string> = {
		select: '<path d="m4 2.8 7.6 9.2-4.6.5-2.5 4.2z"/>',
		'fam-build': '<path d="M2 9.2 8 3l6 6.2"/><path d="M3.4 8.2V14h9.2V8.2"/><path d="M6.2 14v-3.8h3.6V14"/>',
		'fam-form': '<path d="M2.4 14V7.2a5.6 5.6 0 0 1 11.2 0V14"/><path d="M5.5 14V8.2a2.5 2.5 0 0 1 5 0V14"/><path d="M2.4 14h11.2"/>',
		'fam-land': '<path d="m1.5 12.8 4.1-5.2 2.5 2.7 2.6-3.3 3.8 5.8z"/><path d="M3.1 14h9.8"/><path d="M11.1 6.2V2.9"/>',
		'fam-furnish': '<path d="M3.2 8.2V6.3a1.4 1.4 0 0 1 1.4-1.4h6.8a1.4 1.4 0 0 1 1.4 1.4v1.9"/><path d="M2.2 8.1a1.2 1.2 0 0 1 2.4 0v2h6.8v-2a1.2 1.2 0 0 1 2.4 0v4.1H2.2z"/><path d="M3.5 12.2V14M12.5 12.2V14"/>',
		paint: '<path d="m11.7 2.1 2.2 2.2-7.2 7.2-2.6.4.4-2.6z"/><path d="m4.9 9.9 1.2 1.2"/><path d="M2.8 13.2h10.4"/>',
		eraser: '<path d="m8.8 2.6 4.6 4.6-5.9 5.9H4.3L2 10.8z"/><path d="m5.8 5.7 4.6 4.6"/><path d="M7.5 13.1h6.5"/>',
		library: '<path d="M3 13.2V3.1M5.7 13.2V2.6M8.5 13.2V4.1"/><path d="m11.3 3 2.3-.5 1.1 10.1-2.4.5z"/>',
		measure: '<path d="M2.1 5.2h11.8v5.6H2.1z"/><path d="M4.2 5.2v2.4M6.3 5.2v1.6M8.4 5.2v2.4M10.5 5.2v1.6M12.6 5.2v2.4"/>',
		slice: '<path d="M3 2.8 13 7l-3 6.2L2 8.8z"/><path d="m3 2.8 3.4 11.1M13 7 6.4 13.2"/>',
		wall: '<path d="M2 5.1h12M2 10.9h12M4.7 5.1v5.8M8 5.1v5.8M11.3 5.1v5.8"/>',
		opening: '<path d="M3.2 13.2V6.3a4.8 4.8 0 0 1 9.6 0v6.9"/><path d="M3.2 13.2h9.6"/><path d="M6.2 13.2V7.1M9.8 13.2V7.1"/>',
		stair: '<path d="M2.2 13.2h3.1V10h3.1V6.8h3.1V3.6h2.3"/>',
		building: '<path d="M3 13.2V4.1l5-2.1v11.2M8 6.1l5 1.8v5.3"/><path d="M5.1 5.7h.9M5.1 8.2h.9M5.1 10.7h.9M10.2 9.1h.8M10.2 11.2h.8"/>',
		room: '<path d="M2.5 3.1h11v9.8h-11z"/><path d="M5.1 3.1v9.8"/>',
		form: '<path d="M2.4 13.2V7.2a5.6 5.6 0 0 1 11.2 0v6"/><path d="M5.5 13.2V8.2a2.5 2.5 0 0 1 5 0v5"/>',
		roof: '<path d="m1.8 7.4 6.2-4.9 6.2 4.9"/><path d="M3.4 6.8v6.4h9.2V6.8"/>',
		terrace: '<path d="M2 5.2h12M2 8h12M2 10.8h12M4.8 13.2h6.4"/>',
		ground: '<path d="m1.5 11.9 4.2-4.7 2.7 2.5 2.4-2.9 3.7 5.1z"/><path d="M2 13.2h12"/>',
		water: '<path d="M2 5.3c1.8-1.4 3.2-1.4 5 0s3.2 1.4 5 0 2.2-1.1 2-1.1M2 8.6c1.8-1.4 3.2-1.4 5 0s3.2 1.4 5 0 2.2-1.1 2-1.1M2 11.9c1.8-1.4 3.2-1.4 5 0s3.2 1.4 5 0 2.2-1.1 2-1.1"/>',
		path: '<path d="M5.2 13.2c0-2.6 2.1-3.2 2.1-5.5S5.9 4 7.3 2.8"/><path d="M10.5 13.2c0-2.2-2.2-3.2-2.2-5.5s1.1-2.8 1.7-4.3"/>',
		plants: '<path d="M8 13.2V7.1"/><path d="M8 9.5C5.7 9.5 3.7 7.8 3.7 5.3c2.4 0 4.3 1.6 4.3 4.2zM8 7.2c0-2.6 1.8-4.4 4.3-4.4 0 2.6-1.9 4.4-4.3 4.4z"/><path d="M3 13.2h10"/>',
		trees: '<path d="M8 2.4 4.6 8h2.1L3.9 12h8.2l-2.8-4h2.1z"/><path d="M8 12v2"/>',
		object: '<path d="M3.2 4.2h9.6v6.1H3.2z"/><path d="M2.3 12.2h11.4M4.5 12.2V14M11.5 12.2V14"/>',
		light: '<path d="M5.2 9.2a3.8 3.8 0 1 1 5.6 0c-.8.8-1.1 1.4-1.1 2.1H6.3c0-.7-.3-1.3-1.1-2.1z"/><path d="M6.4 12.8h3.2M7 14h2M8 1.5v1"/>',
		'shape-line': '<circle cx="3.2" cy="12.4" r="1.2"/><circle cx="12.8" cy="3.6" r="1.2"/><path d="m4.2 11.5 7.6-7"/>',
		'shape-arc': '<path d="M2.5 12.5V9a5.5 5.5 0 0 1 11 0v3.5"/><circle cx="2.5" cy="12.8" r="1"/><circle cx="13.5" cy="12.8" r="1"/>',
		'shape-box': '<path d="M3.4 4.2h9.2v7.6H3.4z"/><circle cx="3.4" cy="11.8" r="1"/><circle cx="12.6" cy="4.2" r="1"/>',
		'shape-circle': '<circle cx="8" cy="8" r="5.4"/><circle cx="8" cy="8" r="1"/>',
		'h-low': '<path d="M2.5 13.4h11"/><path d="M4.2 13.4V9.8M11.8 13.4V9.8M4.2 9.8h7.6"/>',
		'h-room': '<path d="M2.5 13.4h11"/><path d="M4.2 13.4V6.6M11.8 13.4V6.6M4.2 6.6h7.6"/>',
		'h-tall': '<path d="M2.5 13.4h11"/><path d="M4.2 13.4V3.8M11.8 13.4V3.8M4.2 3.8h7.6"/>',
		'op-door': '<path d="M3.4 13.2V4.5a1.3 1.3 0 0 1 1.3-1.3h6.6a1.3 1.3 0 0 1 1.3 1.3v8.7"/><path d="M2.4 13.2h11.2"/><circle cx="10.5" cy="8.3" r=".7"/>',
		'op-window': '<path d="M2.6 3.1h10.8v10.1H2.6z"/><path d="M8 3.1v10.1M2.6 8.1h10.8"/>',
		'op-arch': '<path d="M3.3 13.2V6.4a4.7 4.7 0 0 1 9.4 0v6.8"/><path d="M3.3 13.2h9.4"/>',
		'op-round': '<circle cx="8" cy="6.4" r="3.2"/><path d="M4.8 13.2V6.4a3.2 3.2 0 0 1 6.4 0v6.8"/><path d="M4.8 13.2h6.4"/>',
		'op-niche': '<path d="M4.2 13.2V5.9a3.8 3.8 0 0 1 7.6 0v7.3"/><path d="M3.1 13.2h9.8"/>',
		'op-wide': '<path d="M2.2 6.4a2 2 0 0 1 2-2h7.6a2 2 0 0 1 2 2v6.8H2.2z"/><path d="M2.2 13.2h11.6M6 4.4v8.8"/>'
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{@html paths[name] ?? paths.select}
</svg>
