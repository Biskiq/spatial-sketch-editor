/* PR #247 probe: a PNG of one recorded pose, with the shipped or the candidate fade. Debug only. */
(() => {
	const P = window.__pr247;
	const c = window.__capture;
	const material = P.objects().grid.material;
	const original = (P.originalFragment = P.originalFragment ?? material.fragmentShader);
	const common = (m) => `levelFade(min(spacingCssPx(vLattice.x / ${m}), spacingCssPx(vLattice.y / ${m})))`;
	material.fragmentShader = c.weights === 'common'
		? original
			.replace('float minorWeight = levelFade(spacingCssPx(minorCells));', `float minorWeight = ${common('1.0')};`)
			.replace('float majorWeight = levelFade(spacingCssPx(majorCells));', `float majorWeight = ${common('5.0')};`)
			.replace('float coarseWeight = levelFade(spacingCssPx(coarseCells)) * (1.0 - majorWeight);', `float coarseWeight = ${common('25.0')} * (1.0 - majorWeight);`)
		: original;
	material.needsUpdate = true;
	P.apply({ target: c.target, azimuthRadians: c.az, elevationRadians: (c.el * Math.PI) / 180, targetPlaneHeightMeters: c.T }, c.radius);
	P.renderer.render(P.scene, P.camera);
	const url = P.renderer.domElement.toDataURL('image/png');
	material.fragmentShader = original;
	material.needsUpdate = true;
	return url;
})();
