// Non-persisted fixture data for the World Authoring Prototype.
//
// Two kinds of thing live here, and neither is a production model:
//
//   * explicit relation data for the two places this fixture really has. The gallery/`x > 0`
//     bucketing the old shell used was a fixture shortcut, not ownership; here a bound that two
//     places share is listed in both, and the Index says so rather than pretending one owns it.
//   * a bounded dense metadata fixture for Browse/Search: repeated display names, distinct IDs, more
//     rows than one page, and records that have **no** Stage geometry at all. Those records are
//     labelled as such and can be selected (an identity is an identity) but never "opened", "brought
//     into view" or revealed, because there is nothing to fly to.
//
// Nothing here is exported, persisted or validated as a document; it exists so the shell's laws can
// be proved on honest data. See the implementation plan §7.

// ----- places and their relations ----------------------------------------

// `bounds` are the walls that hold the place; `shared` names the ones another place also lists.
// `ceilings` are the ceiling regions over it (closure or suspended, as the fixture declares).
// `onDisplay` is Scene artwork hanging here; `located` is Scene furniture standing here.
export const PLACES = [
  {
    id: 'long', name: 'Long Gallery', ref: 'R-LONG',
    bounds: ['north', 'south', 'west', 'rotunda'],
    shared: ['rotunda'],
    ceilings: ['longc', 'soffit'],
    onDisplay: ['harbor', 'pears', 'kestrel'],
    located: ['bench'],
  },
  {
    id: 'rotunda', name: 'Rotunda', ref: 'R-ROT',
    bounds: ['rotunda'],
    shared: ['rotunda'],
    ceilings: ['rotc'],
    onDisplay: ['tide1', 'tide2', 'tide3', 'marsh'],
    located: ['vessel'],
  },
];

export const placeOf = (id) => PLACES.find((p) => p.id === id) || null;

// Which places list this bound. More than one is a shared bound, not two copies of a wall.
export function placesOfBound(id) {
  return PLACES.filter((p) => p.bounds.includes(id));
}

// The place a thing belongs to for *listing* purposes: the places that name it, in fixture order.
export function placesOfThing(id) {
  return PLACES.filter((p) => p.bounds.includes(id) || p.ceilings.includes(id) || p.onDisplay.includes(id) || p.located.includes(id));
}

// ----- the dense metadata fixture ----------------------------------------

// Repeated names on purpose: several "Condition survey" sheets and conservation files are what a
// registry looks like. None of them has geometry, and the label says where each one actually lives —
// a records office, a loans register — places this prototype does not model.
const SHEETS = ['Long Gallery', 'Rotunda drum', 'Door and window ironwork', 'Floor structure'];
const FILES = ['Garden window glazing', 'Rotunda ceiling plaster', 'Light slot seals'];
export const METADATA = [
  ...SHEETS.map((s, i) => ({ id: `survey-${i + 1}`, name: 'Condition survey', kind: 'Record · survey sheet', where: `${s} · conservation file`, ref: `SURV-${100 + i}` })),
  ...FILES.map((f, i) => ({ id: `cons-${i + 1}`, name: 'Conservation file', kind: 'Record · file', where: `${f} · records office`, ref: `CONS-${200 + i}` })),
  { id: 'loan-1', name: 'Loan agreement', kind: 'Record · agreement', where: 'Loans register', ref: 'LOAN-31' },
  { id: 'loan-2', name: 'Loan agreement', kind: 'Record · agreement', where: 'Loans register', ref: 'LOAN-32' },
  { id: 'guide-1', name: 'Visitor guide text', kind: 'Record · text', where: 'Interpretation plan', ref: 'GUIDE-4' },
  { id: 'photo-1', name: 'Photograph', kind: 'Record · photograph', where: 'Photo library', ref: 'PH-1908-12' },
  { id: 'photo-2', name: 'Photograph', kind: 'Record · photograph', where: 'Photo library', ref: 'PH-1908-13' },
  { id: 'photo-3', name: 'Photograph', kind: 'Record · photograph', where: 'Photo library', ref: 'PH-1955-02' },
];

export const metadataOf = (id) => METADATA.find((r) => r.id === id) || null;

// Where a museum subject is listed: the places that name it, from the explicit relations above.
// A bound two places share says so; nothing is inferred from coordinates.
export function listingOf(id, kind, museum) {
  const names = placesOfThing(id).map((p) => p.name);
  if (names.length > 1) return `${names[0]} and ${names[1]} · shared bound`;
  if (names.length === 1) return names[0];
  const w = museum.walls.find((x) => x.id === id);
  if (w) {
    const g = museum.galleries.find((x) => x.id === w.gallery);
    if (g) return g.name;
  }
  return 'this museum';
}

// ----- everything Browse/Search lists -----------------------------------

// The museum's own subjects (which have geometry) and the metadata records (which do not). `geom` is
// the honest flag the row verbs are derived from: no geometry, no Open location, no recovery verbs.
export function browseRecords(museum) {
  const wallOf = (id) => museum.walls.find((w) => w.id === id) || null;
  const out = [];
  for (const w of museum.walls) {
    out.push({ id: w.id, name: w.name, kind: w.kind === 'arc' ? 'Curved wall' : 'Wall', where: listingOf(w.id, 'walls', museum), ref: w.ref, geom: true });
    for (const o of w.openings) out.push({ id: o.id, name: o.name, kind: o.kind === 'door' ? 'Door' : 'Window', where: `in the ${w.name}`, ref: o.ref, geom: true });
  }
  for (const c of museum.ceilings) out.push({ id: c.id, name: c.name, kind: c.rel === 'closure' ? 'Ceiling · closes the room' : 'Ceiling · suspended', where: listingOf(c.id, 'ceilings', museum), ref: c.ref, geom: true });
  for (const a of museum.art) {
    const w = wallOf(a.wall);
    // A reference the fixture leaves unresolved is labelled as such: the row never implies a host.
    out.push({ id: a.id, name: a.name, kind: 'Artwork · Scene', where: w ? `on the ${w.name}` : 'unresolved wall reference', ref: '', geom: true });
  }
  for (const o of museum.objects) out.push({ id: o.id, name: o.name, kind: 'Object · Scene', where: listingOf(o.id, 'objects', museum), ref: '', geom: true });
  for (const r of METADATA) out.push({ ...r, geom: false });
  return out;
}
