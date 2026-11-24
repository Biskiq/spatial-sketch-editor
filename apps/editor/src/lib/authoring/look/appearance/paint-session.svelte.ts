import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
import type { StageShellState } from '../../stage/route/stage-shell-state.svelte';
import { paintConsequence } from '../../stage/paint-consequence';
import { contribution } from '../../workspace/region-ownership';
import type { FinishAuthoring } from '../finish-authoring.svelte';
import { paintTileSource, parseColourKey } from '../paint-pick';
import { createPaintTrayState } from '../paint-tray-state.svelte';
import type { PaintAppearanceProps, PaintChip } from '../appearance-view';

export function createPaintSession(input: {
	readonly shell: StageShellState;
	readonly finishes: () => FinishAuthoring;
	readonly previewing: () => boolean;
	readonly openLibrary: () => void;
	readonly endLibraryDraft: () => void;
	readonly finishTileSource: (id: string) => FinishTileSource | null;
}) {
	const { shell } = input;
	const paintTray = $derived(input.finishes().paintTray());
	const paintTrayState = createPaintTrayState();
	// Paint's consequence line, read on the Stage view bar while the tray is up.
	const paintLine = $derived(
		shell.armedHostTool === 'paint' && !input.previewing() && !shell.libraryOpen && input.finishes().libraryDraft === null
			? paintConsequence({
				stroke: shell.paintTool?.stroke() ?? null,
				dropper: paintTray.dropper,
				picked: paintTray.active !== null,
				tab: paintTray.colourEnabled ? paintTrayState.tab : 'materials',
				candidate: shell.paintCandidate
			})
			: null
	);
	$effect(() => {
		if (shell.armedHostTool !== 'paint') paintTrayState.reset();
	});

	function paintKey(key: 'tab' | 'reach' | 'sample'): boolean {
			if (key === 'tab') {
				if (!input.finishes().paintTray().colourEnabled) return false;
				paintTrayState.toggleTab(true);
			} else if (key === 'reach') {
				const next = shell.paintTool?.surfaceScope() === 'space' ? 'surface' : 'space';
				shell.paintTool?.setSurfaceScope(next);
			} else {
				if (input.finishes().dropperArmed) input.finishes().cancelDropper();
				else input.finishes().armDropper();
			}
			return true;
		}

	function dismissPaint(): boolean {
			if (input.finishes().libraryDraft !== null) {
				input.endLibraryDraft();
				return true;
			}
			if (paintTrayState.wheelOpen) {
				// Paint colour closes first and hands focus back to Custom colour.
				paintTrayState.setWheelOpen(false);
				document.querySelector<HTMLElement>('[data-paint-wheel-open]')?.focus();
				return true;
			}
			if (input.finishes().dropperArmed) {
				input.finishes().cancelDropper();
				return true;
			}
			return paintTrayState.dismiss();
		}

	function readTray(): PaintAppearanceProps | null {
		const finishes = input.finishes();
		if (shell.armedHostTool !== 'paint' || input.previewing() || shell.libraryOpen || finishes.libraryDraft !== null) return null;
		return {
			tray: paintTray,
			view: paintTrayState,
			radius: shell.paintTool?.surfaceScope() ?? 'surface',
			onRadius: (radius) => shell.paintTool?.setSurfaceScope(radius),
			onPick(swatch) {
				const colour = swatch.kind === 'colour' ? parseColourKey(swatch.key) : null;
				if (colour !== null) finishes.pickColour(colour);
				else finishes.pickMaterialKey(swatch.key);
			},
			onColour: (colour) => finishes.pickColour(colour),
			onFavourite: () => finishes.toggleActiveFavourite(),
			onDropper: () => (finishes.dropperArmed ? finishes.cancelDropper() : finishes.armDropper()),
			onLibrary: input.openLibrary,
			palette: {
				...finishes.paletteView(),
				rename: (slotId, name) => void finishes.renamePaletteSlot(slotId, name),
				setColor: (slotId, color) => void finishes.setPaletteSlotColor(slotId, color),
				remove: (slotId) => void finishes.removePaletteSlot(slotId),
				add: (color) => finishes.addPaletteSlot(color)
			},
			tileSource: input.finishTileSource
		};
	}

	const toolbars = contribution<'appearance', 'toolbars'>()({
		get paintLine() { return paintLine; }
	});
	return {
		paintKey,
		dismissPaint,
		toolbars,
		get tray() { return readTray(); },
		get ownsPlate() { return shell.armedHostTool === 'paint' && !input.previewing() && !shell.libraryOpen; },
		get chip(): PaintChip {
			const swatch = paintTray.active;
			return swatch === null ? null : {
				color: swatch.color,
				shape: swatch.kind === 'colour' ? 'colour' : 'material',
				source: swatch.kind === 'finish' ? paintTileSource(swatch.key, input.finishTileSource) : null
			};
		}
	};
}
