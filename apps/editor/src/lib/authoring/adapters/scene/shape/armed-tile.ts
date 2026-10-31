/**
 * Which Objects tile is armed for a project, and whether its panel is compact.
 *
 * An install retires the Scene binding and remounts the panel while the creator's
 * tool stays armed, so this belongs beside the project's other pending arm (a
 * model awaiting placement) rather than to either of them. It is session state:
 * nothing here reaches a document.
 */
import type { ShapeKind } from './outline';

/** A Shape tile; Sphere has no drawn outline and places through existing Place. */
export type ObjectTile = ShapeKind | 'sphere';

type Arm = { tile: ObjectTile | null; compact: boolean };

const arms = new Map<string, Arm>();

function armOf(projectId: string): Arm {
	let arm = arms.get(projectId);
	if (arm === undefined) {
		arm = { tile: 'box', compact: false };
		arms.set(projectId, arm);
	}
	return arm;
}

export function armedTile(projectId: string): ObjectTile | null {
	return armOf(projectId).tile;
}

/** Name the tile, or `null` when a model or saved copy is what is armed. */
export function armTile(projectId: string, tile: ObjectTile | null): void {
	armOf(projectId).tile = tile;
}

export function objectsPanelCompact(projectId: string): boolean {
	return armOf(projectId).compact;
}

export function setObjectsPanelCompact(projectId: string, compact: boolean): void {
	armOf(projectId).compact = compact;
}
