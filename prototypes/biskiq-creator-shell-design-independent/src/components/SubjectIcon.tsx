import { Armchair, Box, Frame, Leaf, PanelsTopLeft, Piano } from 'lucide-react';
import type { SubjectKind } from '../model';

export default function SubjectIcon({ kind, size = 16 }: { kind: SubjectKind; size?: number }) {
  const Icon = { piano: Piano, bench: Armchair, plant: Leaf, artwork: Frame, window: PanelsTopLeft, architecture: Box, plinth: Box }[kind];
  return <Icon size={size} strokeWidth={1.6} />;
}