// Regenerates examples/*.json from the same commands the UI uses: npx vite-node scripts/make-examples.ts
import { writeFileSync } from 'node:fs';
import { arrange, createBand, moveGuidePoint, setEntrance, setGuide, setNotes, setPiecePose } from '../src/model/commands';
import { serialize } from '../src/model/file';
import { freshFixture } from '../src/model/fixture';

const guided = setGuide(freshFixture(), [[-2.2, 1.4], [-0.4, 2], [1.5, 1], [2.1, -0.6]], 'Display guide');
if ('refused' in guided) throw new Error(guided.refused);
let original = arrange(createBand(guided), { startMargin: 0.3, endMargin: 0.3, sideOffset: 0.5, order: ['piece-b', 'piece-main', 'piece-c'], follow: true });
// Local exception: the main piece leaves its slot and turns toward the entrance.
original = setPiecePose(original, 'piece-main', { x: 0.25, z: 1.22, yaw: (28 * Math.PI) / 180 });
original = setNotes(original, 'Example (engineering walkthrough, not an owner verdict). Open, bending display; main piece stands proud of the edge facing Entrance A. Quality to preserve: the long bend behind the main piece.');

let revised = setEntrance(original, 'east');
revised = moveGuidePoint(revised, 'gp-4', 1.19, -1.61);
revised = setNotes(revised, 'Example revision for Entrance B: main piece unchanged; the guide end swings away from the new arrival area, carrying the edge and both supports. The bend behind the main piece survives; the run toward Entrance A is shorter.');

writeFileSync(new URL('../examples/original.json', import.meta.url), serialize(original) + '\n');
writeFileSync(new URL('../examples/revised.json', import.meta.url), serialize(revised) + '\n');
