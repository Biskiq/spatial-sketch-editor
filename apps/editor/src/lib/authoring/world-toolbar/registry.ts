/**
 * The World toolbar's one typed vocabulary (A2).
 *
 * The registry is presentation data, not a second task system. A landed tool
 * names the existing contribution it arms through the route's host bridge; a
 * planned tool carries no controller and says so, so the complete #285 toolbar
 * can be inspected without pretending a capability exists.
 */
export type WorldFamilyId = 'build' | 'form' | 'land' | 'furnish';

export type WorldToolId =
  | 'select'
  | 'walls'
  | 'opening'
  | 'stair'
  | 'building'
  | 'room'
  | 'slice'
  | 'form'
  | 'roofline'
  | 'terrace'
  | 'ground'
  | 'water'
  | 'path'
  | 'plants'
  | 'trees'
  | 'objects'
  | 'lights'
  | 'paint'
  | 'erase'
  | 'measure'
  | 'library';

export type WorldOption = {
  readonly label: string;
  readonly value?: string;
  readonly disabled?: boolean;
};

export type WorldOptionGroup = {
  readonly label: string;
  readonly options: readonly WorldOption[];
};

export type WorldTool = {
  readonly id: WorldToolId;
  readonly label: string;
  readonly icon: string;
  readonly family: WorldFamilyId | null;
  /** Landed tools are wired to an existing controller; planned tools are inspectable placeholders. */
  readonly stage: 'landed' | 'planned';
  /** The post-merge row that will make a planned tool real. */
  readonly after?: 'T1' | 'T2' | 'T5';
  readonly summary?: string;
  /** Optional static groups for a planned tool's plate. */
  readonly options?: readonly WorldOptionGroup[];
  /** The one production shortcut, when the existing input map already owns it. */
  readonly shortcut?: string;
};export type WorldFamily = {
	readonly id: WorldFamilyId;
	readonly label: string;
	readonly icon: string;
	/** The prototype's family accent, used for the active tab rule and dots. */
	readonly accent: string;
	/** The first tool a family opens when it has no remembered member yet. */
	readonly defaultTool: WorldToolId;
	readonly tools: readonly WorldToolId[];
};

export type WorldLibraryCategory =
  | 'objects'
  | 'materials'
  | 'my-objects'
  | 'plants'
  | 'buildings';

