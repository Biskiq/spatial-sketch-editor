import { CubeTexture, DataTexture, SRGBColorSpace } from 'three';
import { srgbByte, type resolveSkyLook } from './sky-atmosphere';
import { skyDirection } from './sky-time';

type SkyColors = Pick<ReturnType<typeof resolveSkyLook>, 'zenith' | 'horizon' | 'glow'>;

const SIZE = 64;

/** Three caches its equirectangular conversion by identity. Upload cube faces directly for live edits. */
export function createSkyBackground() {
	const faces = Array.from({ length: 6 }, () => {
		const data = new Uint8Array(SIZE * SIZE * 4);
		return { data, face: new DataTexture(data, SIZE, SIZE) };
	});
	const texture = new CubeTexture(faces.map(({ face }) => face));
	texture.colorSpace = SRGBColorSpace;

	function update({ zenith, horizon, glow }: SkyColors): void {
		const direction = glow && skyDirection(glow.bearing, 0);
		for (const [face, { data }] of faces.entries()) {
			for (let row = 0; row < SIZE; row++) {
				for (let column = 0; column < SIZE; column++) {
					const u = 2 * (column + 0.5) / SIZE - 1;
					const v = 1 - 2 * (row + 0.5) / SIZE;
					// CubeTexture reflects X before sampling (Three's cube image convention).
					const [x, y, z] = face === 0 ? [-1, v, -u] : face === 1 ? [1, v, u]
						: face === 2 ? [-u, 1, -v] : face === 3 ? [-u, -1, v]
						: face === 4 ? [-u, v, 1] : [u, v, -1];
					const length = Math.hypot(x, y, z);
					const elevation = Math.max(0, y / length);
					const lobe = glow && direction
						? glow.strength * Math.max(0, (x * direction[0] + z * direction[2]) / length) ** 8
						: 0;
					const offset = (row * SIZE + column) * 4;
					for (let channel = 0; channel < 3; channel++) {
						const base = horizon[channel]! + (zenith[channel]! - horizon[channel]!) * elevation;
						data[offset + channel] = srgbByte(base + ((glow?.color[channel] ?? base) - base) * lobe);
					}
					data[offset + 3] = 255;
				}
			}
		}
		texture.needsUpdate = true;
	}
	return { texture, update };
}
