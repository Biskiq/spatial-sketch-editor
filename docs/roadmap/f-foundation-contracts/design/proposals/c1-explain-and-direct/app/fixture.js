// The prepared test fixture: accepted source at revision 14 of a small project.
//
// It stands in for the ratified authorities without inventing their formats:
//   layout     — the native architectural bay (Layout owns architecture + representation)
//   scene      — one pump definition, two placed instances, one ambient binding (Scene)
//   camera     — views and spatial routes (Camera owns views/routes/framing/evaluation)
//   res        — one typed reusable performance resource ("Open casing")
//   exp / occ  — two Experiences over the same world; each Stop is an occurrence with
//                its own identity, order position, content and bindings (Experience)
//
// Shapes here are prototype fixtures, not schema proposals (see rationale → handoff).

export const BAY = { x0: -4.5, x1: 4.5, z0: -3.5, z1: 3.5, h: 3.2, t: 0.2 };

// Local frame of the PX-2 definition: shaft along +x, casing cover at the +x end.
// The cover separates along +x; the declared capability range is 0–1.0 m.
export const PX2 = {
  id: 'PX-2',
  name: 'PX-2 end-suction pump',
  ref: 'SCENE · DEF PX-2',
  rev: 4,
  bounds: { min: [-0.86, 0, -0.36], max: [0.86, 1.1, 0.36] },
  casingBounds: { min: [0.28, 0.06, -0.37], max: [0.88, 0.84, 0.37] },
  coverSpan: [0.525, 0.87], // local x span of the moving cover assembly when closed
  components: {
    casing: { id: 'casing', name: 'Casing cover', capability: 'Casing opening', channel: 'separation', unit: 'm', range: [0, 1], control: 'exclusive', visitor: true },
    rotor: { id: 'rotor', name: 'Impeller', capability: 'Rotor spin', ambient: true, rpm: 1450 },
    motor: { id: 'motor', name: 'Motor' },
    skid: { id: 'skid', name: 'Skid' },
  },
};

