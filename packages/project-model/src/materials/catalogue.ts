/**
 * The immutable shipped material catalogue.
 *
 * The catalogue is part of the portable material contract, not of the editor:
 * an API reader, a package reader and the public runtime can qualify a curated
 * base without importing the editor catalogue. The editor's content facade
 * joins names and thumbnails to these records; it does not own their bytes or
 * their meaning.
 *
 * Rules:
 *
 * - a base id is append-only; changing pixels or meaning needs a new id;
 * - a shipped image is keyed by an allowlisted logical URI with its exact
 *   SHA-256, MIME and byte length;
 * - the neutral technical base is frozen and excluded from creator-facing
 *   catalogue counts;
 * - the six legacy placeholder bases (pre-S8 F) stay resolvable with unchanged
 *   recipes, pins and bytes for existing documents and baselines, but are not
 *   creator-facing and carry no catalogue provenance. Removing them is a later
 *   strict format change.
 *
 * The curated bases (T2.S8 F) are derived from retained CC0 sources by
 * `apps/editor/assets-source/textures/derive.ts`; each set's derivation and
 * licence record lives under `apps/editor/assets-source/`.
 */
import { deepFreeze } from './immutable';
import { readRecipe } from './read';
import { NEUTRAL_RECIPE } from './neutral';
import {
	MATERIAL_PROFILE,
	MATERIAL_NEUTRAL_BASE_ID,
	type Hash,
	type MapRole,
	type Recipe
} from './types';

export type CatalogueImage = {
	readonly uri: string;
	readonly hash: Hash;
	readonly mime: 'image/png' | 'image/jpeg' | 'image/webp';
	readonly byteSize: number;
};

/**
 * Every shipped image the catalogue uses: the legacy placeholders' PNGs, then
 * the curated sets' qualified WebP derivatives (`color` lossy sRGB, `normal`
 * lossless +Y, `orm` lossless R occlusion / G roughness / B metal). The editor
 * static files are verified against these pins at test time; the manifest is
 * the pure, portable copy. Append-only.
 */
