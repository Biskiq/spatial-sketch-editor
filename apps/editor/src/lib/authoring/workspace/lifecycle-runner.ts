import { LIFECYCLE_ORDER, REFUSAL_EVENTS } from './lifecycle-order';
import type {
	FeatureLifecycle,
	LifecycleArguments,
	LifecycleEvent,
	LifecycleHandler,
	LifecycleRegistrar,
	LifecycleRegistration,
} from './protocol';

const events = Object.keys(LIFECYCLE_ORDER) as LifecycleEvent[];
const refusalEvents: ReadonlySet<LifecycleEvent> = new Set(REFUSAL_EVENTS);

export function createFeatureLifecycle(input: {
	readonly core: LifecycleRegistration<'core'>;
	readonly features: readonly Exclude<LifecycleRegistrar, { id: 'core' }>[];
}): FeatureLifecycle {
	const registrars: readonly LifecycleRegistrar[] = [
		{ id: 'core', lifecycle: input.core },
		...input.features,
	];

	// The type system checks owner/event membership at registration sites. Check
	// completeness and uniqueness here, where all registrations come together.
	function compile<Event extends LifecycleEvent>(event: Event) {
		const order: readonly string[] = LIFECYCLE_ORDER[event];
		const remaining = new Set(order);
		if (remaining.size !== order.length) throw new Error(`Duplicate lifecycle step in ${event}`);
		const handlers = new Map<string, LifecycleHandler<Event>>();
		for (const { id, lifecycle } of registrars) {
			const registration = lifecycle[event] as Record<string, LifecycleHandler<Event>> | undefined;
			for (const [name, handler] of Object.entries(registration ?? {})) {
				const step = `${id}:${name}`;
				if (!remaining.delete(step)) {
					const problem = handlers.has(step) ? 'Duplicate' : 'Unexpected';
					throw new Error(`${problem} lifecycle handler ${event} → ${step}`);
				}
				handlers.set(step, handler);
			}
		}
		if (remaining.size > 0) {
			throw new Error(`Missing lifecycle handlers for ${event}: ${[...remaining].join(', ')}`);
		}
		const chain = order.map((step) => handlers.get(step)!);
		const canRefuse = refusalEvents.has(event);

		return (...args: LifecycleArguments[Event]) => {
			for (const handler of chain) {
				if (handler(...args) === false && canRefuse) return false;
			}
			if (canRefuse) return true;
		};
	}

	for (const { id, lifecycle } of registrars) {
		for (const event of Object.keys(lifecycle)) {
			if (!Object.hasOwn(LIFECYCLE_ORDER, event))
				throw new Error(`Unexpected lifecycle event ${id} → ${event}`);
		}
	}
	// Every key is emitted by the authoritative table. The event's argument
	// and refusal types are paired inside compile before constructing the record.
	return Object.fromEntries(events.map((event) => [event, compile(event)])) as FeatureLifecycle;
}