export function freshProject() {
  return {
    rev: 14,
    name: 'Pump Hall',
    nextId: 40,
    layout: {
      bay: {
        id: 'L-BAY-1', name: 'Pump bay', ref: 'LAYOUT · BAY-1',
        walls: {
          'W-N': { id: 'W-N', name: 'North wall', ref: 'LAYOUT · W-N' },
          'W-E': { id: 'W-E', name: 'East wall', ref: 'LAYOUT · W-E' },
          'W-S': { id: 'W-S', name: 'South wall', ref: 'LAYOUT · W-S' },
          'W-W': { id: 'W-W', name: 'West wall', ref: 'LAYOUT · W-W' },
        },
        representation: { cutaway: { label: 'Cutaway', note: 'Roof lifts, south wall cut to 1 m' } },
      },
    },
    scene: {
      defs: { 'PX-2': { id: 'PX-2', rev: 4 } },
      inst: {
        pumpA: { id: 'pumpA', name: 'Pump A', def: 'PX-2', ref: 'SCENE · P-A', pos: [-1.6, -0.9], rot: 0, baseline: { casing: 0 } },
        pumpB: { id: 'pumpB', name: 'Pump B', def: 'PX-2', ref: 'SCENE · P-B', pos: [2.85, -0.9], rot: 0, baseline: { casing: 0 } },
      },
      ambient: {
        'AMB-ROTOR': { id: 'AMB-ROTOR', name: 'Rotor spin', ref: 'SCENE · AMBIENT', targets: ['pumpA', 'pumpB'], clock: 'world', display: 'slowed ×0.02 for legibility' },
      },
    },
    camera: {
      views: {
        'V-1': { id: 'V-1', name: 'Bay overview', framing: 'locked', subject: null, eye: [3.75, 2.7, 3.25], target: [0.55, 0.45, -1.1], fov: 60 },
        'V-3': { id: 'V-3', name: 'Pump B · side', framing: 'assisted', subject: 'pumpB', focus: 'whole', az: 112, el: 17, fov: 42, fill: 0.8 },
        'V-4': { id: 'V-4', name: 'Pump A · detail', framing: 'locked', subject: 'pumpA', eye: [0.44, 1.19, 1.62], target: [-1.02, 0.5, -0.9], fov: 40, aim: [-1.6, -0.9] },
        'V-5': { id: 'V-5', name: 'Exit', framing: 'locked', subject: null, eye: [-3.9, 1.85, 3.0], target: [1.4, 0.75, -1.3], fov: 56 },
      },
      routes: {
        'R-1': { id: 'R-1', a: 'V-1', b: 'V-3', via: [[3.1, 2.2, 2.8]] },
        'R-2': { id: 'R-2', a: 'V-3', b: 'V-4', via: [[1.1, 1.45, 2.2]] },
        'R-3': { id: 'R-3', a: 'V-4', b: 'V-5', via: [[-2.1, 1.45, 2.2]] },
        'R-4': { id: 'R-4', a: 'V-1', b: 'V-5', via: [[0.1, 2.3, 3.0]] },
      },
    },
    res: {
      perfs: {
        'P-OPEN': {
          id: 'P-OPEN', name: 'Open casing', ref: 'RES · PERF OPEN-CASING', rev: 3,
          role: { name: 'casing', needs: 'Casing opening' },
          params: { separation: 0.6 },
          duration: 2.4, ease: 'in-out', end: 'hold',
          reduced: 'Steps open, then outlines the moved cover',
        },
      },
    },
    exp: {
      order: ['E-HOW', 'E-SVC'],
      list: {
        'E-HOW': { id: 'E-HOW', name: 'How it works', ref: 'EXP · HOW', stops: ['OCC-11', 'OCC-12'] },
        'E-SVC': { id: 'E-SVC', name: 'Service check', ref: 'EXP · SVC', stops: ['OCC-21'] },
      },
    },
    occ: {
      'OCC-11': {
        id: 'OCC-11', exp: 'E-HOW', title: 'Introduction', subject: null, cont: 'hold',
        beats: [
          { id: 'B-1', kind: 'shot', view: 'V-1', move: 'cut', rel: 'start' },
          { id: 'B-2', kind: 'say', rel: 'with', dur: 7, cues: [], text: 'This bay lifts river water up to the town reservoir. Two identical pumps share the work — here is how one of them does it.' },
        ],
        states: [], basis: { params: {}, pos: {} }, ack: {},
      },
      'OCC-12': {
        id: 'OCC-12', exp: 'E-HOW', title: 'End', subject: null, cont: 'hold',
        beats: [
          { id: 'B-3', kind: 'shot', view: 'V-5', move: 'travel', rel: 'start' },
          { id: 'B-4', kind: 'say', rel: 'then', dur: 6, cues: [], text: 'Two pumps, one design: while one runs, the other can be opened and serviced.' },
        ],
        states: [], basis: { params: {}, pos: {} }, ack: {},
      },
      'OCC-21': {
        id: 'OCC-21', exp: 'E-SVC', title: 'Service round', subject: null, cont: 'hold',
        beats: [
          { id: 'B-5', kind: 'shot', view: 'V-1', move: 'cut', rel: 'start' },
          { id: 'B-6', kind: 'say', rel: 'with', dur: 6, cues: [], text: 'Service round. Each pump is opened in turn and checked before it goes back into use.' },
        ],
        states: [], basis: { params: {}, pos: {} }, ack: {},
      },
    },
  };
}

// Channels the fixture declares (F.3 shape: instance → component → capability → frame).
export const CHANNELS = {
  'pumpA.casing': { inst: 'pumpA', comp: 'casing', label: 'Pump A › Casing cover › separation', exclusive: true },
  'pumpB.casing': { inst: 'pumpB', comp: 'casing', label: 'Pump B › Casing cover › separation', exclusive: true },
  'bay.cutaway': { inst: null, comp: null, label: 'Pump bay › representation › cutaway', exclusive: true, layout: true },
};
export const casingChannel = (inst) => inst + '.casing';