export const SHIPPED_MATERIAL_IMAGES: readonly CatalogueImage[] = deepFreeze([
	{
		uri: '/textures/plaster-warm/map.png',
		hash: 'sha256-fbc560b447dbf80a578ee872d01a47776f041a3a9404603b0f1529664566eec0',
		mime: 'image/png',
		byteSize: 47350
	},
	{
		uri: '/textures/plaster-warm/roughness.png',
		hash: 'sha256-956a35621e1fd853be643bcaf726fd40db671946f80f8475fb5cd60648ca18ec',
		mime: 'image/png',
		byteSize: 61695
	},
	{
		uri: '/textures/wood-walnut/map.png',
		hash: 'sha256-358c89409516f0c020e0ad703ef082666010a00517c68c1667c4d8e885b867f4',
		mime: 'image/png',
		byteSize: 53591
	},
	{
		uri: '/textures/wood-walnut/roughness.png',
		hash: 'sha256-677d806ea44fba6f6d3447b8a0f0c1956b3078e84cf572fd0c444139ac5e7865',
		mime: 'image/png',
		byteSize: 2001
	},
	{
		uri: '/textures/brass-aged/map.png',
		hash: 'sha256-ad73e7b0fec069675ce71f8c0a63734c597d51b6a81d00fa1755dec00c86f271',
		mime: 'image/png',
		byteSize: 76488
	},
	{
		uri: '/textures/wood-oak-veneer/color.webp',
		hash: 'sha256-609c7523f3bcaa7f4aa10a489980386ee2579acbcb73fa03c1b084f2f00fb54b',
		mime: 'image/webp',
		byteSize: 28916
	},
	{
		uri: '/textures/wood-oak-veneer/normal.webp',
		hash: 'sha256-41c1d86ed94267ccef48d6a2b99d330bf1cd8d8309209fa1c54b9a01bb4b513b',
		mime: 'image/webp',
		byteSize: 261720
	},
	{
		uri: '/textures/wood-oak-veneer/orm.webp',
		hash: 'sha256-1794f4ce7ccf464a5a957820636c3b76d5c9cad3575e35965e6a84b5e3218f6d',
		mime: 'image/webp',
		byteSize: 222024
	},
	{
		uri: '/textures/wood-walnut-veneer/color.webp',
		hash: 'sha256-3b7eb33f0c21f41eae4cd9a58fc85d0c08a5099c9b2a8b1352b98648692e1198',
		mime: 'image/webp',
		byteSize: 144146
	},
	{
		uri: '/textures/wood-walnut-veneer/normal.webp',
		hash: 'sha256-1be042d760267e8deeb0927e2239d1e377a3e94d37607f07db66f679f54b9703',
		mime: 'image/webp',
		byteSize: 621080
	},
	{
		uri: '/textures/wood-walnut-veneer/orm.webp',
		hash: 'sha256-5d4c9eecbfc0c6a7efa067ae192554b18c538aa1f6c8961e36b3c952980dcd60',
		mime: 'image/webp',
		byteSize: 916812
	},
	{
		uri: '/textures/wood-oak-planks/color.webp',
		hash: 'sha256-87cd8d3ca60160177a8e4f684b320819a47bec54e811d2ccfc319fd027fba90e',
		mime: 'image/webp',
		byteSize: 237406
	},
	{
		uri: '/textures/wood-oak-planks/normal.webp',
		hash: 'sha256-0bae98742d97f49e9c5ca6d5a595f24f252245daf351fa336ee69bc0afe5408f',
		mime: 'image/webp',
		byteSize: 856620
	},
	{
		uri: '/textures/wood-oak-planks/orm.webp',
		hash: 'sha256-f755dc04f5570ea5548f00a4f4601959702d99d09d90c9e19193f728811587b0',
		mime: 'image/webp',
		byteSize: 1175470
	},
	{
		uri: '/textures/wood-herringbone-parquet/color.webp',
		hash: 'sha256-ca8b379b35cf12a1fb23d3a89049edaa43d427dcec462853f0ecbe48027fccfd',
		mime: 'image/webp',
		byteSize: 1306350
	},
	{
		uri: '/textures/wood-herringbone-parquet/normal.webp',
		hash: 'sha256-0aa86abab55d8056a58b8ad4c572aab57b6d6dd1297d11d1e9627618b9e93c59',
		mime: 'image/webp',
		byteSize: 3210128
	},
	{
		uri: '/textures/wood-herringbone-parquet/orm.webp',
		hash: 'sha256-478869f6f71924534bacea4d33d8bd0ad59cf73c8c608be454b4c4e283c41aff',
		mime: 'image/webp',
		byteSize: 3549212
	},
	{
		uri: '/textures/stone-terrazzo/color.webp',
		hash: 'sha256-b1b9cb28a2d85597f501526a992af86a12a1b4c772aafc02216c08f3d38c64ca',
		mime: 'image/webp',
		byteSize: 71870
	},
	{
		uri: '/textures/stone-terrazzo/normal.webp',
		hash: 'sha256-617c711c7ead655306a9d8460e0be782b74fb81fa60a71f8cfa6d3a795e6903b',
		mime: 'image/webp',
		byteSize: 86608
	},
	{
		uri: '/textures/stone-terrazzo/orm.webp',
		hash: 'sha256-228a0afe700ebe9d7c173cff5712f8a78d96c1733ccaea654be72d205febc5c6',
		mime: 'image/webp',
		byteSize: 124406
	},
	{
		uri: '/textures/masonry-brick-red/color.webp',
		hash: 'sha256-f950fe0f80b27d7f42ca28390ff74c5fed6689addb6edcffce94d74a3f632fce',
		mime: 'image/webp',
		byteSize: 421944
	},
	{
		uri: '/textures/masonry-brick-red/normal.webp',
		hash: 'sha256-fe24714e3da646826bd82335708e32322cc1b81e9100a9676e54d0c3592c93eb',
		mime: 'image/webp',
		byteSize: 1937452
	},
	{
		uri: '/textures/masonry-brick-red/orm.webp',
		hash: 'sha256-eb00bef0a6ed59174366dde943cbe5be452d220fe73be6b096806eb0f974158c',
		mime: 'image/webp',
		byteSize: 1240504
	},
	{
		uri: '/textures/plaster-painted/color.webp',
		hash: 'sha256-e9aef308c792b2324e562f5cc0607637a5b8de6cdaf1deb0c7f137a66c2f9050',
		mime: 'image/webp',
		byteSize: 311708
	},
	{
		uri: '/textures/plaster-painted/normal.webp',
		hash: 'sha256-14eb6c6261835bd0685113c3910f487ea8226b21b52a5f5853fe290e5b85d23f',
		mime: 'image/webp',
		byteSize: 1628824
	},
	{
		uri: '/textures/plaster-painted/orm.webp',
		hash: 'sha256-a3f907d398b049956bf29187a80f5ee5380bc6f0703790cc2b0177cfafd39704',
		mime: 'image/webp',
		byteSize: 861296
	},
	{
		uri: '/textures/concrete-smooth/color.webp',
		hash: 'sha256-df97c25706c29bb60855496c958a16b7689800a1daafff95309dae3059c6c4cb',
		mime: 'image/webp',
		byteSize: 245694
	},
	{
		uri: '/textures/concrete-smooth/normal.webp',
		hash: 'sha256-2ad3f48a8eaea35483ae210aa6c06bab0c60464e1ed020aa5c0f5f7589ed0713',
		mime: 'image/webp',
		byteSize: 762750
	},
	{
		uri: '/textures/concrete-smooth/orm.webp',
		hash: 'sha256-e7a8a9fee83a80b563fc49a85a851cdd5dd53d162b4368e0763e63d910684c97',
		mime: 'image/webp',
		byteSize: 649010
	},
	{
		uri: '/textures/tile-ceramic-white/color.webp',
		hash: 'sha256-4c26b805337be92a4e9db0999a8dd2af0b21ec1a4d0c952d82f7148df0095ffe',
		mime: 'image/webp',
		byteSize: 19976
	},
	{
		uri: '/textures/tile-ceramic-white/normal.webp',
		hash: 'sha256-641cdbeea9c27f33c61bd22d4c142acf7938baff4be7548414710be7f0df8057',
		mime: 'image/webp',
		byteSize: 265234
	},
	{
		uri: '/textures/tile-ceramic-white/orm.webp',
		hash: 'sha256-8c37ea083159eebd86c9933e54e8b3cd4a735e215cc70b41800473387b7ca8fc',
		mime: 'image/webp',
		byteSize: 160486
	},
	{
		uri: '/textures/metal-satin/normal.webp',
		hash: 'sha256-87be18764ce07a9540dfea5ae858d6dff0d545a11a003cb91f6e8b3e7f20d2ef',
		mime: 'image/webp',
		byteSize: 63656
	},
	{
		uri: '/textures/metal-satin/orm.webp',
		hash: 'sha256-a5b6ed419a02387c3dbff85fc9390a3276f59ec51d2b279b3bcbea807fef04c5',
		mime: 'image/webp',
		byteSize: 84748
	},
	{
		uri: '/textures/metal-brushed/normal.webp',
		hash: 'sha256-9bab5f44390a43a7a04a050c198c1fc110aaf789def6cd81a3a54275b564e5ba',
		mime: 'image/webp',
		byteSize: 560130
	},
	{
		uri: '/textures/metal-brushed/orm.webp',
		hash: 'sha256-94f08c88496afaee26bece34df1b64e2c648ffd456de75262c79252f6b333182',
		mime: 'image/webp',
		byteSize: 408544
	},
	{
		uri: '/textures/textile-linen/color.webp',
		hash: 'sha256-a0eef2abb6bd6bd42218b7e21e3ba7345586fb59d9d55089b6b588ebca22a817',
		mime: 'image/webp',
		byteSize: 56656
	},
	{
		uri: '/textures/textile-linen/normal.webp',
		hash: 'sha256-e9ea4858d8ceb8ef0fb24fecee84b1a76396d16ecf680cb5c756cfa4c2e8d157',
		mime: 'image/webp',
		byteSize: 340922
	},
	{
		uri: '/textures/textile-linen/orm.webp',
		hash: 'sha256-82ec123de3387d931eb3b526c1442c42de5d8bd59f52916fdeff25cb68f70b4f',
		mime: 'image/webp',
		byteSize: 382978
	},
	{
		uri: '/textures/textile-carpet-loop/color.webp',
		hash: 'sha256-6be9de20a80081ccedbe8ad00da5363457cc61be5e18b7b79a924fbeb1adf957',
		mime: 'image/webp',
		byteSize: 230670
	},
	{
		uri: '/textures/textile-carpet-loop/normal.webp',
		hash: 'sha256-63f6dd7a2dc582535d28d33f827c7f9336f489b0b3993a1fa4b9546122d67314',
		mime: 'image/webp',
		byteSize: 2244576
	},
	{
		uri: '/textures/textile-carpet-loop/orm.webp',
		hash: 'sha256-198f1ba16841d5f5014a0bd9c6c5658e1d62da576ef22eb332f4d49d7fb65d81',
		mime: 'image/webp',
		byteSize: 1254460
	},
	{
		uri: '/textures/leather-smooth/color.webp',
		hash: 'sha256-aabf976f0ae75f15f9e6fba5278789636a8f1c7714eac58497f207921b985a35',
		mime: 'image/webp',
		byteSize: 48618
	},
	{
		uri: '/textures/leather-smooth/normal.webp',
		hash: 'sha256-94c10d202a5018a95b5939c919debd92abfaf181803e5e51479cd9c0fe4fa46f',
		mime: 'image/webp',
		byteSize: 237852
	},
	{
		uri: '/textures/leather-smooth/orm.webp',
		hash: 'sha256-d97e099816b588b3108af9dc7d62eda185a9da771a6c0866bf7ac268346e317b',
		mime: 'image/webp',
		byteSize: 309432
	},
	{
		uri: '/textures/synthetic-plastic-matte/color.webp',
		hash: 'sha256-a67e6d09a4f21a8b405a0012984e07e7c30a0ad900d88a64d85d984d15b70320',
		mime: 'image/webp',
		byteSize: 2084
	},
	{
		uri: '/textures/synthetic-plastic-matte/normal.webp',
		hash: 'sha256-1dde35d60cc767d9f5c2a4c8e30b1779835bc4845becaeb1c00cdf7de8bdc574',
		mime: 'image/webp',
		byteSize: 237040
	},
	{
		uri: '/textures/synthetic-plastic-matte/orm.webp',
		hash: 'sha256-a8c9f9bb303a7303173568145a0c126cc850a59ed6354e623ff3b9c5c2464eac',
		mime: 'image/webp',
		byteSize: 112620
	},
	{
		uri: '/textures/stone-travertine/color.webp',
		hash: 'sha256-606be858d1b49aad24f25a9143599e24bcb63daac4150de14319e5d946ddccba',
		mime: 'image/webp',
		byteSize: 39934
	},
	{
		uri: '/textures/stone-travertine/normal.webp',
		hash: 'sha256-eaeec1196865e358e750a1c39e0b9a561d0d84c7be7f6a12742de07fbfcf80ce',
		mime: 'image/webp',
		byteSize: 61870
	},
	{
		uri: '/textures/stone-travertine/orm.webp',
		hash: 'sha256-0f78e8d41ecae47375071bd00add122d04ca9db1c38942b0d80da56e01c6ba4f',
		mime: 'image/webp',
		byteSize: 72712
	}
] as const);

