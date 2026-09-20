/**
 * `plan-render-harness.ts` — the smallest durable render harness for the Plan
 * surfaces (T2b).
 *
 * **Why it exists.** Until this harness, every `PlanSvg.svelte` /
 * `LayoutPlanViewport.svelte` claim in the suite was proven by slicing the
 * component's own source text (`readLibSource(...)` + `toContain`) or by
 * regex-matching a CSS rule out of the raw `.svelte` file. Those pins break on
 * harmless refactors and — worse — stay green when the component stops emitting
 * the thing they claim it paints. This harness renders the real component
 * through its public props and lets a test assert on what came *out*.
 *
 * **Mechanism, and why it is the smallest faithful one.**
 *
 * 1. `svelte/server`'s `render()` runs the shipped component (the `svelte()`
 *    transform is already in every lane's test setup) in plain Node. No jsdom,
 *    no happy-dom, no new dependency, no browser ceremony, fully deterministic.
 *    The component is *not* re-implemented or mocked into a different
 *    architecture: it is the same component the app mounts, driven by its real
 *    props (`model`, `planView`, `presentation`).
 * 2. `planSvgStylesheet()` compiles the same file with `svelte/compiler`
 *    (`css: 'external'`) so paint declarations can be read from the real
 *    stylesheet instead of a regex over source text. The compiler is the
 *    authority on what the stylesheet is; a comment or a stray `}` in the file
 *    can no longer fool the assertion.
 *
 * **What it deliberately does not do.** It does not run effects, mount into a
 * document, or dispatch events, so it proves the *emitted* half of a rendering
 * contract (element kind, class, geometry, attribute, order, presence) and the
 * *declared* half (compiled CSS for an emitted class). Interaction state is
 * driven by passing the same inputs the app passes (`presentation`, model
 * projections), not by synthesising DOM events — a claim that genuinely needs
 * hover/click must be proven at the model/adapter level where the decision is
 * made, or by the store the viewport reads.
 *
 * **Rules for extending it.** Add a helper only when a real replacement test
 * needs it, keep it prop-driven, and never let it reach for a component's
 * internals or for source text. If a claim cannot be expressed through the
 * component's public inputs and its rendered output, that claim belongs at a
 * lower layer — not in this file.
 */
import { compile } from 'svelte/compiler';
import { render as renderSsr } from 'svelte/server';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import PlanSvg from '$lib/editor/layout/PlanSvg.svelte';
import {
	createPlanViewportState,
	setPlanViewportSize,
	type PlanViewportState
} from '$lib/editor/layout/layout-plan-transform';
import type { PlanPresentationSource, PlanRenderModel } from '$lib/layout/plan-render-model';

const here = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(here, '../../src/lib');
const PLAN_SVG_PATH = resolve(LIB, 'editor/layout/PlanSvg.svelte');

/** Absolute path of a component under `src/lib`, for the stylesheet readers. */
export function componentPath(relative: string): string {
	return resolve(LIB, relative);
}

/** One element of rendered markup, with its attributes already parsed. */
export type PlanElement = {
	tag: string;
	attrs: Record<string, string>;
	/** `class` split on whitespace, in emission order. */
	classes: string[];
	/** Text content for `<text>` elements (entity-decoded), else `''`. */
	text: string;
	/** Depth in the tree, 0 for the root element. */
	depth: number;
	/** Ancestor classes (`g` elements carry the layer grouping). */
	ancestors: string[];
	/** Position in document order. */
	index: number;
};

export type PlanSvgInput = {
	model: PlanRenderModel;
	planView?: PlanViewportState;
	presentation?: PlanPresentationSource;
};

/** A viewport the harness owns, so renders are deterministic and comparable. */
export function planViewFixture(overrides: Partial<PlanViewportState> = {}): PlanViewportState {
	const state = createPlanViewportState();
	setPlanViewportSize(state, state.width, state.height);
	state.initialized = true;
	return Object.assign(state, overrides);
}

/** Render `PlanSvg.svelte` through its public props and parse the markup. */
export function renderPlanSvg(input: PlanSvgInput): PlanElement[] {
	return parseMarkup(renderPlanSvgMarkup(input));
}

/** The raw SSR markup, for a test that needs to inspect it as text. */
export function renderPlanSvgMarkup(input: PlanSvgInput): string {
	const { body } = renderSsr(PlanSvg, {
		props: {
			model: input.model,
			planView: input.planView ?? planViewFixture(),
			presentation: input.presentation
		}
	});
	return body;
}

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: '\u00a0'
};

function decodeEntities(value: string): string {
	return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
		if (code.startsWith('#x') || code.startsWith('#X')) {
			return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
		}
		if (code.startsWith('#')) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
		return ENTITIES[code] ?? match;
	});
}

/**
 * A deliberately tiny, deterministic parser for the harness's own rendered SVG.
 * It is a scanner over well-formed markup the harness just produced — not a
 * general HTML parser — so it can be small: tags, attributes, classes, text.
 */
