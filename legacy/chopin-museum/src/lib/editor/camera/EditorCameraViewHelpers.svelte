<script lang="ts">
	import { onDestroy } from 'svelte';
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
		OctahedronGeometry,
		RingGeometry,
		SphereGeometry,
		Vector3,
		type Material,
		type PerspectiveCamera
	} from 'three';
	import {
		getSceneCameraViewKeyframeWorldPosition,
		getSceneCameraViewKeyframeWorldTarget
	} from './editor-camera-view';
	import { pickShellScale } from './editor-camera-framing';
	import { SCENE_PALETTE } from '../styles/scene-palette';
	import type { EditorCameraViewKeyframeUserData } from '../editor-selection';
	import type { EditorStore } from '../editor-store.svelte';

	let { store }: { store: EditorStore } = $props();
	const { scene, camera, canvas, invalidate } = useThrelte();

	type ViewMarkerHelper = {
		root: Group;
		marker: Mesh;
		geometry: OctahedronGeometry;
		material: MeshBasicMaterial;
		connectionId: string;
		direction: 'forward' | 'reverse';
		keyframeId: string;
	};

	type ViewTargetHelper = {
		root: Group;
		ring: Mesh;
		ringGeometry: RingGeometry;
		dot: Mesh;
		dotGeometry: SphereGeometry;
		shell: Mesh;
		shellGeometry: SphereGeometry;
		material: MeshBasicMaterial;
		connector: Line;
		connectorGeometry: BufferGeometry;
		connectorMaterial: LineDashedMaterial;
		connectorPositions: Float32Array;
		connectorDistances: Float32Array;
		connectionId: string;
		direction: 'forward' | 'reverse';
		keyframeId: string;
	};

	const markers = new Map<string, ViewMarkerHelper>();
	let targetHelper: ViewTargetHelper | null = null;
	const cameraPosition = new Vector3();
	const targetPosition = new Vector3();
	const observerScratch = new Vector3();

	function helperKey(
		connectionId: string,
		direction: 'forward' | 'reverse',
		keyframeId: string
	) {
		return `${connectionId}:${direction}:${keyframeId}`;
	}

	function createTaggedRoot(
		connectionId: string,
		direction: 'forward' | 'reverse',
		keyframeId: string,
		viewHandle: 'position' | 'target',
		name: string
	) {
		const root = new Group();
		root.name = name;
		root.userData = {
			editorEntity: 'camera-view-keyframe',
			connectionId,
			direction,
			keyframeId,
			viewHandle
		} satisfies EditorCameraViewKeyframeUserData;
		return root;
	}

	function createMarker(
		connectionId: string,
		direction: 'forward' | 'reverse',
		keyframeId: string
	): ViewMarkerHelper {
		const root = createTaggedRoot(
			connectionId,
			direction,
			keyframeId,
			'position',
			`EditorCameraViewKeyframe:${connectionId}:${direction}:${keyframeId}`
		);
		// P21.6 Slice B §4.3 — view-key diamonds in the selected-path blue.
		const geometry = new OctahedronGeometry(0.13);
		const material = new MeshBasicMaterial({
			color: SCENE_PALETTE.cameraPathSelected,
			depthTest: false,
			depthWrite: false,
			toneMapped: false
		});
		const marker = new Mesh(geometry, material);
		marker.renderOrder = 1003;
		root.add(marker);
		scene.add(root);
		return {
			root,
			marker,
			geometry,
			material,
			connectionId,
			direction,
			keyframeId
		};
	}

	function disposeMarker(helper: ViewMarkerHelper) {
		helper.root.removeFromParent();
		helper.geometry.dispose();
		helper.material.dispose();
	}

	function createTarget(
		connectionId: string,
		direction: 'forward' | 'reverse',
		keyframeId: string
	): ViewTargetHelper {
		const root = createTaggedRoot(
			connectionId,
			direction,
			keyframeId,
			'target',
			`EditorCameraViewTarget:${connectionId}:${direction}:${keyframeId}`
		);
		// P21.6 Slice B §4.3 — target crosshair in the canonical target blue:
		// billboarded ring + center dot (decorative only) with an invisible
		// 24px-clamped shell owning the pick (same contract as §4.2 anchors).
		const ringGeometry = new RingGeometry(0.12, 0.15, 40);
		const material = new MeshBasicMaterial({
			color: SCENE_PALETTE.cameraTarget,
			transparent: true,
			opacity: 0.95,
			depthTest: false,
			depthWrite: false,
			side: DoubleSide,
			toneMapped: false
		});
		const ring = new Mesh(ringGeometry, material);
		ring.renderOrder = 1004;
		ring.raycast = () => undefined as never;
		const dotGeometry = new SphereGeometry(0.045, 12, 8);
		const dot = new Mesh(dotGeometry, material);
		dot.renderOrder = 1004;
		dot.raycast = () => undefined as never;
		const shellGeometry = new SphereGeometry(0.14, 10, 8);
		const shellMaterial = new MeshBasicMaterial({
			transparent: true,
			opacity: 1,
			depthWrite: false,
			toneMapped: false
		});
		shellMaterial.colorWrite = false;
		const shell = new Mesh(shellGeometry, shellMaterial);
		shell.renderOrder = 1004;
		root.add(ring, dot, shell);

		const connectorPositions = new Float32Array(6);
		const connectorDistances = new Float32Array(2);
		const connectorGeometry = new BufferGeometry();
		connectorGeometry.setAttribute(
			'position',
			new BufferAttribute(connectorPositions, 3)
		);
		connectorGeometry.setAttribute(
			'lineDistance',
			new BufferAttribute(connectorDistances, 1)
		);
		const connectorMaterial = new LineDashedMaterial({
			color: SCENE_PALETTE.cameraLookAtRay,
			dashSize: 0.25,
			gapSize: 0.15,
			transparent: true,
			opacity: 0.45,
			depthTest: true,
			depthWrite: false,
			toneMapped: false
		});
		const connector = new Line(connectorGeometry, connectorMaterial);
		connector.name = `EditorCameraViewConnector:${connectionId}:${direction}:${keyframeId}`;
		connector.renderOrder = 1002;
		connector.frustumCulled = false;
		connector.raycast = () => undefined as never;
		scene.add(root, connector);
		store.registerViewKeyframeTargetHelperRoot(
			connectionId,
			direction,
			keyframeId,
			root
		);
		return {
			root,
			ring,
			ringGeometry,
			dot,
			dotGeometry,
			shell,
			shellGeometry,
			material,
			connector,
			connectorGeometry,
			connectorMaterial,
			connectorPositions,
			connectorDistances,
			connectionId,
			direction,
			keyframeId
		};
	}

	function disposeTarget(helper: ViewTargetHelper) {
		store.unregisterViewKeyframeTargetHelperRoot(
			helper.connectionId,
			helper.direction,
			helper.keyframeId,
			helper.root
		);
		helper.root.removeFromParent();
		helper.connector.removeFromParent();
		helper.ringGeometry.dispose();
		helper.dotGeometry.dispose();
		helper.shellGeometry.dispose();
		(helper.shell.material as Material).dispose();
		helper.connectorGeometry.dispose();
		helper.connectorMaterial.dispose();
		helper.material.dispose();
	}

	function disposeAll() {
		for (const helper of markers.values()) disposeMarker(helper);
		markers.clear();
		if (targetHelper) disposeTarget(targetHelper);
		targetHelper = null;
	}

	$effect(() => {
		const hidden = !store.isCameraKeyHelpersActive;
		const document = store.document;
		const selection = store.navigationSelection;
		const activeConnectionId = store.activeCameraConnectionId;
		const direction = activeConnectionId ? store.activeCameraDirection : null;
		const connection = activeConnectionId
			? document.connections.find((candidate) => candidate.id === activeConnectionId)
			: undefined;
		if (hidden || !connection || !direction) {
			disposeAll();
			return;
		}

		const track = connection.viewTracks?.[direction] ?? [];
		const desiredKeys = new Set(
			track.map((keyframe) => helperKey(connection.id, direction, keyframe.id))
		);
		for (const [key, helper] of markers) {
			if (desiredKeys.has(key)) continue;
			disposeMarker(helper);
			markers.delete(key);
		}

		for (const keyframe of track) {
			const key = helperKey(connection.id, direction, keyframe.id);
			let helper = markers.get(key);
			if (!helper) {
				helper = createMarker(connection.id, direction, keyframe.id);
				markers.set(key, helper);
			}
			helper.root.position.set(
				...getSceneCameraViewKeyframeWorldPosition(
					document,
					connection.id,
					direction,
					keyframe.progress,
					store.rooms
				)
			);
			const selected =
				selection?.kind === 'view-keyframe' &&
				selection.connectionId === connection.id &&
				selection.direction === direction &&
				selection.keyframeId === keyframe.id;
			helper.material.color.setHex(
				selected ? 0xffffff : SCENE_PALETTE.cameraPathSelected
			);
			helper.marker.scale.setScalar(selected ? 1.28 : 1);
		}

		const selectedKeyframe =
			selection?.kind === 'view-keyframe' &&
			selection.connectionId === connection.id &&
			selection.direction === direction
				? track.find((keyframe) => keyframe.id === selection.keyframeId)
				: undefined;
		const targetKey = selectedKeyframe
			? helperKey(connection.id, direction, selectedKeyframe.id)
			: null;
		const currentTargetKey = targetHelper
			? helperKey(
					targetHelper.connectionId,
					targetHelper.direction,
					targetHelper.keyframeId
				)
			: null;
		if (targetHelper && currentTargetKey !== targetKey) {
			disposeTarget(targetHelper);
			targetHelper = null;
		}
		if (selectedKeyframe) {
			targetHelper ??= createTarget(
				connection.id,
				direction,
				selectedKeyframe.id
			);
			cameraPosition.set(
				...getSceneCameraViewKeyframeWorldPosition(
					document,
					connection.id,
					direction,
					selectedKeyframe.progress,
					store.rooms
				)
			);
			targetPosition.set(
				...getSceneCameraViewKeyframeWorldTarget(selectedKeyframe, store.rooms)
			);
			targetHelper.root.position.copy(targetPosition);
			// In-place connector update over the fixed 2-point layout (the
			// allocating from-points call is never used on this path).
			targetHelper.connectorPositions[0] = cameraPosition.x;
			targetHelper.connectorPositions[1] = cameraPosition.y;
			targetHelper.connectorPositions[2] = cameraPosition.z;
			targetHelper.connectorPositions[3] = targetPosition.x;
			targetHelper.connectorPositions[4] = targetPosition.y;
			targetHelper.connectorPositions[5] = targetPosition.z;
			(targetHelper.connectorGeometry.getAttribute('position') as BufferAttribute).needsUpdate =
				true;
			targetHelper.connectorDistances[0] = 0;
			targetHelper.connectorDistances[1] = cameraPosition.distanceTo(targetPosition);
			(targetHelper.connectorGeometry.getAttribute('lineDistance') as BufferAttribute).needsUpdate =
				true;
			targetHelper.connectorGeometry.computeBoundingSphere();
		} else if (targetHelper) {
			disposeTarget(targetHelper);
			targetHelper = null;
		}
		invalidate();
	});

	useTask(() => {
		if (!targetHelper) return;
		// Billboard the crosshair ring; clamp the pick shell to 24px.
		const observer = camera.current as PerspectiveCamera | undefined;
		if (!observer) return;
		targetHelper.ring.quaternion.copy(observer.quaternion);
		const viewportHeight = Math.max(0, canvas.clientHeight || 0);
		if (viewportHeight <= 0) return;
		targetHelper.root.updateWorldMatrix(true, false);
		observerScratch
			.setFromMatrixPosition(targetHelper.root.matrixWorld)
			.applyMatrix4(observer.matrixWorldInverse);
		const effectiveFov =
			typeof observer.getEffectiveFOV === 'function'
				? observer.getEffectiveFOV()
				: observer.fov;
		const scale = pickShellScale(
			-observerScratch.z,
			effectiveFov,
			viewportHeight,
			0.14
		);
		if (Math.abs(scale - targetHelper.shell.scale.x) > 1e-3) {
			targetHelper.shell.scale.setScalar(scale);
			invalidate();
		}
	});


	onDestroy(disposeAll);
</script>
