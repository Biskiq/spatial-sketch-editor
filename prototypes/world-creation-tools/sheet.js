'use strict';
/*
 * World creation tools — the System sheet.
 * Generated from the same registry as the Stage, so the reference cannot drift from the
 * prototype. Specimens reuse the live classes (.key, .tok, .tag, .opt).
 */

const SHEET = {
  render(root) {
    const fam = (id) => FAMILIES.find((f) => f.id === id);
    const keyHtml = (id, armed) => { const t = TOOLS[id]; return `<span class="key${armed ? ' armed' : ''}${t.disabled ? ' off' : ''}">${icon(t.icon, 22)}<span class="kl">${t.name}</span><kbd>${t.key}</kbd></span>`; };
    const dockFamilies = `<div class="dock specimen" data-mode="families"><div class="dg">${keyHtml('select')}</div><i class="ds"></i>
      <div class="fam open" style="--mark:${fam('build').mark}"><span class="famkey holds">${icon('fam-build', 22)}<span class="kl">Build</span></span><div class="famtools">${fam('build').tools.map((t) => keyHtml(t, t === 'walls')).join('')}</div></div>
      <div class="fam" style="--mark:${fam('furnish').mark}"><span class="famkey">${icon('fam-furnish', 22)}<span class="kl">Furnish</span><em>3</em></span></div>
      <div class="fam" style="--mark:${fam('land').mark}"><span class="famkey">${icon('fam-land', 22)}<span class="kl">Landscape</span><em>4</em></span></div>
      <i class="ds"></i><div class="dg">${UTILITY_RIGHT.map((t) => keyHtml(t)).join('')}</div><i class="ds"></i><div class="dg quiet">${INSPECT.map((t) => keyHtml(t)).join('')}</div><i class="ds"></i><span class="key lib">${icon('library', 22)}<span class="kl">Library</span></span></div>`;
    const dockFlat = `<div class="dock specimen" data-mode="flat"><div class="dg">${keyHtml('select')}</div><i class="ds"></i>${FAMILIES.map((f) => `<div class="fam flat" style="--mark:${f.mark}">${f.tools.map((t) => keyHtml(t, t === 'walls')).join('')}</div>`).join('')}<i class="ds"></i><div class="dg">${UTILITY_RIGHT.map((t) => keyHtml(t)).join('')}</div><i class="ds"></i><div class="dg quiet">${INSPECT.map((t) => keyHtml(t)).join('')}</div></div>`;

    const toolRows = (f) => f.tools.map((id) => {
      const t = TOOLS[id];
      return `<tr><th scope="row"><span class="ti">${icon(t.icon, 20)}</span>${t.name}<kbd>${t.key}</kbd></th><td>${esc(t.makes)}</td><td>${esc(t.gesture)}</td><td><ul>${t.proposes.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></td><td class="${/Needs/.test(t.owner) ? 'needs' : ''}">${esc(t.owner)}</td><td>${esc(t.area)}</td></tr>`;
    }).join('');
    const utilRows = [...UTILITY_LEFT, ...UTILITY_RIGHT, ...INSPECT].map((id) => {
      const t = TOOLS[id];
      return `<tr><th scope="row"><span class="ti">${icon(t.icon, 20)}</span>${t.name}<kbd>${t.key}</kbd></th><td>${esc(t.makes)}</td><td>${esc(t.gesture)}</td><td><ul>${t.proposes.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></td><td>${esc(t.owner)}</td><td>${esc(t.area)}</td></tr>`;
    }).join('');
    const thead = '<thead><tr><th>Tool</th><th>Makes</th><th>Gesture</th><th>Proposes</th><th>Owner</th><th>Lands in</th></tr></thead>';

    const shapes = Object.entries(SHAPES).map(([k, s]) => `<div class="shape"><span class="opt on">${icon(s.icon, 22)}<kbd>${s.key}</kbd></span><div><b>${s.label}</b><p>${esc(s.hint)}</p><small>${Object.values(TOOLS).filter((t) => (t.palette || []).some((g) => g.id === 'shape' && g.options.some((o) => o.v === k))).map((t) => t.name).join(', ') || '—'}</small></div></div>`).join('');

    const matrix = `<table class="matrix"><thead><tr><th>Tool in hand ↓ meets →</th>${INTERACTIONS.cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${INTERACTIONS.rows.map(([r, cells]) => `<tr><th scope="row">${r}</th>${cells.map((c) => `<td class="${c === '—' ? 'nil' : /^Refused/.test(c) ? 'refused' : /Asks|once, or/.test(c) ? 'ask' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

    const tok = (mode, ic, text, extra = '', cls = '') => `<span class="tok ${mode} ${cls}" style="position:relative;transform:none"><span class="tk-b">${icon(ic, 15)}<span>${text}</span>${extra}</span></span>`;
    const tokens = `<div class="specs">
      <figure>${tok('live', 'doorway', 'Doorway in Wall 3')}<figcaption><b>Proposed</b> Dashed cobalt, during the gesture. Commits with the release.</figcaption></figure>
      <figure>${tok('amend', 'steps', '9 steps', '<small>1/2</small><i class="tk-act">' + icon('cycle', 13) + '</i>')}<figcaption><b>Choice</b> After release. Click to cycle; amends the same undo step.</figcaption></figure>
      <figure>${tok('amend', 'doorway', 'Gate in Wall 7', '<i class="tk-act">' + icon('check', 13) + '</i>')}<figcaption><b>Accepted</b> Click to drop it from the step.</figcaption></figure>
      <figure>${tok('amend', 'doorway', 'Gate in Wall 7', '<i class="tk-act">' + icon('close', 13) + '</i>', 'declined')}<figcaption><b>Dropped</b> Struck through; click to restore.</figcaption></figure>
      <figure>${tok('info', 'datum', 'Cottage keeps its datum')}<figcaption><b>Said, not asked</b> A fact about the result. No choice to make.</figcaption></figure>
    </div>`;
    const tag = (kind, text, sub) => `<span class="tag ${kind}" style="position:relative;transform:none"><span>${text}</span>${sub ? `<ul>${sub.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}</span>`;
    const tags = `<div class="specs">
      <figure>${tag('live', '8.0 × 6.0 m · 2 storeys')}<figcaption><b>Live tag</b> Only while hovering or dragging.</figcaption></figure>
      <figure>${tag('refuse', 'Refused · Crosses Cottage')}<figcaption><b>Refusal</b> The refused part turns red; nothing commits.</figcaption></figure>
      <figure>${tag('erase', 'Erase Wall 5', ['Gate 1 goes with it', 'Walled garden opens up'])}<figcaption><b>Removal</b> Names what goes and what stays before the click.</figcaption></figure>
      <figure>${tag('inspect', '6.42 m · Δh 1.20 m')}<figcaption><b>Inspection</b> Yellow, temporary, never saved.</figcaption></figure>
    </div>`;
    const marks = `<div class="specs marks">
      <figure><svg viewBox="0 0 150 70"><path d="M14 52 L70 22 L132 40" fill="none" stroke="#1b201c" stroke-width="2.2"/><circle cx="14" cy="52" r="6.5" fill="#fff" stroke="#1b201c" stroke-width="1.7"/><circle cx="14" cy="52" r="2" fill="#1b201c"/><rect x="65.5" y="17.5" width="9" height="9" fill="#fff" stroke="#1b201c" stroke-width="1.7"/><circle cx="132" cy="40" r="3.6" fill="#1b201c"/></svg><figcaption><b>Draft ink</b> End marks say what you snapped to: ring a wall end, square the grid, dot free (Alt).</figcaption></figure>
      <figure><svg viewBox="0 0 150 70"><path d="M20 56 L20 22 L80 10 L80 44 Z" fill="rgba(159,184,236,.35)" stroke="#2a62d6" stroke-width="1.4" stroke-dasharray="6 4"/><path d="M80 44 L80 10 L130 24 L130 58 Z" fill="rgba(159,184,236,.25)" stroke="#2a62d6" stroke-width="1.4" stroke-dasharray="6 4"/></svg><figcaption><b>Procedural preview</b> The result itself, faint, with a cobalt dashed edge.</figcaption></figure>
      <figure><svg viewBox="0 0 150 70"><path d="M20 56 L20 22 L80 10 L80 44 Z" fill="#efe2b8" stroke="#a7801a" stroke-width="2.2"/><circle cx="50" cy="16" r="7" fill="#d4ad45" stroke="#fff" stroke-width="1.6"/></svg><figcaption><b>Selection</b> Gold. The knob on top bends a wall; the square above a roof sets storeys.</figcaption></figure>
      <figure><svg viewBox="0 0 150 70"><path d="M20 56 L20 22 L80 10 L80 44 Z" fill="#eab1a6" stroke="#d0412d" stroke-width="2"/><path d="M80 44 L80 10 L130 24 L130 58 Z" fill="#f5d7d1" stroke="#d0412d" stroke-width="1.6"/></svg><figcaption><b>Refusal and removal</b> Red. Always with words.</figcaption></figure>
    </div>`;

    const decisions = [
      ['Ink (one pen for walls, rooms and openings)', 'Named creation tools: Walls, Building, Opening, Roof, Stair; Object, Art, Light; Ground, Path, Water, Plants', 'The tool says what you are making, so the gesture can be simple and the preview can be the result.'],
      ['Flat utility dock: Select · Ink · Slice · Eraser · Brush · Measure', 'Families dock: Select, Build, Furnish, Landscape, Paint, Erase, Measure, Slice, Library', 'Thirteen creation tools do not fit a flat row that stays learnable. A flat dock is kept as a comparison toggle.'],
      ['Brush (materials)', 'Paint: universal, reach by scope (face, wall, room or building, everything like it); the ground takes it as a brush', 'One way to colour anything. The Ask Rule fires when a click would change a shared definition.'],
      ['Shape chosen per gesture inside Ink', 'Shared shape keys 1 to 6 in every drawing tool', 'One meaning, one key: 3 is always Box, in Walls, Building and Path.'],
      ['Consequences shown in an acceptance bar before commit', 'Consequence tokens in place, during the gesture; release commits; tokens stay to amend the same undo step', 'Keeps the Tiny Glade flow (no confirm step) without hiding anything: every consequence is visible before release and changeable after.'],
      ['Esc: palette, then disarm', 'Esc: draft, amend tokens, selection, palette, then Select', 'Adds one rung for the amend tokens. Right-click cancels only the live draft.'],
      ['Eraser: click, scrub and lasso with an acceptance bar', 'Erase: click with a tag that names what goes and what stays; hold over plants to clear', 'Lasso stays valid and is not re-prototyped here.'],
    ];
    const pushback = [
      ['Lighting as one tool', 'Light holds fixtures, and the sun lives on a sky arc inside it. Environment is Scene; it does not earn its own dock key.'],
      ['Water as its own family', 'Water is a terrain edit with a surface, so it sits in Landscape with Ground, Path and Plants.'],
      ['Paths/Stairs as one tool', 'Two things: a Stair is architecture (Layout) between two heights; a path’s Steps are a consequence of laying a path on a slope.'],
      ['Openings as a side effect', 'Openings stay first-class (Opening tool) and are also proposed by Path and Walls. Either way the result is one ordinary Opening.'],
      ['Materials as a family tool', 'Paint is universal, next to Erase: it works on Build, Furnish and Landscape surfaces alike.'],
      ['Art inside Objects', 'Art is first-class: it hangs on a wall face, in rows, skipping openings. Hanging is an explicit attachment.'],
      ['Procedural magic', 'Procedural results are proposals with names. A path never silently cuts a wall; it proposes a doorway that you can drop.'],
    ];
    const owners = [
      ['Landscape ownership', 'Ground, paths, water and plants have no owner today. Options: a fifth Landscape authority, terrain inside Layout with plants in Scene, or all in Scene. The prototype marks them “Needs an owner”.'],
      ['Placed buildings', 'Building assumes Layout placed structures from reusable definitions (T5). “Every Cottage” edits the definition; “Only this one” writes an override.'],
      ['Cross-owner acceptance', 'A path that proposes a doorway commits Landscape and Layout changes in one step. Needs the atomic cross-domain acceptance the North Star asks for.'],
      ['Sun and hour', 'The prototype treats the hour as Scene environment, set with an undoable step. Whether the hour is authored or a viewing preference needs a decision.'],
      ['Plant scatter rule', 'The skip rule (paths, water, buildings) runs once at painting time and is not stored. Confirm that a persistent rule is not wanted.'],
    ];
    const pathFlow = [
      ['Armed', 'Pointer moves over ground', 'Aiming', 'Snap end mark under the pointer'],
      ['Aiming', 'Press (Freehand) or click (Line, Arc)', 'Drafting', 'Black draft ink; ribbon preview on the ground; live length tag'],
      ['Drafting', 'Stroke meets a wall, building, slope, water or plants', 'Proposing', 'Cobalt tokens at each crossing: doorway or gate, door, steps, bridge, clears plants'],
      ['Proposing', 'Release (Freehand), double-click or Enter', 'Committed', 'One undo step with the path and every accepted consequence; it settles into the ground'],
      ['Committed', 'Click a token', 'Committed', 'Same step re-planned with the new choice; history still shows one row'],
      ['Any live state', 'Esc or right-click', 'Cancelled', 'Draft disappears; nothing recorded'],
      ['Any live state', 'Crosses a building edge with Walls', 'Refused', 'Refused part turns red with the reason; nothing commits'],
    ];
    const intentExample = { intent: 'landscape.path.lay', points: [[-5, 3.2], [-5, -1.2], [-3.4, -3.6], [2.8, -5.5]], width: 1.6, surface: 'gravel', consequences: [{ intent: 'layout.opening.cut', kind: 'door', host: 'b1', at: 4 }, { intent: 'landscape.path.crossing', as: 'bridge' }, { intent: 'layout.opening.cut', kind: 'gate', host: 'w8', at: 3.5 }] };

    root.innerHTML = `<article class="sheet">
      <header class="sh-hero">
        <div class="sh-dockmark">${dockFamilies}</div>
        <h1>Say what you are making.</h1>
        <p class="lede">A World tool system for Biskiq where each tool names its intent, shows the result while you gesture, proposes its consequences where they happen, and commits one undo step you can still amend. This sheet is generated from the same registry as the interactive Stage.</p>
        <p class="sh-nav"><button data-view="stage">Open the Stage</button> <a href="#village/path">Try Path in the village</a> <a href="#gallery/art">Try Art in the gallery</a> <a href="#slope/building">Try Building on a slope</a></p>
      </header>

      <section><h2>Principles</h2><div class="principles">
        <div><h3>Name the intent</h3><p>Walls, Building, Path, Plants. The tool knows its target, so a shape key and a drag are enough.</p></div>
        <div><h3>Show the result, not a wireframe</h3><p>During the gesture you see the procedural result itself: walls rising, a roof forming, a ribbon on the ground.</p></div>
        <div><h3>Propose in place</h3><p>Doorways, steps, bridges and plinths appear as tokens where they will happen, before release.</p></div>
        <div><h3>Commit on release, amend after</h3><p>No confirm step. The tokens stay after release; changing one re-plans the same undo step.</p></div>
        <div><h3>Results are ordinary things</h3><p>A path’s doorway is an Opening. Erase the path and the opening stays, now just an opening.</p></div>
        <div><h3>Explicit relationships only</h3><p>Art hangs on its wall. A spot keeps aiming only when you choose it. A bench by a wall is placement, not attachment.</p></div>
        <div><h3>Refuse in words</h3><p>“Too close to the end of Wall 3.” The refused part turns red; nothing half-commits.</p></div>
        <div><h3>Every domain keeps its owner</h3><p>Build is Layout, Furnish is Scene, Landscape needs an owner. The Card always says which.</p></div>
      </div></section>

      <section><h2>The dock</h2>
        <p class="sec-lede">The lower working edge stays: dock, then the palette above it, then any Instrument. Families expand in place, one at a time; clicking a family re-arms the tool you last used in it. Letter keys arm any tool directly and open its family.</p>
        <div class="dock-compare">
          <figure>${dockFamilies}<figcaption><b>Families</b> (proposed). Three family keys keep the dock short; the open family shows its tools with its colour mark.</figcaption></figure>
          <figure>${dockFlat}<figcaption><b>Flat</b> (comparison). Every tool visible; scans well once learned, but it is twenty keys wide. Toggle it on the Stage from the top strip.</figcaption></figure>
        </div>
      </section>

      <section><h2>Tools</h2>
        ${FAMILIES.map((f) => `<h3 class="famh" style="--mark:${f.mark}">${icon(f.icon, 22)} ${f.name} <span>${esc(f.blurb)}</span><em class="${/Needs/.test(f.owner) ? 'needs' : ''}">${f.owner}</em></h3><table class="tools">${thead}<tbody>${toolRows(f)}</tbody></table>`).join('')}
        <h3 class="famh" style="--mark:#f3f0e4">${icon('select', 22)} Utilities <span>Outside the families: they work on everything.</span></h3><table class="tools">${thead}<tbody>${utilRows}</tbody></table>
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

      <section><h2>Icons</h2><p class="sec-lede">One 24 px grid, 1.5 px strokes, round caps; drawn for the forest dock and reused on paper.</p><div class="icons">${Object.keys(ICONS).map((k) => `<figure>${icon(k, 24)}<figcaption>${k}</figcaption></figure>`).join('')}</div></section>
    </article>`;
  },
};