const IMAGE_BY_URI = new Map(SHIPPED_MATERIAL_IMAGES.map((entry) => [entry.uri, entry]));
const IMAGE_BY_HASH = new Map(SHIPPED_MATERIAL_IMAGES.map((entry) => [entry.hash, entry]));

/** The creator-facing curated catalogue ids (T2.S8 F), in shelf order. */
export const CATALOGUE_MATERIAL_IDS = Object.freeze([
	'wood-oak-veneer',
	'wood-walnut-veneer',
	'wood-oak-planks',
	'wood-herringbone-parquet',
	'stone-travertine',
	'stone-terrazzo',
	'masonry-brick-red',
	'plaster-painted',
	'concrete-smooth',
	'concrete-polished',
	'tile-ceramic-white',
	'metal-stainless-satin',
	'metal-brass-satin',
	'metal-copper-satin',
	'metal-gold-satin',
	'metal-stainless-brushed',
	'metal-aluminium-brushed',
	'textile-linen',
	'textile-carpet-loop',
	'leather-cognac',
	'synthetic-plastic-matte'
] as const);

export type CatalogueMaterialId = (typeof CATALOGUE_MATERIAL_IDS)[number];

/**
 * The pre-S8 F placeholder bases. Resolvable for existing documents, never
 * offered for new use and never counted.
 */
