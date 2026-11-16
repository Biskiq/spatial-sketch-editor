import { pointerRay } from '@portfolio/camera-core';
import { wrap360 } from '$lib/render/sky-time';
import { nearestT, type DialGrip } from '$lib/authoring/look/celestial-dial';
import { skySession } from '$lib/authoring/look/sky-session.svelte';
import type { GestureLease, StageAdapterServices, StagePointerIntent } from '$lib/authoring/stage/stage-adapter-host';

export function createSkyDialSession({ stage }: StageAdapterServices) {
	let drag: {
		grip: DialGrip;
		lease: GestureLease;
		dial: NonNullable<ReturnType<NonNullable<ReturnType<typeof skySession>>['dial']>>;
		owner: 'dial-time' | 'dial-heading';
		gesture: NonNullable<ReturnType<typeof skySession>>['look']['gesture'];
	} | null = null;

	function cancel(): boolean {
		if (!drag) return false;
		const held = drag;
		drag = null;
		held.gesture.cancel();
		held.lease.release();
		return true;
	}

	function pointerIntent(intent: StagePointerIntent): boolean {
		const session = skySession(stage.session);
		if (intent.phase === 'down') {
			const dial = session?.dial();
			const grip = intent.handleId;
			if (!session || !dial || (grip !== 'noon' && grip !== 'tip' && grip !== 'glyph')) return false;
			const owner = grip === 'noon' ? 'dial-heading' : 'dial-time';
			if (!session.look.gesture.begin(owner)) return false;
			const acquired = stage.acquireGesture({ owner: 'sky', evaluationId: intent.evaluationId, policy: 'cancel-on-reading-change' });
			if (acquired.kind !== 'granted') {
				session.look.gesture.cancel();
				return false;
			}
			drag = { grip, dial, owner, gesture: session.look.gesture, lease: acquired.lease };
			return true;
		}
		if (!drag) return false;
		if (!drag.lease.active || intent.phase === 'cancel' || !session || !session.dial()) return cancel();
		const camera = stage.evaluation();
		if (!camera) return cancel();
		const { grip, dial, gesture, owner, lease } = drag;
		if (grip === 'noon') {
			const ray = pointerRay(intent.css, camera, camera.token);
			if (ray.kind === 'ray' && Math.abs(ray.ray.direction[1]) > 1e-6) {
				const anchor = dial.placement.anchor;
				const distance = (anchor[1] - ray.ray.origin[1]) / ray.ray.direction[1];
				const x = ray.ray.origin[0] + distance * ray.ray.direction[0] - anchor[0];
				const z = ray.ray.origin[2] + distance * ray.ray.direction[2] - anchor[2];
				const step = intent.altKey ? 1 : 15;
				gesture.move(owner, { heading: wrap360(Math.round((Math.atan2(x, -z) * 180 / Math.PI - 180) / step) * step) });
			}
		} else if (dial.body.phase === 'day' || dial.body.phase === 'night') {
			const sky = gesture.value;
			gesture.move(owner, { time: nearestT(intent.css, sky.time, dial.body.phase, grip, dial.placement, camera, sky) });
		}
		if (intent.phase === 'up') {
			drag = null;
			lease.release();
			void gesture.commit(owner);
		}
		return true;
	}

	return { pointerIntent, cancel };
}
