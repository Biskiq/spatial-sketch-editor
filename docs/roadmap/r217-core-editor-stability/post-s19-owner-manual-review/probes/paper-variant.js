(() => {
 const P=window.__pr247; const v=window.__variant; const THREE=P.THREE;
 let group=null; P.scene.traverse(o=>{ if(o.name==='StagePaperMarks') group=o; });
 if(!group) return 'no marks';
 const lines=[],tints=[];
 group.traverse(o=>{ if(o.isLineSegments2||o.type==='LineSegments2') lines.push(o); else if(o.isMesh) tints.push(o); });
 const halo=lines.find(l=>l.material.color.getHex()===0x152c26||l.userData.role==='halo')??lines[0];
 const core=lines.find(l=>l.material.color.getHex()===0x74560c||l.userData.role==='core')??lines[1];
 if(v.save){ P.savedPaper={h:[halo.material.color.getHex(),halo.material.linewidth,halo.material.opacity],c:[core.material.color.getHex(),core.material.linewidth],t:[tints[0]?.material.opacity,tints[0]?.material.color.getHex()]}; }
 const s=P.savedPaper; halo.userData.role='halo'; core.userData.role='core';
 halo.material.color.setHex(v.halo??s.h[0]); halo.material.linewidth=v.haloW??s.h[1]; halo.material.opacity=v.haloO??s.h[2];
 core.material.color.setHex(v.core??s.c[0]); core.material.linewidth=v.coreW??s.c[1];
 if(tints[0]){ tints[0].material.opacity=v.tint??s.t[0]; if(v.tintColor) tints[0].material.color.setHex(v.tintColor); else tints[0].material.color.setHex(s.t[1]); }
 P.renderer.render(P.scene,P.camera);
 return P.renderer.domElement.toDataURL('image/png');
})();