export const LEGACY_MATERIAL_IDS = Object.freeze([
	'plaster-warm',
	'wood-walnut',
	'brass-aged',
	'marble-light',
	'velvet-dark',
	'paper-aged'
] as const);

export type LegacyMaterialId = (typeof LEGACY_MATERIAL_IDS)[number];

export type CatalogueMaterial = {
	readonly id: string;
	readonly label: string;
	/** The technical neutral base is not a creator-facing catalogue entry. */
	readonly technical: boolean;
	/** A legacy placeholder: resolvable, not creator-facing. */
	readonly legacy: boolean;
	readonly recipe: Recipe;
};

function recipe(input: {
	readonly color: string;
	readonly roughness: number;
	readonly metalness: number;
	readonly tileMeters: readonly [number, number];
	readonly colorImage?: string;
	readonly roughnessImage?: string;
}): Recipe {
	const colorImage =
		input.colorImage === undefined ? undefined : IMAGE_BY_URI.get(input.colorImage);
	const roughnessImage =
		input.roughnessImage === undefined ? undefined : IMAGE_BY_URI.get(input.roughnessImage);
	if (
		(input.colorImage !== undefined && colorImage === undefined) ||
		(input.roughnessImage !== undefined && roughnessImage === undefined)
	) {
		throw new Error('a catalogue recipe names an unknown shipped image');
	}
	const read = readRecipe({
		profile: MATERIAL_PROFILE,
		color: input.color,
		roughness: input.roughness,
		metalness: input.metalness,
		occlusionStrength: 1,
		normalScale: 1,
		mapping: {
			kind: 'target',
			metric: {
				tileMeters: [input.tileMeters[0], input.tileMeters[1]],
				rotation: 0,
				offset: [0, 0]
			}
		},
		maps: {
			...(colorImage === undefined ? {} : { color: { image: colorImage.hash } }),
			...(roughnessImage === undefined
				? {}
				: {
						roughness: {
							image: roughnessImage.hash,
							// The established render slot reads the green channel, as a
							// metallic–roughness map does. The curated images are grayscale, so the
							// reading is unchanged; the channel states the portable meaning.
							component: 'g',
							invert: false
						}
					})
		}
	});
	if (!read.success) {
		throw new Error(`catalogue recipe is invalid: ${JSON.stringify(read.issues)}`);
	}
	return read.recipe;
}

