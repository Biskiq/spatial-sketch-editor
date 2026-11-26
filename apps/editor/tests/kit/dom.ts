import { flushSync, mount, tick, unmount, type Component, type ComponentProps } from 'svelte';

// ---------------------------------------------------------------------------
// Mounting

export type Mounted<Props extends Record<string, unknown>> = {
	readonly target: HTMLElement;
	readonly component: ReturnType<typeof mount>;
	readonly props: Props;
	unmount(): void;
};

/**
 * Mount one component in a fresh body child. The caller owns the jsdom
 * environment; this function only owns the component lifetime.
 */
export function mountComponent<Props extends Record<string, unknown>>(
	component: Component<Props>,
	props: Props,
	options: { readonly target?: HTMLElement } = {}
): Mounted<Props> {
	const target = options.target ?? document.createElement('div');
	if (options.target === undefined) document.body.append(target);
	const mounted = mount(component, { target, props });
	flushSync();
	let live = true;
	return {
		target,
		component: mounted,
		props,
		unmount() {
			if (!live) return;
			live = false;
			void unmount(mounted);
			if (options.target === undefined) target.remove();
		}
	};
}

/** Mount with a Svelte component's own prop type, for typed call sites. */
export function mountWithProps<ComponentType extends Component<any>>(
	component: ComponentType,
	props: ComponentProps<ComponentType>,
	options: { readonly target?: HTMLElement } = {}
): Mounted<ComponentProps<ComponentType>> {
	return mountComponent(component as Component<ComponentProps<ComponentType>>, props, options);
}

// ---------------------------------------------------------------------------
// Settling and polling

/** Let Svelte flush, one macrotask run and Svelte flush again. */
export async function settle(): Promise<void> {
	await tick();
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	await tick();
}

/** Poll a predicate until it holds, with a bounded wait. */
export async function eventually(
	check: () => boolean,
	options: { readonly attempts?: number; readonly intervalMs?: number } = {}
): Promise<void> {
	const attempts = options.attempts ?? 200;
	const intervalMs = options.intervalMs ?? 5;
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (check()) return;
		await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
	}
	if (check()) return;
	throw new Error('condition never became true');
}
