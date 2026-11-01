/*
 * PR #247 probe: attach to the live Stage renderer and drive the production scene.
 * Loaded into the running editor with `agent-browser eval --stdin`. Debug only; it
 * imports the same modules the editor uses through the Vite dev server, so the
 * materials, the mat placement and the clip range are the shipped ones.
 */
(async () => {
	const FS = window.__PROBE_FS ?? '/@fs/<absolute-checkout-path>';
	const threeUrl = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /\/deps\/three\.js/.test(n));
	const THREE = await import(threeUrl);
	const P = (window.__pr247 = window.__pr247 ?? {});
	P.THREE = THREE;
	const proto = THREE.Object3D.prototype;
	if (!P.hooked) {
		const original = proto.onBeforeRender;
		proto.onBeforeRender = function (r, s, c) {
			if (this.isScene) { P.renderer = r; P.scene = s; P.camera = c; P.frames = (P.frames ?? 0) + 1; }
			return original.apply(this, arguments);
		};
		P.hooked = true;
	}
	const viewport = await import(`${FS}/packages/camera-core/src/viewport.ts`);
	const grid = await import(`${FS}/apps/editor/src/lib/authoring/stage/stage-grid.ts`);
	const matGrid = await import(`${FS}/apps/editor/src/lib/authoring/stage/shell/stage-mat-grid.ts`);
	P.viewport = viewport;
	P.groundFor = grid.matGroundFor;
	P.updateGrid = matGrid.updateMatGridMaterial;

	P.objects = () => {
		const out = { floors: [], walls: [], mat: null, grid: null, others: [] };
		P.scene.traverse((o) => {
			if (!o.isMesh) return;
			if (o.material?.uniforms?.uLatticeOffset) out.grid = o;
			else if (o.name.startsWith('VisitorFloor:')) out.floors.push(o);
			else if (o.name.startsWith('VisitorPhysicalWall')) out.walls.push(o);
			else if (o.material?.isMeshStandardMaterial && o.geometry?.type === 'PlaneGeometry' && !out.mat && !o.name) out.mat = o;
			else out.others.push(o);
		});
		return out;
	};
	P.rect = () => {
		const c = P.renderer.domElement;
		const b = c.getBoundingClientRect();
		return { left: 0, top: 0, width: b.width, height: b.height, devicePixelRatio: P.renderer.getPixelRatio() };
	};
	/** One pose through the shipped evaluator, realized exactly as StageCamera and StageMatGround do. */
	P.apply = (pose, sceneRadius, datum = 0) => {
		const state = viewport.createViewportCameraState({ outputId: 'probe', sessionEpoch: 'probe', sourceRevision: 'probe', pose, sceneRadiusMeters: sceneRadius, displayGroundYMeters: datum });
		const result = viewport.evaluateViewport(state, P.rect(), 0, 0);
		const evaluation = result.evaluation ?? result;
		const camera = P.camera;
		camera.matrixAutoUpdate = false;
		camera.matrix.fromArray(evaluation.inverseViewMatrix);
		camera.matrixWorldNeedsUpdate = true;
		camera.near = evaluation.near;
		camera.far = evaluation.far;
		camera.projectionMatrix.fromArray(evaluation.projectionMatrix);
		// Candidate near plane, tested without touching camera-core: rewrites only the
		// perspective depth terms of the evaluated matrix.
		if (P.nearCandidate) {
			const eye = evaluation.eye;
			const d = Math.hypot(eye[0] - pose.target[0], eye[1] - pose.target[1], eye[2] - pose.target[2]);
			const halfFov = Math.atan(1 / evaluation.projectionMatrix[5]);
			const bottom = pose.elevationRadians + halfFov;
			const groundNear = eye[1] - datum > 0 && bottom > 0 ? ((eye[1] - datum) * Math.cos(halfFov)) / Math.sin(bottom) : Infinity;
			const near = Math.max(0.01, Math.min(Math.max(d - sceneRadius, P.nearCandidate * d), 0.9 * groundNear));
			const far = evaluation.far;
			camera.near = near;
			camera.projectionMatrix.elements[10] = -(far + near) / (far - near);
			camera.projectionMatrix.elements[14] = (-2 * far * near) / (far - near);
		}
		camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
		camera.updateMatrixWorld(true);
		camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
		const ground = P.groundFor(evaluation, datum);
		const o = P.objects();
		const size = 2 * ground.halfExtentMeters;
		if (o.mat) { o.mat.position.set(ground.centerXZ[0], datum - 0.004, ground.centerXZ[1]); o.mat.scale.set(size, size, 1); }
		if (o.grid) {
			o.grid.position.set(ground.centerXZ[0], datum + 0.002, ground.centerXZ[1]);
			o.grid.scale.set(size, size, 1);
			P.updateGrid(o.grid.material, ground, P.renderer.getPixelRatio());
		}
		return { near: camera.near, far: evaluation.far, eye: [...evaluation.eye], halfExtent: ground.halfExtentMeters };
	};
	/** Toggle by group without touching production state permanently. */
	P.show = (flags) => {
		const o = P.objects();
		const set = (m, v) => { if (m) m.visible = v; };
		set(o.mat, flags.mat); set(o.grid, flags.grid);
		o.floors.forEach((m) => set(m, flags.floor));
		o.walls.forEach((m) => set(m, flags.walls));
	};
	P.read = () => {
		const r = P.renderer;
		r.setRenderTarget(null);
		r.render(P.scene, P.camera);
		const gl = r.getContext();
		const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
		const data = new Uint8Array(w * h * 4);
		gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
		return { w, h, data };
	};
	return JSON.stringify({ threeUrl, ok: true, hasEvaluate: typeof viewport.evaluateViewport });
})();
