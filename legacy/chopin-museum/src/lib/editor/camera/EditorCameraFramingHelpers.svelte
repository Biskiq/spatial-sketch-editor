<script lang="ts">
	import { onDestroy } from 'svelte';
	import { useTask, useThrelte } from '@threlte/core';
	import {
		BufferAttribute,
		BufferGeometry,
		ConeGeometry,
		DoubleSide,
		Group,
		LineBasicMaterial,
		LineSegments,
		Mesh,
		MeshBasicMaterial,
		SphereGeometry,
		Vector3,
		type Material,
		type PerspectiveCamera
	} from 'three';
	import {
		createEditorCameraFramingGeometry,
		EDITOR_CAMERA_FRUSTUM_LINE_FLOATS,
		EDITOR_CAMERA_FRUSTUM_VOLUME_FLOATS,
		EDITOR_CAMERA_FRUSTUM_VOLUME_INDEX,
		framingOwnerKey,
		isFramingSelectionEligible,
		pickShellScale,
		resolveCameraPreviewFramingOwner,
		setEditorCameraFramingOrientation,
		writeEditorCameraFrustumLinePositions,
		writeEditorCameraFrustumVolumePositions,
		type EditorCameraFramingGeometry
	} from './editor-camera-framing';
	import { SCENE_PALETTE } from '../styles/scene-palette';
	import {
		getSceneCameraViewKeyframeWorldPosition,
		getSceneCameraViewKeyframeWorldTarget
	} from './editor-camera-view';
	import type { EditorCameraFovHandleUserData } from '../editor-selection';
	import type { EditorStore } from '../editor-store.svelte';

	let { store }: { store: EditorStore } = $props();
	const { scene, camera, canvas, invalidate } = useThrelte();

	const bodyGeometry = new ConeGeometry(0.09, 0.16, 4);
	// P21.6 Slice A §2.2 — minimal dark apex nub (retires the wireframe box proxy).
	// ConeGeometry is centered on origin with tip at local +Y (+0.08 m).
	// Single pose convention shared by nub, frustum, handles, and preview
	// (see `setEditorCameraFramingOrientation`):
	//   1. translate tip to origin, 2. rotate +Y → +Z (mesh-forward).
	// Parent mesh sits at the eye and orients from the shared basis.
	bodyGeometry.translate(0, -0.08, 0);
	bodyGeometry.rotateX(Math.PI / 2);
	const bodyMaterial = new MeshBasicMaterial({
		color: 0x1e293b,
		depthTest: false,
		depthWrite: false,
		toneMapped: false
	});
	const body = new Mesh(bodyGeometry, bodyMaterial);
	body.name = 'EditorSelectedVirtualCameraBody';
	body.renderOrder = 1005;
	body.raycast = () => undefined as never;

	// P21.6 Slice B §3.1 — translucent frustum-volume fill: fixed 6-triangle
	// layout (apex + 4 far corners), positions written in place, never
	// rebuilt per tick. Bounded transparency: depthWrite off (no self
	// occlusion), depthTest on (opaque walls truncate abruptly — expected
	// occlusion, not a bug). Overlapping layers accumulate — the fill never
	// carries essential information; perimeter/handles are the affordances.
	const fillPositions = new Float32Array(EDITOR_CAMERA_FRUSTUM_VOLUME_FLOATS);
	const fillGeometry = new BufferGeometry();
	fillGeometry.setAttribute('position', new BufferAttribute(fillPositions, 3));
	fillGeometry.setIndex([...EDITOR_CAMERA_FRUSTUM_VOLUME_INDEX]);
	const fillMaterial = new MeshBasicMaterial({
		color: SCENE_PALETTE.cameraFrustumFill,
		transparent: true,
		opacity: 0.09,
		depthWrite: false,
		depthTest: true,
		side: DoubleSide,
		toneMapped: false
	});
	const fill = new Mesh(fillGeometry, fillMaterial);
	fill.name = 'EditorSelectedVirtualCameraFrustumFill';
	fill.renderOrder = 1003;
	fill.frustumCulled = false;
	fill.raycast = () => undefined as never;

	const frustumPositions = new Float32Array(EDITOR_CAMERA_FRUSTUM_LINE_FLOATS);
	const frustumGeometry = new BufferGeometry();
	frustumGeometry.setAttribute('position', new BufferAttribute(frustumPositions, 3));
	const frustumMaterial = new LineBasicMaterial({
		color: SCENE_PALETTE.cameraFrustumLine,
		transparent: true,
		opacity: 0.75,
		depthTest: false,
		depthWrite: false,
		toneMapped: false
	});
	const frustum = new LineSegments(frustumGeometry, frustumMaterial);
	frustum.name = 'EditorSelectedVirtualCameraFiniteFrustum';
	frustum.renderOrder = 1004;
	frustum.frustumCulled = false;
	frustum.raycast = () => undefined as never;

	const handleGeometry = new SphereGeometry(0.09, 14, 10);
	const handleMaterial = new MeshBasicMaterial({
		color: SCENE_PALETTE.cameraNodeSeq,
		depthTest: false,
		depthWrite: false,
		toneMapped: false
	});
	// P21.6 Slice B §3.4 — 24px pick shells: the visible dot shrinks
	// (0.13 → 0.09) but the hit area never does. Decorative dots never
	// raycast; only the tagged-root shells participate in picking.
	const handleShellGeometry = new SphereGeometry(0.14, 10, 8);
	const handleShellMaterial = new MeshBasicMaterial({
		transparent: true,
		opacity: 1,
		depthWrite: false,
		toneMapped: false
	});
	handleShellMaterial.colorWrite = false;
	const topHandleRoot = new Group();
	const bottomHandleRoot = new Group();
	const topHandle = new Mesh(handleGeometry, handleMaterial);
	const bottomHandle = new Mesh(handleGeometry, handleMaterial);
	const topHandleShell = new Mesh(handleShellGeometry, handleShellMaterial);
	const bottomHandleShell = new Mesh(handleShellGeometry, handleShellMaterial);
	topHandleRoot.name = 'EditorCameraFovHandle:top';
	bottomHandleRoot.name = 'EditorCameraFovHandle:bottom';
	topHandle.renderOrder = 1006;
	bottomHandle.renderOrder = 1006;
	topHandle.raycast = () => undefined as never;
	bottomHandle.raycast = () => undefined as never;
	topHandleShell.renderOrder = 1006;
	bottomHandleShell.renderOrder = 1006;
	topHandleRoot.add(topHandle, topHandleShell);
	bottomHandleRoot.add(bottomHandle, bottomHandleShell);
	scene.add(body, fill, frustum, topHandleRoot, bottomHandleRoot);
	// P21.6 review (A/B P1) — Three.js defaults every object to visible; a
	// newly mounted helper with no selection would flash at the origin until
	// the first pose-bearing tick. Initialize hidden to match lastVisible.
	body.visible = false;
	fill.visible = false;
	frustum.visible = false;
	topHandleRoot.visible = false;
	bottomHandleRoot.visible = false;

	const eye = new Vector3();
	const target = new Vector3();
	const observerScratch = new Vector3();
	let lastEyeX = Number.NaN;
	let lastEyeY = Number.NaN;
	let lastEyeZ = Number.NaN;
	let lastTargetX = Number.NaN;
	let lastTargetY = Number.NaN;
	let lastTargetZ = Number.NaN;
	let lastFov = Number.NaN;
	let lastAspect = Number.NaN;
	let lastVisible = false;
	let lastOwnerKey: string | null = null;
	let lastTopShellScale = 1;
	let lastBottomShellScale = 1;

	function hide() {
		body.visible = false;
		fill.visible = false;
		frustum.visible = false;
		topHandleRoot.visible = false;
		bottomHandleRoot.visible = false;
		lastVisible = false;
		lastOwnerKey = null;
		// Visible→hidden is a real transition (callers guard on lastVisible),
		// so this never invalidates idle frames.
		invalidate();
	}

	function framingPose() {
		// Eligibility first (shared with the rig resolver): outside the
		// Camera workspace or under a pending placement the helper cannot
		// show — and must not suppress the playhead owner either.
		const selectionEligible = isFramingSelectionEligible({
			workspace: store.currentWorkspace,
			hasPendingPlacement: !!(
				store.pendingPlacementAssetId ||
				store.pendingPlacementPrimitiveKind ||
				store.pendingPlacementLightKind
			)
		});
		if (!selectionEligible) {
			return null;
		}
		const selection = store.navigationSelection;
		const hasEditableSelection =
			(selection?.kind === 'node' && !!store.selectedNavigationNode) ||
			(selection?.kind === 'view-keyframe' && !!store.selectedViewKeyframe);
		// P21.6 review (A/B P1) — paused Director preview yields to an
		// editable selection (which owns the filled helper); playback owns
		// the playhead, and paused with no editable selection owns `none`
		// (clean viewport — never resurrect the wireframe on deselect). A
		// paused visitor still shows framing so paused framing stays
		// editable.
		if (
			store.isDirectorCameraPreview &&
			resolveCameraPreviewFramingOwner({
				hasDirectorPreview: true,
				previewPlaying: store.isCameraPreviewPlaying,
				hasEditableSelection,
				framingVisible: store.viewportShowFraming,
				selectionEligible
			}) !== 'selection'
		) {
			return null;
		}
		if (store.isVisitorCameraPreview && store.isCameraPreviewPlaying) {
			return null;
		}
		if (selection?.kind === 'node') {
			const node = store.selectedNavigationNode;
			if (!node) return null;
			return {
				position: store.rooms.pointInFrame(node.roomId, node.position),
				target: store.rooms.pointInFrame(node.roomId, node.cameraTarget),
				fov: node.fov,
				userData: {
					editorEntity: 'camera-fov-handle',
					owner: 'node',
					nodeId: node.id
				} as const
			};
		}
		if (selection?.kind === 'view-keyframe') {
			const keyframe = store.selectedViewKeyframe;
			if (!keyframe) return null;
			return {
				position: getSceneCameraViewKeyframeWorldPosition(
					store.document,
					selection.connectionId,
					selection.direction,
					keyframe.progress,
					store.rooms
				),
				target: getSceneCameraViewKeyframeWorldTarget(keyframe, store.rooms),
				fov: keyframe.fov,
				userData: {
					editorEntity: 'camera-fov-handle',
					owner: 'view-keyframe',
					connectionId: selection.connectionId,
					direction: selection.direction,
					keyframeId: selection.keyframeId
				} as const
			};
		}
		return null;
	}

	function updateFrustumLines(geometry: EditorCameraFramingGeometry) {
		writeEditorCameraFrustumLinePositions(frustumPositions, eye, geometry);
		frustumGeometry.getAttribute('position').needsUpdate = true;
		frustumGeometry.computeBoundingSphere();
	}

	function updateFrustumFill(geometry: EditorCameraFramingGeometry) {
		writeEditorCameraFrustumVolumePositions(fillPositions, eye, geometry);
		fillGeometry.getAttribute('position').needsUpdate = true;
		fillGeometry.computeBoundingSphere();
	}

	/**
	 * P21.6 Slice B §3.4 — 24px shell clamp (perspective observer only):
	 * camera-space depth + CSS pixels + effective vertical FOV. Guards: zero
	 * viewport height, centers behind / inside the near plane.
	 */
	function updateHandleShellScale(root: Group, shell: Mesh): number {
		const observer = camera.current as PerspectiveCamera | undefined;
		const viewportHeight = Math.max(0, canvas.clientHeight || 0);
		if (!observer || viewportHeight <= 0) {
			shell.scale.setScalar(1);
			return 1;
		}
		observerScratch.setFromMatrixPosition(root.matrixWorld);
		observerScratch.applyMatrix4(observer.matrixWorldInverse);
		const depthZ = -observerScratch.z;
		const effectiveFov =
			typeof observer.getEffectiveFOV === 'function'
				? observer.getEffectiveFOV()
				: observer.fov;
		const scale = pickShellScale(depthZ, effectiveFov, viewportHeight, 0.14);
		shell.scale.setScalar(scale);
		return scale;
	}

	useTask(() => {
		const pose = framingPose();
		if (!pose) {
			if (lastVisible) hide();
			return;
		}
		eye.set(pose.position[0], pose.position[1], pose.position[2]);
		target.set(pose.target[0], pose.target[1], pose.target[2]);
		if (eye.distanceToSquared(target) <= 1e-12) {
			if (lastVisible) hide();
			return;
		}
		const aspect = (camera.current as PerspectiveCamera | undefined)?.aspect ?? 1;
		// Slice 7 — skip unchanged updates: the frustum is authored-space, so
		// an idle selection poses identically every tick. No attribute writes,
		// no invalidate. Shell scales still refresh (observer-dependent).
		// P21.6 review (A/B P2) — the cache key carries selection identity:
		// an identical pose under a new owner still refreshes handle userData.
		const ownerKey = framingOwnerKey(pose.userData);
		const unchanged =
			lastVisible &&
			ownerKey === lastOwnerKey &&
			eye.x === lastEyeX &&
			eye.y === lastEyeY &&
			eye.z === lastEyeZ &&
			target.x === lastTargetX &&
			target.y === lastTargetY &&
			target.z === lastTargetZ &&
			pose.fov === lastFov &&
			aspect === lastAspect;
		// Ownership refreshes independently of geometry: retagging handles
		// needs no render.
		if (ownerKey !== lastOwnerKey) {
			topHandleRoot.userData = {
				...pose.userData,
				side: 'top'
			} satisfies EditorCameraFovHandleUserData;
			bottomHandleRoot.userData = {
				...pose.userData,
				side: 'bottom'
			} satisfies EditorCameraFovHandleUserData;
			lastOwnerKey = ownerKey;
		}
		if (!unchanged) {
			const geometry = createEditorCameraFramingGeometry(eye, target, pose.fov, aspect);
			body.visible = true;
			fill.visible = true;
			frustum.visible = true;
			topHandleRoot.visible = true;
			bottomHandleRoot.visible = true;
			body.position.copy(eye);
			// P21.6 review (A/B P2-7) — nub orients from the shared framing
			// basis (mesh +Z forward), matching the rectangle/handles and
			// the preview camera — never an independent lookAt.
			setEditorCameraFramingOrientation(body, eye, target);
			updateFrustumLines(geometry);
			updateFrustumFill(geometry);
			topHandleRoot.position.set(...geometry.topHandle);
			bottomHandleRoot.position.set(...geometry.bottomHandle);
			lastEyeX = eye.x;
			lastEyeY = eye.y;
			lastEyeZ = eye.z;
			lastTargetX = target.x;
			lastTargetY = target.y;
			lastTargetZ = target.z;
			lastFov = pose.fov;
			lastAspect = aspect;
			lastVisible = true;
			invalidate();
		}
		topHandleRoot.updateWorldMatrix(true, false);
		bottomHandleRoot.updateWorldMatrix(true, false);
		const topShellScale = updateHandleShellScale(topHandleRoot, topHandleShell);
		const bottomShellScale = updateHandleShellScale(bottomHandleRoot, bottomHandleShell);
		if (
			Math.abs(topShellScale - lastTopShellScale) > 1e-3 ||
			Math.abs(bottomShellScale - lastBottomShellScale) > 1e-3
		) {
			lastTopShellScale = topShellScale;
			lastBottomShellScale = bottomShellScale;
			invalidate();
		}
	});

	onDestroy(() => {
		body.removeFromParent();
		fill.removeFromParent();
		frustum.removeFromParent();
		topHandleRoot.removeFromParent();
		bottomHandleRoot.removeFromParent();
		bodyGeometry.dispose();
		fillGeometry.dispose();
		frustumGeometry.dispose();
		handleGeometry.dispose();
		handleShellGeometry.dispose();
		for (const material of [
			bodyMaterial,
			fillMaterial,
			frustumMaterial,
			handleMaterial,
			handleShellMaterial
		] as Material[]) {
			material.dispose();
		}
	});
</script>
