import { addEncounter, addNarration, addToGuide, addView, captureControl, definition, id, type Document, type Profile, type Subject } from './model';
const generic = [
  { id: 'visibility', label: 'Visible', channel: 'visible', kind: 'state' as const, control: 'toggle' as const, signals: ['complete'], sourceEditable: true },
  { id: 'emphasis', label: 'Highlight', channel: 'highlight', kind: 'state' as const, control: 'toggle' as const, signals: ['complete'], sourceEditable: false },
];
export function emptyDocument(): Document {
  const profiles: Profile[] = [
    { id: 'machine', label: 'Machine · casing + rotor', capabilities: [{ id: 'casing', label: 'Casing opening', channel: 'open', kind: 'motion', control: 'range', min: 0, max: 1, step: .1, duration: 1.5, signals: ['complete'], sourceEditable: true }, { id: 'rotor', label: 'Run rotor', channel: 'running', kind: 'loop', control: 'toggle', signals: [], sourceEditable: false }, ...generic] },
    { id: 'machine-replacement', label: 'Replacement · casing only', capabilities: [{ id: 'casing', label: 'Casing opening', channel: 'open', kind: 'motion', control: 'range', min: 0, max: 1, step: .1, duration: 1.5, signals: ['complete'], sourceEditable: true }, ...generic] },
    { id: 'piano', label: 'Piano · playback', capabilities: [{ id: 'music', label: 'Music', channel: 'playing', kind: 'playback', control: 'buttons', actions: [{ label: 'Play', value: true }, { label: 'Stop', value: false }], duration: 12, signals: ['complete'], sourceEditable: false }, ...generic] },
    { id: 'wall', label: 'Native Wall · unfold', capabilities: [{ id: 'unfold', label: 'Unfold', channel: 'unfolded', kind: 'motion', control: 'toggle', duration: 1, signals: ['complete'], sourceEditable: true }, ...generic] },
    { id: 'light', label: 'Light · intensity', capabilities: [{ id: 'intensity', label: 'Intensity', channel: 'intensity', kind: 'state', control: 'range', min: 0, max: 4, step: .1, signals: ['complete'], sourceEditable: true }, ...generic] },
    { id: 'mesh', label: 'Imported mesh · generic', capabilities: generic },
    { id: 'environment', label: 'Room · atmosphere', capabilities: [{ id: 'ambient', label: 'Ambient light', channel: 'ambient', kind: 'state', control: 'range', min: .05, max: 1.5, step: .05, signals: ['complete'], sourceEditable: true }] },
    { id: 'switch', label: 'Switch · activation', capabilities: [{ id: 'press', label: 'Activation', channel: 'pressed', kind: 'state', control: 'toggle', signals: ['complete'], sourceEditable: false }] },
  ];
  const subjects: Subject[] = [
    { id: 'machine', name: 'Machine', shape: 'machine', position: [-3, 0, -1], profileId: 'machine', properties: { visible: true, highlight: false, open: 0, running: false } },
    { id: 'piano', name: 'Piano', shape: 'piano', position: [3, 0, -2], profileId: 'piano', properties: { visible: true, highlight: false, playing: false } },
    { id: 'wall', name: 'Wall', shape: 'wall', position: [0, 0, -6], profileId: 'wall', properties: { visible: true, highlight: false, unfolded: false } },
    { id: 'light', name: 'Light', shape: 'light', position: [5, 0, 3], profileId: 'light', properties: { visible: true, highlight: false, intensity: 2 } },
    { id: 'mesh', name: 'Imported mesh', shape: 'mesh', position: [-4, 0, 4], profileId: 'mesh', properties: { visible: true, highlight: false } },
    { id: 'room', name: 'Room environment', shape: 'environment', position: [0, 0, 0], profileId: 'environment', properties: { ambient: .65 } },
    { id: 'switch', name: 'Switch', shape: 'switch', position: [-5.5, 0, 2.5], profileId: 'switch', properties: { visible: true, highlight: false, pressed: false } },
  ];
  return { counter: 0, world: { revision: 0, profiles: Object.fromEntries(profiles.map(p => [p.id, p])), subjects: Object.fromEntries(subjects.map(s => [s.id, s])) }, experience: { name: 'Untitled Experience', encounters: {}, definitions: {}, uses: {}, positions: {}, routes: [{ id: 'main', name: 'Guide', ids: [] }] } };
}
export function exampleDocument() {
  const d = emptyDocument(); d.experience.name = 'How the workshop works';
  const a = addEncounter(d, { kind: 'subjects', ids: ['machine'] }, 'Understand the drive'); const overview = Object.values(d.experience.uses).find(u => u.encounterId === a)!;
  definition(d, overview)!.name = 'Machine overview';
  const closeUp = addView(d, a, { position: [-3, 2.6, 3.1], target: [-3, 1.4, -1] }, 'Rotor close-up');
  const output = addView(d, a, { position: [1.5, 2.7, 1], target: [-2, 1.4, -1] }, 'Output shaft');
  const narration = addNarration(d, a); const n = definition(d, narration); if (n?.kind === 'narration') { n.text = 'The casing protects the moving parts. Inside, the rotor transfers power through the shaft. Notice how it keeps running while we look elsewhere.'; n.duration = 18; n.markers = [{ id: 'inside', label: 'Look inside', time: 6 }, { id: 'output', label: 'Follow the output', time: 12 }]; }
  d.experience.uses[closeUp].cue = { useId: narration, signal: 'marker:inside' }; d.experience.uses[output].cue = { useId: narration, signal: 'marker:output' };
  const closeUpDef = definition(d, closeUp); if (closeUpDef?.kind === 'view') closeUpDef.speed = 'fast';
  const outputDef = definition(d, output); if (outputDef?.kind === 'view') outputDef.speed = 'slow';
  const open = captureControl(d, 'machine', 'casing', 1, a); d.experience.uses[open].end = { kind: 'experience' }; const run = captureControl(d, 'machine', 'rotor', true, a); d.experience.uses[run].start = { kind: 'after', useId: open, signal: 'complete', encounterId: a }; d.experience.uses[run].end = { kind: 'experience' };
  captureControl(d, 'machine', 'emphasis', true, a);
  const toggle = captureControl(d, 'machine', 'rotor', true, null, true); d.experience.uses[toggle].toggle = true;
  captureControl(d, 'piano', 'music', true, null, true);
  const beam = captureControl(d, 'light', 'intensity', 3, null, true); d.experience.uses[beam].triggerSubjectId = 'switch';
  const b = addEncounter(d, { kind: 'subjects', ids: ['machine', 'mesh'] }, 'Compare materials'); const bview = Object.values(d.experience.uses).find(u => u.encounterId === b)!; bview.definitionId = overview.definitionId;
  const bn = addNarration(d, b); const bnDef = definition(d, bn); if (bnDef?.kind === 'narration') { bnDef.text = 'Compare the forms and materials. The machine can remain active while you explore this exhibit.'; bnDef.duration = 12; }
  const detour = addEncounter(d, { kind: 'subjects', ids: ['wall'] }, 'Inspect the room assembly'); const unfold = captureControl(d, 'wall', 'unfold', true, detour); definition(d, unfold)!.name = 'Reveal the Wall assembly';
  const dn = addNarration(d, detour); const dnDef = definition(d, dn); if (dnDef?.kind === 'narration') { dnDef.text = 'Unfolding is a presentation of the same Wall. Return to the drive when you are ready.'; dnDef.duration = 8; }
  const roomIdea = addEncounter(d, { kind: 'environment' }, 'After hours', false); captureControl(d, 'room', 'ambient', .25, roomIdea);
  const rn = addNarration(d, roomIdea); const rnDef = definition(d, rn); if (rnDef?.kind === 'narration') { rnDef.text = 'The workshop quiets down. Only the ambient light remains.'; rnDef.duration = 6; }
  addToGuide(d, a); const comparison = addToGuide(d, b); const optional = addToGuide(d, detour, 'optional');
  d.experience.positions[comparison[0]].choices.push({ id: id(d, 'choice'), label: 'Inspect the room assembly', kind: 'detour', targetId: optional[0] });
  return d;
}
