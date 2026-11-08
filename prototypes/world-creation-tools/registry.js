'use strict';
/*
 * World creation tools — the registry.
 * One description drives the dock, every palette, the Library, the Spec drawer and the
 * System sheet, so the prototype and its reference cannot drift apart. Nothing here is a
 * persisted format: it is the proposal's capability description (shell "capability placement").
 *
 * Where a capability lives is decided by one rule:
 *   Dock key       a family: one owner and one kind of making (Build, Form, Landscape, Furnish)
 *   Tool           its own gesture and its own target, inside its family (Walls, Water, Lights)
 *   Palette        a variant of the armed tool's gesture (shape, kind, size, finish)
 *   Library        catalogue content you pick from (objects, lights, plants, definitions, materials)
 *   Selection      an operation on something that already exists (roof a room, turn, replace)
 *   Head           the world's look and ways of reading it (Sky, Plan, Paper/Living, Measure)
 * Nouns get words (families, tools); variants get pictures (palette options).
 */

const FAMILIES = [
  {
    id: 'build', name: 'Build', icon: 'fam-build', mark: '#d4835c',
    owner: 'Layout',
    blurb: 'Architecture: walls and the rooms they close, openings, stairs and whole buildings.',
    tools: ['walls', 'opening', 'stair', 'building'],
    grows: ['Level', 'Railing', 'Column grid'],
  },
  {
    id: 'form', name: 'Form', icon: 'fam-form', mark: '#ead9b2',
    owner: 'Scene',
    blurb: 'Solids you draw yourself: stages, pedestals, drums, columns, sculpture. Draw it here; pick it in Furnish.',
    tools: ['form'],
    grows: ['Carve', 'Sweep', 'Lathe', 'Array'],
  },
  {
    id: 'land', name: 'Landscape', icon: 'fam-land', mark: '#9dbb73',
    owner: 'Needs an owner',
    blurb: 'The ground and what flows and grows on it: terrain, water, paths and plants.',
    tools: ['ground', 'water', 'path', 'plants'],
    grows: ['Hedge', 'Fence', 'Rocks'],
  },
  {
    id: 'furnish', name: 'Furnish', icon: 'fam-furnish', mark: '#e3b75f',
    owner: 'Scene',
    blurb: 'Things you pick, not draw: objects, frames and lights from the shelf and the Library.',
    tools: ['object', 'light'],
    grows: ['Media', 'Sound', 'Trigger zone'],
  },
];
const familyOf = (id) => FAMILIES.find((f) => f.tools.includes(id)) || null;

/* Building definitions: Library content. Picking one sets Building's footprint shape and storeys;
   roof and windows come from the definition and stay editable per building in the Card. */
const BUILDING_DEFS = {
  cottage: { label: 'Cottage', icon: 'def-cottage', shape: 'box', floors: '2', roof: 'gable', windows: 'regular' },
  tower: { label: 'Tower', icon: 'def-tower', shape: 'circle', floors: '3', roof: 'cone', windows: 'sparse' },
  pavilion: { label: 'Pavilion', icon: 'def-pavilion', shape: 'box', floors: '1', roof: 'flat', windows: 'none' },
  barn: { label: 'Long barn', icon: 'def-barn', shape: 'outline', floors: '1', roof: 'hip', windows: 'sparse' },
};

