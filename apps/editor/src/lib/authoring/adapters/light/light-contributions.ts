/**
 * X8 — the Light binding's read-only contributions.
 *
 * Everything the Light adapter contributes to the Stage that does not capture
 * input: the Lights task, subjects, picking, the erase and delete routes, the
 * marks, the guides, the dial-tick hover tag and the Card (fields, facts, name,
 * actions). It reads the gesture session's captured copy and the grip refusal
 * through narrow views and owns only the idle-hover tick tag, which is
 * session-only presentation: never selection, history or source.
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
import { directionalTickAt, guideSegments } from './light-guides';
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
	| 'idleHoverIntent'
	| 'cardWriter'
	| 'cardFacts'
	| 'cardName'
	| 'cardActions';

export type LightContributions = Required<Pick<StageAdapterBinding, LightContributionKeys>>;

export type LightContributionDeps = {
	readonly services: StageAdapterServices;
	/** The binding context's scene pick; camera-free, so a Card read may use it. */
	readonly context: StageAdapterContext;
	/** The captured gesture's dragged copy and frozen dial frame. */
	readonly gesture: Pick<LightGestureSession, 'entity' | 'dialFrame'>;
	readonly refusal: LightRefusal;
};

export function createLightContributions(deps: LightContributionDeps): LightContributions {
	const { services, context, gesture, refusal } = deps;
	const source = stageScene(context.snapshot);
	/** The Directional tick under an unpressed pointer, for its name tag. */
	let hoveredDialTick: string | null = null;

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
			const nearest =
				lightGlyphAt(candidate.css, live) ??
				directionalTickAt(
					candidate.css,
					live,
					candidate.coarse === true,
					services.stage,
					gesture.dialFrame
				);
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
			return lightMarkDescriptors(
				light,
				adapterContext,
				services.stage,
				refusal.current(),
				gesture.dialFrame
			);
		},
		guides(adapterContext) {
			const light = effectiveLight(adapterContext);
			if (light === null) return [];
			const guide = guideSegments(light, adapterContext, services.stage, hoveredDialTick);
			return [
				{
					id: 'light-guide',
					role: 'selection' as const,
					segments: guide.segments,
					derivedSegments: guide.derivedSegments,
					labels: guide.labels
				}
			];
		},
		idleHoverIntent(intent, adapterContext) {
			if (intent.phase === 'cancel') {
				if (hoveredDialTick !== null) {
					hoveredDialTick = null;
					services.stage.notifySurfaceChange();
				}
				return false;
			}
			const tick = directionalTickAt(
				intent.css,
				adapterContext,
				intent.coarse === true,
				services.stage,
				gesture.dialFrame
			);
			const next = tick?.light.id ?? null;
			if (next !== hoveredDialTick) {
				hoveredDialTick = next;
				services.stage.notifySurfaceChange();
			}
			return false;
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
