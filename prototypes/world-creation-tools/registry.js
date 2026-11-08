'use strict';
/*
 * World creation tools — the registry.
 * One description drives the dock, every palette, the Spec drawer and the System sheet,
 * so the prototype and its reference cannot drift apart. Nothing here is a persisted
 * format: it is the proposal's capability description (shell "capability placement").
 */

const FAMILIES = [
  {
    id: 'build', name: 'Build', icon: 'fam-build', mark: '#d9b98b',
    owner: 'Layout',
    blurb: 'Architecture. Walls, whole buildings, openings, roofs and stairs.',
    tools: ['walls', 'building', 'opening', 'roof', 'stair'],
  },
  {
    id: 'furnish', name: 'Furnish', icon: 'fam-furnish', mark: '#c3b4db',
    owner: 'Scene',
    blurb: 'Things placed in the world. Objects, art and light.',
    tools: ['object', 'art', 'light'],
  },
  {
    id: 'land', name: 'Landscape', icon: 'fam-land', mark: '#9fc58d',
    owner: 'Needs an owner',
    blurb: 'The ground and what grows on it. Terrain, paths, water and plants.',
    tools: ['ground', 'path', 'water', 'plants'],
  },
];

/* Shared stroke shapes. One meaning, one key, in every drawing tool: 3 is always Box. */
const SHAPES = {
  line: { key: '1', icon: 'shape-line', label: 'Line', hint: 'Click points. Click the first point to close, double-click or Enter to finish.' },
  arc: { key: '2', icon: 'shape-arc', label: 'Arc', hint: 'Click the start, click the end, move to bend, click to set. Keeps chaining.' },
  box: { key: '3', icon: 'shape-box', label: 'Box', hint: 'Drag two corners. Shift keeps it square.' },
  circle: { key: '4', icon: 'shape-circle', label: 'Circle', hint: 'Drag out from the centre.' },
  free: { key: '5', icon: 'shape-free', label: 'Freehand', hint: 'Drag a stroke.' },
  outline: { key: '6', icon: 'shape-outline', label: 'Outline', hint: 'Click corners; click the first corner or press Enter to close.' },
};

const shapeGroup = (list, dflt) => ({
  id: 'shape', label: 'Shape', kind: 'seg', shared: true, default: dflt || list[0],
  options: list.map((v) => ({ v, icon: SHAPES[v].icon, label: SHAPES[v].label, key: SHAPES[v].key })),
});
const sizeGroup = (dflt = 'm') => ({
  id: 'size', label: 'Brush size', kind: 'seg', default: dflt,
  options: [
    { v: 's', icon: 'size-s', label: 'Small · 1.5 m', key: '[' },
    { v: 'm', icon: 'size-m', label: 'Medium · 3 m' },
    { v: 'l', icon: 'size-l', label: 'Large · 5 m', key: ']' },
  ],
});

const MATERIALS = {
  limewash: { label: 'Limewash', color: '#f1e6cf', for: 'arch' },
  plaster: { label: 'Warm plaster', color: '#e3d3b6', for: 'arch' },
  ochre: { label: 'Ochre', color: '#d6b46e', for: 'arch' },
  brick: { label: 'Old brick', color: '#a8705e', for: 'arch' },
  timber: { label: 'Timber', color: '#9c7752', for: 'arch' },
  stone: { label: 'Grey stone', color: '#b6b2a6', for: 'arch' },
  slate: { label: 'Slate', color: '#5d6a6c', for: 'arch' },
  sage: { label: 'Sage', color: '#9db29a', for: 'arch' },
  grass: { label: 'Lawn', color: '#a7bf87', for: 'ground' },
  meadow: { label: 'Meadow', color: '#c5cf8f', for: 'ground' },
  gravel: { label: 'Gravel', color: '#d6ccb8', for: 'ground' },
  sand: { label: 'Sand', color: '#e5d6b2', for: 'ground' },
};

