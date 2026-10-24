<script lang="ts">
	import { onMount } from 'svelte';
	import { T, useTask, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { MathUtils, Spherical, Vector3 } from 'three';
	import type { PerspectiveCamera } from 'three';
	import {
		getNode,
		createCameraMotion,
		createCameraMotionSample,
		sampleCameraMotion,
		VISITOR_CAMERA_PROJECTION,
		CAMERA_FOV_UPDATE_EPSILON,
		type CameraMotion
	} from '@portfolio/camera-core';
	import type { NavigationGraph } from '@portfolio/project-model';
	import type { VisitorRuntimeState } from './visitor-runtime-state.svelte';
	import { resolveVisitorCameraRoute } from './visitor-camera-route';
	import type { LayoutBounds3 } from '@portfolio/layout-core';

	let {
		graph,
		visitor,
		bounds = null,
		runEpoch = 0,
		onCameraGap
	}: {
		graph: NavigationGraph;
		visitor: VisitorRuntimeState;
		bounds?: LayoutBounds3 | null;
		/** The run this director presents; a new run reframes from its own entry. */
		runEpoch?: number;
		/** Surfaces a typed handoff gap instead of silently re-routing. */
		onCameraGap?: (message: string | null) => void;
	} = $props();

	// A reused surface keeps this component (and its look-around offset) alive.
	// A new run starts from its own entry View, not from the previous run's aim.
	$effect(() => {
		void runEpoch;
		cameraViewId = null;
		activeMotion = null;
		activeTargetViewId = null;
		lookYaw = 0;
		lookPitch = 0;
		lookViewId = null;
	});

	const currentViewId = $derived(visitor.currentViewId);
	let cameraRef: PerspectiveCamera | undefined = $state(undefined);

	const motionSample = createCameraMotionSample();
	const currentPosition = motionSample.position;
	const currentTarget = motionSample.target;
	let cameraViewId: string | null = null;

	function setNeutralFrame() {
		currentPosition.set(0, 8, 12);
		currentTarget.set(0, 1, 0);
		motionSample.fov = VISITOR_CAMERA_PROJECTION.fov;
	}

	function frameFor(viewId: string | null) {
		if (viewId === null) {
			setNeutralFrame();
			return;
		}
		// The graph is derived from the F.2 Camera unit. A View that is absent from
		// a released snapshot must degrade to the neutral frame, not throw inside a
		// reactive effect and blank the whole surface.
		let node;
		try {
			node = getNode(viewId, graph);
		} catch {
			setNeutralFrame();
			return;
		}
		currentPosition.set(...node.position);
		currentTarget.set(...node.cameraTarget);
		motionSample.fov = node.fov;
	}

	// svelte-ignore state_referenced_locally
	frameFor(currentViewId);
	const initialCameraPosition: [number, number, number] = [
		currentPosition.x,
		currentPosition.y,
		currentPosition.z
	];
	const initialCameraFov = motionSample.fov;

	let activeMotion: CameraMotion | null = null;
	let activeTargetViewId: string | null = $state(null);
	let transitionProgress: number = $state(1);

	const { canvas } = useThrelte();
	const lookDirection = new Vector3();
	const lookSpherical = new Spherical();
	const lookYawLimit = MathUtils.degToRad(130);
	const lookUpLimit = MathUtils.degToRad(32);
	const lookDownLimit = MathUtils.degToRad(25);
	const lookKeyStep = MathUtils.degToRad(4);
	const lookPointerSensitivity = 0.003;
	let lookYaw = 0;
	let lookPitch = 0;
	let lookViewId: string | null = null;

	let pointerId: number | null = null;
	let previousPointerX = 0;
	let previousPointerY = 0;

	const isAuthoredMode = () => currentViewId !== null;
	const canLookAround = () => isAuthoredMode() && activeTargetViewId === null;

	function cancelPointerLook() {
		if (pointerId !== null) {
			try {
				if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
			} catch {
				// Canvas may be detached during takeover teardown.
			}
		}
		pointerId = null;
		if (isAuthoredMode()) canvas.style.cursor = canLookAround() ? 'grab' : '';
		else canvas.style.cursor = '';
	}

	$effect(() => {
		// Only a changed Presentation view starts Camera motion. The Experience
		// interpreter owns why the visitor moved; this owns how the Camera gets
		// there. A Cut (or reduced motion) is instant; a Travel animates the
		// Camera route the unit already validated.
		const targetViewId = currentViewId;
		if (targetViewId === null) {
			cameraViewId = null;
			activeMotion = null;
			activeTargetViewId = null;
			onCameraGap?.(null);
			frameFor(null);
			return;
		}
		// An explicit Cut, reduced motion, or the first framing settles instantly.
		// This decision comes **before** the in-flight guard: a Cut to the View the
		// Camera is already travelling to — or a reduced-motion toggle mid-travel —
		// is a command to settle now, not a duplicate hold-tick re-run. Only an
		// actual change is applied, so a hold at a Cut Stop does not reframe (and so
		// does not cancel look-around) on every interpreter tick.
		const invocation = visitor.currentInvocation ?? { kind: 'cut' as const, viewId: targetViewId };
		if (cameraViewId === null || visitor.reducedMotion || invocation.kind === 'cut') {
			const settling = cameraViewId !== targetViewId || activeTargetViewId !== null || activeMotion !== null;
			if (!settling) return;
			cameraViewId = targetViewId;
			activeMotion = null;
			activeTargetViewId = null;
			onCameraGap?.(null);
			frameFor(targetViewId);
			return;
		}
		// A target equal to the settled View is a duplicate hold tick only when no
		// Travel is in flight. With one in flight it is a real new invocation —
		// for example an authored Travel back to the View the Camera left — and the
		// handoff below must realize it rather than letting the stale motion run on.
		if (targetViewId === cameraViewId && activeTargetViewId === null) return;
		// A hold tick or any other interpreter state write re-runs this effect
		// while the Camera is still travelling: `cameraViewId` stays at the origin
		// until the motion completes. Starting the same route again would reset
		// progress from the current mid-flight pose on every frame. The in-flight
		// target is the guard; a different target still re-routes from here.
		if (activeTargetViewId === targetViewId) return;
		// A Travel can overtake the one still in flight: the previous Stop's
		// authored hold expires on editorial time, not when the Camera physically
		// arrives. The interpreter has already left that Stop, so the next
		// connection's declared origin is authoritative. Accept the handoff from
		// the live pose; never finish the stale Travel first (that would reorder
		// the authored motion) and never substitute pathfinding.
		const handoffFromViewId =
			activeTargetViewId !== null && activeTargetViewId !== targetViewId
				? activeTargetViewId
				: null;
		const resolved = resolveVisitorCameraRoute({
			fromViewId: cameraViewId,
			toViewId: targetViewId,
			invocation,
			graph,
			handoffFromViewId
		});
		if (resolved.kind === 'gap') {
			// Camera owns how; it cannot invent a different connection. Settle on the
			// requested View as a Cut and surface the gap rather than pathfinding.
			cameraViewId = targetViewId;
			activeMotion = null;
			activeTargetViewId = null;
			onCameraGap?.(resolved.reason);
			frameFor(targetViewId);
			return;
		}
		onCameraGap?.(null);
		activeMotion = createCameraMotion(resolved.route, {
			position: currentPosition,
			target: currentTarget,
			fov: motionSample.fov
		});
		// A handoff overtook a Travel to `originViewId`: that View is now the
		// logical origin the Experience left, even though the Camera never
		// finished reaching it. The next connection is evaluated from there.
		cameraViewId = resolved.originViewId;
		activeTargetViewId = targetViewId;
		transitionProgress = 0;
	});

	useTask((delta) => {
		if (!cameraRef || !isAuthoredMode()) return;
		if (visitor.state.phase === 'holding') visitor.tick(delta * 1000);
		if (activeTargetViewId && activeMotion) {
			if (activeMotion.durationSeconds === 0) {
				transitionProgress = 1;
			} else {
				const speed = visitor.reducedMotion ? 24 : 1 / activeMotion.durationSeconds;
				transitionProgress = Math.min(1, transitionProgress + delta * speed);
			}
			sampleCameraMotion(activeMotion, transitionProgress, motionSample);
			if (transitionProgress >= 1) {
				cameraViewId = activeTargetViewId;
				activeTargetViewId = null;
				activeMotion = null;
			}
		} else if (!activeTargetViewId) {
			let node;
			try {
				node = getNode(cameraViewId ?? '', graph);
			} catch {
				return;
			}
			currentPosition.set(...node.position);
			currentTarget.set(...node.cameraTarget);
			motionSample.fov = node.fov;
		}
		if (canLookAround()) {
			lookDirection.copy(currentTarget).sub(currentPosition);
			lookSpherical.setFromVector3(lookDirection);
			lookSpherical.theta += lookYaw;
			lookSpherical.phi = MathUtils.clamp(
				lookSpherical.phi + lookPitch,
				0.08,
				Math.PI - 0.08
			);
			lookDirection.setFromSpherical(lookSpherical);
			currentTarget.copy(currentPosition).add(lookDirection);
		}
		cameraRef.position.copy(currentPosition);
		cameraRef.lookAt(currentTarget);
		if (Math.abs(cameraRef.fov - motionSample.fov) > CAMERA_FOV_UPDATE_EPSILON) {
			cameraRef.fov = motionSample.fov;
			cameraRef.updateProjectionMatrix();
		}
	});

	function isEditableTarget(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return false;
		return target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName);
	}

	function isInteractiveTarget(target: EventTarget | null) {
		return (
			target instanceof HTMLElement &&
			Boolean(target.closest('button, a[href], [role="button"]'))
		);
	}

	function hasModifier(event: KeyboardEvent) {
		return event.ctrlKey || event.metaKey || event.altKey;
	}

	onMount(() => {
		// Register unconditionally: the surface starts neutral and enters after a
		// parent mount, so an authored-mode guard here would never attach.
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			const canvasEl = canvas as HTMLCanvasElement;
			const root = canvasEl.closest('[data-visitor-canvas-root]');
			const active = document.activeElement;
			if (root && active && !root.contains(active)) return;
			if (hasModifier(event)) return;
			if (isEditableTarget(event.target)) return;
			if (isInteractiveTarget(event.target)) return;

			const key = event.key;
			if (canLookAround() && (key === 'w' || key === 'W')) {
				event.preventDefault();
				lookPitch = MathUtils.clamp(lookPitch - lookKeyStep, -lookUpLimit, lookDownLimit);
				return;
			}
			if (canLookAround() && (key === 's' || key === 'S')) {
				event.preventDefault();
				lookPitch = MathUtils.clamp(lookPitch + lookKeyStep, -lookUpLimit, lookDownLimit);
				return;
			}
			if (canLookAround() && (key === 'a' || key === 'A')) {
				event.preventDefault();
				lookYaw = MathUtils.clamp(lookYaw + lookKeyStep, -lookYawLimit, lookYawLimit);
				return;
			}
			if (canLookAround() && (key === 'd' || key === 'D')) {
				event.preventDefault();
				lookYaw = MathUtils.clamp(lookYaw - lookKeyStep, -lookYawLimit, lookYawLimit);
				return;
			}
			// Continue is the one editorial advance. There is no node-keyed
			// previous/next: Guide order is authored, and a Gate is passed only by
			// this explicit action.
			if (key === 'ArrowRight' || key === 'Enter') {
				event.preventDefault();
				visitor.continue();
			}
		};

		const onPointerDown = (event: PointerEvent) => {
			if (!canLookAround() || event.button !== 0 || pointerId !== null) return;
			pointerId = event.pointerId;
			previousPointerX = event.clientX;
			previousPointerY = event.clientY;
			try {
				canvas.setPointerCapture(event.pointerId);
			} catch {
				pointerId = null;
				return;
			}
			canvas.style.cursor = 'grabbing';
		};

		const onPointerMove = (event: PointerEvent) => {
			if (pointerId !== event.pointerId || !canLookAround()) return;
			const deltaX = event.clientX - previousPointerX;
			const deltaY = event.clientY - previousPointerY;
			previousPointerX = event.clientX;
			previousPointerY = event.clientY;
			lookYaw = MathUtils.clamp(
				lookYaw - deltaX * lookPointerSensitivity,
				-lookYawLimit,
				lookYawLimit
			);
			lookPitch = MathUtils.clamp(
				lookPitch + deltaY * lookPointerSensitivity,
				-lookUpLimit,
				lookDownLimit
			);
		};

		const onPointerEnd = (event: PointerEvent) => {
			if (pointerId === event.pointerId) cancelPointerLook();
		};

		window.addEventListener('keydown', onKeyDown);
		canvas.addEventListener('pointerdown', onPointerDown);
		canvas.addEventListener('pointermove', onPointerMove);
		canvas.addEventListener('pointerup', onPointerEnd);
		canvas.addEventListener('pointercancel', onPointerEnd);
		canvas.addEventListener('lostpointercapture', onPointerEnd);

		return () => {
			cancelPointerLook();
			try {
				canvas.style.cursor = '';
			} catch {
				// Detached during teardown.
			}
			window.removeEventListener('keydown', onKeyDown);
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerup', onPointerEnd);
			canvas.removeEventListener('pointercancel', onPointerEnd);
			canvas.removeEventListener('lostpointercapture', onPointerEnd);
		};
	});

	$effect(() => {
		if (!isAuthoredMode()) return;
		const viewId = currentViewId;
		if (viewId !== lookViewId) {
			lookViewId = viewId;
			lookYaw = 0;
			lookPitch = 0;
		}
		if (!canLookAround()) cancelPointerLook();
		else if (pointerId === null) {
			try {
				canvas.style.cursor = 'grab';
			} catch {
				// Detached.
			}
		}
	});

	const neutralFrame = $derived.by(() => {
		if (!bounds)
			return {
				position: [0, 8, 12] as [number, number, number],
				target: [0, 1, 0] as [number, number, number]
			};
		const center: [number, number, number] = [
			(bounds.min[0] + bounds.max[0]) / 2,
			(bounds.min[1] + bounds.max[1]) / 2,
			(bounds.min[2] + bounds.max[2]) / 2
		];
		const size: [number, number, number] = [
			bounds.max[0] - bounds.min[0],
			bounds.max[1] - bounds.min[1],
			bounds.max[2] - bounds.min[2]
		];
		const radius = Math.max(size[0], size[1], size[2], 2);
		return {
			position: [
				center[0] + radius * 0.6,
				center[1] + radius * 0.7,
				center[2] + radius * 0.9
			] as [number, number, number],
			target: center
		};
	});
</script>

{#if isAuthoredMode()}
	<T.PerspectiveCamera
		bind:ref={cameraRef}
		makeDefault
		position={initialCameraPosition}
		fov={initialCameraFov}
		near={VISITOR_CAMERA_PROJECTION.near}
		far={VISITOR_CAMERA_PROJECTION.far}
	/>
{:else}
	<T.PerspectiveCamera
		bind:ref={cameraRef}
		makeDefault
		position={neutralFrame.position}
		fov={VISITOR_CAMERA_PROJECTION.fov}
		near={VISITOR_CAMERA_PROJECTION.near}
		far={VISITOR_CAMERA_PROJECTION.far}
	/>
	<OrbitControls target={neutralFrame.target} enableDamping={!visitor.reducedMotion} />
{/if}
