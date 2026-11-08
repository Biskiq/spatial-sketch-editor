'use strict';
/*
 * World creation tools — the System sheet.
 * Generated from the same registry as the Stage, so the reference cannot drift from the
 * prototype. The instrument stills are the Stage's own markup (UI.dockHtml, paletteHtml,
 * selectionHtml, libraryHtml) rendered for one state and made inert.
 */

const SHEET = {
  render(root) {
    // A still of the live instrument: the Stage's markup for one state, inert.
    const still = (tool, mode, selected) => {
      const keep = { tool: T.tool, lib: UI.lib };
      T.tool = tool; UI.lib = mode === 'library' ? { mode: 'browse', target: null, cat: 'objects' } : null;
      try {
        const tier = mode === 'library' ? UI.libraryHtml() : mode === 'selection' ? UI.selectionHtml(selected) : UI.paletteHtml();
        const f = familyOf(tool), last = f ? { ...T.famLast, [f.id]: tool } : T.famLast;
        return `<div class="edge specimen" inert><div class="tier${mode === 'library' ? ' library' : ''}">${tier}</div><nav class="dock">${UI.dockHtml(tool, mode === 'library', last)}</nav></div>`;
      } finally { T.tool = keep.tool; UI.lib = keep.lib; }
    };
    const bench = { kind: 'objects', item: { id: 'o1', name: 'Bench 1' } };

    const row = (t) => `<tr><th scope="row"><span class="ti">${icon(t.icon, 20)}</span>${t.name}<kbd>${t.key}</kbd></th><td>${esc(t.makes)}</td><td>${esc(t.gesture)}</td><td><ul>${t.proposes.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></td><td class="${/Needs/.test(t.owner) ? 'needs' : ''}">${esc(t.owner)}</td><td>${esc(t.area)}</td></tr>`;
    const thead = '<thead><tr><th>Tool</th><th>Makes</th><th>Gesture</th><th>Proposes</th><th>Owner</th><th>Lands in</th></tr></thead>';

    const shapes = Object.entries(SHAPES).map(([k, s]) => `<div class="shape"><span class="opt on">${icon(s.icon, 22)}<kbd>${s.key}</kbd></span><div><b>${s.label}</b><p>${esc(s.hint)}</p><small>${Object.values(TOOLS).filter((t) => (t.palette || []).some((g) => g.id === 'shape' && g.options.some((o) => o.v === k))).map((t) => t.name).join(', ') || '—'}</small></div></div>`).join('');

    const matrix = `<table class="matrix"><thead><tr><th>Tool in hand ↓ meets →</th>${INTERACTIONS.cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${INTERACTIONS.rows.map(([r, cells]) => `<tr><th scope="row">${r}</th>${cells.map((c) => `<td class="${c === '—' ? 'nil' : /^Refused/.test(c) ? 'refused' : /Asks|once, or/.test(c) ? 'ask' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

    const tok = (mode, ic, text, extra = '', cls = '') => `<span class="tok ${mode} ${cls}"><span class="tk-b">${icon(ic, 15)}<span>${text}</span>${extra}</span></span>`;
    const tokens = `<div class="specs">
      <figure>${tok('live', 'doorway', 'Doorway in Wall 3')}<figcaption><b>Proposed</b> Blue pencil, dashed, during the gesture. Commits with the release.</figcaption></figure>
      <figure>${tok('amend', 'steps', '9 steps', '<small>1/2</small><i class="tk-act">' + icon('cycle', 13) + '</i>')}<figcaption><b>Choice</b> After release. Click to cycle; amends the same undo step.</figcaption></figure>
      <figure>${tok('amend', 'doorway', 'Gate in Wall 7', '<i class="tk-act">' + icon('check', 13) + '</i>')}<figcaption><b>Accepted</b> Click to drop it from the step.</figcaption></figure>
      <figure>${tok('amend', 'doorway', 'Gate in Wall 7', '<i class="tk-act">' + icon('close', 13) + '</i>', 'declined')}<figcaption><b>Dropped</b> Struck through; click to restore.</figcaption></figure>
      <figure>${tok('info', 'datum', 'Cottage keeps its datum')}<figcaption><b>Said, not asked</b> A fact about the result. No choice to make.</figcaption></figure>
    </div>`;
    const tag = (kind, text, sub) => `<span class="tag ${kind}"><span>${text}</span>${sub ? `<ul>${sub.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}</span>`;
    const tags = `<div class="specs">
      <figure>${tag('live', '8.0 × 6.0 m · 2 storeys')}<figcaption><b>Live tag</b> DM Mono on forest. Only while hovering or dragging.</figcaption></figure>
      <figure>${tag('refuse', 'Refused · Crosses Cottage')}<figcaption><b>Refusal</b> The refused part turns red; nothing commits.</figcaption></figure>
      <figure>${tag('erase', 'Erase Wall 5', ['Gate 1 goes with it', 'Walled garden opens up'])}<figcaption><b>Removal</b> Names what goes and what stays before the click.</figcaption></figure>
      <figure>${tag('inspect', '6.42 m · Δh 1.20 m')}<figcaption><b>Inspection</b> Yellow, temporary, never saved.</figcaption></figure>
    </div>`;
    const marks = `<div class="specs marks">
      <figure><svg viewBox="0 0 150 70"><path d="M14 52 L70 22 L132 40" fill="none" stroke="#26231d" stroke-width="2.2"/><circle cx="14" cy="52" r="6.5" fill="#fbf6ea" stroke="#26231d" stroke-width="1.7"/><circle cx="14" cy="52" r="2" fill="#26231d"/><rect x="65.5" y="17.5" width="9" height="9" fill="#fbf6ea" stroke="#26231d" stroke-width="1.7"/><circle cx="132" cy="40" r="3.6" fill="#26231d"/></svg><figcaption><b>Draft ink</b> End marks say what you snapped to: ring a wall end, square the grid, dot free (Alt).</figcaption></figure>
      <figure><svg viewBox="0 0 150 70"><path d="M20 56 L20 22 L80 10 L80 44 Z" fill="rgba(159,184,236,.35)" stroke="#2a62d6" stroke-width="1.4" stroke-dasharray="6 4"/><path d="M80 44 L80 10 L130 24 L130 58 Z" fill="rgba(159,184,236,.25)" stroke="#2a62d6" stroke-width="1.4" stroke-dasharray="6 4"/></svg><figcaption><b>Procedural preview</b> The result itself, faint, with a blue-pencil edge.</figcaption></figure>
      <figure><svg viewBox="0 0 150 70"><path d="M20 56 L20 22 L80 10 L80 44 Z" fill="#efe2b8" stroke="#a7801a" stroke-width="2.2"/><circle cx="50" cy="16" r="7" fill="#d4ad45" stroke="#fbf6ea" stroke-width="1.6"/></svg><figcaption><b>Selection</b> Gold, and only selection. The knob on top bends a wall; the square above a roof sets storeys.</figcaption></figure>
      <figure><svg viewBox="0 0 150 70"><path d="M20 56 L20 22 L80 10 L80 44 Z" fill="#eab1a6" stroke="#c8462f" stroke-width="2"/><path d="M80 44 L80 10 L130 24 L130 58 Z" fill="#f5d7d1" stroke="#c8462f" stroke-width="1.6"/></svg><figcaption><b>Refusal and removal</b> Red. Always with words.</figcaption></figure>
    </div>`;

    // ── this iteration: what was challenged, and what replaced it ──────────────
    const challenged = [
      ['Ten icon keys in three captioned families', 'Eight labelled keys: Select · Build, Form, Landscape, Furnish · Paint, Erase · Library', 'Icons alone asked people to learn sixteen glyphs. Four family words are learnable at a glance; the tools inside are words too, one click away in the tier. The dock stays the same size as Biskiq grows: new tools go inside a family.'],
      ['Building as its own dock key', 'Building is a Build tool fed by definitions (Cottage, Tower, Pavilion, Long barn) picked in its options or the Library', 'It shares Walls’ footprint gesture and target, so by the placement rule it is not a key. It stays a tool because its result differs: a placed structure that follows its definition.'],
      ['Object and Form side by side in Furnish', 'Draw it: Form, its own key. Pick it: Furnish', 'Different verbs, different homes. Form is the seed of expressive modelling (Carve, Sweep, Lathe, Array) and earns room to grow; Furnish is the shelf and the Library.'],
      ['The sun on an arc inside Light', 'Lights are fixtures only. The Sky lives in the head: presets, the hour, and the arc you can drag while it is open', 'The hour is not a pointer tool and should not need one armed. It sits with the other ways of setting how the world looks.'],
      ['Water as Ground’s Pond and Stream modes', 'Water is its own Landscape tool (A), with Pond and Stream as its modes', 'Once tools inside a family cost no dock space, the noun deserves its name. Ground’s options shrink to what ground does.'],
      ['Library only as the last dock key', 'Library is a key (K) and also the last action in every palette that draws on the catalogue', 'The catalogue is reached from where you are, not only from the end of the dock.'],
      ['Ivory and dark green, system type, line icons', 'Living Draft: forest chassis, parchment with grain, ink edges on what is built, Fraunces for names, DM Mono for measures, monochrome keys with family accents, Living and Paper profiles', 'Distinctive without decoration: every new mark carries meaning (a family, a name, a measure, a cut).'],
    ];

    // ── the final pass on the toolbar ──────────────────────────────────────────
    const tightened = [
      ['The tier folded, and grew or shrank with each tool', 'One fixed instrument, 656 × 164: a plate of two rows on the dock. Same size for every tool, the selection and the Library', 'Your hand learns where things are. Nothing jumps when you switch.'],
      ['Hover tooltips and a hover list of each family’s tools', 'Nothing appears on hover. Click a family: its tools are in the words row. Click a tool: it is armed', 'Discovery by clicking is predictable and works on touch. The words row already lists every tool.'],
      ['A line of guidance under every palette', 'Gone. One word above each option group names what it holds now (Cottage, Two storeys, Limewash)', 'Names and pictures carry it. The readout on this prototype keeps the coaching, outside the product.'],
      ['Duotone keys in four washes', 'Parchment line on forest. Family colour only on the armed family: its dot and its tool’s underline', 'Colour washes muddied the forest. Accents now mean state.'],
      ['Every material swatch in Paint', 'Five recent materials, then All, which opens the Library at Materials', 'Scales to any catalogue; the ones you are using stay in reach.'],
    ];
    const anatomy = [
      ['Instrument', '656 px wide (phone: full width less 16 px); 164 px tall. One radius, one shadow'],
      ['Words row', '40 px. The family’s tools in Fraunces 16, the armed one underlined in the family accent. Or the selection’s name, or the Library’s kinds and Close'],
      ['Pictures strip', '62 px. Option groups, each with one Mono 10 word above it naming the current choice. Selection actions and Erase; or catalogue tiles'],
      ['Dock', '62 px. Eight keys of equal width: icon, label, one dot per tool. The armed key is parchment and joins the plate'],
      ['Overflow', 'Each row scrolls sideways inside itself (wheel, trackpad or touch). A fade marks the side that continues. The instrument never resizes'],
      ['Clicks', 'Family key: open its tools and arm the last one used. Tool word: arm it. Armed key again: nothing changes. Library key or Esc: open and close the Library'],
    ];

    // ── where things live ─────────────────────────────────────────────────────
    const placement = [
      ['Build, Form, Landscape, Furnish', 'Dock key: a family', 'One owner and one kind of making. A family earns a key when it has its own owner and its own verb. The key arms the tool you last used in it.'],
      ['Walls, Opening, Stair, Building · Form · Ground, Water, Path, Plants · Objects, Lights', 'A tool inside its family, named in the words row', 'Each has its own gesture and its own target. Letter keys arm any of them directly.'],
      ['Select, Paint, Erase', 'Dock key, outside the families', 'They work on everything, whichever family made it.'],
      ['Shape, kind, size, finish, mode, definition', 'The armed tool’s options, as pictures', 'Variants of the gesture in hand. Options never act on something that already exists.'],
      ['Turn, Duplicate, Replace, Straighten, Save to Library, Erase', 'Selection actions (Select armed)', 'Operations on something that exists. Its properties stay in the Card.'],
      ['Objects, fixtures, plants, building definitions, materials, saved forms', 'Library (K), and the Library action in palettes', 'Catalogue content. Picking one arms the tool that places it.'],
      ['Roof', 'Walls (the token when a run closes) and the selection of a room', 'A consequence of closing a room, or an operation on one. Not a drawing gesture.'],
      ['Frames and art', 'Objects: frames are wall items on the shelf', 'Hanging is Objects’ gesture against a wall face.'],
      ['Sky: the hour and presets; later weather and season', 'The head, as a chip with a popover', 'The world’s look, not a gesture on the Stage.'],
      ['Plan and 3D, Living and Paper, Measure, Slice', 'The head', 'Ways of looking. They make nothing.'],
    ];
    const grows = [
      ['Build', 'Level, Railing, Column grid', 'Tools inside Build; Railing also offered on Stair'],
      ['Form', 'Carve, Sweep, Lathe, Array', 'Tools inside Form. Saved forms go to the Library and are placed with Objects'],
      ['Landscape', 'Hedge, Fence, Rocks', 'Tools inside Landscape; a Hedge is Plants drawn along a stroke'],
      ['Furnish', 'Media, Sound, Trigger zone', 'Tools inside Furnish while they are things you place'],
      ['Interactive experiences', 'Viewpoints, Camera paths, Triggers, Sequences', 'A fifth family key (say, Direct) once it has its own owner and two tools. Until then Trigger zone stays in Furnish'],
      ['Galleries', 'Hanging plans, labels, lighting presets', 'Objects frames and Lights; a hanging plan is a selection action on a wall'],
      ['Sky', 'Weather, Season, Fog, Night sky', 'Inside the Sky popover'],
    ];

    const decisions = [
      ['Ink (one pen for walls, rooms and openings)', 'Named creation tools in four families: Build (Walls, Opening, Stair, Building), Form, Landscape (Ground, Water, Path, Plants), Furnish (Objects, Lights)', 'The tool says what you are making, so the gesture can be simple and the preview can be the result.'],
      ['Flat utility dock: Select, Ink, Slice, Eraser, Brush, Measure', 'One instrument: eight labelled keys and one parchment tier above for tools and options, selection actions or the Library; Measure, Slice and the Sky in the head', 'The dock does not grow with the product; families do.'],
      ['Brush (materials)', 'Paint: universal, reach by scope (face, wall, room or building, everything like it); the ground takes it as a brush', 'One way to colour anything. The Ask Rule fires when a click would change a shared definition.'],
      ['Shape chosen per gesture inside Ink', 'Shared shape keys 1 to 6 in every drawing tool', 'One meaning, one key: 3 is always Box, in Walls, Building, Form and Ground’s terrace.'],
      ['Consequences shown in an acceptance bar before commit', 'Consequence tokens in place, during the gesture; release commits; tokens stay to amend the same undo step', 'No confirm step, nothing hidden: every consequence is visible before release and changeable after.'],
      ['Esc: palette, then disarm', 'Esc: draft, Library or Sky, amend tokens, selection, palette, then Select', 'Right-click cancels only the live draft.'],
    ];
    const pushback = [
      ['Lighting as one tool', 'Lights hold fixtures. The sun and the hour are the Sky, in the head: Scene environment, not a pointer tool.'],
      ['Water as its own tool', 'Agreed, inside Landscape: Water (A) with Pond and Stream. Underneath it is still a terrain edit with a surface.'],
      ['Paths/Stairs as one tool', 'Two things: a Stair is architecture (Layout) between two heights; a path’s Steps are a consequence of laying a path on a slope.'],
      ['Openings as a side effect', 'Openings stay first-class (Opening) and are also proposed by Path and Walls. Either way the result is one ordinary Opening.'],
      ['Materials as a family tool', 'Paint is universal, next to Erase: it works on every family’s surfaces alike.'],
      ['Procedural magic', 'Procedural results are proposals with names. A path never silently cuts a wall; it proposes a doorway that you can drop.'],
    ];
    const owners = [
      ['Landscape ownership', 'Ground, water, paths and plants have no owner today. Options: a Landscape authority, terrain inside Layout with plants in Scene, or all in Scene. The prototype marks them “Needs an owner”. The Landscape key does not depend on the answer.'],
      ['Placed buildings', 'Building assumes Layout placed structures from reusable definitions (T5). “Every Cottage” edits the definition; “Only this one” writes an override.'],
      ['Cross-owner acceptance', 'A path that proposes a doorway commits Landscape and Layout changes in one step. Needs the atomic cross-domain acceptance the North Star asks for.'],
      ['Sky', 'The prototype treats the hour as Scene environment, set with an undoable step. Living and Paper are viewing preferences, never saved into the world.'],
      ['Saved forms', 'Save to Library makes a composed form reusable: a Scene-owned definition or a typed resource. The prototype does not keep the entry.'],
      ['Plant scatter rule', 'The skip rule (paths, water, buildings) runs once at painting time and is not stored. Confirm that a persistent rule is not wanted.'],
    ];
    const pathFlow = [
      ['Armed', 'Pointer moves over ground', 'Aiming', 'Snap end mark under the pointer'],
      ['Aiming', 'Press (Freehand) or click (Line, Arc)', 'Drafting', 'Ink draft; ribbon preview on the ground; live length tag'],
      ['Drafting', 'Stroke meets a wall, building, slope, water or plants', 'Proposing', 'Blue-pencil tokens at each crossing: doorway or gate, door, steps, bridge, clears plants'],
      ['Proposing', 'Release (Freehand), double-click or Enter', 'Committed', 'One undo step with the path and every accepted consequence; it settles into the ground'],
      ['Committed', 'Click a token', 'Committed', 'Same step re-planned with the new choice; history still shows one row'],
      ['Any live state', 'Esc or right-click', 'Cancelled', 'Draft disappears; nothing recorded'],
      ['Any live state', 'Crosses a building edge with Walls', 'Refused', 'Refused part turns red with the reason; nothing commits'],
    ];
    const intentExample = { intent: 'landscape.path.lay', points: [[-5, 3.2], [-5, -1.2], [-3.4, -3.6], [2.8, -5.5]], width: 1.6, surface: 'gravel', consequences: [{ intent: 'layout.opening.cut', kind: 'door', host: 'b1', at: 4 }, { intent: 'landscape.path.crossing', as: 'bridge' }, { intent: 'layout.opening.cut', kind: 'gate', host: 'w8', at: 3.5 }] };

    // ── identity ──────────────────────────────────────────────────────────────
    const sw = (c, name, use) => `<figure><i style="--c:${c}"></i><figcaption><b>${name}</b>${esc(use)} <code>${c}</code></figcaption></figure>`;
    const palette = `<div class="pal">
      ${sw('#13261b', 'Forest', 'The chassis: head, dock, toasts, armed options.')}
      ${sw('#7f9150', 'Moss', 'Landscape’s accent; turf on the cut.')}
      ${sw('#9fb39a', 'Sage', 'Ground; quiet labels on forest.')}
      ${sw('#fbf6ea', 'Parchment', 'Every surface you read: the plate, Card, Sky, sheet. With grain.')}
      ${sw('#c2643f', 'Terracotta', 'Build’s accent, roofs and brick.')}
      ${sw('#d4ad45', 'Gold', 'Selection, and only selection.')}
      ${sw('#2a62d6', 'Blue pencil', 'Proposals: dashed while drawing, solid to amend.')}
      ${sw('#26231d', 'Ink', 'Text, and the drafting line on what is built.')}
      ${sw('#c8462f', 'Erase', 'Removal and refusal, always with words.')}
      ${sw('#f2d000', 'Inspect', 'Temporary readings. Never saved.')}
    </div>
    <h3>Dock keys and family accents</h3><p class="sec-lede">One parchment pencil line on forest for every key. A family’s colour appears only when it is armed: the filled dot under its key and the underline of its armed tool.</p>
    <div class="icons">${['select', ...FAMILIES.map((f) => f.icon), 'paint', 'erase', 'library'].map((k) => { const f = FAMILIES.find((x) => x.icon === k); return `<figure class="dark">${heroIcon(k, 32)}<figcaption>${f ? `<i class="acc" style="--c:${f.accent}"></i>${f.name}` : TOOLS[k] ? TOOLS[k].name : 'Library'}</figcaption></figure>`; }).join('')}</div>`;
    const type = `<div class="type">
      <figure><div class="t-d">Village by the pond</div><figcaption><b>Fraunces</b> for names: the worlds and things you author, the tools you pick, headings. Words for nouns.</figcaption></figure>
      <figure><div class="t-s">Duplicate · Save to Library</div><figcaption><b>Instrument Sans</b> for the interface: key labels and actions.</figcaption></figure>
      <figure><div class="t-m">8.0 × 6.0 m · 15:30</div><figcaption><b>DM Mono</b> for what is measured and tagged: lengths, the hour, owners, kinds.</figcaption></figure>
    </div>`;
    const shots = UI.shots;
    const profiles = shots
      ? `<div class="profiles"><figure><img src="${shots.living}" alt="The village in the Living profile"><figcaption><b>Living</b> The illustrated world. Sage and moss ground, warm light and shadow, the hour, ink edges on what is built, the slab cut and hatched.</figcaption></figure><figure><img src="${shots.paper}" alt="The same village in the Paper profile"><figcaption><b>Paper</b> The same world as a technical drawing. Parchment tones by value, flat light, stronger ink, no hour. A way of looking, never saved.</figcaption></figure></div>`
      : `<p class="sec-lede"><b>Living</b> is the illustrated world: sage and moss ground, warm light, the hour, ink edges on what is built, the slab cut and hatched. <b>Paper</b> is the same world as a technical drawing: parchment tones by value, flat light, stronger ink, no hour. Switch them in the head on the Stage; open the Stage before the sheet to see both here.</p>`;
    const surfaces = [
      ['Two materials, one each', 'Forest is the chassis you hold (head, dock); parchment is what you read (tier, Card, Sky). Nothing else gets a background.'],
      ['One surface, one shadow', 'The plate and the dock are one instrument of fixed size with one shadow. No card inside a card; rows are separated by a hairline, groups by space.'],
      ['The armed key is a tab', 'Parchment, joined to the plate above it, so you can see what the plate belongs to.'],
      ['Grain on paper only', 'A faint paper grain on parchment surfaces and the Stage. Forest stays clean so state reads crisply against it.'],
      ['Ink on what is built', 'Architecture, forms and objects get a drafting line; ground and plants stay soft. The world reads as drawn and grown.'],
      ['Motion with meaning', 'One orchestrated motion: what you commit rises out of the ground.'],
    ];

    root.innerHTML = `<article class="sheet">
      <header class="sh-hero">
        <div class="sh-dockmark">${still('walls', 'palette')}</div>
        <p class="eyebrow">Biskiq · World tools · Living Draft</p>
        <h1>Say what you are <em>making</em>.</h1>
        <p class="lede">A World tool system where each tool names its intent, shows the result while you gesture, proposes its consequences where they happen, and commits one undo step you can still amend. Four families, words for nouns and pictures for variants, drawn in a precise and living hand.</p>
        <p class="sh-nav"><button data-view="stage">Open the Stage</button> <a href="#village/path">Path in the village</a> <a href="#gallery/object">Hang frames in the gallery</a> <a href="#studio/form">Compose forms in the studio</a> <a href="#slope/building">Building on a slope</a> <a href="#meadow/water">Water in the meadow</a></p>
      </header>

      <section><h2>What this iteration changed</h2><p class="sec-lede">An adversarial pass over the previous proposal and the brief. One direction, not alternatives.</p>
        <table class="dec"><thead><tr><th>Was</th><th>Now</th><th>Why</th></tr></thead><tbody>${challenged.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </section>

      <section><h2>Final pass: the toolbar</h2><p class="sec-lede">Visual polish and behaviour only; the families, the grammar and the Sky are unchanged.</p>
        <table class="dec"><thead><tr><th>Was</th><th>Now</th><th>Why</th></tr></thead><tbody>${tightened.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </section>

      <section><h2>Principles</h2><div class="principles">
        <div><h3>Name the intent</h3><p>Walls, Building, Water, Plants. The tool knows its target, so a shape key and a drag are enough.</p></div>
        <div><h3>Words for nouns, pictures for variants</h3><p>Families and tools are named. Shapes, kinds and sizes are drawn. You read what you are making and see how.</p></div>
        <div><h3>Show the result, not a wireframe</h3><p>During the gesture you see the procedural result itself: walls rising, a roof forming, a ribbon on the ground.</p></div>
        <div><h3>Propose in place</h3><p>Doorways, steps, bridges and plinths appear in blue pencil where they will happen, before release.</p></div>
        <div><h3>Commit on release, amend after</h3><p>No confirm step. The tokens stay after release; changing one re-plans the same undo step.</p></div>
        <div><h3>Results are ordinary things</h3><p>A path’s doorway is an Opening. Erase the path and the opening stays, now just an opening.</p></div>
        <div><h3>Refuse in words</h3><p>“Too close to the end of Wall 3.” The refused part turns red; nothing half-commits.</p></div>
        <div><h3>Every domain keeps its owner</h3><p>Build is Layout, Form and Furnish are Scene, Landscape needs an owner. The Card always says which.</p></div>
      </div></section>

      <section><h2>The instrument</h2>
        <p class="sec-lede">One instrument of fixed size at the lower edge, read from the bottom up: family, tool, options. Click a family, then a tool. Nothing appears on hover and nothing resizes; a row with more than fits scrolls inside itself. Letter keys arm any tool directly.</p>
        <table class="dec"><tbody>${anatomy.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>
        <div class="stills">
          <figure>${still('water', 'palette')}<figcaption><b>Tools and options</b> Landscape armed with Water. The family’s tools in words, the armed tool’s options in pictures, one word above each group.</figcaption></figure>
          <figure>${still('building', 'palette')}<figcaption><b>Definitions drive Building</b> Pick Cottage, Tower, Pavilion or Long barn and draw its footprint; it rises as you draw.</figcaption></figure>
          <figure>${still('paint', 'palette')}<figcaption><b>Paint</b> Five recent materials, then All for the Library’s Materials. Reach and brush size beside them.</figcaption></figure>
          <figure>${still('select', 'selection', bench)}<figcaption><b>Selection</b> Select armed and something chosen: the gold pip, the operations it allows, Erase at the far end. Its properties stay in the Card.</figcaption></figure>
          <figure>${still('object', 'library')}<figcaption><b>Library</b> K. Its kinds in the words row, the catalogue in the strip, scrolling sideways. The tool that will place the pick stays held beneath.</figcaption></figure>
        </div>
        <h3>Where things live</h3><p class="sec-lede">One rule decides placement, so a new capability has one obvious home.</p>
        <table class="dec place"><thead><tr><th>Capability</th><th>Lives in</th><th>Why</th></tr></thead><tbody>${placement.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        <h3>How it grows</h3><p class="sec-lede">Biskiq has to reach architecture, landscapes, galleries, standalone objects, expressive modelling and interactive experiences. The dock stays eight keys until a new owner with its own verb arrives.</p>
        <table class="dec"><thead><tr><th>Area</th><th>Next tools</th><th>Where they go</th></tr></thead><tbody>${grows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </section>

      <section><h2>Tools</h2>
        ${FAMILIES.map((f) => `<h3 class="famh"><span class="hico">${heroIcon(f.icon, 28)}</span>${f.name} <span>${esc(f.blurb)}</span><em class="${/Needs/.test(f.owner) ? 'needs' : ''}">${f.owner}</em></h3><table class="tools">${thead}<tbody>${f.tools.map((id) => row(TOOLS[id])).join('')}</tbody></table><p class="grow">Grows: ${f.grows.join(' · ')}</p>`).join('')}
        <h3 class="famh"><span class="hico">${heroIcon('select', 28)}</span>Utilities and view <span>Outside the families: they work on everything, or only look.</span></h3><table class="tools">${thead}<tbody>${[...UTILITY_LEFT, ...UTILITY_RIGHT, ...VIEW_TOOLS].map((id) => row(TOOLS[id])).join('')}</tbody></table>
      </section>

      <section><h2>Identity: Living Draft</h2>
        <p class="sec-lede">Precise drafting and an illustrated, growing world in one hand. A forest chassis around warm parchment; the drafting line on what is built; colour that always means something.</p>
        <h3>Colour</h3>${palette}
        <h3>Type</h3>${type}
        <h3>Two profiles of one world</h3>${profiles}
        <h3>Surfaces</h3><table class="dec"><tbody>${surfaces.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>
      </section>

      <section><h2>Shared grammar</h2>
        <h3>Shapes</h3><p class="sec-lede">The same six keys in every drawing tool that offers them.</p><div class="shapes">${shapes}</div>
        <div class="two">
          <div><h3>The interaction states</h3><p class="sec-lede">Every creation tool moves through the same sequence; the Stage readout shows it live.</p><ol class="states">${STATES.map((s) => `<li><b>${s.label}</b> ${esc(s.note)}</li>`).join('')}</ol><ul class="exits">${STATE_EXITS.map((s) => `<li><b>${s.label}</b> ${esc(s.note)}</li>`).join('')}</ul></div>
          <div><h3>Esc, one rung at a time</h3><ol class="states">${ESC_LADDER.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
            <h3>Brushes</h3><dl class="keys">${BRUSH_KEYS.map(([k, v]) => `<dt><kbd>${k}</kbd></dt><dd>${v}</dd>`).join('')}<dt><kbd>Space</kbd></dt><dd>Hold and drag to orbit with any tool</dd><dt><kbd>⌘Z</kbd></dt><dd>Undo one accepted gesture</dd></dl></div>
        </div>
        <h3>Path, state by state</h3><p class="sec-lede">The pattern every drawing tool follows, written out for the busiest one.</p>
        <table class="flow"><thead><tr><th>From</th><th>Event</th><th>To</th><th>Feedback</th></tr></thead><tbody>${pathFlow.map((r) => `<tr>${r.map((c, i) => (i === 0 || i === 2 ? `<td><b>${c}</b></td>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</tbody></table>
        <h3>The intent it produces</h3><p class="sec-lede">Typed, serializable and the same for a person or an agent. Consequences ride inside the one accepted intent.</p><pre class="intent">${esc(JSON.stringify(intentExample, null, 1))}</pre>
      </section>

      <section><h2>When tools meet</h2><p class="sec-lede">What a new gesture proposes against what is already there. Red cells refuse; gold cells ask.</p>${matrix}</section>

      <section><h2>Marks and feedback</h2>${marks}<h3>Consequence tokens</h3>${tokens}<h3>Tags</h3>${tags}</section>

      <section><h2>What this replaces</h2><table class="dec"><thead><tr><th>Approved today</th><th>Proposed</th><th>Why</th></tr></thead><tbody>${decisions.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>

      <section><h2>Where this differs from the brief</h2><table class="dec"><thead><tr><th>Brief suggested</th><th>Proposal</th></tr></thead><tbody>${pushback.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>

      <section><h2>Owner decisions this needs</h2><dl class="owners">${owners.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>

      <section><h2>Icons</h2><p class="sec-lede">Two voices. Dock keys: a pencil line over an offset wash (above). Options: one 24 px grid, 1.5 px strokes, round caps, in the colour of the text around them.</p><div class="icons">${Object.keys(ICONS).map((k) => `<figure>${icon(k, 24)}<figcaption>${k}</figcaption></figure>`).join('')}</div></section>
    </article>`;
  },
};
