import fs from 'node:fs';
import path from 'node:path';

function findRepoRoot(start = process.cwd()): string {
	let dir = path.resolve(start);
	while (true) {
		if (fs.existsSync(path.join(dir, 'apps/editor')) && fs.existsSync(path.join(dir, 'packages'))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) throw new Error(`repository root not found from ${start}`);
		dir = parent;
	}
}

process.chdir(path.join(findRepoRoot(), 'apps/editor'));