export const WORLD_TOOLS: readonly WorldTool[] = [
  {
    id: 'select',
    label: 'Select',
    icon: 'select',
    family: null,
    stage: 'landed',
    summary: 'Select a subject on the Stage.',
    shortcut: 'V'
  },
  {
    id: 'walls',
    label: 'Walls',
    icon: 'walls',
    family: 'build',
    stage: 'landed',
    summary: 'Draw a Wall chain; close a Room.',
    options: [
      { label: 'Shape', options: [{ label: 'Line' }, { label: 'Box' }, { label: 'Circle' }, { label: 'Arc', disabled: true }] },
      { label: 'Height', options: [{ label: '2.4' }, { label: '3.0' }, { label: '3.6' }] }
    ]
  },
  {
    id: 'opening',
    label: 'Opening',
    icon: 'opening',
    family: 'build',
    stage: 'landed',
    summary: 'Place a door or window on a Wall.',
    options: [
      { label: 'Kind', options: [{ label: 'Door' }, { label: 'Window' }] },
      { label: 'Profile', options: [{ label: 'Square' }, { label: 'Arch' }, { label: 'Pointed', disabled: true }] }
    ]
  },
  {
    id: 'stair',
    label: 'Stair',
    icon: 'stair',
    family: 'build',
    stage: 'planned',
    after: 'T1',
    summary: 'Stairs between levels.',
    options: [
      { label: 'Type', options: [{ label: 'Straight' }, { label: 'L' }, { label: 'U', disabled: true }] },
      { label: 'Rise', options: [{ label: '17 cm' }, { label: '18 cm' }, { label: '19 cm' }] }
    ]
  },
  {
    id: 'building',
    label: 'Building',
    icon: 'building',
    family: 'build',
    stage: 'planned',
    after: 'T5',
    summary: 'A whole building volume.',
    options: [
      { label: 'Form', options: [{ label: 'Block' }, { label: 'Courtyard' }] },
      { label: 'Levels', options: [{ label: '1' }, { label: '2' }, { label: '3' }] }
    ]
  },
  {
    id: 'room',
    label: 'Room',
    icon: 'room',
    family: 'build',
    stage: 'planned',
    after: 'T1',
    summary: 'Draw a named room.',
    options: [
      { label: 'Type', options: [{ label: 'Living' }, { label: 'Bedroom' }, { label: 'Service' }] },
      { label: 'Floor', options: [{ label: 'Timber' }, { label: 'Stone' }] }
    ]
  },
  {
    id: 'slice',
    label: 'Slice',
    icon: 'slice',
    family: 'build',
    stage: 'planned',
    after: 'T1',
    summary: 'Cut a section through the model.',
    options: [
      { label: 'Axis', options: [{ label: 'X' }, { label: 'Z' }] },
      { label: 'Offset', options: [{ label: '0.0 m' }] }
    ]
  },
  {
    id: 'form',
    label: 'Form',
    icon: 'form',
    family: 'form',
    stage: 'planned',
    after: 'T1',
    summary: 'Sculpt a mass with curved edges.',
    options: [
      { label: 'Primitive', options: [{ label: 'Box' }, { label: 'Cylinder' }, { label: 'Sphere' }] },
      { label: 'Edit', options: [{ label: 'Push' }, { label: 'Pull' }, { label: 'Bend' }] }
    ]
  },
  {
    id: 'roofline',
    label: 'Roof',
    icon: 'roof',
    family: 'form',
    stage: 'planned',
    after: 'T1',
    summary: 'Set a roof or parapet.',
    options: [
      { label: 'Kind', options: [{ label: 'Flat' }, { label: 'Pitch' }, { label: 'Shed' }] },
      { label: 'Pitch', options: [{ label: '15°' }, { label: '30°' }, { label: '45°' }] }
    ]
  },
  {
    id: 'terrace',
    label: 'Terrace',
    icon: 'terrace',
    family: 'form',
    stage: 'planned',
    after: 'T5',
    summary: 'A raised outdoor platform.',
    options: [
      { label: 'Edge', options: [{ label: 'Straight' }, { label: 'Curved' }] },
      { label: 'Height', options: [{ label: '0.15 m' }, { label: '0.3 m' }] }
    ]
  },
  {
    id: 'ground',
    label: 'Ground',
    icon: 'ground',
    family: 'land',
    stage: 'planned',
    after: 'T2',
    summary: 'Shape the ground plane.',
    options: [
      { label: 'Surface', options: [{ label: 'Lawn' }, { label: 'Gravel' }, { label: 'Paving' }] },
      { label: 'Fall', options: [{ label: 'Flat' }, { label: 'Slope' }] }
    ]
  },
  {
    id: 'water',
    label: 'Water',
    icon: 'water',
    family: 'land',
    stage: 'planned',
    after: 'T2',
    summary: 'Draw a pool, pond or rill.',
    options: [
      { label: 'Kind', options: [{ label: 'Pond' }, { label: 'Pool' }, { label: 'Rill' }] },
      { label: 'Depth', options: [{ label: '0.3 m' }, { label: '0.6 m' }] }
    ]
  },
  {
    id: 'path',
    label: 'Path',
    icon: 'path',
    family: 'land',
    stage: 'planned',
    after: 'T2',
    summary: 'Lay a path through the world.',
    options: [
      { label: 'Surface', options: [{ label: 'Stone' }, { label: 'Gravel' }, { label: 'Timber' }] },
      { label: 'Width', options: [{ label: '0.9 m' }, { label: '1.2 m' }, { label: '1.8 m' }] }
    ]
  },
  {
    id: 'plants',
    label: 'Plants',
    icon: 'plants',
    family: 'land',
    stage: 'planned',
    after: 'T2',
    summary: 'Scatter planting beds and shrubs.',
    options: [
      { label: 'Kind', options: [{ label: 'Bed' }, { label: 'Shrub' }, { label: 'Hedge' }] },
      { label: 'Density', options: [{ label: 'Sparse' }, { label: 'Natural' }, { label: 'Dense' }] }
    ]
  },
  {
    id: 'trees',
    label: 'Trees',
    icon: 'plant-tree',
    family: 'land',
    stage: 'planned',
    after: 'T2',
    summary: 'Place single trees.',
    options: [
      { label: 'Species', options: [{ label: 'Oak' }, { label: 'Birch' }, { label: 'Pine' }] },
      { label: 'Canopy', options: [{ label: 'Young' }, { label: 'Mature' }] }
    ]
  },
  {
    id: 'objects',
    label: 'Objects',
    icon: 'object',
    family: 'furnish',
    stage: 'landed',
    summary: 'Place furniture and models from the Library.'
  },
  {
    id: 'lights',
    label: 'Lights',
    icon: 'light',
    family: 'furnish',
    stage: 'landed',
    summary: 'Place point and spot lights from the Library.'
  },
  { id: 'paint', label: 'Paint', icon: 'paint', family: null, stage: 'planned', after: 'T5', summary: 'Assign a material to a surface.' },
  { id: 'erase', label: 'Erase', icon: 'erase', family: null, stage: 'landed', summary: 'Remove a subject from the Stage.', shortcut: 'E' },
  { id: 'measure', label: 'Measure', icon: 'measure', family: null, stage: 'landed', summary: 'Measure between two points.', shortcut: 'M' },
  {
    id: 'library',
    label: 'Library',
    icon: 'library',
    family: null,
    stage: 'landed',
    summary: 'Objects, materials and future content.',
    shortcut: 'L'
  }
];

