import { existsSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const packageDirectories = readdirSync(resolve(root, 'packages'))
	.map((name) => resolve(root, 'packages', name))
	.filter((directory) => existsSync(resolve(directory, 'vitest.config.ts')));

export default defineConfig(({ mode }) => {
	const lane = mode === 'fast' || mode === 'arch' || mode === 'heavy' ? mode : null;
	const editorConfig = lane === null ? 'vitest.config.ts' : `vitest.${lane}.config.ts`;

	return {
		test: {
			pool: 'forks',
			projects: [
				resolve(root, 'apps/editor', editorConfig),
				...packageDirectories.map((directory) => ({
					root: directory,
					test: {
						name: basename(directory),
						include: [lane === 'arch' || lane === 'heavy' ? `tests/**/*.${lane}.test.ts` : 'tests/**/*.test.ts'],
						exclude: lane === 'fast'
							? [...configDefaults.exclude, '**/*.arch.test.ts', '**/*.heavy.test.ts']
							: configDefaults.exclude
					}
				}))
			]
		}
	};
});
