/**
 * Artwork framing is authored presentation, not rendered geometry. The Scene
 * record stores only style, Mat and colour; every dimension below is a real
 * world-space default derived at render time. Both Stage and Visitor Preview
 * read this one module, so their frames cannot disagree.
 */

export const ARTWORK_FRAME_STYLES = ['none', 'thin', 'gallery', 'float'] as const;
export type ArtworkFrameStyle = (typeof ARTWORK_FRAME_STYLES)[number];

export const ARTWORK_FRAME_COLORS = [
	{ id: 'black', label: 'Black', hex: '#1b1b1b' },
	{ id: 'walnut', label: 'Walnut', hex: '#8a6238' },
	{ id: 'ivory', label: 'Ivory', hex: '#f4f1ea' }
] as const;
export type ArtworkFrameColor = (typeof ARTWORK_FRAME_COLORS)[number]['id'];

export const ARTWORK_FRAME_OPTIONS: readonly { readonly style: ArtworkFrameStyle; readonly label: string }[] = [
	{ style: 'none', label: 'None' },
	{ style: 'thin', label: 'Thin' },
	{ style: 'gallery', label: 'Gallery' },
	{ style: 'float', label: 'Float' }
];

export type ArtworkFrameSpec = {
	readonly faceMeters: number;
	readonly depthMeters: number;
	readonly revealMeters: number;
};

/** One physical default table. No width or depth is serialized or authored. */
export const ARTWORK_FRAME_SPECS: Readonly<Record<ArtworkFrameStyle, ArtworkFrameSpec>> = {
	none: { faceMeters: 0, depthMeters: 0, revealMeters: 0 },
	thin: { faceMeters: 0.018, depthMeters: 0.025, revealMeters: 0 },
	gallery: { faceMeters: 0.06, depthMeters: 0.04, revealMeters: 0 },
	float: { faceMeters: 0.015, depthMeters: 0.04, revealMeters: 0.012 }
};

export const ARTWORK_MAT_METERS = 0.06;
export const ARTWORK_MAT_COLOR = '#f6f3ec';
export const ARTWORK_FLOAT_BACKING_COLOR = '#2a2420';

/**
 * The one persisted frame record. Absent means no frame and no Mat; a present
 * `none` style with `mat: false` is canonicalized away.
 */
export type ArtworkFrame = {
	readonly style: ArtworkFrameStyle;
	readonly mat: boolean;
	readonly color: ArtworkFrameColor;
};

export function isArtworkFrameStyle(value: string): value is ArtworkFrameStyle {
	return (ARTWORK_FRAME_STYLES as readonly string[]).includes(value);
}