/**
 * A curated set's recipe over its pinned images at `/textures/<set>/`. Factors
 * multiply the maps; roughness reads ORM green and occlusion ORM red. Metalness
 * is a factor only: the ORM blue channel states it but is not bound.
 */
function curated(input: {
	readonly set: string;
	readonly color: string;
	readonly roughness: number;
	readonly metalness: number;
	readonly tileMeters: readonly [number, number];
	readonly colorMap: boolean;
	readonly occlusion: boolean;
}): Recipe {
	const image = (role: 'color' | 'normal' | 'orm') => {
		const pinned = IMAGE_BY_URI.get(`/textures/${input.set}/${role}.webp`);
		if (pinned === undefined) throw new Error(`curated set ${input.set} has no pinned ${role} image`);
		return pinned.hash;
	};
	const orm = image('orm');
	const read = readRecipe({
		profile: MATERIAL_PROFILE,
		color: input.color,
		roughness: input.roughness,
		metalness: input.metalness,
		occlusionStrength: 1,
		normalScale: 1,
		mapping: {
			kind: 'target',
			metric: {
				tileMeters: [input.tileMeters[0], input.tileMeters[1]],
				rotation: 0,
				offset: [0, 0]
			}
		},
		maps: {
			...(input.colorMap ? { color: { image: image('color') } } : {}),
			normal: { image: image('normal'), convention: '+Y' },
			roughness: { image: orm, component: 'g', invert: false },
			...(input.occlusion ? { occlusion: { image: orm, component: 'r', invert: false } } : {})
		}
	});
	if (!read.success) {
		throw new Error(`curated recipe ${input.set} is invalid: ${JSON.stringify(read.issues)}`);
	}
	return read.recipe;
}

