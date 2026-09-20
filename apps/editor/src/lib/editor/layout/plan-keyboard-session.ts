/**
 * `plan-keyboard-session.ts` — P23.13 S10 / §9: the keyboard's traversal
 * decision, as one pure function.
 *
 * **Why this module exists (T2b).** The decision — "does this key move the ring,
 * enter the group, or reach the numeric door?" — was six conditionals inline in
 * `LayoutPlanViewport.svelte`'s keydown handler, reachable by no test without
 * mounting a 5.8k-line component in a DOM this repo does not have (the suite runs
 * in Node). The only available proof was slicing the handler's source text, which
 * is why K1/K2 were pinned by whitespace-exact string matches and a
 * `planAnnouncedFocus = ` occurrence count. The *rule* is pure: a key, the
 * modifier state, the two gates the surface owns (plan view + select tool), the
 * keyboard's entry state, the quiet-canvas predicate, the group, the ring. The
 * component keeps what a pure function cannot know — the live interaction object,
 * the DOM event, the state writes — and asks this module what to do.
 *
 * **The rule (spec A5/§9), stated once.** A key the user has not asked this
 * instrument to use is left alone, so page scroll and every other surface keep
 * their arrows:
 *
 * - **Arrows** traverse a group the keyboard has *entered*, on a quiet canvas
 *   (§9: no open field, no live gesture or draft). They never *enter* a group: a
 *   pointer press focuses a control without entering anything, so membership
 *   alone would let a click unlock the arrows. When the ring is outside the group
 *   (`planTraversalStep` answers nothing) the decision is `null`, i.e. the arrow
 *   stays the page's.
 * - **Enter** comes in two presses. The first enters the selected owner's group
 *   and lands the ring on its first control; only when the entry is already held
 *   *and* the ring is on a member does Enter reach S7's numeric door. That makes
 *   the chain identical whether the ring arrived by keyboard or by pointer — a
 *   pointer-focused control cannot skip the entry.
 * - An open field owns Enter through its own input, so this decision never steals
 *   a submit, and a group the document cannot supply is `null` — absence, never a
 *   guess.
 */
import type { PlanTraversalControl } from './plan-keyboard-traversal';
import { planTraversalStep } from './plan-keyboard-traversal';

const TRAVERSAL_ARROWS = new Set(['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']);

export type PlanKeyboardTraversalFacts = {
	/** `KeyboardEvent.key`. */
	readonly key: string;
	readonly metaKey: boolean;
	readonly ctrlKey: boolean;
	readonly altKey: boolean;
	/** The Plan surface's mode; traversal exists in `layout` only. */
	readonly planViewMode: string;
	readonly tool: string;
	/** A5: the keyboard has entered the group of the selection still selected. */
	readonly entered: boolean;
	/** §9: no open field, no live gesture or draft that owns the keyboard. */
	readonly quiet: boolean;
	/**
	 * The selected owner's control group, resolved lazily: the group is built from
	 * document facts and is LOD-gated, so a decision that does not need it must not
	 * pay for it (and a key that is left alone must not build one at all).
	 */
	readonly group: () => readonly PlanTraversalControl[] | null;
	/** The control the ring is on, if any. */
	readonly focusId: string | null;
	/** A numeric field is open and owns Enter itself. */
	readonly numericEntryOpen: boolean;
};

export type PlanKeyboardTraversalDecision =
	/** Move the ring to `control`, the next member in traversal order. */
	| {
			readonly kind: 'traverse';
			readonly control: PlanTraversalControl;
			readonly index: number;
			readonly groupSize: number;
	  }
	/** Enter the selected owner's group, landing on its first control. */
	| {
			readonly kind: 'enter-group';
			readonly control: PlanTraversalControl;
			readonly groupSize: number;
	  }
	/**
	 * The ring is inside an entered group (or the selection owns no group): Enter
	 * is S7's numeric door. The caller attempts the door and, if the control has no
	 * exact value to edit, keeps handling the key — the door is a request, not a
	 * claim.
	 */
	| { readonly kind: 'open-numeric-door' };

/** What this key should do to the traversal instrument, or `null` to leave it alone. */
export function planKeyboardTraversalDecision(
	facts: PlanKeyboardTraversalFacts
): PlanKeyboardTraversalDecision | null {
	// Both traversal paths are plain, unmodified keys on the layout Plan with the
	// select tool; anything else belongs to whatever else handles the key.
	if (facts.metaKey || facts.ctrlKey || facts.altKey) return null;
	if (facts.planViewMode !== 'layout' || facts.tool !== 'select') return null;

	if (TRAVERSAL_ARROWS.has(facts.key) && facts.entered && facts.quiet) {
		const group = facts.group();
		if (group && group.length > 0) {
			const direction = facts.key === 'ArrowRight' || facts.key === 'ArrowDown' ? 1 : -1;
			const next = planTraversalStep(group, facts.focusId, direction);
			if (next) {
				return {
					kind: 'traverse',
					control: next,
					index: group.indexOf(next),
					groupSize: group.length
				};
			}
		}
		// An arrow that finds nothing to traverse is not a traversal: fall through
		// to `null` so the page keeps its scroll.
		return null;
	}

	if (facts.key === 'Enter' && !facts.numericEntryOpen) {
		const group = facts.quiet ? facts.group() : null;
		const focusInGroup =
			!!group && facts.focusId !== null && group.some((control) => control.id === facts.focusId);
		if (group && group.length > 0 && (!facts.entered || !focusInGroup)) {
			const first = group[0];
			if (first) return { kind: 'enter-group', control: first, groupSize: group.length };
		}
		return { kind: 'open-numeric-door' };
	}

	return null;
}