export function isArtworkFrameColor(value: string): value is ArtworkFrameColor {
	return ARTWORK_FRAME_COLORS.some((entry) => entry.id === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type ArtworkFrameRead =
	| { readonly frame?: ArtworkFrame; readonly error?: never }
	| { readonly frame?: never; readonly error: string };

/**
 * Strict reader shared by the Scene codec and the Artwork transform planner.
 * It returns no frame for the canonical default (none + no Mat).
 */
export function readArtworkFrame(input: unknown): ArtworkFrameRead {
	if (!isRecord(input)) return { error: 'Expected a frame object.' };
	const unknown = Object.keys(input).find((key) => !['style', 'mat', 'color'].includes(key));
	if (unknown !== undefined) return { error: `Unknown frame field: ${unknown}` };
	const style = input.style;
	const mat = input.mat;
	const color = input.color;
	if (typeof style !== 'string' || !isArtworkFrameStyle(style)) {
		return { error: 'Frame style must be none, thin, gallery or float.' };
	}
	if (typeof mat !== 'boolean') return { error: 'Frame mat must be a boolean.' };
	if (typeof color !== 'string' || !isArtworkFrameColor(color)) {
		return { error: 'Frame colour must be black, walnut or ivory.' };
	}
	if (style === 'none' && !mat) return {};
	return { frame: { style, mat, color } };
}

export function normalizeArtworkFrame(frame: ArtworkFrame | undefined): ArtworkFrame | undefined {
	return frame !== undefined && !(frame.style === 'none' && !frame.mat) ? frame : undefined;
}

export function artworkFrameStyleLabel(style: ArtworkFrameStyle): string {
	return ARTWORK_FRAME_OPTIONS.find((entry) => entry.style === style)?.label ?? 'None';
}

export function artworkFrameColorHex(color: ArtworkFrameColor): string {
	return ARTWORK_FRAME_COLORS.find((entry) => entry.id === color)?.hex ?? ARTWORK_FRAME_COLORS[0].hex;
}

export function artworkFrameColorLabel(color: ArtworkFrameColor): string {
	return ARTWORK_FRAME_COLORS.find((entry) => entry.id === color)?.label ?? 'Black';
}

/** The generated border from the image edge to the outer frame edge. */
export function artworkFrameBorderMeters(frame: ArtworkFrame | undefined): number {
	const normalized = normalizeArtworkFrame(frame);
	if (normalized === undefined) return 0;
	const spec = ARTWORK_FRAME_SPECS[normalized.style];
	return spec.faceMeters + (normalized.mat ? ARTWORK_MAT_METERS : 0) + spec.revealMeters;
}

export type ArtworkFrameRail = {
	readonly size: [number, number, number];
	readonly center: [number, number, number];
};

export type ArtworkFramePlate = {
	readonly width: number;
	readonly height: number;
	readonly innerWidth: number;
	readonly innerHeight: number;
	readonly z: number;
};

export type ArtworkFrameLayout = {
	readonly style: ArtworkFrameStyle;
	readonly imageWidth: number;
	readonly imageHeight: number;
	readonly outerWidth: number;
	readonly outerHeight: number;
	readonly depth: number;
	readonly faceMeters: number;
	readonly matMeters: number;
	readonly revealMeters: number;
	readonly borderMeters: number;
	readonly frameColor: string | null;
	readonly matColor: string;
	readonly backingColor: string | null;
	readonly rails: readonly ArtworkFrameRail[];
	readonly mat: ArtworkFramePlate | null;
	readonly backing: ArtworkFramePlate | null;
};

/**
 * The generated physical layout for one image. The image keeps its authored
 * centre at z = 0; the moulding projects forward, the Mat sits just in front of
 * the image edge and the backing sits behind the image so alpha still reads.
 */
export function artworkFrameLayout(
	widthMeters: number,
	heightMeters: number,
	frame: ArtworkFrame | undefined
): ArtworkFrameLayout {
	const normalized = normalizeArtworkFrame(frame);
	const style = normalized?.style ?? 'none';
	const spec = ARTWORK_FRAME_SPECS[style];
	const faceMeters = style === 'none' ? 0 : spec.faceMeters;
	const depth = style === 'none' ? 0 : spec.depthMeters;
	const matMeters = normalized?.mat ? ARTWORK_MAT_METERS : 0;
	const revealMeters = style === 'float' ? spec.revealMeters : 0;
	const borderMeters = faceMeters + matMeters + revealMeters;
	const outerWidth = widthMeters + 2 * borderMeters;
	const outerHeight = heightMeters + 2 * borderMeters;
	const openingWidth = widthMeters + 2 * (matMeters + revealMeters);
	const openingHeight = heightMeters + 2 * (matMeters + revealMeters);

	const backingColor = faceMeters > 0
		? (style === 'float' ? ARTWORK_FLOAT_BACKING_COLOR : ARTWORK_MAT_COLOR)
		: matMeters > 0 ? ARTWORK_MAT_COLOR : null;

	const rails: ArtworkFrameRail[] = [];
	if (faceMeters > 0) {
		const railZ = depth / 2;
		const x = (outerWidth - faceMeters) / 2;
		const y = (outerHeight - faceMeters) / 2;
		rails.push(
			{ size: [outerWidth, faceMeters, depth], center: [0, y, railZ] },
			{ size: [outerWidth, faceMeters, depth], center: [0, -y, railZ] },
			{ size: [faceMeters, outerHeight - 2 * faceMeters, depth], center: [-x, 0, railZ] },
			{ size: [faceMeters, outerHeight - 2 * faceMeters, depth], center: [x, 0, railZ] }
		);
	}

	return {
		style,
		imageWidth: widthMeters,
		imageHeight: heightMeters,
		outerWidth,
		outerHeight,
		depth,
		faceMeters,
		matMeters,
		revealMeters,
		borderMeters,
		frameColor: faceMeters > 0 && normalized !== undefined
			? artworkFrameColorHex(normalized.color)
			: null,
		matColor: ARTWORK_MAT_COLOR,
		backingColor,
		rails,
		mat: matMeters > 0
			? {
					width: widthMeters + 2 * matMeters,
					height: heightMeters + 2 * matMeters,
					innerWidth: widthMeters,
					innerHeight: heightMeters,
					z: 0.002
				}
			: null,
		backing: backingColor !== null
			? {
					width: openingWidth,
					height: openingHeight,
					innerWidth: openingWidth,
					innerHeight: openingHeight,
					z: -0.004
				}
			: null
	};
}