const CATALOGUE: readonly CatalogueMaterial[] = deepFreeze([
	{
		id: 'wood-oak-veneer',
		label: 'Oak Veneer',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'wood-oak-veneer',
			color: '#ffffff',
			roughness: 1,
			metalness: 0,
			tileMeters: [0.5, 0.5],
			colorMap: true,
			occlusion: true
		})
	},
	{
		id: 'wood-walnut-veneer',
		label: 'Walnut Veneer',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'wood-walnut-veneer',
			color: '#7a6e63',
			roughness: 1,
			metalness: 0,
			tileMeters: [1.0, 1.0],
			colorMap: true,
			occlusion: true
		})
	},
	{
		id: 'wood-oak-planks',
		label: 'Oak Plank Floor',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'wood-oak-planks',
			color: '#ffffff',
			roughness: 1,
			metalness: 0,
			tileMeters: [1.7, 1.7],
			colorMap: true,
			occlusion: true
		})
	},
	{
		id: 'wood-herringbone-parquet',
		label: 'Herringbone Parquet',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'wood-herringbone-parquet',
			color: '#ffffff',
			roughness: 1,
			metalness: 0,
			tileMeters: [3.4, 3.4],
			colorMap: true,
			occlusion: true
		})
	},
	{
		id: 'stone-travertine',
		label: 'Travertine',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'stone-travertine',
			color: '#ffffff',
			roughness: 1,
			metalness: 0,
			tileMeters: [1.2, 1.2],
			colorMap: true,
			occlusion: true
		})
	},
	{
		id: 'stone-terrazzo',
		label: 'Terrazzo',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'stone-terrazzo',
			color: '#ffffff',
			roughness: 1,
			metalness: 0,
			tileMeters: [0.8, 0.8],
			colorMap: true,
			occlusion: false
		})
	},
	{
		id: 'masonry-brick-red',
		label: 'Red Brick',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'masonry-brick-red',
			color: '#ffffff',
			roughness: 1,
			metalness: 0,
			tileMeters: [1.0, 1.0],
			colorMap: true,
			occlusion: true
		})
	},
	{
		id: 'plaster-painted',
		label: 'Painted Plaster',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'plaster-painted',
			color: '#fbfff9',
			roughness: 1,
			metalness: 0,
			tileMeters: [2.0, 2.0],
			colorMap: true,
			occlusion: true
		})
	},
	{
		id: 'concrete-smooth',
		label: 'Smooth Concrete',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'concrete-smooth',
			color: '#e7e6ff',
			roughness: 1,
			metalness: 0,
			tileMeters: [2.4, 2.4],
			colorMap: true,
			occlusion: false
		})
	},
	{
		id: 'concrete-polished',
		label: 'Polished Concrete',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'concrete-smooth',
			color: '#e7e6ff',
			roughness: 0.45,
			metalness: 0,
			tileMeters: [2.4, 2.4],
			colorMap: true,
			occlusion: false
		})
	},
	{
		id: 'tile-ceramic-white',
		label: 'White Ceramic Tile',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'tile-ceramic-white',
			color: '#f3f4f0',
			roughness: 1,
			metalness: 0,
			tileMeters: [1.0, 1.0],
			colorMap: true,
			occlusion: true
		})
	},
	{
		id: 'metal-stainless-satin',
		label: 'Satin Stainless Steel',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'metal-satin',
			color: '#d6d1cb',
			roughness: 1,
			metalness: 1,
			tileMeters: [0.5, 0.5],
			colorMap: false,
			occlusion: false
		})
	},
	{
		id: 'metal-brass-satin',
		label: 'Satin Brass',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'metal-satin',
			color: '#f5e4ae',
			roughness: 1,
			metalness: 1,
			tileMeters: [0.5, 0.5],
			colorMap: false,
			occlusion: false
		})
	},
	{
		id: 'metal-copper-satin',
		label: 'Satin Copper',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'metal-satin',
			color: '#f7cfbf',
			roughness: 1,
			metalness: 1,
			tileMeters: [0.5, 0.5],
			colorMap: false,
			occlusion: false
		})
	},
	{
		id: 'metal-gold-satin',
		label: 'Satin Gold',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'metal-satin',
			color: '#ffe496',
			roughness: 1,
			metalness: 1,
			tileMeters: [0.5, 0.5],
			colorMap: false,
			occlusion: false
		})
	},
	{
		id: 'metal-stainless-brushed',
		label: 'Brushed Stainless Steel',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'metal-brushed',
			color: '#d6d1cb',
			roughness: 1,
			metalness: 1,
			tileMeters: [0.5, 0.5],
			colorMap: false,
			occlusion: false
		})
	},
	{
		id: 'metal-aluminium-brushed',
		label: 'Brushed Aluminium',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'metal-brushed',
			color: '#f5f6f6',
			roughness: 1,
			metalness: 1,
			tileMeters: [0.5, 0.5],
			colorMap: false,
			occlusion: false
		})
	},
	{
		id: 'textile-linen',
		label: 'Natural Linen',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'textile-linen',
			color: '#fdeed2',
			roughness: 1,
			metalness: 0,
			tileMeters: [0.271, 0.271],
			colorMap: true,
			occlusion: true
		})
	},
	{
		id: 'textile-carpet-loop',
		label: 'Loop Pile Carpet',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'textile-carpet-loop',
			color: '#ffffff',
			roughness: 1,
			metalness: 0,
			tileMeters: [1.7, 1.7],
			colorMap: true,
			occlusion: true
		})
	},
	{
		id: 'leather-cognac',
		label: 'Cognac Leather',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'leather-smooth',
			color: '#eb8d60',
			roughness: 1,
			metalness: 0,
			tileMeters: [0.3, 0.3],
			colorMap: true,
			occlusion: true
		})
	},
	{
		id: 'synthetic-plastic-matte',
		label: 'Matte Plastic',
		technical: false,
		legacy: false,
		recipe: curated({
			set: 'synthetic-plastic-matte',
			color: '#f8fbf9',
			roughness: 1,
			metalness: 0,
			tileMeters: [0.5, 0.5],
			colorMap: true,
			occlusion: false
		})
	},
	{
		id: 'plaster-warm',
		label: 'Warm Plaster',
		technical: false,
		legacy: true,
		recipe: recipe({
			color: '#c4b4a0',
			roughness: 0.92,
			metalness: 0.02,
			tileMeters: [2, 2],
			colorImage: '/textures/plaster-warm/map.png',
			roughnessImage: '/textures/plaster-warm/roughness.png'
		})
	},
	{
		id: 'wood-walnut',
		label: 'Walnut Wood',
		technical: false,
		legacy: true,
		recipe: recipe({
			color: '#3d2a1a',
			roughness: 0.78,
			metalness: 0.04,
			tileMeters: [1.5, 1.5],
			colorImage: '/textures/wood-walnut/map.png',
			roughnessImage: '/textures/wood-walnut/roughness.png'
		})
	},
	{
		id: 'brass-aged',
		label: 'Aged Brass',
		technical: false,
		legacy: true,
		recipe: recipe({
			color: '#d6b35f',
			roughness: 0.45,
			metalness: 0.85,
			tileMeters: [0.5, 0.5],
			colorImage: '/textures/brass-aged/map.png'
		})
	},
	{
		id: 'marble-light',
		label: 'Light Marble',
		technical: false,
		legacy: true,
		recipe: recipe({ color: '#e8e4dc', roughness: 0.35, metalness: 0.08, tileMeters: [1.2, 1.2] })
	},
	{
		id: 'velvet-dark',
		label: 'Dark Velvet',
		technical: false,
		legacy: true,
		recipe: recipe({ color: '#3a1822', roughness: 0.95, metalness: 0, tileMeters: [1, 1] })
	},
	{
		id: 'paper-aged',
		label: 'Aged Paper',
		technical: false,
		legacy: true,
		recipe: recipe({ color: '#e2d2b0', roughness: 0.9, metalness: 0, tileMeters: [0.4, 0.4] })
	},
	{
		id: MATERIAL_NEUTRAL_BASE_ID,
		label: 'Neutral PBR',
		technical: true,
		legacy: false,
		recipe: NEUTRAL_RECIPE
	}
] as const);

