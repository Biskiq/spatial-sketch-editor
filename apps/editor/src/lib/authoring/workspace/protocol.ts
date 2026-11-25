import type { BootState } from '../stage/boot-state';
import type { StageHistoryCommandOutcome } from '../stage/host-acceptance';
import type { StageFacade } from '../stage/stage-facade';
import type { StageLens } from '../stage/stage-session';
import type { LIFECYCLE_ORDER } from './lifecycle-order';

export type FeatureId =
	| 'appearance'
	| 'artwork'
	| 'experience'
	| 'layout-readings'
	| 'library'
	| 'light-inspection'
	| 'sky'
	| 'studio';

export type WorkspaceOwner = FeatureId | 'core';

export type LifecycleArguments = {
	interruptForReplacement: [];
	resetFocus: [];
	resetPresentationBeforeSwap: [];
	resetPresentation: [];
	facadeMounted: [facade: StageFacade];
	adaptersChanged: [];
	accepted: [];
	historyInstalled: [outcome: Extract<StageHistoryCommandOutcome, { kind: 'installed' }>];
	historyStep: [direction: 'undo' | 'redo'];
	readingChange: [reading: '3d' | 'plan'];
	settlePending: [];
	leaveLens: [next: StageLens];
	windowBlur: [];
	leaveProject: [];
	start: [];
	dispose: [];
};

export type LifecycleEvent = keyof LifecycleArguments;
export type RefusalEvent = 'leaveLens' | 'settlePending';
type LifecycleResult<Event extends LifecycleEvent> = Event extends RefusalEvent ? boolean : void;
type LifecycleStep<Event extends LifecycleEvent> = (typeof LIFECYCLE_ORDER)[Event][number];
export type LifecycleHandler<Event extends LifecycleEvent> = (
	...args: LifecycleArguments[Event]
) => Event extends RefusalEvent ? boolean | void : void;

export type FeatureLifecycle = {
	[Event in LifecycleEvent]: (...args: LifecycleArguments[Event]) => LifecycleResult<Event>;
};

export type LifecycleRegistration<Owner extends WorkspaceOwner> = {
	[Event in LifecycleEvent]?: {
		[Step in LifecycleStep<Event> as Step extends `${Owner}:${infer Name}` ? Name : never]?: LifecycleHandler<Event>;
	};
};

export type LifecycleRegistrar = {
	[Owner in WorkspaceOwner]: { readonly id: Owner; readonly lifecycle: LifecycleRegistration<Owner> };
}[WorkspaceOwner];

export type EscapeResult = 'handled' | 'pass';

/** Values sampled at their original points while unwinding one Escape key. */
export type EscapeContext = {
	readonly event: KeyboardEvent;
	stage: StageFacade | null;
	armedHostTool: string | null;
	toolbarFocus: boolean;
	claimed: boolean;
};

/** Set once after the owners register their lifecycle steps. */
export function late<Value>() {
	let cell: { readonly value: Value } | undefined;
	return {
		get(): Value {
			if (cell === undefined) throw new Error('Workspace lifecycle is not installed');
			return cell.value;
		},
		set(value: Value): void {
			if (cell !== undefined) throw new Error('Workspace lifecycle is already installed');
			cell = { value };
		}
	};
}


export type StageBootPanelView = {
	readonly boot: BootState;
	readonly repair: {
		readonly busy: boolean;
		readonly error: string | null;
		onFileChosen(event: Event): Promise<void>;
	};
	readonly transferName: string | null;
	readonly runReplacement: (kind: 'starter' | 'empty') => Promise<void>;
	readonly returnToObject: () => void;
};

export type StageReplaceDialogView = {
	readonly pendingReplacement: 'starter' | 'empty' | 'source' | null;
	readonly runReplacement: (kind: 'starter' | 'empty' | 'source') => Promise<void>;
	readonly cancelReplacement: () => void;
};