/* The Sky: the world's hour and look. Scene environment, set from the head, not a dock tool. */
const SKY_PRESETS = [
  { id: 'dawn', label: 'Dawn', t: 6.5, a: '#f1cfb4', b: '#c9d3e0' },
  { id: 'morning', label: 'Morning', t: 9, a: '#f4ead2', b: '#d3e1dc' },
  { id: 'noon', label: 'Noon', t: 12.5, a: '#f7f1e2', b: '#dfe8e0' },
  { id: 'afternoon', label: 'Afternoon', t: 15.5, a: '#f5e6c8', b: '#e1e2cc' },
  { id: 'golden', label: 'Golden hour', t: 18, a: '#f2c88e', b: '#e9a77d' },
  { id: 'dusk', label: 'Dusk', t: 19.5, a: '#8d7fa0', b: '#3d4766' },
  { id: 'night', label: 'Night', t: 21, a: '#2c3552', b: '#161d30' },
];
const skyPresetAt = (t) => SKY_PRESETS.reduce((best, p) => (Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best), SKY_PRESETS[0]);

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
const sizeGroup = (dflt = 'm', when) => ({
  id: 'size', label: 'Size', kind: 'seg', default: dflt, when,
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

/*
 * Things you place with Object. Floor items stand on the ground, a floor or a form;
 * wall items hang on a wall face. The shelf in the palette shows recent ones; the
 * Library holds them all and puts a picked one back on the shelf.
 */
const ITEMS = {
  plinth: { label: 'Plinth and sculpture', short: 'Plinth', icon: 'obj-plinth' },
  bench: { label: 'Bench', short: 'Bench', icon: 'obj-bench' },
  chair: { label: 'Chair', short: 'Chair', icon: 'obj-chair' },
  table: { label: 'Table', short: 'Table', icon: 'obj-table' },
  planter: { label: 'Planter', short: 'Planter', icon: 'obj-planter' },
  frame: { label: 'Frame (hangs on a wall)', short: 'Frame', icon: 'obj-frame', wall: true },
  sofa: { label: 'Sofa', short: 'Sofa', icon: 'obj-sofa' },
  stool: { label: 'Stool', short: 'Stool', icon: 'obj-stool' },
  vitrine: { label: 'Vitrine', short: 'Vitrine', icon: 'obj-vitrine' },
  screen: { label: 'Screen', short: 'Screen', icon: 'obj-screen' },
};
const SHELF_DEFAULT = ['plinth', 'bench', 'chair', 'table', 'planter', 'frame'];
const isWallItem = (v) => !!(ITEMS[v] && ITEMS[v].wall);

const FRAME_SIZES = [
  { v: 's', icon: 'art-s', label: 'Small · 0.5 × 0.6 m' }, { v: 'm', icon: 'art-m', label: 'Medium · 0.8 × 1 m' }, { v: 'l', icon: 'art-l', label: 'Large · 1.4 × 1.2 m' },
];
const ROOF_STYLES = {
  none: { icon: 'roof-none', label: 'Open to the sky' },
  flat: { icon: 'roof-flat', label: 'Flat roof' },
  hip: { icon: 'roof-hip', label: 'Hip roof' },
  gable: { icon: 'roof-gable', label: 'Gable roof (four straight walls)' },
  dome: { icon: 'roof-dome', label: 'Dome (round rooms)' },
};
const PITCHES = [{ v: 'low', text: '20°', label: 'Low pitch' }, { v: 'mid', text: '35°', label: 'Middle pitch' }, { v: 'steep', text: '50°', label: 'Steep pitch' }];

const TOOLS = {
  select: {
    name: 'Select', key: 'V', icon: 'select', family: null,
    makes: 'Nothing new. Picks a thing, pulls its marks, and offers what you can do to it.',
    target: 'Anything', gesture: 'Click to select; drag a mark; drag empty Stage to orbit (3D) or pan (2D)',
    result: 'Edits through the selected owner', owner: 'Each subject’s owner',
    proposes: ['Selection actions in the palette: roof a room, turn, duplicate, replace from the Library'], area: 'Today',
    today: 'Landed for walls, openings and objects. The prototype adds a bend knob on walls, height marks on buildings and forms, and the action palette.',
    palette: [],
  },

  // ── Build ────────────────────────────────────────────────────────────────
  walls: {
    name: 'Walls', key: 'W', icon: 'walls', family: 'build',
    makes: 'Walls: straight, curved, boxed or round. Closing a run makes a room and offers it a roof.',
    target: 'Ground, a terrace, a wall end', gesture: 'Any shape; pull a wall’s middle later to curve it',
    result: 'Layout Walls; a closed run derives a Room; an accepted roof is a Layout Roof', owner: 'Layout',
    proposes: ['A roof when the run closes (open, flat, hip, gable or dome)', 'Doorway where it crosses a path', 'Refuses crossing a building'],
    area: 'T1', today: 'Straight Wall chains by Line or Box land today under Ink. Arc, Circle, bending and the roof offer are new.',
    palette: [
      shapeGroup(['line', 'arc', 'box', 'circle']),
      { id: 'height', label: 'Height', kind: 'seg', default: 'room', options: [
        { v: 'low', icon: 'h-low', label: 'Garden wall · 1.2 m' },
        { v: 'room', icon: 'h-room', label: 'Room · 3 m' },
        { v: 'tall', icon: 'h-tall', label: 'Hall · 4.5 m' },
      ] },
    ],
  },
  building: {
    name: 'Building', key: 'B', icon: 'building', family: 'build',
    makes: 'A whole building from a definition and a footprint: walls, roof and windows, generated and still editable.',
    target: 'Ground or a terrace', gesture: 'Pick a definition, then draw its footprint; it rises as you draw',
    result: 'A placed Layout structure from a building definition', owner: 'Layout (placed structure)',
    proposes: ['Plinth or level the ground on a slope', 'Door where a path meets it', 'Refuses overlapping buildings'],
    area: 'T5', today: null,
    palette: [
      { id: 'def', label: 'Definition', kind: 'seg', default: 'cottage',
        options: Object.entries(BUILDING_DEFS).map(([v, d]) => ({ v, icon: d.icon, label: d.label })) },
      shapeGroup(['box', 'circle', 'outline']),
      { id: 'floors', label: 'Storeys', kind: 'seg', default: '2', options: [
        { v: '1', text: '1', label: 'One storey' }, { v: '2', text: '2', label: 'Two storeys' }, { v: '3', text: '3', label: 'Three storeys' },
      ] },
      { id: 'library', label: 'More', kind: 'action', icon: 'library', text: 'Library', note: 'Every building definition, and your own' },
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
  stair: {
    name: 'Stair', key: 'T', icon: 'stair', family: 'build',
    makes: 'An architectural stair between two heights.',
    target: 'From one height to another (ground, terrace, a form, later a Level)', gesture: 'Drag from the bottom to the top',
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
    name: 'Objects', key: 'F', icon: 'object', family: 'furnish',
    makes: 'Furniture, plinths, vitrines and frames from a shelf of recent things; the Library holds the rest.',
    target: 'Ground, a floor, the top of a form; a wall face for frames', gesture: 'Click places one; drag lays an evenly spaced row; R turns 15°',
    result: 'Placed Scene instances; a frame is attached to its wall by hanging', owner: 'Scene',
    proposes: ['Backs onto a wall when close (placement only)', 'A row skips what is in the way and says so', 'Frames: a row skips doors and windows; refuses walls too low to hang'],
    area: 'T2', today: 'Placing from the Library lands today; the shelf, rows and wall items are new.',
    palette: [
      { id: 'item', label: 'Shelf', kind: 'seg', shelf: true, default: 'plinth', options: [] },
      { id: 'fsize', label: 'Frame', kind: 'seg', default: 'm', when: (v) => isWallItem(v('item')), options: FRAME_SIZES },
      { id: 'line', label: 'Hang line', kind: 'seg', default: '1.45', when: (v) => isWallItem(v('item')), options: [
        { v: '1.45', text: '1.45', label: 'Centre at 1.45 m (gallery)' }, { v: '1.6', text: '1.60', label: 'Centre at 1.60 m (domestic)' },
      ] },
      { id: 'library', label: 'More', kind: 'action', icon: 'library', text: 'Library', note: 'Everything that is not on the shelf' },
    ],
  },
  form: {
    name: 'Form', key: 'D', icon: 'form', family: 'form',
    makes: 'Solids you compose yourself: a stage, a pedestal, a drum, a stepped mass, a sculpture.',
    target: 'Ground, a floor, the top of another form', gesture: 'Draw a Box, Circle or Outline, pull up its height, click to set',
    result: 'A composed Scene object, placed', owner: 'Scene (composed object)',
    proposes: ['Rests on the form or floor beneath it', 'Clears plants in its footprint', 'Refuses overlapping a building'],
    area: 'T2', today: null,
    palette: [
      shapeGroup(['box', 'circle', 'outline']),
      { id: 'finish', label: 'Finish', kind: 'swatch', default: 'limewash',
        options: ['limewash', 'stone', 'timber', 'ochre', 'slate'].map((v) => ({ v, color: MATERIALS[v].color, label: MATERIALS[v].label })) },
    ],
  },
  light: {
    name: 'Lights', key: 'L', icon: 'light', family: 'furnish',
    makes: 'Light fixtures: spots, pendants, wall lights and lamps. The sun is the Sky, in the head.',
    target: 'Ground, a wall, inside a room (pendant)', gesture: 'Click to place',
    result: 'Scene lights', owner: 'Scene',
    proposes: ['Aim a spot at a nearby frame: once, or keep aimed (explicit)', 'Refuses a pendant with nothing to hang from'],
    area: 'T2', today: null,
    palette: [
      { id: 'kind', label: 'Fixture', kind: 'seg', default: 'spot', options: [
        { v: 'spot', icon: 'light-spot', label: 'Spot', key: '1' }, { v: 'pendant', icon: 'light-pendant', label: 'Pendant (inside a room)', key: '2' },
        { v: 'wall', icon: 'light-wall', label: 'Wall light', key: '3' }, { v: 'lamp', icon: 'light-lamp', label: 'Floor lamp', key: '4' },
      ] },
      { id: 'library', label: 'More', kind: 'action', icon: 'library', text: 'Library', note: 'Every fixture' },
    ],
  },

  // ── Landscape ────────────────────────────────────────────────────────────
  ground: {
    name: 'Ground', key: 'G', icon: 'ground', family: 'land',
    makes: 'Raised, lowered, flattened and smoothed ground, and flat terraces.',
    target: 'Ground', gesture: 'Hold to brush (Shift inverts); Terrace: draw, then pull',
    result: 'A terrain edit', owner: 'Needs an owner (Landscape)',
    proposes: ['Buildings keep their datum; their plinth follows', 'Paths re-drape (they belong to the ground)'],
    area: 'Landscape', today: null,
    palette: [
      { id: 'brush', label: 'Mode', kind: 'seg', default: 'raise', options: [
        { v: 'raise', icon: 'raise', label: 'Raise (Shift lowers)', key: '1' }, { v: 'lower', icon: 'lower', label: 'Lower (Shift raises)', key: '2' },
        { v: 'flatten', icon: 'flatten', label: 'Flatten to where you start', key: '3' }, { v: 'smooth', icon: 'smooth', label: 'Smooth', key: '4' },
        { v: 'terrace', icon: 'terrace', label: 'Terrace: draw, then pull', key: '5' },
      ] },
      sizeGroup('m', (v) => v('brush') !== 'terrace'),
    ],
  },
  water: {
    name: 'Water', key: 'A', icon: 'water', family: 'land',
    makes: 'Ponds and streams: lowered ground with a level surface that fills what it meets.',
    target: 'Ground', gesture: 'Pond: hold to paint; Stream: drag a stroke downhill',
    result: 'A terrain edit with a water surface', owner: 'Needs an owner (Landscape)',
    proposes: ['A bridge or stepping stones where a path now crosses it', 'Keeps clear of buildings', 'Drowns plants it covers'],
    area: 'Landscape', today: null,
    palette: [
      { id: 'mode', label: 'Water', kind: 'seg', default: 'pond', options: [
        { v: 'pond', icon: 'water-pond', label: 'Pond: hold to paint water', key: '1' }, { v: 'stream', icon: 'water-stream', label: 'Stream: drag a stroke', key: '2' },
      ] },
      { id: 'depth', label: 'Depth', kind: 'seg', default: 'shallow', options: [
        { v: 'shallow', icon: 'depth-shallow', label: 'Shallow · 0.5 m' }, { v: 'deep', icon: 'depth-deep', label: 'Deep · 1.2 m' },
      ] },
      sizeGroup('m', (v) => v('mode') === 'pond'),
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
  plants: {
    name: 'Plants', key: 'N', icon: 'plants', family: 'land',
    makes: 'Trees, shrubs, flowers and grass, scattered by brush or placed one at a time.',
    target: 'Ground', gesture: 'Hold to scatter; click for one; Shift clears',
    result: 'Plant instances (scatter skips paths, water, buildings and forms when painted)', owner: 'Needs an owner (Landscape or Scene)',
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
      { id: 'library', label: 'More', kind: 'action', icon: 'library', text: 'Library', note: 'Every species' },
    ],
  },

  // ── universal ────────────────────────────────────────────────────────────
  paint: {
    name: 'Paint', key: 'C', icon: 'paint', family: null,
    makes: 'Materials and colours on walls, roofs, floors, forms and ground.',
    target: 'Any surface; the ground takes it as a brush', gesture: 'Click a surface (reach decides how far); brush the ground; Alt samples',
    result: 'Material assignment by the surface’s owner', owner: 'Scene (presentation of Layout surfaces)',
    proposes: ['Asks before changing a shared building style (Ask Rule)'],
    area: 'T2', today: 'Approved as Brush; not landed.',
    palette: [
      { id: 'material', label: 'Material', kind: 'swatch', default: 'limewash',
        options: Object.entries(MATERIALS).map(([v, m]) => ({ v, color: m.color, label: m.label + (m.for === 'ground' ? ' (ground)' : '') })) },
      { id: 'scope', label: 'Reach', kind: 'seg', default: 'wall', options: [
        { v: 'face', icon: 'scope-face', label: 'This face' }, { v: 'wall', icon: 'scope-wall', label: 'Whole wall or form' },
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
    name: 'Measure', key: 'M', icon: 'measure', family: null, group: 'view',
    makes: 'A temporary distance. Never saved.',
    target: 'Anywhere', gesture: 'Drag', result: 'Temporary reading', owner: 'None (session)',
    proposes: [], area: 'Today', today: 'Landed. Moves from the dock to the view cluster.', palette: [],
  },
  slice: {
    name: 'Slice', key: 'X', icon: 'slice', family: null, group: 'view', disabled: true,
    makes: 'A temporary cut. Unchanged from the approved sheet; not prototyped here.',
    target: '—', gesture: '—', result: 'Temporary reading', owner: 'None (session)',
    proposes: [], area: 'Approved', today: 'Approved, not landed. Moves to the view cluster; otherwise unchanged.', palette: [],
  },
};

/* Dock order outside the families. Measure and Slice read the world, so they sit with the view. */
const UTILITY_LEFT = ['select'];
const UTILITY_RIGHT = ['paint', 'erase'];
const VIEW_TOOLS = ['measure', 'slice'];

/* The Library: catalogue content. Picking an item arms the tool that places it. */
const LIBRARY = [
  { id: 'objects', name: 'Objects', tool: 'object', opt: 'item', blurb: 'Picking one puts it on the shelf.',
    items: Object.entries(ITEMS).map(([v, it]) => ({ v, icon: it.icon, label: it.short, note: it.wall ? 'Hangs on a wall' : null })) },
  { id: 'lights', name: 'Lights', tool: 'light', opt: 'kind',
    items: TOOLS.light.palette[0].options.map((o) => ({ v: o.v, icon: o.icon, label: o.label.split(' (')[0] })) },
  { id: 'plants', name: 'Plants', tool: 'plants', opt: 'kind',
    items: TOOLS.plants.palette[0].options.map((o) => ({ v: o.v, icon: o.icon, label: o.label })) },
  { id: 'buildings', name: 'Buildings', tool: 'building', opt: 'def', blurb: 'Definitions. Every placed copy follows its definition; picking one arms Building.',
    items: Object.entries(BUILDING_DEFS).map(([v, d]) => ({ v, icon: d.icon, label: d.label })) },
  { id: 'materials', name: 'Materials', tool: 'paint', opt: 'material',
    items: Object.entries(MATERIALS).map(([v, m]) => ({ v, color: m.color, label: m.label })) },
];

/* What a new gesture proposes against what is already there. Rows: the tool in hand. */
const INTERACTIONS = {
  cols: ['Wall', 'Building', 'Path', 'Slope or terrace', 'Water', 'Plants', 'Form', 'Frame', 'Room'],
  rows: [
    ['Walls', ['Joins at the end', 'Refused: crosses it', 'Doorway where they cross', 'Sits on the ground', '—', '—', '—', '—', 'Closing a run makes one, and offers a roof']],
    ['Building', ['Refused: crosses it', 'Refused: overlaps', 'Door where it meets', 'Plinth, or level the ground', 'Keeps clear', 'Clears plants in its footprint', '—', '—', '—']],
    ['Opening', ['Cut in its face', 'Cut on the storey you point at', '—', '—', '—', '—', '—', 'Refused: overlaps', 'Connects two Rooms (derived)']],
    ['Objects', ['Backs onto it (placement only)', 'Refused: inside it', '—', 'Stands on the ground', 'Refused', '—', 'Stands on top', '—', 'Stands on its floor']],
    ['Objects · frame', ['Hangs on it; a row skips openings', 'Refused: generated walls', '—', '—', '—', '—', '—', 'Refused: overlaps', '—']],
    ['Form', ['—', 'Refused: overlaps', '—', 'Grounds at its lowest corner', '—', 'Clears them', 'Rests on top', '—', 'Stands on its floor']],
    ['Lights', ['Wall light mounts on it', '—', '—', '—', '—', '—', 'Stands on top', 'Aim once, or keep aimed', 'Pendant hangs from it']],
    ['Path', ['Doorway, or a gate in a low wall', 'Door', 'Joins it', 'Steps, or a ramp', 'Bridge, or stepping stones', 'Clears them', '—', '—', '—']],
    ['Ground', ['Wall keeps its datum', 'Keeps its datum; plinth follows', 'Re-drapes (it belongs to the ground)', '—', '—', 'Ride the ground', 'Keeps its base', '—', '—']],
    ['Water', ['Keeps clear', 'Keeps clear', 'Bridge, or stepping stones', 'Fills to its level', '—', 'Drowns them', '—', '—', '—']],
    ['Paint', ['Face, wall, room or all like it', 'Asks: this one or the whole definition', 'Surface', 'Ground brush', '—', '—', 'Whole form, or all like it', '—', 'Floor']],
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
  'Close the Library or the Sky',
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
