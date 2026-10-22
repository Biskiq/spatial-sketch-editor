// Writes the probe's Layout fixtures as canonical JSON (bundled by cold-compile.mjs).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serializeWallFirstLayoutDocument } from '@portfolio/layout-core';
import { addOpenings, buildGrid } from './fixtures';

const dir = process.argv[2]!;
for (const k of [3, 7, 14]) writeFileSync(join(dir, `grid-${k}.json`), serializeWallFirstLayoutDocument(addOpenings(buildGrid(k))));
writeFileSync(join(dir, 'grid-20-walls.json'), serializeWallFirstLayoutDocument(buildGrid(20)));