const TOOLS = {
  select: {
    name: 'Select', key: 'V', icon: 'select', family: null,
    makes: 'Nothing new. Picks a thing and pulls its marks.',
    target: 'Anything', gesture: 'Click to select; drag a mark; drag empty Stage to orbit (3D) or pan (2D)',
    result: 'Edits through the selected owner', owner: 'Each subject’s owner',
    proposes: [], area: 'Today',
    today: 'Landed for walls, openings and objects. The prototype adds a bend knob on walls and storey and roof marks on buildings.',
    palette: [],
  },

  // ── Build ────────────────────────────────────────────────────────────────
  walls: {
    name: 'Walls', key: 'W', icon: 'walls', family: 'build',
    makes: 'Walls: straight, curved, boxed or round. A closed run encloses a room.',
    target: 'Ground, a terrace, a wall end', gesture: 'Any shape; pull a wall’s middle later to curve it',
    result: 'Layout Walls; a closed run derives a Room', owner: 'Layout',
    proposes: ['Room it encloses (derived)', 'Doorway where it crosses a path', 'Refuses crossing a building'],
    area: 'T1', today: 'Straight Wall chains by Line or Box land today under Ink. Arc, Circle and bending are new.',
    palette: [
      shapeGroup(['line', 'arc', 'box', 'circle']),
      { id: 'height', label: 'Wall height', kind: 'seg', default: 'room', options: [
        { v: 'low', icon: 'h-low', label: 'Garden wall · 1.2 m' },
        { v: 'room', icon: 'h-room', label: 'Room · 3 m' },
        { v: 'tall', icon: 'h-tall', label: 'Hall · 4.5 m' },
      ] },
    ],
  },
  building: {
    name: 'Building', key: 'B', icon: 'building', family: 'build',
    makes: 'A whole building from its footprint: walls, roof and windows, generated and still editable.',
    target: 'Ground or a terrace', gesture: 'Box, Circle or Outline footprint; it rises as you draw',
    result: 'A placed Layout structure from a building definition', owner: 'Layout (placed structure)',
    proposes: ['Plinth or level the ground on a slope', 'Door where a path meets it', 'Refuses overlapping buildings'],
    area: 'T5', today: null,
    palette: [
      shapeGroup(['box', 'circle', 'outline']),
      { id: 'floors', label: 'Storeys', kind: 'seg', default: '2', options: [
        { v: '1', text: '1', label: 'One storey' }, { v: '2', text: '2', label: 'Two storeys' }, { v: '3', text: '3', label: 'Three storeys' },
      ] },
      { id: 'roof', label: 'Roof', kind: 'seg', default: 'gable', options: [
        { v: 'gable', icon: 'roof-gable', label: 'Gable' }, { v: 'hip', icon: 'roof-hip', label: 'Hip' },
        { v: 'flat', icon: 'roof-flat', label: 'Flat' }, { v: 'cone', icon: 'roof-cone', label: 'Cone (round footprints)' },
      ] },
      { id: 'windows', label: 'Windows', kind: 'seg', default: 'regular', options: [
        { v: 'none', icon: 'win-none', label: 'No windows' }, { v: 'sparse', icon: 'win-sparse', label: 'Sparse' }, { v: 'regular', icon: 'win-regular', label: 'Regular rhythm' },
      ] },
    ],
  },
  opening: {
    name: 'Opening', key: 'O', icon: 'opening', family: 'build',
    makes: 'Doors, windows, arches, round windows, niches and wide openings in a wall.',
    target: 'A wall face (any storey of a building)', gesture: 'Hover to see it on the wall; click to cut',
    result: 'A Layout Opening hosted by that wall', owner: 'Layout',
    proposes: ['Connects the two rooms it joins (derived)', 'Refuses ground, wall ends and overlaps'],
    area: 'T1', today: 'Straight door or window on one wall face lands today under Ink.',
    palette: [
      { id: 'kind', label: 'Kind', kind: 'seg', default: 'door', options: [
        { v: 'door', icon: 'op-door', label: 'Door · 0.9 m', key: '1' }, { v: 'window', icon: 'op-window', label: 'Window · 1.2 m', key: '2' },
        { v: 'arch', icon: 'op-arch', label: 'Arch · 1.4 m', key: '3' }, { v: 'round', icon: 'op-round', label: 'Round window', key: '4' },
        { v: 'niche', icon: 'op-niche', label: 'Niche (not through)', key: '5' }, { v: 'wide', icon: 'op-wide', label: 'Wide opening · 2.4 m', key: '6' },
      ] },
    ],
  },
  roof: {
    name: 'Roof', key: 'R', icon: 'roof', family: 'build',
    makes: 'A roof over walls you drew yourself.',
    target: 'Inside a closed room', gesture: 'Hover a room to see the roof; click to set',
    result: 'A Layout Roof over that room’s walls', owner: 'Layout',
    proposes: ['Refuses open walls, explains why'],
    area: 'T5', today: null,
    palette: [
      { id: 'style', label: 'Style', kind: 'seg', default: 'hip', options: [
        { v: 'gable', icon: 'roof-gable', label: 'Gable (four walls)' }, { v: 'hip', icon: 'roof-hip', label: 'Hip' },
        { v: 'flat', icon: 'roof-flat', label: 'Flat' }, { v: 'dome', icon: 'roof-dome', label: 'Dome' },
      ] },
      { id: 'pitch', label: 'Pitch', kind: 'seg', default: 'mid', options: [
        { v: 'low', text: '20°', label: 'Low pitch' }, { v: 'mid', text: '35°', label: 'Middle pitch' }, { v: 'steep', text: '50°', label: 'Steep pitch' },
      ] },
    ],
  },
  stair: {
    name: 'Stair', key: 'T', icon: 'stair', family: 'build',
    makes: 'An architectural stair between two heights.',
    target: 'From one height to another (ground, terrace, later a Level)', gesture: 'Drag from the bottom to the top',
    result: 'A Layout Stair with derived treads', owner: 'Layout',
    proposes: ['Tread count from the rise', 'Refuses when there is nothing to climb'],
    area: 'T1 with Levels', today: null,
    palette: [
      { id: 'width', label: 'Width', kind: 'seg', default: '1.2', options: [
        { v: '0.9', icon: 'w-narrow', label: 'Narrow · 0.9 m' }, { v: '1.2', icon: 'w-path', label: 'Standard · 1.2 m' }, { v: '2.0', icon: 'w-wide', label: 'Grand · 2 m' },
      ] },
    ],
  },

  // ── Furnish ──────────────────────────────────────────────────────────────
  object: {
    name: 'Object', key: 'F', icon: 'object', family: 'furnish',
    makes: 'Furniture, plinths and props from a shelf of recent things; the Library holds the rest.',
    target: 'Ground, a floor, a raised top', gesture: 'Click to place; press and drag to turn; R turns 15°',
    result: 'A placed Scene instance', owner: 'Scene',
    proposes: ['Backs onto a wall when close (placement only, not attached)'],
    area: 'T2', today: 'Placing from the Library lands today; the shelf palette is new.',
    palette: [
      { id: 'item', label: 'Shelf', kind: 'seg', default: 'bench', options: [
        { v: 'bench', icon: 'obj-bench', label: 'Bench' }, { v: 'table', icon: 'obj-table', label: 'Table' },
        { v: 'chair', icon: 'obj-chair', label: 'Chair' }, { v: 'plinth', icon: 'obj-plinth', label: 'Plinth and sculpture' },
        { v: 'sofa', icon: 'obj-sofa', label: 'Sofa' }, { v: 'planter', icon: 'obj-planter', label: 'Planter' },
      ] },
      { id: 'library', label: 'Library', kind: 'action', icon: 'library', text: 'Library', note: 'Opens the Library Instrument (not prototyped)' },
    ],
  },
  art: {
    name: 'Art', key: 'A', icon: 'art', family: 'furnish',
    makes: 'Hung artwork. One frame, or a whole evenly spaced row in one drag.',
    target: 'A wall face', gesture: 'Click to hang at the hang line; drag along the wall for a row',
    result: 'Scene art attached to its wall (explicit, by hanging)', owner: 'Scene',
    proposes: ['Row skips doors and windows', 'Refuses walls too low to hang'],
    area: 'T2', today: null,
    palette: [
      { id: 'size', label: 'Frame', kind: 'seg', default: 'm', options: [
        { v: 's', icon: 'art-s', label: 'Small · 0.5 × 0.6 m' }, { v: 'm', icon: 'art-m', label: 'Medium · 0.8 × 1 m' }, { v: 'l', icon: 'art-l', label: 'Large · 1.4 × 1.2 m' },
      ] },
      { id: 'line', label: 'Hang line', kind: 'seg', default: '1.45', options: [
        { v: '1.45', text: '1.45', label: 'Centre at 1.45 m (gallery)' }, { v: '1.6', text: '1.60', label: 'Centre at 1.60 m (domestic)' },
      ] },
    ],
  },
  light: {
    name: 'Light', key: 'L', icon: 'light', family: 'furnish',
    makes: 'Light fixtures, and the sun. Drag the sun across the sky arc to change the hour.',
    target: 'Ground, a wall, inside a room (pendant), the sky arc (sun)', gesture: 'Click to place; drag the sun',
    result: 'Scene lights; the sun is Scene environment', owner: 'Scene',
    proposes: ['Aim a spot at nearby art: once, or keep aimed (explicit)', 'Refuses a pendant with nothing to hang from'],
    area: 'T2', today: null,
    palette: [
      { id: 'kind', label: 'Fixture', kind: 'seg', default: 'spot', options: [
        { v: 'spot', icon: 'light-spot', label: 'Spot' }, { v: 'pendant', icon: 'light-pendant', label: 'Pendant (inside a room)' },
        { v: 'wall', icon: 'light-wall', label: 'Wall light' }, { v: 'lamp', icon: 'light-lamp', label: 'Floor lamp' },
      ] },
    ],
  },

  // ── Landscape ────────────────────────────────────────────────────────────
  ground: {
    name: 'Ground', key: 'G', icon: 'ground', family: 'land',
    makes: 'Raised, lowered, flattened and smoothed ground, and flat terraces.',
    target: 'Ground', gesture: 'Hold to brush (Shift inverts); Terrace: draw a shape, then pull its height',
    result: 'A terrain edit', owner: 'Needs an owner (Landscape)',
    proposes: ['Buildings keep their datum; their plinth follows', 'Paths re-drape (they belong to the ground)'],
    area: 'Landscape', today: null,
    palette: [
      { id: 'brush', label: 'Brush', kind: 'seg', default: 'raise', options: [
        { v: 'raise', icon: 'raise', label: 'Raise (Shift lowers)' }, { v: 'lower', icon: 'lower', label: 'Lower (Shift raises)' },
        { v: 'flatten', icon: 'flatten', label: 'Flatten to where you start' }, { v: 'smooth', icon: 'smooth', label: 'Smooth' },
        { v: 'terrace', icon: 'terrace', label: 'Terrace: draw, then pull' },
      ] },
      sizeGroup('m'),
    ],
  },
  path: {
    name: 'Path', key: 'P', icon: 'path', family: 'land',
    makes: 'Walkways that lie on the ground and meet what they cross.',
    target: 'Ground', gesture: 'Freehand, Line or Arc stroke',
    result: 'A path, plus any accepted consequences, in one step', owner: 'Needs an owner (Landscape)',
    proposes: ['Doorway or gate through a wall', 'Door into a building', 'Steps or a ramp on a slope', 'Bridge or stepping stones over water', 'Clears plants in its way'],
    area: 'Landscape', today: null,
    palette: [
      shapeGroup(['free', 'line', 'arc']),
      { id: 'width', label: 'Width', kind: 'seg', default: '1.6', options: [
        { v: '1.0', icon: 'w-narrow', label: 'Narrow · 1 m' }, { v: '1.6', icon: 'w-path', label: 'Path · 1.6 m' }, { v: '2.6', icon: 'w-wide', label: 'Wide · 2.6 m' },
      ] },
      { id: 'surface', label: 'Surface', kind: 'swatch', default: 'gravel', options: [
        { v: 'gravel', color: '#d8cdb7', label: 'Gravel' }, { v: 'stone', color: '#bfbab0', label: 'Stone flags' }, { v: 'boards', color: '#b4946d', label: 'Boards' },
      ] },
    ],
  },
  water: {
    name: 'Water', key: 'H', icon: 'water', family: 'land',
    makes: 'Ponds painted into the ground and streams drawn across it.',
    target: 'Ground', gesture: 'Pond: hold to paint. Stream: drag a stroke',
    result: 'Lowered ground with a water surface', owner: 'Needs an owner (Landscape)',
    proposes: ['Bridge for a path it now crosses', 'Keeps clear of buildings'],
    area: 'Landscape', today: null,
    palette: [
      { id: 'mode', label: 'Water', kind: 'seg', default: 'pond', options: [
        { v: 'pond', icon: 'water-pond', label: 'Pond (paint)' }, { v: 'stream', icon: 'water-stream', label: 'Stream (stroke)' },
      ] },
      { id: 'depth', label: 'Depth', kind: 'seg', default: 'shallow', options: [
        { v: 'shallow', icon: 'depth-shallow', label: 'Shallow · 0.5 m' }, { v: 'deep', icon: 'depth-deep', label: 'Deep · 1.2 m' },
      ] },
      sizeGroup('m'),
    ],
  },
  plants: {
    name: 'Plants', key: 'N', icon: 'plants', family: 'land',
    makes: 'Trees, shrubs, flowers and grass, scattered by brush or placed one at a time.',
    target: 'Ground', gesture: 'Hold to scatter; click for one; Shift clears',
    result: 'Plant instances (scatter skips paths, water and buildings when painted)', owner: 'Needs an owner (Landscape or Scene)',
    proposes: ['Nothing persistent: the scatter rule runs once, at painting time'],
    area: 'Landscape', today: null,
    palette: [
      { id: 'kind', label: 'Plant', kind: 'seg', default: 'tree', options: [
        { v: 'tree', icon: 'plant-tree', label: 'Trees' }, { v: 'shrub', icon: 'plant-shrub', label: 'Shrubs' },
        { v: 'flower', icon: 'plant-flower', label: 'Flowers' }, { v: 'grass', icon: 'plant-grass', label: 'Tall grass' },
      ] },
      { id: 'density', label: 'Density', kind: 'seg', default: 'sparse', options: [
        { v: 'sparse', icon: 'dens-sparse', label: 'Sparse' }, { v: 'full', icon: 'dens-full', label: 'Full' },
      ] },
      sizeGroup('m'),
    ],
  },

  // ── universal ────────────────────────────────────────────────────────────
  paint: {
    name: 'Paint', key: 'C', icon: 'paint', family: null,
    makes: 'Materials and colours on walls, roofs, floors and ground.',
    target: 'Any surface; the ground takes it as a brush', gesture: 'Click a surface (scope decides how far); brush the ground; Alt samples',
    result: 'Material assignment by the surface’s owner', owner: 'Scene (presentation of Layout surfaces)',
    proposes: ['Asks before changing a shared building style (Ask Rule)'],
    area: 'T2', today: 'Approved as Brush; not landed.',
    palette: [
      { id: 'material', label: 'Material', kind: 'swatch', default: 'limewash',
        options: Object.entries(MATERIALS).map(([v, m]) => ({ v, color: m.color, label: m.label + (m.for === 'ground' ? ' (ground)' : '') })) },
      { id: 'scope', label: 'Reach', kind: 'seg', default: 'wall', options: [
        { v: 'face', icon: 'scope-face', label: 'This face' }, { v: 'wall', icon: 'scope-wall', label: 'Whole wall' },
        { v: 'room', icon: 'scope-room', label: 'Room or building' }, { v: 'all', icon: 'scope-all', label: 'Everything with this material' },
      ] },
      sizeGroup('m'),
    ],
  },
  erase: {
    name: 'Erase', key: 'E', icon: 'erase', family: null,
    makes: 'Removal. Click a thing; hold over plants to clear them.',
    target: 'Anything erasable', gesture: 'Click; hold and drag over plants',
    result: 'Removal by each owner, consequences named', owner: 'Each subject’s owner',
    proposes: ['Names what goes with it and what stays'],
    area: 'Today', today: 'Landed (click, scrub and lasso with an acceptance bar). The prototype keeps click only.',
    palette: [],
  },
  measure: {
    name: 'Measure', key: 'M', icon: 'measure', family: null, group: 'inspect',
    makes: 'A temporary distance. Never saved.',
    target: 'Anywhere', gesture: 'Drag', result: 'Temporary reading', owner: 'None (session)',
    proposes: [], area: 'Today', today: 'Landed.', palette: [],
  },
  slice: {
    name: 'Slice', key: 'X', icon: 'slice', family: null, group: 'inspect', disabled: true,
    makes: 'A temporary cut. Unchanged from the approved sheet; not prototyped here.',
    target: '—', gesture: '—', result: 'Temporary reading', owner: 'None (session)',
    proposes: [], area: 'Approved', today: 'Approved, not landed. Unchanged by this proposal.', palette: [],
  },
};

