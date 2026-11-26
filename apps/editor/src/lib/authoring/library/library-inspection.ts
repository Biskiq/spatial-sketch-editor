/**
 * The Library inspection's remembered geometry and lighting.
 * Session view state only: Library detail and Customise… share it, nothing
 * serializes it.
 */
export type LibraryInspectionGeometry = 'sphere' | 'plane' | 'block';
export type LibraryInspectionLighting = 'studio' | 'grazing' | 'world';
export type LibraryInspectionSettings = {
	readonly geometry: LibraryInspectionGeometry;
	readonly lighting: LibraryInspectionLighting;
};
export const LIBRARY_INSPECTION_DEFAULT: LibraryInspectionSettings = {
	geometry: 'sphere',
	lighting: 'studio',
};
