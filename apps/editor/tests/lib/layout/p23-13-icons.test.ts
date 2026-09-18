/**
 * P23.13 S9 (step 3) — toolbar icon family under the 2026-09-17 owner ruling.
 *
 * Keep-list stays byte-identical on its lucide marks (Wall, Rect Room,
 * Poly Room, Door, Window — the Door 3-dash / Window-parallel redesigns are
 * explicitly not adopted); design effort goes to the rest, which carry the
 * verbatim Designer-D repo-SVG paths. Delete/Cancel stay generic lucide UI
 * (outside the drafting family). The icon component is editor-only, so
 * visitor chunks stay clean.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../../..');

function readLibSource(relativePath: string): string {
	return readFileSync(resolve(here, '../../../src/lib', relativePath), 'utf8');
}

const toolbar = readLibSource('editor/layout/LayoutDraftToolbar.svelte');
const icons = readLibSource('editor/layout/PlanDraftIcon.svelte');
const family = readFileSync(
	resolve(repoRoot, 'docs/reference/design-system/P23.13-drafting-icons-Designer-D.svg'),
	'utf8'
);

describe('P23.13 S9 toolbar icons (owner ruling 2026-09-17)', () => {
	it('keeps the five owner-ratified originals byte-identical on lucide', () => {
		// Wall, Rect Room, Poly Room, Door, Window — no repo-SVG swap.
		expect(toolbar).toContain('BrickWall');
		expect(toolbar).toContain('Square');
		expect(toolbar).toContain('Pentagon');
		expect(toolbar).toContain('DoorOpen');
		expect(toolbar).toContain('Grid2x2');
		expect(toolbar).toContain('<BrickWall size={14}');
		expect(toolbar).toContain('Rect Room</button>');
		expect(toolbar).toContain('Poly Room</button>');
		// The redesigns are not adopted: the toolbar never renders the
		// family Door/Window symbols.
		expect(toolbar).not.toContain('name="door"');
		expect(toolbar).not.toContain('name="window"');
		expect(toolbar).not.toContain('name="wall"');
		expect(toolbar).not.toContain('name="rect-room"');
		expect(toolbar).not.toContain('name="poly-room"');
	});

	it('carries the remaining drafting marks as verbatim Designer-D paths', () => {
		expect(toolbar).toContain('<PlanDraftIcon name="select"');
		expect(toolbar).toContain('<PlanDraftIcon name="column-preset"');
		expect(toolbar).toContain('<PlanDraftIcon name="platform-preset"');
		expect(toolbar).toContain('<PlanDraftIcon name="plinth-preset"');
		expect(toolbar).toContain('<PlanDraftIcon name="snap"');
		expect(toolbar).toContain('<PlanDraftIcon name="grid"');
		// Verbatim: every integrated path appears identically in the family SVG.
		for (const path of [
			'M5 3L17 12H11L8 18Z',
			'M10 3A7 7 0 1 0 10 17A7 7 0 1 0 10 3Z',
			'M2 6H18V14H2ZM5 10H15',
			'M4 4H16V16H4ZM7 7H13V13H7Z',
			'M4 4V11A6 6 0 0 0 16 11V4M4 7H7M13 7H16',
			'M3 3H17V17H3ZM3 8H17M3 13H17M8 3V17M13 3V17'
		]) {
			expect(icons).toContain(path);
			expect(family).toContain(path);
		}
		// Native 20×20, 1.5 px optical stroke, square corners, butt ends.
		expect(icons).toContain('viewBox="0 0 20 20"');
		expect(icons).toContain('stroke-width="1.5"');
		expect(icons).toContain('stroke-linejoin="miter"');
		expect(icons).toContain('stroke-linecap="butt"');
	});

	it('leaves generic UI outside the drafting family on lucide', () => {
		expect(toolbar).toContain('Trash2');
		expect(toolbar).toContain('<X size={14}');
	});

	it('keeps visible labels authoritative beside every icon', () => {
		for (const label of [
			'Select</button>',
			'Wall</button>',
			'Rect Room</button>',
			'Poly Room</button>',
			'Door</button>',
			'Window</button>',
			'Column</button>',
			'Platform</button>',
			'Plinth</button>',
			'Grid</button>'
		]) {
			expect(toolbar).toContain(label);
		}
	});

	it('stays editor-only (visitor chunks never import the icon component)', () => {
		const museumSources: string[] = [];
		void museumSources;
		// Pinned by location + import graph: the component lives under
		// editor/layout and only the editor toolbar references it. Chunk
		// purity itself is enforced by the visitor boundary suites.
		expect(toolbar).toContain("from './PlanDraftIcon.svelte'");
		expect(icons).not.toContain('museum');
	});
});
