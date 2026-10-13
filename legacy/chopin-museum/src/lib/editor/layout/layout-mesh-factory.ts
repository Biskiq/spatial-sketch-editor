import {
	compileLayoutGeometry,
	compileWallFirstLayoutGeometry
} from '$lib/layout/layout-geometry';
import type { LayoutDocument, LayoutVec2 } from '$lib/layout/layout-types';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
import type { LayoutGeometryIssue } from '$lib/layout/layout-geometry-validation';
import type {
	CompiledCurveSample,
	CompiledLayoutGeometry,
	CompiledLayoutQueryGeometry,
	CompiledOpening,
	CompiledSolidSpan,
	CompiledWallSection,
	LayoutBounds3
} from '$lib/layout/layout-geometry-types';
import type { LayoutObjectDescriptor } from './layout-object-editing';

export type WallPreview = {
	segmentId: string;
	start: LayoutVec2;
	end: LayoutVec2;
	height: number;
	thickness: number;
	length: number;
	samples: CompiledCurveSample[];
	sections: CompiledWallSection[];
	solidSpans: CompiledSolidSpan[];
	openings: CompiledOpening[];
	solidCenterlinePolylines: LayoutVec2[][];
};

export type LayoutRoomPreview = {
	roomId: string;
	floorElevation: number;
	ceilingElevation: number;
	floorThickness: number;
	ceilingThickness: number;
	floorPolygon: LayoutVec2[];
	ceilingPolygon: LayoutVec2[];
	walls: WallPreview[];
};

export type LayoutPreviewModel = {
	rooms: LayoutRoomPreview[];
	objects: LayoutObjectDescriptor[];
	queries: CompiledLayoutQueryGeometry;
};

export type LayoutPreviewModelResult = {
	model: LayoutPreviewModel;
	geometry: CompiledLayoutGeometry;
	issues: LayoutGeometryIssue[];
	bounds: LayoutBounds3 | null;
};

/**
 * Editor preview projection. All geometry is adapted from the single shared
 * `compileLayoutGeometry()` contract; no curve is resampled or reinterpreted
 * here.
 */
export function buildLayoutPreviewModel(
	document: LayoutDocument | LayoutDocumentWallFirst
): LayoutPreviewModelResult {
	const result = isWallFirstLayout(document)
		? compileWallFirstLayoutGeometry(document)
		: compileLayoutGeometry(document);
	return {
		model: projectLayoutPreviewModel(result.geometry),
		geometry: result.geometry,
		issues: result.issues,
		bounds: result.geometry.bounds
	};
}

/**
 * The one **pure projection** of a compiled layout into the Plan/3D preview
 * model. Split out of `buildLayoutPreviewModel` so a caller that already holds a
 * compile result — or a geometry it derived that model from before — projects it
 * without compiling again. It reads nothing but its argument, so projecting the
 * same geometry twice always yields the same model.
 */
export function projectLayoutPreviewModel(geometry: CompiledLayoutGeometry): LayoutPreviewModel {
	return {
		rooms: geometry.rooms.map((room) => ({
			roomId: room.roomId,
			floorElevation: room.floorElevation,
			ceilingElevation: room.ceilingElevation,
			floorThickness: room.floorThickness,
			ceilingThickness: room.ceilingThickness,
			floorPolygon: room.floorPolygon,
			ceilingPolygon: room.ceilingPolygon,
			walls: room.walls.map((wall) => ({
				segmentId: wall.segmentId,
				start: wall.samples[0]?.point ?? ([0, 0] as LayoutVec2),
				end: wall.samples.at(-1)?.point ?? ([0, 0] as LayoutVec2),
				height: room.ceilingElevation - room.floorElevation,
				thickness: wall.thickness,
				length: wall.length,
				samples: wall.samples,
				sections: wall.sections,
				solidSpans: wall.solidSpans,
				openings: wall.openings,
				solidCenterlinePolylines: wall.solidCenterlinePolylines
			}))
		})),
		objects: geometry.objects,
		queries: geometry.queries
	};
}

function isWallFirstLayout(
	document: LayoutDocument | LayoutDocumentWallFirst
): document is LayoutDocumentWallFirst {
	return 'formatVersion' in document;
}
