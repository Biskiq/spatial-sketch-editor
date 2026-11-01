(() => {
 const P=window.__pr247; const c=window.__s;
 P.apply({target:c.target,azimuthRadians:c.az,elevationRadians:c.el*Math.PI/180,targetPlaneHeightMeters:c.T},c.radius);
 P.renderer.render(P.scene,P.camera);
 return P.renderer.domElement.toDataURL('image/png');
})();
