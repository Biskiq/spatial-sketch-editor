/** A fresh process keeps the cold oracle's graph out of the retained editor's
 * peak heap. Exact final authored JSON is the hand-off, outside edit timing. */
import { readFileSync, writeFileSync } from 'node:fs';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { outputDigest } from './persistent-oracle';

const document = JSON.parse(readFileSync(process.env.S06_SOURCE_FILE!, 'utf8'));
const result = compileWallFirstLayoutGeometry(document);
writeFileSync(process.env.S06_COLD_RESULT!, JSON.stringify({ oracleDigest: outputDigest(result) }) + '\n');
