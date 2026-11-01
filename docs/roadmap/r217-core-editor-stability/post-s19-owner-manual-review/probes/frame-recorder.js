/*
 * PR #247 probe: record what production actually drew, frame by frame, during real input.
 * Runs inside the Scene's onAfterRender, so it reads the very framebuffer the render left,
 * and logs the facts each frame was drawn with. Nothing here renders or moves anything.
 */
(() => {
	const P = window.__pr247;
	const THREE = P.THREE;
	const proto = THREE.Object3D.prototype;
	if (!P.recorderInstalled) {
		const original = proto.onAfterRender;
		proto.onAfterRender = function (renderer, scene, camera) {
			const R = P.rec;
			if (this.isScene && R && R.on && !P.busy) {
				const gl = renderer.getContext();
				const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
				const data = new Uint8Array(w * h * 4);
				gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
				const o = P.objects();
				const bs = R.blockSize;
				const bw = Math.floor(w / bs), bh = Math.floor(h / bs);
				const blocks = new Float32Array(bw * bh);
				for (let y = 0; y < bh * bs; y += 1) for (let x = 0; x < bw * bs; x += 1) {
					const k = (y * w + x) * 4;
					blocks[Math.floor(y / bs) * bw + Math.floor(x / bs)] += (0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2]) / (bs * bs);
				}
				const u = o.grid?.material.uniforms;
				R.frames.push({
					t: performance.now(),
					near: camera.near, far: camera.far,
					eye: camera.position ? camera.matrixWorld.elements.slice(12, 15) : null,
					matScale: o.mat?.scale.x, matX: o.mat?.position.x, matZ: o.mat?.position.z,
					gridScale: o.grid?.scale.x, gridX: o.grid?.position.x, gridZ: o.grid?.position.z,
					uSize: u?.uSize.value, lattice: u ? [...u.uLatticeOffset.value] : null, pr: u?.uPixelRatio.value
				});
				R.blocks.push(blocks); R.bw = bw; R.bh = bh;
				if (R.keep && R.images.length < R.keep) {
					const canvas = document.createElement('canvas');
					const [cx, cy, cw, ch] = R.crop;
					canvas.width = cw; canvas.height = ch;
					canvas.getContext('2d').drawImage(renderer.domElement, cx, cy, cw, ch, 0, 0, cw, ch);
					R.images.push(canvas.toDataURL('image/png'));
				}
			}
			return original.apply(this, arguments);
		};
		P.recorderInstalled = true;
	}
	P.rec = { on: true, frames: [], blocks: [], images: [], blockSize: 8, keep: window.__keep ?? 0, crop: window.__crop ?? [0, 0, 480, 300] };
	return 'recording';
})();