const CATALOGUE_BY_ID = new Map(CATALOGUE.map((entry) => [entry.id, entry]));

/** Every material base id, including the technical neutral base. */
export const CATALOGUE_BASE_IDS: readonly string[] = Object.freeze(CATALOGUE.map((entry) => entry.id));

/** The complete immutable catalogue. */
export function catalogueMaterials(): readonly CatalogueMaterial[] {
	return CATALOGUE;
}

/** One base by id, or `undefined` when the id is not admitted. */
export function catalogueMaterial(id: string): CatalogueMaterial | undefined {
	return CATALOGUE_BY_ID.get(id);
}

/** One base's normalized recipe, or `undefined` for an unknown id. */
export function catalogueRecipe(id: string): Recipe | undefined {
	return CATALOGUE_BY_ID.get(id)?.recipe;
}

/** Whether an id is a legacy placeholder base (resolvable, not creator-facing). */
export function isLegacyMaterialId(id: string): boolean {
	return (LEGACY_MATERIAL_IDS as readonly string[]).includes(id);
}

/** Whether an id is an admitted catalogue base, including the neutral base. */
export function isCatalogueMaterialId(id: string): boolean {
	return CATALOGUE_BY_ID.has(id);
}

/** The shipped image entry for a logical URI, or `undefined`. */
export function shippedImage(uri: string): CatalogueImage | undefined {
	return IMAGE_BY_URI.get(uri);
}

