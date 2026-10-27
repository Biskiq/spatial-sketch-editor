<script lang="ts">
  import { onMount } from 'svelte';
  import {
    arrange, createBand, defaultArrangeParams, deleteGuide, detach, followAgain, guideInUse, insertGuidePoint, isFollowing,
    moveGuidePoint, removeGuidePoint, renameGuide, setBandSize, setEntrance, setGuide, setNotes, setPiecePose, type ArrangeParams,
  } from './model/commands';
  import { briefChecks, evaluate } from './model/evaluate';
  import { parse, serialize } from './model/file';
  import { DEFAULT_BAND, ENTRANCE_LABEL, freshFixture } from './model/fixture';
  import { Session } from './model/session';
  import type { E0Document, Pose, Vec2 } from './model/types';
  import Viewport, { type CameraRequest, type Gesture, type PointerMode, type Selection, type ViewMode } from './viewport/Viewport.svelte';

  type Path = 'spatial' | 'explicit';
  type Panel = { kind: 'edge'; width: number; height: number; source: string | null } | { kind: 'arrange'; params: ArrangeParams; source: string | null };

  const session = new Session(freshFixture());
  let version = $state(0);
  session.subscribe(() => version++);

  let path = $state<Path>('spatial');
  let briefOpen = $state(true);
  let selection = $state<Selection>(null);
  /** Spatial path: the guide stays the active working context across selection changes. Never saved. */
  let context = $state(false);
  /** Explicit path: guide handles opened from an inspector's Edit guide. */
  let guideEditing = $state(false);
  let mode = $state<PointerMode>('select');
  let drawPoints = $state<Vec2[]>([]);
  let borrowOrder = $state<string[]>([]);
  let lastBorrowOrder = $state<string[] | null>(null);
  let panel = $state<Panel | null>(null);
  let view = $state<ViewMode>('3d');
  let cameraRequest = $state<CameraRequest>({ kind: 'fit', n: 0 });
  let notice = $state<{ kind: 'info' | 'refusal'; text: string } | null>(null);
  let mainReference = $state<Pose | null>(null);
  let fileInput: HTMLInputElement;

  // Derived view of the session (version makes Svelte re-read the plain class).
  const accepted = $derived.by(() => (void version, session.doc));
  const draft = $derived.by(() => (void version, session.draft));
  const shown = $derived.by(() => (void version, session.shown));
  const acceptedEv = $derived(evaluate(accepted));
  const shownEv = $derived(evaluate(shown));
  // An invalid draft keeps showing accepted results for anything it could not evaluate.
  const renderEv = $derived(draft?.error ? { ...shownEv, bandOutline: shownEv.bandOutline ?? (shown.band ? acceptedEv.bandOutline : null), pieces: shownEv.slots || !shown.arrangement ? shownEv.pieces : acceptedEv.pieces } : shownEv);
  const renderDoc = $derived(draft?.error && !shownEv.bandOutline && shown.band ? { ...shown, band: accepted.band } : shown);
  // Any refused draft shows its guide in the refusal colour: band and arrangement failures come from its shape.
  const guideInvalid = $derived(!!draft?.error && shownEv.errors.some((e) => e.target !== 'document'));
  const checks = $derived(briefChecks(shown, renderEv, mainReference));
  const epoch = $derived.by(() => (void version, session.epoch));
  const canUndo = $derived.by(() => (void version, session.canUndo));
  const canRedo = $derived.by(() => (void version, session.canRedo));

  const guide = $derived(shown.guide);
  const selectedPiece = $derived.by(() => {
    const sel = selection;
    return sel?.kind === 'piece' ? shown.pieces.find((p) => p.id === sel.id) ?? null : null;
  });
  const selectedMember = $derived(selectedPiece ? shown.arrangement?.members.find((m) => m.pieceId === selectedPiece.id) ?? null : null);
  const selectedPose = $derived(selectedPiece ? renderEv.pieces.find((p) => p.id === selectedPiece.id)!.pose : null);
  const showGuideHandles = $derived(!!guide && mode === 'select' && (path === 'spatial' ? context : guideEditing || selection?.kind === 'guide'));
  const scope = $derived(!!guide && (path === 'spatial' ? context : guideEditing || selection?.kind === 'guide' || !!panel));

  const deg = (r: number) => Math.round(((r * 180) / Math.PI) * 10) / 10;
  const rad = (d: number) => (d * Math.PI) / 180;
  const fmt = (v: number) => (Math.round(v * 1000) / 1000).toString();
  const pieceName = (id: string) => shown.pieces.find((p) => p.id === id)?.name ?? id;

  function say(text: string, kind: 'info' | 'refusal' = 'info') {
    notice = { kind, text };
  }

  // ---- panel previews ----------------------------------------------------------

  function panelOp(doc: E0Document): E0Document {
    if (!panel || !panel.source || !doc.guide) return doc;
    return panel.kind === 'edge' ? createBand(doc, panel.width, panel.height) : arrange(doc, panel.params);
  }
  const panelLabel = () => (panel?.kind === 'edge' ? 'Create edge' : shown.arrangement || accepted.arrangement ? 'Re-arrange (replaces all three slots)' : 'Arrange');

  function refreshPanel() {
    if (panel?.source && accepted.guide) session.preview(panelOp(accepted), panelLabel());
    else if (draft) session.cancel();
  }

  function openPanel(kind: 'edge' | 'arrange') {
    exitModes();
    session.interrupt();
    // Unambiguous source prefill: there is at most one guide, and an active context or selection names it.
    const source = accepted.guide ? accepted.guide.id : null;
    if (kind === 'edge') {
      if (accepted.band) return say('This document already has its display edge. Select it to edit its size or its shared guide.', 'refusal');
      panel = { kind, width: DEFAULT_BAND.width, height: DEFAULT_BAND.height, source };
    } else {
      panel = { kind, params: defaultArrangeParams(accepted, accepted.arrangement ? undefined : lastBorrowOrder ?? undefined), source };
    }
    refreshPanel();
  }

  function acceptPanel() {
    if (!panel) return;
    if (!panel.source) return say('Choose the guide this should be built from.', 'refusal');
    refreshPanel();
    const kind = panel.kind;
    const follow = panel.kind === 'arrange' && panel.params.follow;
    if (session.commitDraft()) {
      panel = null;
      if (kind === 'edge') {
        selection = { kind: 'band' };
        say('Display edge created. Editing its guide reshapes it.');
      } else {
        say(follow ? 'Pieces now follow the guide. Moving one breaks following for that piece only.' : 'Pieces placed at the guide positions as free poses; nothing follows the guide.');
      }
    }
  }

  function closePanel() {
    panel = null;
    session.interrupt();
    version++;
  }

  // ---- guide creation ------------------------------------------------------------

  function startDraw() {
    if (accepted.guide && guideInUse(accepted)) return say(`The guide is in use by ${guideInUse(accepted)}. Edit it instead; replacing an in-use guide is outside this prototype.`, 'refusal');
    exitModes();
    if (!panel) session.interrupt();
    mode = 'draw';
    drawPoints = [];
    version++;
  }

  function finishDraw() {
    if (drawPoints.length < 2) return say('Click at least two floor points, then press Enter.', 'refusal');
    acceptGuide(drawPoints, 'Guide drawn');
  }

  function startBorrow() {
    if (accepted.guide && guideInUse(accepted)) return say(`The guide is in use by ${guideInUse(accepted)}. Borrowing replaces a guide, which is outside this prototype for an in-use guide.`, 'refusal');
    exitModes();
    if (!panel) session.interrupt();
    mode = 'borrow';
    borrowOrder = [];
    version++;
  }

  function useBorrowed() {
    if (borrowOrder.length !== 3) return say('Select all three pieces in the order the guide should pass through them.', 'refusal');
    const positions = borrowOrder.map((id) => {
      const p = acceptedEv.pieces.find((q) => q.id === id)!.pose;
      return [p.x, p.z] as Vec2;
    });
    const order = [...borrowOrder];
    if (acceptGuide(positions, 'Positions borrowed')) lastBorrowOrder = order;
  }

  function acceptGuide(points: Vec2[], label: string): boolean {
    const r = setGuide(accepted, points, accepted.guide?.name ?? 'Display guide');
    if ('refused' in r) {
      say(r.refused, 'refusal');
      return false;
    }
    if (!session.apply(r, label)) {
      say(`Can't accept this guide: ${session.draft?.error}`, 'refusal');
      session.cancel();
      return false;
    }
    mode = 'select';
    drawPoints = [];
    borrowOrder = [];
    if (path === 'spatial') {
      context = true;
      selection = null;
      say(`${label}. It is now your working context: make the edge or arrange pieces along it, or drag its points.`);
    } else {
      selection = { kind: 'guide' };
      say(`${label}. It is selected; Create edge or Arrange can use it as their source.`);
    }
    if (panel) {
      panel.source = accepted.guide!.id;
      refreshPanel();
    }
    return true;
  }

  function exitModes() {
    mode = 'select';
    drawPoints = [];
    borrowOrder = [];
  }

  // ---- gestures and edits -----------------------------------------------------------

  function applyGesture(doc: E0Document, g: Gesture): E0Document {
    switch (g.type) {
      case 'move-piece': return setPiecePose(doc, g.id, { x: g.x, z: g.z });
      case 'rotate-piece': return setPiecePose(doc, g.id, { yaw: g.yaw });
      case 'move-point': return moveGuidePoint(doc, g.id, g.x, g.z);
      case 'band-width': return setBandSize(doc, { width: g.width });
      case 'band-height': return setBandSize(doc, { height: g.height });
    }
  }

  function gestureLabel(g: Gesture): string {
    if (g.type === 'move-piece' || g.type === 'rotate-piece') {
      const verb = g.type === 'move-piece' ? 'move' : 'turn';
      return isFollowing(accepted, g.id) ? `Break following and ${verb} ${pieceName(g.id)} (other pieces stay)` : `${verb[0].toUpperCase()}${verb.slice(1)} ${pieceName(g.id)}`;
    }
    if (g.type === 'move-point') return 'Edit shared guide';
    return 'Resize display edge';
  }

  function onGesture(g: Gesture, phase: 'preview' | 'commit', ep: number) {
    // A rejected draft stays editable: later gestures continue from it.
    const base = draft?.error && !panel ? draft.doc : accepted;
    const candidate = applyGesture(base, g);
    if (phase === 'preview') {
      session.preview(panel ? panelOp(candidate) : candidate, gestureLabel(g), ep);
      return;
    }
    session.preview(candidate, gestureLabel(g), ep);
    if (session.commitDraft(ep)) {
      if (panel) refreshPanel();
      notice = null;
    }
  }

  function edit(doc: E0Document | { refused: string }, label: string) {
    if ('refused' in doc) return say(doc.refused, 'refusal');
    if (session.apply(doc, label)) {
      if (panel) refreshPanel();
      notice = null;
    }
  }

  /** Numeric field: commit on Enter or blur, Escape restores. */
  function numberField(node: HTMLInputElement, onCommit: (v: number) => void) {
    let commitFn = onCommit;
    const commitValue = () => {
      const v = Number(node.value);
      if (node.value.trim() === '' || !Number.isFinite(v)) return say('Enter a number.', 'refusal');
      if (node.dataset.initial !== node.value) {
        node.dataset.initial = node.value;
        commitFn(v);
      }
    };
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        commitValue();
        node.blur();
      } else if (e.key === 'Escape') {
        node.value = node.dataset.initial ?? node.value;
        node.blur();
        e.stopPropagation();
      }
    };
    const focus = () => (node.dataset.initial = node.value);
    node.addEventListener('keydown', keydown);
    node.addEventListener('change', commitValue);
    node.addEventListener('focus', focus);
    return {
      update(next: (v: number) => void) {
        commitFn = next;
      },
      destroy() {
        node.removeEventListener('keydown', keydown);
        node.removeEventListener('change', commitValue);
        node.removeEventListener('focus', focus);
      },
    };
  }

  function editSharedGuide() {
    if (!accepted.guide) return;
    exitModes();
    if (path === 'spatial') context = true;
    else guideEditing = true;
    say('Editing the shared guide: highlighted results will follow. Drag points, double-click the guide to insert one.');
  }

  function switchEntrance() {
    const next = accepted.entrance === 'south' ? 'east' : 'south';
    if (next === 'east') mainReference = { ...acceptedEv.pieces.find((p) => accepted.pieces.find((q) => q.id === p.id)!.main)!.pose };
    edit(setEntrance(accepted, next), 'Switch entrance');
    say(`${ENTRANCE_LABEL[next]}. Nothing was rearranged${next === 'east' ? '; the main piece pose is recorded for the check' : ''}.`);
  }

  // ---- file, reset, path ---------------------------------------------------------------

  function interruptAll() {
    session.interrupt();
    exitModes();
    panel = null;
    version++;
  }

  function save() {
    const blob = new Blob([serialize(accepted)], { type: 'application/json' });
    const a = document.createElement('a');
    const t = new Date();
    const stamp = `${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}`;
    a.href = URL.createObjectURL(blob);
    a.download = `e0-${path}-${accepted.entrance === 'south' ? 'A' : 'B'}-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    say(`Saved accepted design as ${a.download}.`);
  }

  async function open(file: File) {
    const r = parse(await file.text());
    if ('error' in r) return say(`Couldn't open ${file.name}: ${r.error}`, 'refusal');
    interruptAll();
    session.replace(r.doc);
    selection = null;
    context = false;
    guideEditing = false;
    mainReference = null;
    lastBorrowOrder = null;
    say(`Opened ${file.name}. History starts fresh from this file.`);
  }

  function reset() {
    if (session.canUndo && !confirm('Start again from the supplied fixture? Unsaved work will be replaced (Save first to keep it).')) return;
    interruptAll();
    session.replace(freshFixture());
    selection = null;
    context = false;
    guideEditing = false;
    mainReference = null;
    lastBorrowOrder = null;
    cameraRequest = { kind: 'fit', n: cameraRequest.n + 1 };
    say('Fresh fixture: three pieces, no guide or edge.');
  }

  function setPath(next: Path) {
    if (next === path) return;
    interruptAll();
    path = next;
    context = false;
    guideEditing = false;
    say(next === 'spatial' ? 'Spatial idea first: draw or borrow a guide; it stays your working context.' : 'Explicit controls: use Create edge and Arrange, choosing their source guide.');
  }

  function doUndo() {
    panel = null;
    exitModes();
    session.undo();
  }
  function doRedo() {
    panel = null;
    exitModes();
    session.redo();
  }

  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      if (e.shiftKey) doRedo();
      else doUndo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y' && !typing) {
      e.preventDefault();
      doRedo();
      return;
    }
    if (typing || briefOpen) return;
    if (e.key === 'Enter' && mode === 'draw') finishDraw();
    else if (e.key === 'Enter' && mode === 'borrow') useBorrowed();
    else if (e.key === 'Backspace' && mode === 'draw') drawPoints = drawPoints.slice(0, -1);
    else if (e.key === 'Escape') {
      if (draft && !panel) {
        session.interrupt();
        version++;
        say('Change cancelled; accepted work is unchanged.');
      } else if (mode !== 'select') {
        exitModes();
        if (panel) refreshPanel();
      } else if (panel) closePanel();
      else if (context) {
        context = false;
        say('Context cleared.');
      } else if (guideEditing) guideEditing = false;
      else selection = null;
    }
  }

  onMount(() => {
    window.__e0 = Object.assign((window.__e0 as object) ?? {}, {
      state: () => ({ doc: session.doc, shown: session.shown, ev: evaluate(session.shown), draft: session.draft, epoch: session.epoch, history: session.history.past.length }),
    });
  });
