<script lang="ts">
	/**
	 * The #285 prototype's exact 24px glyphs.
	 *
	 * `hero` selects the dock-key drawing (the prototype's HERO map); the default
	 * palette set is the same 24px grid the prototype uses for options and chrome.
	 */
	let {
		name = 'select',
		size = 24,
		hero = false
	}: { name: string; size?: number; hero?: boolean } = $props();

	const paths: Record<string, string> = {
		select: '<path d="M6.5 3.8 18 10.6l-5.1 1.5 3 5.3-2.2 1.3-3-5.3-3.9 3.7z"/>',
		paint: '<rect x="4" y="3.8" width="13" height="5.2" rx="1.2"/><path d="M17 6.4h2.6v5.2h-8.1v3"/><rect x="10" y="14.6" width="3" height="6" rx=".8"/>',
		erase: '<path d="m14.4 4.6 5 5-9.2 9.4H5.6l-2-2a1.4 1.4 0 0 1 0-2z"/><path d="m8.6 10.2 5 5M10.2 19H20"/>',
		measure: '<path d="m3.6 16.4 12.8-12.8 4 4L7.6 20.4z"/><path d="m7 13 1.6 1.6M9.6 10.4l2 2M12.2 7.8l1.6 1.6M14.8 5.2l2 2"/>',
		slice: '<path d="M8.5 3.5 16 6.2v14.3l-7.5-2.7z"/><path d="M3 12.2h3.2M18.4 12.2h2.6" stroke-dasharray="1.6 1.6"/>',
		'fam-build': '<path d="M3 20.2h18"/><path d="M5 20.2v-8.4l5-4.4 5 4.4v8.4"/><path d="M15 13h5v7.2"/><path d="M8.6 20.2v-4h2.8v4"/>',
		'fam-furnish': '<path d="M5.6 12V8.4a2 2 0 0 1 2-2h8.8a2 2 0 0 1 2 2V12"/><path d="M3.6 12.6a1.5 1.5 0 0 1 3 0v2.6h10.8v-2.6a1.5 1.5 0 0 1 3 0V18H3.6z"/><path d="M6 18v2.2M18 18v2.2"/>',
		'fam-form': '<path d="M3.5 19.5h17v-3h-17z"/><path d="M6.5 16.5v-5h6v5"/><circle cx="16.4" cy="13.2" r="3.2"/>',
		'fam-land': '<path d="M2.6 19.4c3.4-4.8 6-6.8 9.4-6.8 2.1 0 3.9.8 5.6 2.3 1.4 1.2 2.6 2.7 3.8 4.5z"/><path d="M16.2 13V9.2"/><circle cx="16.2" cy="6.6" r="2.6"/>',
		walls: '<path d="M4 20.2V10a5.8 5.8 0 0 1 5.8-5.8H20"/><path d="M7.4 20.2V10.2a2.6 2.6 0 0 1 2.6-2.6h10"/><path d="M4 20.2h3.4M20 4.2v3.4"/>',
		building: '<path d="m3.8 11.2 8.2-6.6 8.2 6.6"/><path d="M6 9.6v10.6h12V9.6"/><path d="M10.2 20.2v-4.6h3.6v4.6"/><path d="M8.2 12.2h1.6M14.2 12.2h1.6"/>',
		opening: '<path d="M3 20.2h18"/><path d="M4.4 20.2V5.6h15.2v14.6"/><path d="M9.4 20.2v-6.4a2.6 2.6 0 0 1 5.2 0v6.4"/>',
		roof: '<path d="m2.8 14.2 6.6-7.6h5.2l6.6 7.6z"/><path d="M9.4 6.6 12 14.2l2.6-7.6"/><path d="M5 14.2v5.4M19 14.2v5.4" stroke-dasharray="1.4 1.6"/>',
		stair: '<path d="M3 20.2h4v-3.6h4V13h4V9.4h4V5.8h2"/><path d="M3 20.2h18" opacity=".45"/>',
		terrace: '<path d="M2.8 19.6h4v-5.2h10.4v5.2h4"/><path d="m6.8 14.4 2.2-4.2h6l2.2 4.2" opacity=".55"/>',
		object: '<path d="m12 3.6 7.6 4.2v8.4L12 20.4l-7.6-4.2V7.8z"/><path d="M4.4 7.8 12 12l7.6-4.2M12 12v8.4"/>',
		form: '<path d="M3.6 15.4h16.8v4.4H3.6z"/><path d="M6.4 15.4V9.6h6.2v5.8"/><ellipse cx="16.8" cy="10.2" rx="2.4" ry=".9"/><path d="M14.4 10.2v5.2M19.2 10.2v5.2"/>',
		light: '<path d="M12 3v4.6"/><path d="M6.8 12.8a5.2 5.2 0 0 1 10.4 0z"/><path d="M10.4 15.4a1.6 1.6 0 0 0 3.2 0"/><path d="m5.2 19.2 1.8-1.8M18.8 19.2 17 17.4M12 18.6v2.2"/>',
		ground: '<path d="M2.6 19.6C5.4 13.4 8.4 9 12 9s6.6 4.4 9.4 10.6"/><path d="M7.2 19.6C8.6 16 10.2 13.8 12 13.8s3.4 2.2 4.8 5.8" opacity=".6"/><path d="M2.6 19.6h18.8" opacity=".45"/>',
		path: '<path d="M5.2 21c1-4.2 4-5.6 7-7.2s5-4.4 5.4-10.6"/><path d="M10.4 21c.8-2.8 3-4 5-5.2s4.6-3.2 5-8.4"/><path d="M8.2 18.6l1.6.8M12.6 15.2l1.4 1.1M16.4 11.2l1.6.6" opacity=".6"/>',
		water: '<path d="M3 9.4c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0"/><path d="M3 14c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0"/><path d="M3 18.6c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0"/>',
		plants: '<path d="M12 21v-9.4"/><path d="M12 11.6c-4 0-6.2-2.6-6.2-6.2 3.6 0 6.2 2.6 6.2 6.2z"/><path d="M12 15.2c3.6 0 5.6-2.2 5.6-5.6-3.4 0-5.6 2.2-5.6 5.6z"/>',
		'plant-tree': '<circle cx="12" cy="9" r="5.6"/><path d="M12 14.6v6"/>',
		room: '<path d="M4.6 4.6h14.8v14.8H4.6z"/><path d="M8.6 12h6.8" opacity=".55"/>',
		'shape-line': '<path d="M5.4 18.6 18.6 5.4"/><circle cx="5.4" cy="18.6" r="1.5"/><circle cx="18.6" cy="5.4" r="1.5"/>',
		'shape-arc': '<path d="M4.6 17.4C6 10 9 7 12 7s6 3 7.4 10.4"/><circle cx="4.6" cy="17.4" r="1.5"/><circle cx="19.4" cy="17.4" r="1.5"/>',
		'shape-box': '<rect x="4.6" y="6" width="14.8" height="12" rx="1"/>',
		'shape-circle': '<circle cx="12" cy="12" r="7.4"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
		'h-low': '<path d="M3.4 19.4h17.2"/><rect x="5" y="14.6" width="14" height="4.8" rx=".5"/>',
		'h-room': '<path d="M3.4 19.4h17.2"/><rect x="5" y="9" width="14" height="10.4" rx=".5"/>',
		'h-tall': '<path d="M3.4 19.4h17.2"/><rect x="5" y="4" width="14" height="15.4" rx=".5"/>',
		'op-door': '<path d="M3 20.2h18"/><path d="M7.6 20.2V5h8.8v15.2"/><circle cx="14.2" cy="13" r=".7" fill="currentColor"/>',
		'op-window': '<path d="M3 20.2h18"/><rect x="6.2" y="6" width="11.6" height="9.4" rx=".5"/><path d="M12 6v9.4M6.2 10.7h11.6"/>',
		'op-arch': '<path d="M3 20.2h18"/><path d="M7 20.2v-8.6a5 5 0 0 1 10 0v8.6"/>',
		'op-round': '<path d="M3 20.2h18"/><circle cx="12" cy="11" r="5"/><path d="M12 6v10M7 11h10" opacity=".55"/>',
		'op-niche': '<path d="M3 20.2h18"/><path d="M7 17.2v-6.6a5 5 0 0 1 10 0v6.6z"/><path d="M9.4 17.2v-6.2a2.6 2.6 0 0 1 5.2 0v6.2" opacity=".55"/>',
		'op-wide': '<path d="M3 20.2h18"/><path d="M4.4 20.2V8.4h15.2v11.8"/><path d="M4.4 8.4 7 5.8h10l2.6 2.6" opacity=".55"/>',
		library: '<rect x="4" y="4" width="6.6" height="6.6" rx="1"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1"/><path d="M16.7 13.4v6.6M13.4 16.7h6.6"/>',
		sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>',
		chevron: '<path d="m7 10 5 5 5-5"/>'
	};

	const heroPaths: Record<string, string> = {
		select: '<path d="M6 3.6 18.4 11l-5.5 1.6 3.2 5.6-2.4 1.4-3.2-5.6L6.2 18.4z"/>',
		'fam-build': '<path d="M2.8 20.4h18.4"/><path d="M5.2 20.4v-9.2l6-5.2 6 5.2v9.2"/><path d="M17.2 14.2h3.4v6.2"/><path d="M9.6 20.4v-4.4h3.2v4.4"/><path d="M8.2 12.4h1.4M12.8 12.4h1.4"/>',
		'fam-form': '<path d="M3.2 20h17.6v-3.2H3.2z"/><path d="M5.8 16.8v-6.2h6.4v6.2"/><circle cx="16.6" cy="13.4" r="3.4"/><path d="M5.8 10.6 8 8.4h6.4l-2.2 2.2M14.4 8.4v6.2l-2.2 2.2" opacity=".7"/>',
		'fam-land': '<path d="M2.4 19.8c3.2-4.8 6.2-6.8 9.6-6.8s6.4 2 9.6 6.8"/><path d="M16.2 13.6V10"/><circle cx="16.2" cy="7.4" r="2.6"/><path d="M5.6 19.8c1.2-1.4 2.2-2.2 3.4-2.6" opacity=".6"/>',
		'fam-furnish': '<path d="M6 12.2V8.2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/><path d="M3.8 12.8a1.5 1.5 0 0 1 3 0v2.4h10.4v-2.4a1.5 1.5 0 0 1 3 0V18H3.8z"/><path d="M6 18v2.4M18 18v2.4"/>',
		paint: '<rect x="4" y="3.6" width="13" height="5.4" rx="1.2"/><path d="M17 6.3h2.8v5.4h-8.3v2.8"/><rect x="10" y="14.4" width="3" height="6.2" rx=".8"/>',
		erase: '<path d="m14.4 4.4 5.2 5.2-9.4 9.6H5.6l-2.1-2.1a1.4 1.4 0 0 1 0-2z"/><path d="m8.6 10.2 5.2 5.2M10.2 19.2h10"/>',
		library: '<path d="M3 20h18"/><path d="M4.6 20V4.6h3.2V20M7.8 20V7h3.2v13"/><path d="m13.2 8.2 3-.9 3.8 12.7-3 .9z"/>'
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={hero ? 1.6 : 1.5}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{@html (hero ? heroPaths[name] : undefined) ?? paths[name] ?? paths.select}
</svg>
