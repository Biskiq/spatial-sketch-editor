/**
 * X8 — the Light binding's read-only contributions.
 *
 * Everything the Light adapter contributes to the Stage that does not capture
 * input: the Lights task, subjects, picking, the erase and delete routes, the
 * marks, the guides and the Card (fields, facts, name, actions). It reads the
 * gesture session's captured copy and the grip refusal through narrow views and
 * holds no state of its own.
 */
import type {
	StageAdapterBinding,
	StageAdapterContext,
	StageAdapterServices
} from '$lib/authoring/stage/stage-adapter-host';
import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
import { sceneEntityReference } from '../scene/placement';
import { lightCardActions, deleteLightAction, lightNameWriter } from './light-actions';
import { lightCardFacts } from './light-card';
import { guideSegments } from './light-guides';
import { lightMarkDescriptors } from './light-marks';
import type { LightRefusal } from './light-session-ports';
import type { LightGestureSession } from './light-gesture-session';
import { LIGHT_TASK, isLight, lightById, lightGlyphAt, selectedLight, type Light } from './light-subjects';
import LightCardFields from './LightCardFields.svelte';

export type LightContributionKeys =
	| 'hostTools'
	| 'pressWhenNoTask'
	| 'tasks'
	| 'subjects'
	| 'pick'
	| 'eraseAction'
	| 'keyIntent'
	| 'handles'
	| 'guides'
	| 'cardWriter'
	| 'cardFacts'
	| 'cardName'
	| 'cardActions';

export type LightContributions = Required<Pick<StageAdapterBinding, LightContributionKeys>>;

export type LightContributionDeps = {
	readonly services: StageAdapterServices;
	/** The binding context's scene pick; camera-free, so a Card read may use it. */
	readonly context: StageAdapterContext;
	/** The captured gesture's dragged copy. */
	readonly gesture: Pick<LightGestureSession, 'entity'>;
	readonly refusal: LightRefusal;
};

export function createLightContributions(deps: LightContributionDeps): LightContributions {
	const { services, context, gesture, refusal } = deps;
	const source = stageScene(context.snapshot);

	const effectiveLight = (adapterContext: StageAdapterContext): Light | null =>
		gesture.entity ?? selectedLight(adapterContext);

	return {
		hostTools: ['erase'],
		pressWhenNoTask: true,
		tasks: [
			{
				id: LIGHT_TASK,
				taskKind: LIGHT_TASK,
				label: 'Lights',
				targetRef: null,
				// Marks beat placement: the selected light can be edited immediately
				// after the install without a second trip to the dock.
				marksWhileOpen: true,
				order: 40
			}
		],
		subjects: source.entities.filter(isLight).map((entity) => ({
			id: `scene:entity:${entity.id}`,
			label: entity.name,
			reference: sceneEntityReference(entity.id, context.snapshot.domain.unitRevisions.scene),
			worldPoint: entity.position
		})),
		pick(candidate, live) {
			const nearest = lightGlyphAt(candidate.css, live);
			if (nearest === null) return null;
			return {
				hit: {
					sourceId: nearest.light.id,
					sourceKind: 'entity',
					reference: sceneEntityReference(
						nearest.light.id,
						live.snapshot.domain.unitRevisions.scene
					),
					worldPoint: [...nearest.light.position]
				},
				refusal: null,
				depthMeters: null,
				planLayer: null,
				cssDistance: nearest.distance
			};
		},
		eraseAction(hit) {
			if (hit.reference?.domain !== 'scene') return null;
			const light = lightById(services.stage.snapshot(), hit.sourceId);
			return light === null
				? { kind: 'refused', message: 'That light cannot be erased.' }
				: { kind: 'action', action: deleteLightAction(services, light), confirm: false };
		},
		keyIntent(intent, adapterContext) {
			if (intent.kind !== 'delete') return false;
			const light = selectedLight(adapterContext);
			if (light === null) return false;
			void deleteLightAction(services, light).run();
			return true;
		},
		handles(adapterContext) {
			const light = effectiveLight(adapterContext);
			if (light === null) return [];
			return lightMarkDescriptors(light, adapterContext, refusal.current());
		},
		guides(adapterContext) {
			const light = effectiveLight(adapterContext);
			if (light === null) return [];
			const guide = guideSegments(light, adapterContext);
			return [
				{
					id: 'light-guide',
					role: 'selection' as const,
					segments: guide.segments,
					derivedSegments: guide.derivedSegments
				}
			];
		},
		cardWriter(subject) {
			if (subject.reference?.domain !== 'scene') return null;
			const light = lightById(services.stage.snapshot(), subject.sourceId);
			if (light === null) return null;
			return {
				summary: 'Light fields',
				inlineActions: true,
				fieldIds: [
					'brightness',
					'warmth',
					'color',
					'position',
					'aim',
					'reach',
					'angle',
					'soft-edge',
					'shadow'
				],
				view: { component: LightCardFields, services }
			};
		},
		cardFacts: (subject) => lightCardFacts(services, subject, context),
		cardName: (subject) => lightNameWriter(services, subject),
		cardActions: (subject) => lightCardActions(services, subject)
	};
}
