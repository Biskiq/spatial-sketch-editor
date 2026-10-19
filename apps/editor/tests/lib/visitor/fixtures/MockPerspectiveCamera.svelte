<script lang="ts">
	// Threlte's camera is a Three PerspectiveCamera. The director only reads and
	// writes position/fov and calls lookAt/updateProjectionMatrix, so a plain
	// object is enough for the mounted camera-handoff test (jsdom has no WebGL).
	// The object is also recorded on globalThis so the test can observe the pose
	// the director actually drove.
	let { ref = $bindable() }: { ref?: unknown } = $props();

	const camera = {
		copies: 0,
		lastPoint: { x: 0, y: 0, z: 0 },
		position: {
			x: 0,
			y: 0,
			z: 0,
			copy(point: { x: number; y: number; z: number }) {
				camera.copies += 1;
				camera.lastPoint = { x: point.x, y: point.y, z: point.z };
				this.x = point.x;
				this.y = point.y;
				this.z = point.z;
			},
			set(x: number, y: number, z: number) {
				this.x = x;
				this.y = y;
				this.z = z;
			}
		},
		lookAt() {},
		fov: 54,
		updateProjectionMatrix() {}
	};

	(globalThis as Record<string, unknown>).__visitorMockCamera = camera;
	ref = camera;
</script>
