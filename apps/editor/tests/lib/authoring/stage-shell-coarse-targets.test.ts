/** Accessibility target floors; compact glyph dimensions are deliberately independent. */
import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

describe('shell coarse-pointer targets',()=>{
 for(const file of ['stage/shell/EditorCard','stage/shell/EditorIndex','stage/shell/StageDock','stage/shell/StageDraftingControl','stage/shell/StageHeightSheet','stage/shell/StageInstrumentHost','adapters/layout/LayoutInkPalette']) {
  it(`${file} keeps a nonzero coarse target floor`,()=>{
   const source=readFileSync(`src/lib/authoring/${file}.svelte`,'utf8');
   const block=source.slice(source.indexOf('@media (pointer: coarse)'));
   expect(block).toMatch(/(?:min-)?width:\s*(?:44px|var\(--shell-touch-target, 44px\))/);
   expect(block).toMatch(/(?:min-)?height:\s*(?:44px|var\(--shell-touch-target, 44px\))/);
  });
 }
});