/* Utility keys outside the families, in dock order. */
const UTILITY_LEFT = ['select'];
const UTILITY_RIGHT = ['paint', 'erase'];
const INSPECT = ['measure', 'slice'];

/* What a new gesture proposes against what is already there. Rows: the tool in hand. */
const INTERACTIONS = {
  cols: ['Wall', 'Building', 'Path', 'Slope or terrace', 'Water', 'Plants', 'Art', 'Room'],
  rows: [
    ['Walls', ['Joins at the end', 'Refused: crosses it', 'Doorway where they cross', 'Sits on the ground', '—', '—', '—', 'Encloses a new Room (derived)']],
    ['Building', ['Refused: crosses it', 'Refused: overlaps', 'Door where it meets', 'Plinth, or level the ground', 'Keeps clear', 'Clears plants in its footprint', '—', '—']],
    ['Opening', ['Cut in its face', 'Cut on the storey you point at', '—', '—', '—', '—', 'Refused: overlaps', 'Connects two Rooms (derived)']],
    ['Path', ['Doorway, or a gate in a low wall', 'Door', 'Joins it', 'Steps, or a ramp', 'Bridge, or stepping stones', 'Clears them', '—', '—']],
    ['Ground', ['Wall keeps its datum', 'Keeps its datum; plinth follows', 'Re-drapes (it belongs to the ground)', '—', '—', 'Ride the ground', '—', '—']],
    ['Water', ['Keeps clear', 'Keeps clear', 'Bridge, or stepping stones', 'Fills to its level', '—', 'Drowns them', '—', '—']],
    ['Light', ['Wall light mounts on it', '—', '—', '—', '—', '—', 'Aim once, or keep aimed', 'Pendant hangs from it']],
    ['Art', ['Hangs on it; skips openings', 'Refused', '—', '—', '—', '—', 'Refused: overlaps', '—']],
    ['Paint', ['Face, wall, room or all like it', 'Asks: this wall or the whole style', 'Surface', 'Ground brush', '—', '—', '—', 'Floor']],
  ],
};

/* The interaction states every creation tool moves through. This really is a sequence. */
const STATES = [
  { id: 'idle', label: 'Armed', note: 'Tool armed; nothing under the pointer yet.' },
  { id: 'aim', label: 'Aiming', note: 'The tool names its target or refuses it in words.' },
  { id: 'draft', label: 'Drafting', note: 'Black draft ink; live length; procedural preview.' },
  { id: 'propose', label: 'Proposing', note: 'Consequence tokens appear where they will happen.' },
  { id: 'commit', label: 'Committed', note: 'Release commits one undo step; tokens stay to amend.' },
];
const STATE_EXITS = [
  { id: 'cancel', label: 'Cancelled', note: 'Esc or right-click. Nothing changes, no history.' },
  { id: 'refuse', label: 'Refused', note: 'The refused part turns red with a reason; nothing commits.' },
];

const ESC_LADDER = [
  'Cancel the live draft (Backspace removes one point)',
  'Dismiss the amend tokens',
  'Clear the selection',
  'Collapse the palette',
  'Return to Select',
];

const BRUSH_KEYS = [
  ['[ ]', 'Smaller or larger brush'],
  ['Shift', 'Invert: lower, clear, unpaint'],
  ['Alt', 'Sample (Paint)'],
];
