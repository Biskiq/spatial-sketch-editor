import { SCENE_SKY_UPDATE_KIND } from '@portfolio/project-model/units';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-adapter-host';
import type { CelestialDialModel } from '$lib/authoring/look/celestial-dial';

export function skyHandles(dial: CelestialDialModel | null | undefined): readonly StageHandleDescriptor[] {
	if (!dial) return [];
	const grip = (id: string, label: string, anchor: typeof dial.noon, hitRadiusCss: number): StageHandleDescriptor => ({
		id, label, anchor, hitRadiusCss, kind: 'point', role: 'edit',
		fact: id === 'noon' ? 'heading' : 'time', verb: label, planner: SCENE_SKY_UPDATE_KIND,
		draw: { hidden: true }, hitGroup: 'sky'
	});
	return [
		...(dial.shadow ? [grip('glyph', 'Time', dial.glyph, 18), grip('tip', 'Shadow tip', dial.shadow, 12)] : []),
		grip('noon', 'Noon bearing', dial.noon, 11)
	];
}