export function parseMarkup(markup: string): PlanElement[] {
	const elements: PlanElement[] = [];
	const stack: string[] = [];
	const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g;
	const attrPattern = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
	let match: RegExpExecArray | null;

	while ((match = tagPattern.exec(markup)) !== null) {
		const [, closing, tag, rawAttrs, selfClosing] = match;
		if (closing === '/') {
			stack.pop();
			continue;
		}
		if (tag === 'style' || tag === 'script') {
			// Skip contents wholesale; the compiled stylesheet is read elsewhere.
			const end = markup.indexOf(`</${tag}>`, tagPattern.lastIndex);
			if (end !== -1) tagPattern.lastIndex = end + tag.length + 3;
			continue;
		}

		const attrs: Record<string, string> = {};
		let attrMatch: RegExpExecArray | null;
		attrPattern.lastIndex = 0;
		while ((attrMatch = attrPattern.exec(rawAttrs)) !== null) {
			attrs[attrMatch[1]] = decodeEntities(attrMatch[2] ?? attrMatch[3] ?? '');
		}

		let text = '';
		if (tag === 'text') {
			const end = markup.indexOf('</text>', tagPattern.lastIndex);
			if (end !== -1) text = decodeEntities(markup.slice(tagPattern.lastIndex, end)).trim();
		}

		// The component scope hash (`svelte-xxxxxxx`) is compiler machinery, not a
		// class the paint contract owns; drop it so assertions read product classes.
		const classes = (attrs.class ?? '')
			.split(/\s+/)
			.filter((name) => name && !name.startsWith('svelte-'));

		elements.push({
			tag,
			attrs,
			classes,
			text,
			depth: stack.length,
			ancestors: [...stack],
			index: elements.length
		});

		if (!selfClosing) stack.push(classes.join(' ') || tag);
	}

	return elements;
}

// --- stylesheet inspection ---------------------------------------------------

const stylesheetCache = new Map<string, string>();

/**
 * The compiled stylesheet of a component, by absolute path.
 *
 * Compiled rather than sliced: the Svelte compiler decides what the stylesheet
 * is, so comments, nested braces and formatting cannot change the answer, and a
 * declaration that the compiler drops is a declaration the browser never sees.
 */
export function componentStylesheet(path: string): string {
	let stylesheet = stylesheetCache.get(path);
	if (stylesheet === undefined) {
		const compiled = compile(readFileSync(path, 'utf8'), {
			filename: path.split('/').pop() ?? 'Component.svelte',
			generate: 'client',
			css: 'external'
		});
		stylesheet = (compiled.css?.code ?? '')
			// Strip the compiler's element-scope class so a test can name the
			// product selector (`.scene-footprint.active`), not `.scene-footprint
			// .active.svelte-1a2b3c`.
			.replace(/\.svelte-[\w-]+/g, '')
			// Scoping can also appear as `:global(...)`; unwrap it to plain CSS.
			.replace(/:global\(([^)]*)\)/g, '$1');
		stylesheetCache.set(path, stylesheet);
	}
	return stylesheet;
}

/** Compiled stylesheet of `PlanSvg.svelte`. */
export function planSvgStylesheet(): string {
	return componentStylesheet(PLAN_SVG_PATH);
}

/**
 * The declarations of one rule (`selector { … }`) from a component's compiled
 * stylesheet. Rules are matched by their exact normalised selector; later rules
 * for the same selector win, which is the cascade at equal specificity.
 * `@media` / `@supports` bodies are flattened, so a selector is found wherever
 * the compiler put it.
 */
export function componentRule(path: string, selector: string): Record<string, string> {
	const declarations: Record<string, string> = {};
	for (const rule of stylesheetRules(componentStylesheet(path))) {
		if (rule.selector !== selector) continue;
		Object.assign(declarations, rule.declarations);
	}
	return declarations;
}

/** The declarations of one rule of `PlanSvg.svelte`. */
export function planSvgRule(selector: string): Record<string, string> {
	return componentRule(PLAN_SVG_PATH, selector);
}

/** Every selector the compiled stylesheet declares, normalised and deduped. */
export function planSvgSelectors(): string[] {
	return [...new Set(stylesheetRules(planSvgStylesheet()).map((rule) => rule.selector))];
}

type StylesheetRule = { selector: string; declarations: Record<string, string> };

function parseDeclarations(body: string): Record<string, string> {
	const declarations: Record<string, string> = {};
	for (const declaration of body.split(';')) {
		const separator = declaration.indexOf(':');
		if (separator === -1) continue;
		const property = declaration.slice(0, separator).trim();
		if (property) declarations[property] = declaration.slice(separator + 1).trim();
	}
	return declarations;
}

/**
 * A depth-aware scanner over the compiled stylesheet. Depth matters: the file's
 * own notes are comments, and a rule directly after one must still be found.
 */
function stylesheetRules(css: string): StylesheetRule[] {
	const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const rules: StylesheetRule[] = [];
	let index = 0;
	while (index < clean.length) {
		const open = clean.indexOf('{', index);
		if (open === -1) break;
		const selector = clean.slice(index, open).replace(/\s+/g, ' ').trim();
		let depth = 1;
		let cursor = open + 1;
		while (cursor < clean.length && depth > 0) {
			const character = clean[cursor];
			if (character === '{') depth += 1;
			else if (character === '}') depth -= 1;
			cursor += 1;
		}
		const body = clean.slice(open + 1, cursor - 1);
		if (selector.startsWith('@')) rules.push(...stylesheetRules(body));
		else if (selector) rules.push({ selector, declarations: parseDeclarations(body) });
		index = cursor;
	}
	return rules;
}

// --- query helpers ----------------------------------------------------------

export function elementsWithClass(elements: readonly PlanElement[], name: string): PlanElement[] {
	return elements.filter((element) => element.classes.includes(name));
}

export function elementsByTag(elements: readonly PlanElement[], tag: string): PlanElement[] {
	return elements.filter((element) => element.tag === tag);
}

/** The first element with this tag, or `undefined`. */
export function elementByTag(
	elements: readonly PlanElement[],
	tag: string
): PlanElement | undefined {
	return elements.find((element) => element.tag === tag);
}

/** Every `class` token emitted anywhere in the render, deduped. */
export function emittedClasses(elements: readonly PlanElement[]): Set<string> {
	const classes = new Set<string>();
	for (const element of elements) for (const name of element.classes) classes.add(name);
	return classes;
}
