/**
 * V3c — the one Region whose roof-local section is open for Edit shape.
 *
 * This is session UI state, not a document fact and not a planner authority. It
 * lives at editor scope so the Card's Edit shape/Done action and the Stage's
 * section marks read the same answer; an accepted edit rebuilds the binding and
 * the marks follow the new Region, while closing or selecting another Region
 * ends the mode.
 */
class RegionShapeStore {
	private regionId: string | null = null;

	current(): string | null {
		return this.regionId;
	}

	isActive(regionId: string): boolean {
		return this.regionId === regionId;
	}

	open(regionId: string): void {
		this.regionId = regionId;
	}

	close(): void {
		this.regionId = null;
	}
}

export const regionShape = new RegionShapeStore();
