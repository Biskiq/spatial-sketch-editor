<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { useTask, useThrelte } from '@threlte/core';
	import {
		BufferAttribute,
		BufferGeometry,
		DoubleSide,
		Group,
		Line,
		LineDashedMaterial,
		Mesh,
		MeshBasicMaterial,
		RingGeometry,
		SphereGeometry,
		Vector3,
		type Material,
		type PerspectiveCamera
	} from 'three';
	import { pickShellScale } from './editor-camera-framing';
	import { SCENE_PALETTE } from '../styles/scene-palette';
	import type { EditorCameraHandleUserData } from '../editor-selection';
	import type { EditorStore } from '../editor-store.svelte';

	let {
		store,
		nodeId,
		positionOnly = false
	}: {
		store: EditorStore;
		nodeId: string;
		positionOnly?: boolean;
	} = $props();
	const editorStore = untrack(() => store);
	const helperNodeId = untrack(() => nodeId);
	const helperPositionOnly = untrack(() => positionOnly);

	const { scene, camera, canvas } = useThrelte();
	const positionRoot = new Group();
	const targetRoot = new Group();
	// P21.6 Slice B §4.1 — dual-layer node marker. Sequenced: solid brand-blue
	// core; unsequenced: transparent center (opacity stays above the
	// NEAR_INVISIBLE_OPACITY selection floor so the center stays pickable)
	// with an emerald perimeter ring. Selection never inverts the fill — a
	// concentric active-blue ring ($r=0.28$) carries selection.
	const coreGeometry = new SphereGeometry(0.16, 20, 14);
	const coreMaterial = new MeshBasicMaterial({
		color: SCENE_PALETTE.cameraNodeSeq,
		depthTest: false,
		depthWrite: false,
		toneMapped: false
	});
	const coreMesh = new Mesh(coreGeometry, coreMaterial);
	coreMesh.raycast = () => null as never;
	const positionShellGeometry = new SphereGeometry(0.24, 10, 8);
	const positionShellMaterial = new MeshBasicMaterial({
		transparent: true,
		opacity: 1,
		depthWrite: false,
		toneMapped: false
	});
	positionShellMaterial.colorWrite = false;
	const positionShell = new Mesh(positionShellGeometry, positionShellMaterial);
	const unsequencedRingGeometry = new RingGeometry(0.19, 0.23, 40);
	const unsequencedRingMaterial = new MeshBasicMaterial({
		color: SCENE_PALETTE.cameraNodeUnseq,
		transparent: true,
		opacity: 0.95,
		depthTest: false,
		depthWrite: false,
		side: DoubleSide,
		toneMapped: false
	});
	const unsequencedRing = new Mesh(unsequencedRingGeometry, unsequencedRingMaterial);
	unsequencedRing.raycast = () => null as never;
	const selectionRingGeometry = new RingGeometry(0.24, 0.28, 48);
	const selectionRingMaterial = new MeshBasicMaterial({
		color: SCENE_PALETTE.cameraNodeSeqActive,
		transparent: true,
		opacity: 0.95,
		depthTest: false,
		depthWrite: false,
		side: DoubleSide,
		toneMapped: false
	});
	const selectionRing = new Mesh(selectionRingGeometry, selectionRingMaterial);
	selectionRing.raycast = () => null as never;
	// P21.6 Slice B §3.3 — target reticle: subtle outer ring (r=0.15) + small
	// center dot in the canonical target blue. Decorative only; the invisible
	// shell owns picking so the reticle stays selectable through its center.
	const targetRingGeometry = new RingGeometry(0.12, 0.15, 40);
	const targetRingMaterial = new MeshBasicMaterial({
		color: SCENE_PALETTE.cameraTarget,
		transparent: true,
		opacity: 0.95,
		depthTest: false,
		depthWrite: false,
		side: DoubleSide,
		toneMapped: false
	});
	const targetRing = new Mesh(targetRingGeometry, targetRingMaterial);
	targetRing.raycast = () => null as never;
	const targetDotGeometry = new SphereGeometry(0.045, 12, 8);
	const targetDotMaterial = new MeshBasicMaterial({
		color: SCENE_PALETTE.cameraTarget,
		depthTest: false,
		depthWrite: false,
		toneMapped: false
	});
	const targetDot = new Mesh(targetDotGeometry, targetDotMaterial);
	targetDot.raycast = () => null as never;
	const targetShellGeometry = new SphereGeometry(0.14, 10, 8);
	const targetShellMaterial = new MeshBasicMaterial({
		transparent: true,
		opacity: 1,
		depthWrite: false,
		toneMapped: false
	});
	targetShellMaterial.colorWrite = false;
	const targetShell = new Mesh(targetShellGeometry, targetShellMaterial);
	const linePositions = new Float32Array(6);
	const lineDistances = new Float32Array(2);
	const lineGeometry = new BufferGeometry();
	lineGeometry.setAttribute('position', new BufferAttribute(linePositions, 3));
	lineGeometry.setAttribute('lineDistance', new BufferAttribute(lineDistances, 1));
	// P21.6 Slice B §3.3 — slate dashed look-at ray (never white: white reads
	// as selection against the white node keylines). Distances update in
	// place — the per-frame GPU-attribute reallocating call is never used
	// here. Scene-occluded (depthTest true) while
	// markers stay discoverable: a camera behind a wall shows badge + rings
	// while the connector disappears — intentional, not a bug.
	const lineMaterial = new LineDashedMaterial({
		color: SCENE_PALETTE.cameraLookAtRay,
		dashSize: 0.25,
		gapSize: 0.15,
		transparent: true,
		opacity: 0.45,
		depthTest: true,
		depthWrite: false,
		toneMapped: false
	});
	const connector = new Line(lineGeometry, lineMaterial);
	connector.frustumCulled = false;
	const positionWorld = new Vector3();
	const targetWorld = new Vector3();
	const observerScratch = new Vector3();

	positionRoot.name = `EditorCameraPosition:${helperNodeId}`;
	targetRoot.name = `EditorCameraTarget:${helperNodeId}`;
	positionRoot.userData = {
		editorEntity: 'camera-handle',
		nodeId: helperNodeId,
		cameraHandle: 'position'
	} satisfies EditorCameraHandleUserData;
	targetRoot.userData = {
		editorEntity: 'camera-handle',
		nodeId: helperNodeId,
		cameraHandle: 'target'
	} satisfies EditorCameraHandleUserData;
	coreMesh.renderOrder = 1001;
	positionShell.renderOrder = 1001;
	unsequencedRing.renderOrder = 1002;
	selectionRing.renderOrder = 1002;
	targetRing.renderOrder = 1001;
	targetDot.renderOrder = 1001;
	targetShell.renderOrder = 1001;
	connector.renderOrder = 1000;
	connector.raycast = () => null as never;
	positionRoot.add(coreMesh, positionShell, unsequencedRing, selectionRing);
	targetRoot.add(targetRing, targetDot, targetShell);
	scene.add(positionRoot);
	editorStore.registerCameraHelperRoot(helperNodeId, 'position', positionRoot);
	if (!helperPositionOnly) {
		scene.add(targetRoot, connector);
		editorStore.registerCameraHelperRoot(helperNodeId, 'target', targetRoot);
	}

	function syncFromStore() {
		const node = editorStore.getRuntimeNavigationNode(helperNodeId);
		if (!node) return;
		positionRoot.position.set(...node.position);
		targetRoot.position.set(...node.cameraTarget);
	}

	function updateConnector() {
		positionRoot.getWorldPosition(positionWorld);
		targetRoot.getWorldPosition(targetWorld);
		const position = lineGeometry.getAttribute('position') as BufferAttribute;
		position.setXYZ(0, positionWorld.x, positionWorld.y, positionWorld.z);
		position.setXYZ(1, targetWorld.x, targetWorld.y, targetWorld.z);
		position.needsUpdate = true;
		const endpointDistance = positionWorld.distanceTo(targetWorld);
		lineDistances[0] = 0;
		lineDistances[1] = endpointDistance;
		(lineGeometry.getAttribute('lineDistance') as BufferAttribute).needsUpdate = true;
		lineGeometry.computeBoundingSphere();
	}

	function shellScaleForWorldPosition(world: Vector3, baseRadius: number): number {
		const observer = camera.current as PerspectiveCamera | undefined;
		const viewportHeight = Math.max(0, canvas.clientHeight || 0);
		if (!observer || viewportHeight <= 0) return 1;
		observerScratch.copy(world).applyMatrix4(observer.matrixWorldInverse);
		const depthZ = -observerScratch.z;
		const effectiveFov =
			typeof observer.getEffectiveFOV === 'function'
				? observer.getEffectiveFOV()
				: observer.fov;
		return pickShellScale(depthZ, effectiveFov, viewportHeight, baseRadius);
	}

	$effect(() => {
		void editorStore.scene;
		void editorStore.historyVersion;
		void editorStore.pendingNavigationCommand;
		if (
			editorStore.transformInteractionActive &&
			editorStore.transformInteractionKind === 'camera' &&
			editorStore.cameraSelection?.nodeId === helperNodeId
		) {
			return;
		}
		syncFromStore();
		updateConnector();
	});

	$effect(() => {
		const activeHandle =
			editorStore.cameraSelection?.nodeId === helperNodeId
				? editorStore.cameraSelection.handle
				: null;
		const selected = activeHandle !== null;
		// Sequenced membership comes from the same main-flow accessor the
		// Camera Plan projection uses — 2D–3D parity by construction.
		const sequenced = editorStore.mainFlowNodeIds.includes(helperNodeId);
		if (sequenced) {
			coreMaterial.color.setHex(SCENE_PALETTE.cameraNodeSeq);
			if (coreMaterial.transparent) {
				coreMaterial.transparent = false;
				coreMaterial.needsUpdate = true;
			}
			coreMaterial.opacity = 1;
		} else {
			coreMaterial.color.setHex(SCENE_PALETTE.cameraNodeUnseq);
			if (!coreMaterial.transparent) {
				coreMaterial.transparent = true;
				coreMaterial.needsUpdate = true;
			}
			coreMaterial.opacity = 0.18;
		}
		unsequencedRing.visible = !sequenced;
		selectionRing.visible = selected;
		const targetActive = activeHandle === 'target';
		targetRingMaterial.color.setHex(
			targetActive ? 0xffffff : SCENE_PALETTE.cameraTarget
		);
		targetDotMaterial.color.setHex(
			targetActive ? 0xffffff : SCENE_PALETTE.cameraTarget
		);
	});

	useTask(() => {
		if (!helperPositionOnly) updateConnector();
		// Billboard: ordinary rings go edge-on under orbit — face the observer.
		const observer = camera.current;
		if (observer) {
			const quaternion = observer.quaternion;
			unsequencedRing.quaternion.copy(quaternion);
			selectionRing.quaternion.copy(quaternion);
			if (!helperPositionOnly) targetRing.quaternion.copy(quaternion);
		}
		positionRoot.getWorldPosition(positionWorld);
		positionShell.scale.setScalar(shellScaleForWorldPosition(positionWorld, 0.24));
		if (!helperPositionOnly) {
			targetRoot.getWorldPosition(targetWorld);
			targetShell.scale.setScalar(shellScaleForWorldPosition(targetWorld, 0.14));
		}
	});

	onDestroy(() => {
		editorStore.unregisterCameraHelperRoot(helperNodeId, 'position', positionRoot);
		if (!helperPositionOnly) {
			editorStore.unregisterCameraHelperRoot(helperNodeId, 'target', targetRoot);
		}
		positionRoot.removeFromParent();
		targetRoot.removeFromParent();
		connector.removeFromParent();
		coreGeometry.dispose();
		positionShellGeometry.dispose();
		unsequencedRingGeometry.dispose();
		selectionRingGeometry.dispose();
		targetRingGeometry.dispose();
		targetDotGeometry.dispose();
		targetShellGeometry.dispose();
		lineGeometry.dispose();
		for (const material of [
			coreMaterial,
			positionShellMaterial,
			unsequencedRingMaterial,
			selectionRingMaterial,
			targetRingMaterial,
			targetDotMaterial,
			targetShellMaterial,
			lineMaterial
		] as Material[]) {
			material.dispose();
		}
	});
</script>
