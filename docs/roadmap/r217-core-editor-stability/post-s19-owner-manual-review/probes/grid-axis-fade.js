/*
 * PR #247 probe: extreme zoom-out. Which grid lines survive, per world axis, per level, per
 * screen band, at one recorded pose? It isolates by a runtime shader patch on the real grid
 * material. `weights: 'axis'` is the shipped per-axis fade; `weights: 'common'` ties each level's
 * fade to the smaller of its two projected spacings, so a level leaves both directions together.
 * Set window.__fade = { poses, radius, target, weights }.
 */
(() => {
	const P = window.__pr247;
	const c = window.__fade;
	const o = P.objects();
	const material = o.grid.material;
	const original = (P.originalFragment = P.originalFragment ?? material.fragmentShader);
	function patched(mode) {
		let s = original.replace('varying vec2 vLattice;', 'uniform vec2 uAxisMask;\nuniform vec3 uLevelMask;\nvarying vec2 vLattice;');
		const weight = (m, cells) => mode === 'common'
			? `levelFade(min(spacingCssPx(vLattice.x / ${m}), spacingCssPx(vLattice.y / ${m})))`
			: `levelFade(spacingCssPx(${cells}))`;
		s = s.replace('float minorWeight = levelFade(spacingCssPx(minorCells));', `float am = axis == 0 ? uAxisMask.x : uAxisMask.y;\n\t\tfloat minorWeight = ${weight('1.0', 'minorCells')};`);
		s = s.replace('float majorWeight = levelFade(spacingCssPx(majorCells));', `float majorWeight = ${weight('5.0', 'majorCells')};`);
		s = s.replace('float coarseWeight = levelFade(spacingCssPx(coarseCells)) * (1.0 - majorWeight);', `float coarseWeight = ${weight('25.0', 'coarseCells')} * (1.0 - majorWeight);`);
		s = s.replace('lineCoverage(minorCells) * minorWeight * uMinorOpacity', 'lineCoverage(minorCells) * minorWeight * uMinorOpacity * am * uLevelMask.x');
		s = s.replace('max(lineCoverage(majorCells) * majorWeight, lineCoverage(coarseCells) * coarseWeight) *', 'max(lineCoverage(majorCells) * majorWeight * uLevelMask.y, lineCoverage(coarseCells) * coarseWeight * uLevelMask.z) * am *');
		return s;
	}
	material.uniforms.uAxisMask = { value: new P.THREE.Vector2(1, 1) };
	material.uniforms.uLevelMask = { value: new P.THREE.Vector3(1, 1, 1) };
	material.fragmentShader = patched(c.weights);
	material.needsUpdate = true;
	const measure = (bg) => {
		const f = P.read();
		const bands = new Array(10).fill(0);
		for (let y = 0; y < f.h; y += 1) {
			const band = Math.min(9, Math.floor((y / f.h) * 10));
			for (let x = 0; x < f.w; x += 1) {
				const k = (y * f.w + x) * 4;
				bands[band] += Math.abs(f.data[k] - bg.data[k]) + Math.abs(f.data[k + 1] - bg.data[k + 1]) + Math.abs(f.data[k + 2] - bg.data[k + 2]);
			}
		}
		return { total: bands.reduce((a, b) => a + b, 0), bands };
	};
	const rows = [];
	for (const pose of c.poses) {
		const a = P.apply({ target: c.target, azimuthRadians: pose.az, elevationRadians: (pose.el * Math.PI) / 180, targetPlaneHeightMeters: pose.T }, c.radius);
		P.show({ mat: true, grid: false, floor: false, walls: false });
		const bg = P.read();
		P.show({ mat: true, grid: true, floor: false, walls: false });
		const set = (ax, az, l) => { material.uniforms.uAxisMask.value.set(ax, az); material.uniforms.uLevelMask.value.set(...l); };
		set(1, 0, [1, 1, 1]); const worldX = measure(bg);   // lines of constant X
		set(0, 1, [1, 1, 1]); const worldZ = measure(bg);   // lines of constant Z
		set(1, 1, [1, 0, 0]); const l1 = measure(bg).total;
		set(1, 1, [0, 1, 0]); const l5 = measure(bg).total;
		set(1, 1, [0, 0, 1]); const l25 = measure(bg).total;
		set(1, 1, [1, 1, 1]);
		// Depth interaction: the same lines with the depth test off.
		const withDepth = measure(bg).total;
		material.depthTest = false; material.needsUpdate = true;
		const noDepth = measure(bg).total;
		material.depthTest = true; material.needsUpdate = true;
		rows.push({ ...pose, near: +a.near.toFixed(1), far: Math.round(a.far), half: a.halfExtent, constX: Math.round(worldX.total / 1000), constZ: Math.round(worldZ.total / 1000), xOverZ: +(worldX.total / Math.max(1, worldZ.total)).toFixed(2), l1: Math.round(l1 / 1000), l5: Math.round(l5 / 1000), l25: Math.round(l25 / 1000), depthLossPct: noDepth ? +((100 * (noDepth - withDepth)) / noDepth).toFixed(2) : 0, xBands: worldX.bands.map((v) => Math.round(v / 1000)), zBands: worldZ.bands.map((v) => Math.round(v / 1000)) });
	}
	delete material.uniforms.uAxisMask; delete material.uniforms.uLevelMask;
	material.fragmentShader = original;
	material.needsUpdate = true;
	P.show({ mat: true, grid: true, floor: true, walls: true });
	return JSON.stringify(rows);
})();
