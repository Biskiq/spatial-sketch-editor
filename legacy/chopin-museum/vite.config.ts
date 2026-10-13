import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { museumEditorEntryPlugin } from './vite/museum-editor-entry-plugin';

export default defineConfig({
	plugins: [museumEditorEntryPlugin(), sveltekit()],
	cacheDir: 'node_modules/.vite/chopin-museum',
	optimizeDeps: {
		include: [
			'three',
			'three/addons/lines/Line2.js',
			'three/addons/lines/LineGeometry.js',
			'three/addons/lines/LineMaterial.js',
			'three/examples/jsm/controls/OrbitControls.js',
			'three/examples/jsm/controls/TransformControls.js',
			'three/examples/jsm/utils/SkeletonUtils.js',
			'@threlte/core',
			'@threlte/extras'
		]
	}
});
