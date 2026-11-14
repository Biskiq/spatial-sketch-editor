/**
 * Light authoring adapter — registration, composition and dispatch.
 *
 * X8: the behavior lives in bounded owners under `./light/`. Placement (the armed
 * kind, the captured press, the held create) is `light-placement-session`; the
 * mark gestures of an existing light are `light-gesture-session`; the subjects,
 * picking, marks, guides, Card and tasks are `light-contributions`. They share one
 * gesture lease, one grip refusal and one install window through the ports in
 * `light-session-ports`. This file keeps no state of its own: it binds those
 * owners to the Stage host and routes each pointer phase to the right one.
 */
import type { StageAdapter, StageAdapterFactory } from '$lib/authoring/stage/stage-adapter-host';
import { createLightContributions } from './light/light-contributions';
import { createLightGestureSession } from './light/light-gesture-session';
import { createLightPlacementSession } from './light/light-placement-session';
import {
	clearLightPreview,
	createLightInstallWindow,
	createLightLease,
	createLightRefusal
} from './light/light-session-ports';

export const createAdapter: StageAdapterFactory = (services) => {
	const adapter: StageAdapter = {
		id: 'light',
		requiredCapabilities: ['stage-instrument-v1'],
		plannerKinds: ['create-light', 'update-light', 'duplicate-light', 'delete-one', 'set-name'],
		bind(context): ReturnType<NonNullable<StageAdapter['bind']>> {
			const lease = createLightLease(services);
			const refusal = createLightRefusal();
			const install = createLightInstallWindow();
			const gesture = createLightGestureSession({ services, lease, refusal, install });
			const placement = createLightPlacementSession({ services, lease, refusal, install });
			const contributions = createLightContributions({ services, context, gesture, refusal });

			return {
				...contributions,
				candidatePreview: (adapterContext) => placement.candidatePreview(adapterContext),
				hoverIntent(intent, adapterContext) {
					// A new pointer move starts a fresh candidate after a refused release.
					placement.clearRefusal();
					return placement.hover(intent, adapterContext, gesture.active);
				},
				pointerIntent(intent, adapterContext) {
					// One release is one commit: while it is in flight the held ghost
					// stays and further moves and clicks are ignored.
					if (placement.placing) return true;
					if (intent.phase === 'down') {
						placement.clearRefusal();
						const began = gesture.begin(
							intent,
							adapterContext,
							!placement.taskOpen && intent.shift === true
						);
						if (began === 'started') return true;
						if (began === 'blocked' || !placement.taskOpen) return false;
						return placement.press(intent, adapterContext);
					}
					if (!gesture.active && !placement.active) return false;
					if (intent.phase === 'cancel') {
						const cancelled = gesture.drop();
						placement.drop();
						lease.release();
						clearLightPreview(services, cancelled);
						placement.zeroCandidate();
						services.stage.notifySurfaceChange();
						return true;
					}
					if (intent.phase === 'move') {
						if (gesture.active) gesture.move(intent, adapterContext);
						else placement.move(intent, adapterContext);
						services.stage.notifySurfaceChange();
						return true;
					}
					if (intent.phase === 'up') {
						if (!gesture.finish(intent, adapterContext)) placement.finish(intent, adapterContext);
						services.stage.notifySurfaceChange();
						return true;
					}
					return false;
				},
				instrument: (task) => placement.instrument(task),
				taskClosed() {
					placement.closeTask();
					gesture.drop();
					lease.release();
					clearLightPreview(services);
				},
				dispose() {
					placement.reset();
					gesture.drop();
					lease.release();
					clearLightPreview(services);
					placement.disarmUnlessInstalling();
				}
			};
		}
	};
	return adapter;
};