export const WORLD_FAMILIES: readonly WorldFamily[] = [
  {
    id: 'build',		label: 'Build',
		icon: 'fam-build',
		accent: '#c2643f',
		defaultTool: 'walls',
    tools: ['walls', 'opening', 'stair', 'building', 'room', 'slice']
  },
  {
    id: 'form',		label: 'Form',
		icon: 'fam-form',
		accent: '#b08a3e',
		defaultTool: 'form',
    tools: ['form', 'roofline', 'terrace']
  },
  {
    id: 'land',		label: 'Landscape',
		icon: 'fam-land',
		accent: '#6f8a3e',
		defaultTool: 'ground',
    tools: ['ground', 'water', 'path', 'plants', 'trees']
  },
  {
    id: 'furnish',		label: 'Furnish',
		icon: 'fam-furnish',
		accent: '#c08a2a',
		defaultTool: 'objects',
    tools: ['objects', 'lights']
  }
];

export const WORLD_LIBRARY_CATEGORIES: readonly { id: WorldLibraryCategory; label: string }[] = [
  { id: 'objects', label: 'Objects' },
  { id: 'materials', label: 'Materials' },
  { id: 'my-objects', label: 'My objects' },
  { id: 'plants', label: 'Plants' },
  { id: 'buildings', label: 'Buildings' }
];

export function worldTool(id: WorldToolId): WorldTool {
  const found = WORLD_TOOLS.find((tool) => tool.id === id);
  if (found === undefined) throw new Error(`Unknown World tool: ${id}`);
  return found;
}

export function worldFamily(id: WorldFamilyId): WorldFamily {
  const found = WORLD_FAMILIES.find((family) => family.id === id);
  if (found === undefined) throw new Error(`Unknown World family: ${id}`);
  return found;
}

export function familyOf(id: WorldToolId): WorldFamily | null {
  const family = worldTool(id).family;
  return family === null ? null : worldFamily(family);
}

export function familyTools(family: WorldFamily): readonly WorldTool[] {
  return family.tools.map((id) => worldTool(id));
}
