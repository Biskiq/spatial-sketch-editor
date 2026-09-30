import { createContext, useContext, type RefObject } from 'react';
import type { Document, Focus, Value } from './model';
import type { Runtime } from './runtime';
import type { SceneHandle } from './Scene';
export type Selection = { kind: 'subject' | 'encounter' | 'use' | 'position'; id: string } | null;
export type AppContextValue = {
  document: Document; mode: 'experience' | 'world' | 'visitor'; selection: Selection; selectedSubjects: string[]; encounterId: string | null;
  edit: <T>(fn: (draft: Document) => T, key?: string) => T; select: (selection: Selection) => void; selectSubject: (id: string, additive?: boolean) => void; setEncounter: (id: string | null) => void;
  audition: Record<string, Record<string, Value>>; auditionValue: (sid: string, channel: string, value: Value) => void;
  shared: boolean; setShared: (shared: boolean) => void; scene: RefObject<SceneHandle | null>; runtime: Runtime | null;
  updateRuntime: (fn: (r: Runtime) => Runtime) => void; reviewFlag: (name: string) => void; reviewFlags: Set<string>;
  focus: Focus; setFocusMode: (mode: 'selection' | 'view' | 'region' | 'environment') => void; focusMode: string; regionPicking: boolean; setRegionPicking: (value: boolean) => void;
  createEncounter: () => void; previewEncounter: (encounterId: string) => void; switchMode: (mode: 'world' | 'experience') => void;
};
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error('Application context missing'); return context; }
