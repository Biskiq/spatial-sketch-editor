<script lang="ts">
	import { onDestroy } from 'svelte';
	import { useTask, useThrelte } from '@threlte/core';
	import {
		Group,
		Mesh,
		MeshBasicMaterial,
		SphereGeometry,
		Vector3,
		type PerspectiveCamera
	} from 'three';
	import { Line2 } from 'three/addons/lines/Line2.js';
	import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
	import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
	import {
		createDraftConnectionPositionPath,
		getCameraPathVisualSampleCount,
		getScenePathAnchorWorldPosition
	} from './editor-camera-path';
	import { pickShellScale } from './editor-camera-framing';
	import { SCENE_PALETTE } from '../styles/scene-palette';
	import type {
		EditorCameraAnchorUserData,
		EditorCameraConnectionUserData
	} from '../editor-selection';
	import type { EditorStore } from '../editor-store.svelte';

	let { store }: { store: EditorStore } = $props();

	const { scene, camera, canvas, invalidate } = useThrelte();

	type ConnectionHelper = {
		visual: Line2;
		visualGeometry: LineGeometry;
		visualMaterial: LineMaterial;
		pick: Line2;
		pickGeometry: LineGeometry;
		pickMaterial: LineMaterial;
	};

	type AnchorHelper = {
		root: Group;
		marker: Mesh;
		dotGeometry: SphereGeometry;
		dotMaterial: MeshBasicMaterial;
		shell: Mesh;
		shellGeometry: SphereGeometry;
		shellMaterial: MeshBasicMaterial;
		connectionId: string;
		anchorId: string;
	};

	const connectionHelpers = new Map<string, ConnectionHelper>();
	const anchorHelpers = new Map<string, AnchorHelper>();
	let resolutionWidth = 0;
	let resolutionHeight = 0;

	function anchorKey(connectionId: string, anchorId: string) {
		return `${connectionId}:${anchorId}`;
	}

	function updateResolution() {
		const width = Math.max(1, canvas.clientWidth);
		const height = Math.max(1, canvas.clientHeight);
		if (width === resolutionWidth && height === resolutionHeight) return;
		resolutionWidth = width;
		resolutionHeight = height;
		for (const helper of connectionHelpers.values()) {
			helper.visualMaterial.resolution.set(width, height);
			helper.pickMaterial.resolution.set(width, height);
		}
		invalidate();
	}

	function createConnectionHelper(connectionId: string): ConnectionHelper {
		const visualGeometry = new LineGeometry();
		const visualMaterial = new LineMaterial({
			color: SCENE_PALETTE.cameraPath,
			linewidth: 1.5,
			transparent: true,
			opacity: 0.45,
			depthTest: false,
			depthWrite: false,
			worldUnits: false,
			toneMapped: false
		});
		const visual = new Line2(visualGeometry, visualMaterial);
		visual.name = `EditorCameraPath:${connectionId}`;
		visual.renderOrder = 900;
		visual.raycast = () => undefined as never;

		const pickGeometry = new LineGeometry();
		const pickMaterial = new LineMaterial({
			color: 0xffffff,
			linewidth: 12,
			transparent: true,
			opacity: 0,
			depthTest: false,
			depthWrite: false,
			worldUnits: false
		});
		pickMaterial.colorWrite = false;
		const pick = new Line2(pickGeometry, pickMaterial);
		pick.name = `EditorCameraPathPick:${connectionId}`;
		pick.renderOrder = 899;
		pick.userData = {
			editorEntity: 'camera-connection',
			connectionId
		} satisfies EditorCameraConnectionUserData;

		visualMaterial.resolution.set(
			Math.max(1, canvas.clientWidth),
			Math.max(1, canvas.clientHeight)
		);
		pickMaterial.resolution.copy(visualMaterial.resolution);
		scene.add(visual, pick);
		return {
			visual,
			visualGeometry,
			visualMaterial,
			pick,
			pickGeometry,
			pickMaterial
		};
	}

	function disposeConnectionHelper(helper: ConnectionHelper) {
		helper.visual.removeFromParent();
		helper.pick.removeFromParent();
		helper.visualGeometry.dispose();
		helper.pickGeometry.dispose();
		helper.visualMaterial.dispose();
		helper.pickMaterial.dispose();
	}

	function createAnchorHelper(connectionId: string, anchorId: string): AnchorHelper {
		const root = new Group();
		// P21.6 Slice B §4.2 — delicate spline control points: the visible dot
		// shrinks 0.14 → 0.07 and re-inks to the invariant anchor token. The
		// invisible shell keeps today's 0.14 grab-feel (colorWrite off — never
		// opacity 0: mesh hits below NEAR_INVISIBLE_OPACITY are filtered —
		// depthWrite off so it never becomes an invisible occluder). The
		// decorative dot never raycasts: no duplicate/competing hits. Hover
		// scales the dot only, never the shared root.
		const dotGeometry = new SphereGeometry(0.07, 14, 10);
		const dotMaterial = new MeshBasicMaterial({
			color: SCENE_PALETTE.cameraAnchor,
			depthTest: false,
			depthWrite: false,
			toneMapped: false
		});
		const marker = new Mesh(dotGeometry, dotMaterial);
		marker.raycast = () => undefined as never;
		const shellGeometry = new SphereGeometry(0.14, 10, 8);
		const shellMaterial = new MeshBasicMaterial({
			transparent: true,
			opacity: 1,
			depthWrite: false,
			toneMapped: false
		});
		shellMaterial.colorWrite = false;
		const shell = new Mesh(shellGeometry, shellMaterial);
		root.name = `EditorCameraAnchor:${connectionId}:${anchorId}`;
		root.userData = {
			editorEntity: 'camera-anchor',
			connectionId,
			anchorId
		} satisfies EditorCameraAnchorUserData;
		marker.renderOrder = 1002;
		root.add(marker, shell);
		scene.add(root);
		store.registerAnchorHelperRoot(connectionId, anchorId, root);
		return {
			root,
			marker,
			dotGeometry,
			dotMaterial,
			shell,
			shellGeometry,
			shellMaterial,
			connectionId,
			anchorId
		};
	}

	function disposeAnchorHelper(helper: AnchorHelper) {
		store.unregisterAnchorHelperRoot(
			helper.connectionId,
			helper.anchorId,
			helper.root
		);
		helper.root.removeFromParent();
		helper.dotGeometry.dispose();
		helper.dotMaterial.dispose();
		helper.shellGeometry.dispose();
		helper.shellMaterial.dispose();
	}

	function disposeAll() {
		for (const helper of connectionHelpers.values()) disposeConnectionHelper(helper);
		for (const helper of anchorHelpers.values()) disposeAnchorHelper(helper);
		connectionHelpers.clear();
		anchorHelpers.clear();
	}

	$effect(() => {
		const hidden = Boolean(
			store.isVisitorCameraPreview ||
			store.pendingPlacementAssetId ||
			store.pendingPlacementPrimitiveKind ||
			store.pendingPlacementLightKind ||
			store.pendingNavigationCommand
		);
		const document = store.document;
		const selection = store.navigationSelection;
		// S10.1.3 — retained (inactive) connections render desaturated and
		// dashed; the View-menu toggle hides them entirely.
		const retainedIds = new Set(store.flowRetainedConnectionIds);
		const showRetained = store.viewportShowRetained;
		const selectedConnectionId =
			selection?.kind === 'connection' ||
			selection?.kind === 'anchor' ||
			selection?.kind === 'view-keyframe'
				? selection.connectionId
				: null;
		const hoveredConnectionId = store.hoveredConnectionId;
		const hoveredAnchorId = store.hoveredAnchorId;

		if (hidden) {
			disposeAll();
			return;
		}

		const liveConnectionIds = new Set(document.connections.map((connection) => connection.id));
		for (const [connectionId, helper] of connectionHelpers) {
			if (liveConnectionIds.has(connectionId)) continue;
			disposeConnectionHelper(helper);
			connectionHelpers.delete(connectionId);
		}
		// Hidden retained splines are disposed (never rendered).
		if (!showRetained) {
			for (const [connectionId, helper] of connectionHelpers) {
				if (!retainedIds.has(connectionId)) continue;
				disposeConnectionHelper(helper);
				connectionHelpers.delete(connectionId);
			}
		}

		for (const connection of document.connections) {
			let helper = connectionHelpers.get(connection.id);
			if (!helper) {
				helper = createConnectionHelper(connection.id);
				connectionHelpers.set(connection.id, helper);
			}
			const path = createDraftConnectionPositionPath(
				document,
				connection.id,
				'forward',
				store.rooms
			);
			const points = path.getSpacedPoints(getCameraPathVisualSampleCount(path));
			const positions = points.flatMap((point) => [point.x, point.y, point.z]);
			helper.visualGeometry.setPositions(positions);
			helper.pickGeometry.setPositions(positions);
			helper.visual.computeLineDistances();
			helper.pick.computeLineDistances();
			const selected = selectedConnectionId === connection.id;
			const hovered = hoveredConnectionId === connection.id;
			const retained = retainedIds.has(connection.id);
			// S10.1.3 — retained splines are desaturated gray, dashed, and
			// dimmer; they still pick/hover like any authored curve.
			helper.visualMaterial.dashed = retained && !selected && !hovered;
			helper.visualMaterial.dashScale = retained ? 3 : 1;
			helper.visualMaterial.dashSize = retained ? 0.18 : 0;
			helper.visualMaterial.gapSize = retained ? 0.12 : 0;
			helper.visualMaterial.linewidth = selected ? 2.5 : hovered ? 1.6 : 1.5;
			helper.visualMaterial.opacity = retained
				? selected
					? 0.8
					: hovered
						? 0.45
						: 0.22
				: selected
					? 0.9
					: hovered
						? 0.55
						: 0.45;
			helper.visualMaterial.color.set(
				selected
					? SCENE_PALETTE.cameraPathSelected
					: retained
						? 0x8a8a8a
						: hovered
							? SCENE_PALETTE.cameraPathSelected
							: SCENE_PALETTE.cameraPath
			);
			helper.visualMaterial.needsUpdate = true;
		}

		const selectedConnection = selectedConnectionId
			? document.connections.find((connection) => connection.id === selectedConnectionId)
			: undefined;
		const desiredAnchorKeys = new Set(
			(selectedConnection?.positionPath.anchors ?? []).map((anchor) =>
				anchorKey(selectedConnection!.id, anchor.id)
			)
		);
		for (const [key, helper] of anchorHelpers) {
			if (desiredAnchorKeys.has(key)) continue;
			disposeAnchorHelper(helper);
			anchorHelpers.delete(key);
		}

		if (selectedConnection) {
			for (const anchor of selectedConnection.positionPath.anchors) {
				const key = anchorKey(selectedConnection.id, anchor.id);
				let helper = anchorHelpers.get(key);
				if (!helper) {
					helper = createAnchorHelper(selectedConnection.id, anchor.id);
					anchorHelpers.set(key, helper);
				}
				helper.root.position.set(...getScenePathAnchorWorldPosition(anchor, store.rooms));
				const selected =
					selection?.kind === 'anchor' && selection.anchorId === anchor.id;
				const hovered =
					hoveredConnectionId === selectedConnection.id && hoveredAnchorId === anchor.id;
				helper.dotMaterial.color.setHex(
					selected || hovered ? 0xffffff : SCENE_PALETTE.cameraAnchor
				);
				helper.marker.scale.setScalar(selected ? 1.25 : hovered ? 0.1 / 0.07 : 1);
			}
		}

		updateResolution();
		invalidate();
	});

	const scratchVector = new Vector3();

	useTask(updateResolution);

	useTask(() => {
		// P21.6 Slice B §3.4 — anchor shells keep a 24px minimum projected
		// diameter; the visible dot never scales with the shell.
		if (anchorHelpers.size === 0) return;
		const observer = camera.current as PerspectiveCamera | undefined;
		const viewportHeight = Math.max(0, canvas.clientHeight || 0);
		if (!observer || viewportHeight <= 0) return;
		const effectiveFov =
			typeof observer.getEffectiveFOV === 'function'
				? observer.getEffectiveFOV()
				: observer.fov;
		let changed = false;
		for (const helper of anchorHelpers.values()) {
			scratchVector.setFromMatrixPosition(helper.root.matrixWorld);
			scratchVector.applyMatrix4(observer.matrixWorldInverse);
			const scale = pickShellScale(-scratchVector.z, effectiveFov, viewportHeight, 0.14);
			if (Math.abs(scale - helper.shell.scale.x) > 1e-3) {
				helper.shell.scale.setScalar(scale);
				changed = true;
			}
		}
		if (changed) invalidate();
	});


	onDestroy(disposeAll);
</script>