</script>

<svelte:window onkeydown={onKey} />

<div class="shell">
  <header class="topbar">
    <div class="brand">
      <strong>E0 Spatial Playground</strong>
      <small>disposable experiment · not product</small>
    </div>
    <div class="seg" role="group" aria-label="Entry path">
      <button class:on={path === 'spatial'} onclick={() => setPath('spatial')}>Spatial idea first</button>
      <button class:on={path === 'explicit'} onclick={() => setPath('explicit')}>Explicit controls</button>
    </div>
    <div class="actions">
      <button onclick={doUndo} disabled={!canUndo && !draft} title="Undo (⌘Z)">Undo</button>
      <button onclick={doRedo} disabled={!canRedo} title="Redo (⇧⌘Z)">Redo</button>
      <span class="sep"></span>
      <button onclick={save}>Save</button>
      <button onclick={() => fileInput.click()}>Open</button>
      <button onclick={reset}>Reset</button>
      <button onclick={() => (briefOpen = true)}>Brief</button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={(e) => {
        const f = (e.currentTarget as HTMLInputElement).files?.[0];
        if (f) open(f);
        (e.currentTarget as HTMLInputElement).value = '';
      }} />
    </div>
  </header>

  <main class="workspace">
    <aside class="panel left">
      {#if path === 'spatial'}
        <h2>Start from a spatial idea</h2>
        <p class="hint">Sketch the line your display should follow, or capture it from where you've placed the pieces. It stays your working context while you make the edge and arrange.</p>
        <button class="big" class:on={mode === 'draw'} onclick={startDraw}>Sketch a guide <small>click floor points · Enter finishes</small></button>
        <button class="big" class:on={mode === 'borrow'} onclick={startBorrow}>Borrow placed positions <small>pick the 3 pieces in order</small></button>
        {#if guide}
          <div class="ctx-card" class:on={context}>
            <div><span class="dot"></span>{guide.name}</div>
            {#if context}
              <button onclick={() => (context = false)}>Clear context</button>
            {:else}
              <button onclick={() => (context = true)}>Work along it</button>
            {/if}
          </div>
        {/if}
      {:else}
        <h2>Tools</h2>
        <p class="hint">Create the display edge or arrange pieces, choosing the guide each one is built from.</p>
        <div class="tool-group">
          <span class="label">Guide</span>
          <button class:on={mode === 'draw'} onclick={startDraw}>Draw guide</button>
          <button class:on={mode === 'borrow'} onclick={startBorrow}>Borrow positions</button>
        </div>
        <div class="tool-group">
          <span class="label">Build</span>
          <button class:on={panel?.kind === 'edge'} onclick={() => openPanel('edge')} disabled={!!accepted.band}>Create edge…</button>
          <button class:on={panel?.kind === 'arrange'} onclick={() => openPanel('arrange')}>{accepted.arrangement ? 'Re-arrange…' : 'Arrange…'}</button>
        </div>
      {/if}

      {#if mode === 'draw'}
        <div class="mode-card">
          <strong>Drawing guide</strong> — {drawPoints.length} point{drawPoints.length === 1 ? '' : 's'}
          <p>Click floor points. Backspace removes the last; Escape cancels.</p>
          <div class="row"><button class="primary" disabled={drawPoints.length < 2} onclick={finishDraw}>Finish (Enter)</button><button onclick={exitModes}>Cancel</button></div>
        </div>
      {:else if mode === 'borrow'}
        <div class="mode-card">
          <strong>Borrow positions</strong> — {borrowOrder.length}/3
          <p>Click the pieces in the order the guide should pass through them. This copies their centres once; moving pieces later won't move the guide.</p>
          <ol>{#each borrowOrder as id}<li>{pieceName(id)}</li>{/each}</ol>
          <div class="row">
            <button class="primary" disabled={borrowOrder.length !== 3} onclick={useBorrowed}>Use positions</button>
            <button onclick={() => (borrowOrder = [])} disabled={!borrowOrder.length}>Clear</button>
            <button onclick={exitModes}>Cancel</button>
          </div>
        </div>
      {/if}

      {#if panel}
        <div class="tool-panel">
          <h3>{panel.kind === 'edge' ? 'Create display edge' : accepted.arrangement ? 'Re-arrange pieces' : 'Arrange pieces'}</h3>
          <label class="field">
            <span>{path === 'spatial' ? 'Along' : 'Source guide'}</span>
            <select value={panel.source ?? ''} onchange={(e) => { panel!.source = (e.currentTarget as HTMLSelectElement).value || null; refreshPanel(); }}>
              <option value="">Choose a guide…</option>
              {#if accepted.guide}<option value={accepted.guide.id}>{accepted.guide.name}</option>{/if}
            </select>
          </label>
          {#if !accepted.guide}
            <div class="row"><button onclick={startDraw}>Draw new</button><button onclick={startBorrow}>Borrow positions</button></div>
          {:else if path === 'explicit'}
            <div class="row"><button class:on={mode === 'pick-source'} onclick={() => (mode = mode === 'pick-source' ? 'select' : 'pick-source')}>Pick in viewport</button></div>
          {/if}
          {#if panel.kind === 'edge'}
            <label class="field"><span>Width (m)</span><input type="number" step="0.05" value={panel.width} oninput={(e) => { (panel as { width: number }).width = Number((e.currentTarget as HTMLInputElement).value); refreshPanel(); }} /></label>
            <label class="field"><span>Height (m)</span><input type="number" step="0.05" value={panel.height} oninput={(e) => { (panel as { height: number }).height = Number((e.currentTarget as HTMLInputElement).value); refreshPanel(); }} /></label>
            <p class="promise">Edits to {accepted.guide?.name ?? 'the guide'} will reshape this edge.</p>
            <div class="row"><button class="primary" onclick={acceptPanel} disabled={!panel.source || !!draft?.error}>Create</button><button onclick={closePanel}>Cancel</button></div>
          {:else}
            {@const params = panel.params}
            <label class="field"><span>Start margin (m)</span><input type="number" step="0.05" min="0" value={params.startMargin} oninput={(e) => { params.startMargin = Number((e.currentTarget as HTMLInputElement).value); refreshPanel(); }} /></label>
            <label class="field"><span>End margin (m)</span><input type="number" step="0.05" min="0" value={params.endMargin} oninput={(e) => { params.endMargin = Number((e.currentTarget as HTMLInputElement).value); refreshPanel(); }} /></label>
            <label class="field"><span>Side offset (m)</span><input type="number" step="0.05" value={params.sideOffset} oninput={(e) => { params.sideOffset = Number((e.currentTarget as HTMLInputElement).value); refreshPanel(); }} /></label>
            <div class="order">
              <span>Order along guide</span>
              {#each params.order as id, i (id)}
                <div class="order-row">
                  <em>{i + 1}</em>{pieceName(id)}
                  <button aria-label="Move earlier" disabled={i === 0} onclick={() => { [params.order[i - 1], params.order[i]] = [params.order[i], params.order[i - 1]]; refreshPanel(); }}>↑</button>
                  <button aria-label="Move later" disabled={i === 2} onclick={() => { [params.order[i + 1], params.order[i]] = [params.order[i], params.order[i + 1]]; refreshPanel(); }}>↓</button>
                </div>
              {/each}
            </div>
            <label class="check"><input type="checkbox" checked={params.follow} onchange={(e) => { params.follow = (e.currentTarget as HTMLInputElement).checked; refreshPanel(); }} /> Follow guide <small>{params.follow ? 'guide edits move these pieces' : 'place once as free poses'}</small></label>
            {#if accepted.arrangement}<p class="promise">Applying replaces all three slots, including pieces you made independent.</p>{/if}
            <div class="row"><button class="primary" onclick={acceptPanel} disabled={!panel.source || !!draft?.error}>Apply</button><button onclick={closePanel}>Cancel</button></div>
          {/if}
        </div>
      {/if}

      <div class="nav">
        <span class="label">View</span>
        <div class="seg small">
          <button class:on={view === 'plan'} onclick={() => (view = 'plan')}>Plan</button>
          <button class:on={view === '3d'} onclick={() => (view = '3d')}>3D</button>
        </div>
        <button onclick={() => { view = '3d'; cameraRequest = { kind: 'entrance', n: cameraRequest.n + 1 }; }}>Entrance view</button>
        <button onclick={() => (cameraRequest = { kind: 'fit', n: cameraRequest.n + 1 })}>Fit view</button>
        <span class="label">Entrance</span>
        <button class="entrance" onclick={switchEntrance}>{ENTRANCE_LABEL[accepted.entrance]} <small>switch</small></button>
        <p class="hint tiny">Drag: orbit (3D) / pan (Plan) · Shift or right-drag: pan · wheel: zoom</p>
      </div>
    </aside>

    <section class="stage">
      <Viewport
        doc={renderDoc}
        ev={renderEv}
        {guideInvalid}
        {view}
        {cameraRequest}
        {selection}
        {scope}
        guideHandles={showGuideHandles}
        {mode}
        {drawPoints}
        {borrowOrder}
        {epoch}
        onSelect={(s) => { selection = s; if (s) notice = null; if (s?.kind === 'guide' && path === 'spatial') context = true; }}
        onDrawPoint={(p) => (drawPoints = [...drawPoints, p])}
        onBorrowPick={(id) => { if (!borrowOrder.includes(id) && borrowOrder.length < 3) borrowOrder = [...borrowOrder, id]; }}
        onPickGuide={() => { if (panel && accepted.guide) { panel.source = accepted.guide.id; mode = 'select'; refreshPanel(); } }}
        {onGesture}
        onInsertPoint={(i, at) => edit(insertGuidePoint(accepted, i, at), 'Insert guide point')}
      />
      {#if path === 'spatial' && context && guide && mode === 'select'}
        <div class="context-bar">
          <span class="dot"></span><span>Working along <strong>{guide.name}</strong></span>
          {#if !accepted.band}<button onclick={() => openPanel('edge')} class:on={panel?.kind === 'edge'}>Make edge along it</button>{/if}
          <button onclick={() => openPanel('arrange')} class:on={panel?.kind === 'arrange'}>{accepted.arrangement ? 'Re-arrange along it' : 'Arrange pieces along it'}</button>
          <button class="ghost" onclick={() => (context = false)}>Clear</button>
        </div>
      {/if}
      {#if mode === 'pick-source'}
        <div class="context-bar"><span>Click the guide (or a result built from it) to use it as the source.</span><button class="ghost" onclick={() => (mode = 'select')}>Cancel</button></div>
      {/if}
      {#if draft && (draft.error || !panel)}
        <div class="draft-bar" class:bad={!!draft.error}>
          {#if draft.error}
            <span><strong>Can't accept {draft.label.toLowerCase()}.</strong> {draft.error} Keep adjusting, or cancel to restore the accepted design.</span>
          {:else}
            <span><strong>Preview:</strong> {draft.label}. Release to accept, Escape to cancel.</span>
          {/if}
          <button onclick={() => { session.interrupt(); version++; if (panel) refreshPanel(); }}>Cancel</button>
        </div>
      {:else if notice}
        <div class="notice" class:bad={notice.kind === 'refusal'}><span>{notice.text}</span><button aria-label="Dismiss" onclick={() => (notice = null)}>×</button></div>
      {/if}
      <div class="view-tag">{view === 'plan' ? 'Plan' : '3D'} · {ENTRANCE_LABEL[accepted.entrance]}</div>
    </section>

    <aside class="panel right">
      {#if selectedPiece && selectedPose}
        <h2>{selectedPiece.name}{selectedPiece.main ? ' · focus piece' : ''}</h2>
        <p class="status">
          {#if selectedMember?.following}
            Following <strong>{guide?.name}</strong> · slot {selectedMember.slot + 1}
          {:else if selectedMember}
            Independent of {guide?.name} (slot {selectedMember.slot + 1} left open)
          {:else}
            Free placement
          {/if}
        </p>
        <div class="grid3">
          <label class="field"><span>X (m)</span><input type="number" step="0.05" value={fmt(selectedPose.x)} use:numberField={(v) => edit(setPiecePose(accepted, selectedPiece.id, { x: v }), 'Move')} /></label>
          <label class="field"><span>Z (m)</span><input type="number" step="0.05" value={fmt(selectedPose.z)} use:numberField={(v) => edit(setPiecePose(accepted, selectedPiece.id, { z: v }), 'Move')} /></label>
          <label class="field"><span>Turn (°)</span><input type="number" step="5" value={deg(selectedPose.yaw)} use:numberField={(v) => edit(setPiecePose(accepted, selectedPiece.id, { yaw: rad(v) }), 'Turn')} /></label>
        </div>
        {#if selectedMember?.following}
          <p class="hint">Moving or turning this piece breaks following for it only; the others keep their slots.</p>
          <div class="row">
            <button onclick={editSharedGuide}>Edit shared guide</button>
            <button onclick={() => edit(detach(accepted, selectedPiece.id), 'Break following')}>Break following</button>
          </div>
        {:else if selectedMember}
          <div class="row">
            <button onclick={() => edit(followAgain(accepted, selectedPiece.id), 'Follow again')}>Follow guide again</button>
            <button onclick={editSharedGuide}>Edit guide</button>
          </div>
        {/if}
        <p class="hint tiny">Drag the piece to move; drag the gold handle in front of it to turn (5° steps, Alt for 1°).</p>
      {:else if selection?.kind === 'band' && shown.band}
        <h2>Display edge</h2>
        <p class="status">Built from <strong>{guide?.name}</strong> · guide edits reshape it</p>
        <div class="grid2">
          <label class="field"><span>Width (m)</span><input type="number" step="0.05" value={fmt(shown.band.width)} use:numberField={(v) => edit(setBandSize(accepted, { width: v }), 'Resize display edge')} /></label>
          <label class="field"><span>Height (m)</span><input type="number" step="0.05" value={fmt(shown.band.height)} use:numberField={(v) => edit(setBandSize(accepted, { height: v }), 'Resize display edge')} /></label>
        </div>
        <div class="row"><button onclick={editSharedGuide}>Edit shared guide</button></div>
        <p class="hint tiny">Gold handles: top sets height, side sets width. Width and height are local to the edge.</p>
      {:else if !guide || !(showGuideHandles || selection?.kind === 'guide')}
        <h2>Nothing selected</h2>
        <p class="hint">Click a piece, the display edge or the guide. Pieces can always be dragged freely.</p>
      {/if}

      {#if guide && (showGuideHandles || selection?.kind === 'guide')}
        <div class="guide-card">
          <h2 aria-label="Guide name"><input class="name" aria-label="Guide name" value={guide.name} onchange={(e) => edit(renameGuide(accepted, (e.currentTarget as HTMLInputElement).value || 'Guide'), 'Rename guide')} /></h2>
          <p class="status">
            {#if shown.band || shown.arrangement}
              Shapes: {[shown.band ? 'display edge' : null, ...(shown.arrangement?.members.filter((m) => m.following).map((m) => pieceName(m.pieceId)) ?? [])].filter(Boolean).join(', ')}
              {#if shown.arrangement?.members.some((m) => !m.following)}<br />Not affected: {shown.arrangement.members.filter((m) => !m.following).map((m) => pieceName(m.pieceId)).join(', ')}{/if}
            {:else}
              Not used yet
            {/if}
            · {renderEv.guideLength?.toFixed(2) ?? '—'} m
          </p>
          <div class="points">
            {#each guide.points as p, i (p.id)}
              <div class="pt">
                <em>{i + 1}</em>
                <input type="number" step="0.05" aria-label="Point {i + 1} X" value={fmt(p.x)} use:numberField={(v) => edit(moveGuidePoint(accepted, p.id, v, p.z), 'Edit shared guide')} />
                <input type="number" step="0.05" aria-label="Point {i + 1} Z" value={fmt(p.z)} use:numberField={(v) => edit(moveGuidePoint(accepted, p.id, p.x, v), 'Edit shared guide')} />
                <button title="Remove point" disabled={guide.points.length <= 2} onclick={() => edit(removeGuidePoint(accepted, p.id), 'Remove guide point')}>−</button>
                <button title="Insert point after" disabled={i === guide.points.length - 1} onclick={() => edit(insertGuidePoint(accepted, i), 'Insert guide point')}>+</button>
              </div>
            {/each}
          </div>
          <div class="row">
            {#if path === 'explicit' && guideEditing}<button onclick={() => (guideEditing = false)}>Done editing</button>{/if}
            <button class="ghost danger" onclick={() => { const r = deleteGuide(accepted); if ('refused' in r) say(r.refused, 'refusal'); else { edit(r, 'Delete guide'); context = false; selection = null; } }}>Delete guide</button>
          </div>
        </div>
      {/if}

      <div class="checks">
        <h3>Brief checks <small>facts only; focus and coherence are your judgment</small></h3>
        {#each checks as c}
          <div class="check-row" class:ok={c.ok}><span>{c.ok ? '✓' : '✗'}</span>{c.label}{#if c.detail}<small>{c.detail}</small>{/if}</div>
        {/each}
      </div>
      <label class="notes">
        <span>Design notes (saved with the file)</span>
        <textarea rows="4" placeholder="Intended character, focus, the quality you want to preserve, compromises…" value={accepted.notes} onchange={(e) => edit(setNotes(accepted, (e.currentTarget as HTMLTextAreaElement).value), 'Edit notes')}></textarea>
      </label>
    </aside>
  </main>

  {#if briefOpen}
    <div class="modal-back">
      <div class="modal" role="dialog" aria-labelledby="brief-title">
        <h2 id="brief-title">The brief</h2>
        <blockquote>
          <p>Arrange a small exhibition of three pieces. Make the main piece the clear focus from the entrance, with two supporting pieces and a low continuous display edge that makes the collection feel intentional. Keep the display within the marked floor and the shaded arrival area clear. Choose an asymmetric layout you would actually want to show; the supporting pieces need not stay evenly spaced or identically oriented.</p>
          <p>After you are happy with it, the entrance moves to the adjacent side. Keep the main piece at its chosen position and orientation. Revise the rest so the collection still reads as one display from the new entrance and the new arrival area is clear. Preserve one other quality you value in your first design—such as openness, rhythm or a particular bend—and explain any compromise.</p>
        </blockquote>
        <p class="hint">The main piece is the tall red one with the gold top. Before you start, note the character you intend and the focus in Design notes. Save your first design before switching Entrance, and save the revision separately.</p>
        <div class="row">
          <button class:primary={path === 'spatial'} onclick={() => { setPath('spatial'); briefOpen = false; }}>Start: spatial idea first</button>
          <button class:primary={path === 'explicit'} onclick={() => { setPath('explicit'); briefOpen = false; }}>Start: explicit controls</button>
        </div>
      </div>
    </div>
  {/if}
</div>
