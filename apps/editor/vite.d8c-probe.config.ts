/**
 * D8c.1 fixture-qualification harness. Test-only: never selected by dev, build
 * or production scripts. It serves the probe page over the product source and
 * streams probe GLBs from the retention store named by D8C_RETENTION, so no
 * candidate bytes enter git.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

function probeModels(): Plugin {
	return {
		name: 'd8c-probe-models',
		configureServer(server) {
			server.middlewares.use('/probe-models', (request, response) => {
				const retention = process.env.D8C_RETENTION;
				if (retention === undefined) {
					response.statusCode = 500;
					response.end('D8C_RETENTION is not set');
					return;
				}
				const pathname = decodeURIComponent((request.url ?? '').split('?')[0] ?? '');
				if (!/^\/[a-z0-9_]+\/probe-(source|stripped)\.glb$/.test(pathname)) {
					response.statusCode = 404;
					response.end('not a probe model');
					return;
				}
				const file = join(resolve(retention), pathname);
				if (!existsSync(file) || !statSync(file).isFile()) {
					response.statusCode = 404;
					response.end('probe model not acquired');
					return;
				}
				response.setHeader('Content-Type', 'model/gltf-binary');
				response.setHeader('Content-Length', String(statSync(file).size));
				response.setHeader('Cache-Control', 'no-store');
				createReadStream(file).pipe(response);
			});
		}
	};
}

export default defineConfig({
	root: ROOT,
	appType: 'mpa',
	// The product's static tree: curated textures and shipped models resolve here,
	// exactly as they do on the dev server.
	publicDir: join(ROOT, 'static'),
	plugins: [probeModels(), svelte({ preprocess: vitePreprocess() })],
	resolve: {
		alias: { $lib: join(ROOT, 'src/lib') },
		dedupe: ['three']
	},
	define: { __BISKIQ_BUILD_REVISION__: JSON.stringify('d8c-probe') },
	server: {
		host: '127.0.0.1',
		port: Number(process.env.D8C_PROBE_PORT ?? 5321),
		strictPort: true,
		fs: { strict: false }
	},
	optimizeDeps: {
		include: ['three', 'three/webgpu', 'three/tsl', '@threlte/core', '@threlte/extras']
	}
});