/** The shipped image entry for a content digest, or `undefined`. */
export function shippedImageByHash(hash: string): CatalogueImage | undefined {
	return IMAGE_BY_HASH.get(hash);
}

/**
 * Plain render facts a catalogue facade can join to labels and thumbnails.
 * The URI is the logical shipped path, never a bundler URL.
 */
export type CatalogueRenderFacts = {
	readonly id: string;
	readonly label: string;
	readonly color: string;
	readonly roughness: number;
	readonly metalness: number;
	readonly defaultTileSizeMeters: readonly [number, number];
	readonly mapUris: Readonly<Partial<Record<MapRole, string>>>;
};

/** The normalized recipe expressed in the editor catalogue's existing terms. */
export function catalogueRenderFacts(id: string): CatalogueRenderFacts | undefined {
	const entry = CATALOGUE_BY_ID.get(id);
	if (entry === undefined) return undefined;
	const mapUris: Partial<Record<MapRole, string>> = {};
	for (const role of ['color', 'normal', 'roughness', 'metalness', 'occlusion'] as const) {
		const binding = entry.recipe.maps[role];
		if (binding === undefined) continue;
		const image = shippedImageByHash(binding.image);
		if (image === undefined) continue;
		mapUris[role] = image.uri;
	}
	const mapping = entry.recipe.mapping;
	const tileMeters = mapping.kind === 'uv' ? ([1, 1] as const) : mapping.metric.tileMeters;
	return deepFreeze({
		id: entry.id,
		label: entry.label,
		color: entry.recipe.color,
		roughness: entry.recipe.roughness,
		metalness: entry.recipe.metalness,
		defaultTileSizeMeters: [tileMeters[0], tileMeters[1]],
		mapUris
	});
}
