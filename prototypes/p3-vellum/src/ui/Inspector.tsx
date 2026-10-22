// A plain-language card for whatever is picked: what it is, how tall in people, and what it remembers.
import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { store } from '../store';
import { app, liveProps } from './ctx';
import { derive, elementName, openingKind, stairMode, coverGroup, DRoom, Derived } from '../model/derive';
import { findEl } from '../model/types';
import type { Run, Opening, RoomSeed, Overhead, Deck, Void, Stair, Post, Obj, Project } from '../model/types';
import { fmtM, inPeople, polyArea } from '../model/geom2d';
import { runGeom, runLabel, closestOnRun } from '../model/runs';
import { lvl } from '../model/settle';
import { stairSteps } from '../model/settle';
import { describeProfile, ohRidge, ohHasSurface, ProfilePreset } from '../model/overheadGeom';
import {
  opRoom, opConfirmRoom, opAddFloorAbove, opRunPatch, opRunTop, opAddOpening, openingDefaults, opOpening, opOverhead, opDeck, opVoid, opStair, opObj,
  opRemove, removalReach, opCoverRooms, coverCheck, isRoundish, opProject, opAddMezzanine, opAddStairTo, Op, OBJ_NAMES, runTxn,
} from '../model/ops';
import { qualifyRidgeTurn } from '../model/roofEdits';
import { mezzanineOffer, stairCandidates } from '../model/offers';
import { joinCheck, joinNeighbours, opJoinRoofs } from '../model/roofJoin';
import { surfaceName } from '../scene/interact';
import { SectionThumb, ShapeCard } from './SectionSheet';
import { enterShaping } from './shaping';
import { detachImport } from '../import/importer';
import { IClose, ITrash } from './icons';

const Slider = (pr: { label: string; value: number; min: number; max: number; step?: number; fmt?: (v: number) => string; people?: boolean; commit: string; make: (v: number) => Op; disabled?: boolean }) => (
  <div class="sec">
    <label>{pr.label}</label>
    <div class="slider">
      <input type="range" min={pr.min} max={pr.max} step={pr.step ?? 0.05} value={pr.value} disabled={pr.disabled} {...liveProps(pr.commit, pr.make)} />
      <span class="val">{(pr.fmt ?? fmtM)(pr.value)}</span>
    </div>
    {pr.people && <div class="people">{inPeople(pr.value)}</div>}
  </div>
);

const Sec = ({ label, children }: { label?: string; children: ComponentChildren }) => (
  <div class="sec">
    {label && <span class="lab">{label}</span>}
    {children}
  </div>
);

function Remember({ items }: { items: { text: string; on?: boolean; toggle?: () => void; knot?: boolean; untie?: () => void; join?: () => void }[] }) {
  if (!items.length) return null;
  return (
    <Sec label="What it remembers">
      <ul class="remember">
        {items.map((i) => (
          <li>
            {i.knot ? <i class="knot" /> : i.toggle ? <input type="checkbox" checked={i.on} onChange={i.toggle} /> : <i class="knot" style={{ borderColor: 'var(--ink-2)' }} />}
            <span style={{ flex: 1 }}>{i.text}</span>
            {i.untie && (
              <button class="btn small blue" onClick={i.untie}>
                Untie
              </button>
            )}
            {i.join && (
              <button class="btn small blue" title="It will follow that wall when the wall moves" onClick={i.join}>
                Join
              </button>
            )}
          </li>
        ))}
      </ul>
    </Sec>
  );
}

function RemoveRow({ id, label }: { id: string; label?: string }) {
  const p = store.project;
  const reach = store.ui.removePreview?.[0] === id ? store.ui.removePreview.slice(1) : null;
  const names = reach ? [...new Set(reach.map((r) => elementName(p, r)))] : [];
  return (
    <div class="sec">
      <div class="remove-row">
        <span class="note">Removing never deletes anything else silently.</span>
        <button
          class="btn small red outline"
          onPointerEnter={() => store.set({ removePreview: [id, ...removalReach(p, [id])] })}
          onPointerLeave={() => store.set({ removePreview: null })}
          onClick={() => {
            store.set({ removePreview: null });
            store.commit(`Removed ${elementName(p, id)}`, opRemove([id]));
          }}
        >
          <ITrash /> {label ?? 'Remove'}
        </button>
      </div>
      {reach && (
        <div class="reach">
          {names.length ? <>Would touch, in red: {names.join(', ')}. You'll see each consequence and can repair it.</> : <>Nothing else leans on it.</>}
        </div>
      )}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Head({ kind, name: raw, rename, onClose }: { kind: string; name: string; rename?: (v: string) => void; onClose?: () => void }) {
  const name = cap(raw);
  return (
    <>
      <div class="kind" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{kind}</span>
        <button class="btn small" style={{ marginTop: '-6px', marginRight: '-6px' }} onClick={onClose ?? (() => store.select(null))} title="Done (Esc)">
          <IClose />
        </button>
      </div>
      <h3>
        {rename ? (
          <input
            key={name}
            defaultValue={name}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onBlur={(e) => {
              const v = (e.target as HTMLInputElement).value.trim();
              if (v && v !== name) rename(v);
            }}
          />
        ) : (
          name
        )}
      </h3>
    </>
  );
}

// ------------------------------------------------------------------ per kind
function RoomCard({ s, dr, dc, p }: { s: RoomSeed; dr: DRoom | undefined; dc: Derived; p: Project }) {
  const parent = s.inheritedFrom ? p.rooms.find((r) => r.id === s.inheritedFrom) : null;
  // what the chips offer is read from the committed project, never from `dr`: a hover preview already contains the
  // roof (or deck) being offered, so reading it here would make the chip under the pointer vanish before the click
  const committed = dc.roomById.get(s.id);
  const covered = committed?.coveredBy ? p.overheads.find((o) => o.id === committed.coveredBy) : null;
  const round = dr ? isRoundish(dr.poly) : false;
  // one cover can reach the rooms a wall actually joins, so the reach is named before it is accepted
  const group = coverGroup(dc, s.id);
  const names = group.map((id) => dc.roomById.get(id)?.name ?? '').filter(Boolean);
  const [only, setOnly] = useState(false);
  const targets = only || group.length < 2 ? [s.id] : group;
  // a preset that cannot carry this group is not offered: the chip, its preview and its commit all ask the same
  // question, so a refusal is never a click that silently does nothing
  const presets: ProfilePreset[] = round ? ['flat', 'dome', 'gable'] : ['flat', 'raked', 'gable', 'clerestory', 'vault'];
  const checks = useMemo(() => {
    const out = new Map<ProfilePreset, ReturnType<typeof coverCheck>>();
    for (const k of presets) out.set(k, coverCheck(p, targets, k));
    return out;
  }, [p, s.id, only, group.length, round]);
  const mezz = useMemo(
    () => (covered ? mezzanineOffer(p, s.id) : { candidates: [], why: '' }),
    [p, s.id, !!covered],
  );
  return (
    <>
      <Head kind="Room" name={s.name} rename={(v) => store.commit(`Renamed ${s.name} to ${v}`, opRoom(s.id, { name: v }))} />
      <div class="facts">
        <span class="num">{dr ? `${dr.area.toFixed(1)} m²` : ''}</span> · floor at <span class="num">{fmtM(s.floorY, 2)}</span> · {s.height.toFixed(1)} m tall, {inPeople(s.height)}
        {covered ? <> · under {covered.name}</> : <> · open to the sky</>}
      </div>
      <div class="row" style={{ marginTop: '8px' }}>
        {/* hovering shows the storey in place; clicking makes it, as one step (the walls then come selected to reshape) */}
        <button
          class="btn small outline"
          title="A floor at this room's top, with walls along its outline and a room as tall as this one. Nothing is tied to the room below."
          onPointerEnter={() => !store.ui.dragging && store.setPreview(opAddFloorAbove(s.id))}
          onPointerLeave={() => store.setPreview(null)}
          onClick={() => {
            store.setPreview(null);
            store.commit(`Added a floor above ${s.name}`, opAddFloorAbove(s.id));
          }}
        >
          + Add a floor above
        </button>
      </div>
      {parent && (
        <div class="note pencil">
          Borrowed from <b>{parent.name}</b> when you divided it — in pencil until you confirm.{' '}
          <button class="btn small blue" onClick={() => store.commit(`Confirmed ${s.name}`, opConfirmRoom(s.id))}>
            Keep these settings
          </button>
        </div>
      )}
      <Slider label="Ceiling height" value={s.height} min={1.8} max={10} commit={`Changed ${s.name}'s height`} make={(v) => opRoom(s.id, { height: v })} people />
      <Slider
        label="Floor (a plinth if raised, a sunken court if lowered)"
        value={s.floorY}
        min={s.level - 2.4}
        max={s.level + 2.5}
        fmt={(v) => (v >= 0 ? '+' : '') + v.toFixed(2) + ' m'}
        commit={`Moved ${s.name}'s floor`}
        make={(v) => opRoom(s.id, { floorY: v })}
      />
      <Sec label="Ceiling">
        <div class="chips">
          <button class={'chip' + (s.ceiling === 'flat' ? ' on' : '')} onClick={() => store.commit(`Flat ceiling in ${s.name}`, opRoom(s.id, { ceiling: 'flat' }))} title="A flat ceiling at the room's height, whatever the roof does">
            Flat at {fmtM(s.height)}
          </button>
          <button class={'chip' + (s.ceiling === 'follow' ? ' on' : '')} onClick={() => store.commit(`${s.name} opens up to the roof`, opRoom(s.id, { ceiling: 'follow' }))} title="No ceiling — the room rises into the roof">
            Open to the roof
          </button>
        </div>
      </Sec>
      {!covered && (
        <Sec label={targets.length === 2 ? `Cover ${names.join(' and ')}` : targets.length > 2 ? `Cover all ${targets.length} rooms` : 'Cover it'}>
          <div class="chips">
            {presets.map((k) => {
              const check = checks.get(k)!;
              return (
                <button
                  class="chip pencil"
                  disabled={!check.ok}
                  title={!check.ok ? `No ${k} roof over ${targets.length > 1 ? 'these rooms' : s.name}: ${check.reason}` : targets.length > 1 ? `One roof over ${names.join(', ')}` : `A ${k} roof over ${s.name}`}
                  onPointerEnter={() => check.ok && store.setPreview(opCoverRooms(targets, k))}
                  onPointerLeave={() => store.setPreview(null)}
                  onClick={() => {
                    store.setPreview(null);
                    if (!check.ok) return;
                    store.commit(targets.length > 1 ? `Covered ${names.join(', ')}` : `Covered ${s.name}`, opCoverRooms(targets, k));
                  }}
                >
                  {k === 'gable' && round ? 'cone' : k}
                </button>
              );
            })}
            {group.length > 1 && (
              <button class={'chip' + (only ? ' on' : '')} onClick={() => setOnly(!only)} title={`Cover ${s.name} on its own`}>
                Only {s.name}
              </button>
            )}
          </div>
          <div class="note" style={{ marginTop: '4px' }}>
            Or pull the sheet to “{s.name} top” and draw the outline yourself.
          </div>
        </Sec>
      )}
      {covered && (
        <Sec label="Inside">
          {mezz.candidates.length > 0 ? (
            <div class="row" style={{ flexWrap: 'wrap', gap: '4px' }}>
              <button
                class="btn small outline"
                title={`2.40 m clear below · at least ${mezz.candidates[0].above.toFixed(2)} m clear above`}
                onPointerEnter={() => store.setPreview(opAddMezzanine(s.id, mezz.candidates[0]))}
                onPointerLeave={() => store.setPreview(null)}
                onClick={() => {
                  store.setPreview(null);
                  store.commit(`Added a mezzanine in ${s.name}`, opAddMezzanine(s.id, mezz.candidates[0]));
                }}
              >
                + Add a mezzanine
              </button>
              {mezz.candidates.slice(1).map((c) => (
                <button
                  class="chip pencil"
                  title="Another qualified placement, in this same step"
                  onPointerEnter={() => store.setPreview(opAddMezzanine(s.id, c))}
                  onPointerLeave={() => store.setPreview(null)}
                  onClick={() => {
                    store.setPreview(null);
                    store.commit(`Added a mezzanine in ${s.name}`, opAddMezzanine(s.id, c));
                  }}
                >
                  {c.area.toFixed(0)} m²
                </button>
              ))}
            </div>
          ) : (
            <div class="note">{mezz.why || 'No mezzanine fits here.'} <span>Draw one on the sheet instead.</span></div>
          )}
        </Sec>
      )}
      <Remember
        items={[
          { text: 'Its name, height and ceiling — through divides and merges' },
          ...p.decks.filter((d) => d.restsOn === s.id).map((d) => ({ text: `${d.name} rests on its ceiling`, knot: true, untie: () => store.commit(`Untied ${d.name}`, opDeck(d.id, { restsOn: null })) })),
          ...p.overheads.filter((o) => o.restsOn?.includes(s.id)).map((o) => ({ text: `${o.name} rests on its walls`, knot: true, untie: () => store.commit(`Untied ${o.name}`, opOverhead(o.id, { restsOn: null })) })),
        ]}
      />
      <RemoveRow id={s.id} label="Remove room" />
    </>
  );
}

function bestGap(p: Project, r: Run): number {
  const d = derive(p);
  const w = d.walls.get(r.id);
  const L = runGeom(r).L;
  const taken = (w?.openings ?? []).map((o) => [o.s0, o.s1] as [number, number]).sort((a, b) => a[0] - b[0]);
  let prev = 0, best = L / 2, bw = -1;
  for (const [a, b] of [...taken, [L, L] as [number, number]]) {
    if (a - prev > bw) {
      bw = a - prev;
      best = (prev + a) / 2;
    }
    prev = Math.max(prev, b);
  }
  return best;
}

function RunCard({ r, p }: { r: Run; p: Project }) {
  const g = runGeom(r);
  const d = derive(p);
  const w = d.walls.get(r.id);
  const ops = p.openings.filter((o) => o.run === r.id);
  const curved = r.bulge.some((b) => Math.abs(b) > 0.02);
  const host = (t: Run['tieA']) => (t ? elementName(p, t.host) : '');
  // an end that only touches another wall (snapped there, never joined): joining is offered, never assumed
  const touching = (end: 'A' | 'B') => {
    if (r.shape !== 'path' || r.closed || (end === 'A' ? r.tieA : r.tieB)) return null;
    const e = end === 'A' ? r.pts[0] : r.pts[r.pts.length - 1];
    for (const o of p.runs) {
      if (o.id === r.id || lvl(o.baseY) !== lvl(r.baseY)) continue;
      const c = closestOnRun(o, e);
      if (c.d < 0.03) return { host: o.id, t: c.t };
    }
    return null;
  };
  const touchA = touching('A'), touchB = touching('B');
  return (
    <>
      <Head kind={runLabel({ ...r, name: undefined })} name={elementName(p, r.id)} rename={(v) => store.commit(`Named the wall ${v}`, opRunPatch(r.id, { name: v }))} />
      <div class="facts">
        <span class="num">{fmtM(g.L)}</span> long{r.shape === 'circle' ? `, ${fmtM(r.radius * 2)} across` : curved ? ', curved' : ''} · <span class="num">{Math.round(r.thick * 100)} cm</span> thick
        {w ? <> · up to {fmtM(w.maxTop - r.baseY)}</> : null}
      </div>
      <Sec label="Height">
        <div class="chips">
          <button class={'chip' + (r.top === null ? ' on' : '')} onClick={() => store.commit('Wall rises to its rooms', opRunTop(r.id, null))} title="Follows the rooms on either side and the roof above">
            Rises to its rooms
          </button>
          <button class={'chip' + (r.top !== null ? ' on' : '')} onClick={() => r.top === null && store.commit('Made it a low wall', opRunTop(r.id, 1.1))}>
            Low wall
          </button>
        </div>
      </Sec>
      {r.top !== null && <Slider label="Low wall height" value={r.top} min={0.2} max={4} commit="Changed the wall's height" make={(v) => opRunTop(r.id, v)} people />}
      <Slider label="Thickness" value={r.thick} min={0.08} max={0.8} step={0.01} fmt={(v) => `${Math.round(v * 100)} cm`} commit="Changed the wall's thickness" make={(v) => opRunPatch(r.id, { thick: v })} />
      <Sec label="Add an opening (or draw one on its face)">
        <div class="chips">
          {(['door', 'arch', 'window', 'round', 'pointed'] as const).map((k) => (
            <button class="chip" onClick={() => store.commit(`Added ${k === 'round' ? 'a round window' : k === 'arch' ? 'an arch' : 'a ' + k}`, opAddOpening(r.id, bestGap(p, r), openingDefaults(k)))}>
              {k}
            </button>
          ))}
        </div>
      </Sec>
      <Remember
        items={[
          ...(r.shape === 'circle' ? [{ text: 'Round stays round — one continuous wall' }] : []),
          ...(curved ? [{ text: 'Its curves keep their bend as the ends move' }] : []),
          ...ops.map((o) => ({ text: `${o.name ?? openingKind(o)}: ${o.anchor === 'ratio' ? 'keeps its place along the wall' : o.anchor === 'start' ? 'measured from the start' : 'measured from the end'}` })),
          ...(r.tieA ? [{ text: `Start tied to ${host(r.tieA)}`, knot: true, untie: () => store.commit('Untied the wall', opRunPatch(r.id, { tieA: null })) }] : []),
          ...(r.tieB ? [{ text: `End tied to ${host(r.tieB)}`, knot: true, untie: () => store.commit('Untied the wall', opRunPatch(r.id, { tieB: null })) }] : []),
          ...(touchA ? [{ text: `Start touches ${host(touchA)} (not joined)`, join: () => store.commit(`Joined to ${host(touchA)}`, opRunPatch(r.id, { tieA: touchA })) }] : []),
          ...(touchB ? [{ text: `End touches ${host(touchB)} (not joined)`, join: () => store.commit(`Joined to ${host(touchB)}`, opRunPatch(r.id, { tieB: touchB })) }] : []),
        ]}
      />
      <RemoveRow id={r.id} label="Remove wall" />
    </>
  );
}

function OpeningCard({ o, p }: { o: Opening; p: Project }) {
  const d = derive(p);
  const dop = d.walls.get(o.run)?.openings.find((x) => x.o.id === o.id);
  const curved = o.shape === 'arch' || o.shape === 'pointed';
  return (
    <>
      <Head kind={`Opening in ${elementName(p, o.run)}`} name={o.name ?? openingKind(o)} rename={(v) => store.commit(`Named it ${v}`, opOpening(o.id, { name: v }))} />
      <div class="facts">
        <span class="num">{fmtM(o.width)}</span> wide · top at <span class="num">{fmtM(o.height)}</span>
        {o.sill > 0.05 ? <> · sill {fmtM(o.sill)}</> : null}
        {dop && !dop.fits && <div class="note red">It {dop.why}. Slide it, shrink it — or set it aside from the loose ends.</div>}
      </div>
      <Sec label="Shape">
        <div class="chips">
          {(['rect', 'arch', 'round', 'pointed'] as const).map((k) => (
            <button class={'chip' + (o.shape === k ? ' on' : '')} onClick={() => store.commit(`Made it ${k === 'rect' ? 'square-headed' : k}`, opOpening(o.id, { shape: k, rise: k === 'arch' ? o.width / 2 : k === 'pointed' ? o.width * 0.7 : o.rise, ...(k === 'round' ? { sill: Math.max(o.sill, 1) } : {}) }))}>
              {k === 'rect' ? 'square' : k}
            </button>
          ))}
        </div>
      </Sec>
      <Slider label="Width" value={o.width} min={0.4} max={8} commit="Changed the width" make={(v) => opOpening(o.id, { width: v })} />
      {o.shape !== 'round' && <Slider label="Top" value={o.height} min={Math.max(0.6, o.sill + 0.4)} max={9} commit="Changed the height" make={(v) => opOpening(o.id, { height: v })} people />}
      <Slider label="Sill (0 = a doorway)" value={o.sill} min={0} max={Math.max(0.1, o.height - 0.4)} commit="Changed the sill" make={(v) => opOpening(o.id, { sill: v, ...(o.shape === 'round' ? { height: v + o.width } : {}) })} />
      {curved && <Slider label="Arch rise" value={o.rise} min={0.1} max={o.shape === 'arch' ? o.width / 2 : o.width} commit="Changed the arch" make={(v) => opOpening(o.id, { rise: v })} />}
      <Sec label="When the wall changes, it…">
        <div class="chips">
          {(
            [
              ['ratio', 'keeps its place'],
              ['start', 'stays near the start'],
              ['end', 'stays near the end'],
            ] as const
          ).map(([k, l]) => (
            <button class={'chip' + (o.anchor === k ? ' on' : '')} onClick={() => store.commit(`Opening ${l}`, opOpening(o.id, { anchor: k }))}>
              {l}
            </button>
          ))}
        </div>
      </Sec>
      <Remember items={[{ text: 'Stays person-sized when the building is scaled', on: o.keepSize, toggle: () => store.commit(o.keepSize ? 'It may scale now' : 'It keeps its size', opOpening(o.id, { keepSize: !o.keepSize })) }]} />
      <RemoveRow id={o.id} />
    </>
  );
}

function OverheadCard({ oh, p }: { oh: Overhead; p: Project }) {
  const authored = store.project.overheads.find((o) => o.id === oh.id) ?? oh;
  const tied = oh.restsOn?.length ? oh.restsOn.map((id) => elementName(p, id)) : null;
  const fitNames = oh.fit ? oh.fit.rooms.map((id) => elementName(p, id)).join(', ') : '';
  const coveredIds = derive(p).rooms.filter((r) => r.coveredBy === oh.id).map((r) => r.id);
  const round = isRoundish(oh.outline);
  const turn = qualifyRidgeTurn(store.project, authored.id);
  const turnOp = turn.op;
  const turnReason = turn.reason;
  // offered only with roofs that meet this one, and read from the committed project, so a hover preview never hides
  // the very chip under the pointer
  const joins = useMemo(
    () => joinNeighbours(store.project, authored.id).map((other) => ({ other, check: joinCheck(store.project, authored.id, other.id) })),
    [store.project, authored.id],
  );
  return (
    <>
      <Head kind={`Overhead · ${describeProfile(oh)}`} name={oh.name} rename={(v) => store.commit(`Renamed it ${v}`, opOverhead(oh.id, { name: v }))} />
      <div class="facts">
        Covers <span class="num">{Math.abs(polyArea(oh.outline)).toFixed(0)} m²</span> · eave at <span class="num">{fmtM(oh.baseY)}</span>
        {ohHasSurface(oh)
          ? <> · highest point <span class="num">{fmtM(ohRidge(oh))}</span></>
          : <> · <span class="num">no surface</span> — see the note on the roof</>}
      </div>
      <div class="note" style={{ marginTop: '6px' }}>Hold the ridge, a slope, an end or an edge. Use the section below for detailed profile editing.</div>
      {turn.available && (
        <div class="row" style={{ marginTop: '8px' }}>
          <button
            class="btn small outline"
            disabled={!!turnReason || !turnOp}
            title={turnReason || 'Turn the ridge to the next direction supported by this outline'}
            onPointerEnter={() => !store.ui.dragging && !turnReason && turnOp && store.setPreview(turnOp)}
            onPointerLeave={() => !store.ui.dragging && store.setPreview(null)}
            onFocus={() => !store.ui.dragging && !turnReason && turnOp && store.setPreview(turnOp)}
            onBlur={() => !store.ui.dragging && store.setPreview(null)}
            onClick={() => {
              store.setPreview(null);
              if (!turnReason && turnOp) store.commit(`Turned ${authored.name}’s ridge`, turnOp);
            }}
          >Turn the ridge · R</button>
        </div>
      )}
      {joins.length > 0 && (
        <div class="row" style={{ marginTop: '8px', flexWrap: 'wrap', gap: '6px' }}>
          {joins.map(({ other, check }) => (
            <button
              key={other.id}
              class="btn small outline"
              disabled={!check.ok}
              title={check.ok ? `One roof over both, at ${authored.name}'s pitch, with a valley where they meet` : `Can't join: ${check.reason}`}
              onPointerEnter={() => !store.ui.dragging && check.ok && store.setPreview(opJoinRoofs(authored.id, other.id, check.merged))}
              onPointerLeave={() => !store.ui.dragging && store.setPreview(null)}
              onFocus={() => !store.ui.dragging && check.ok && store.setPreview(opJoinRoofs(authored.id, other.id, check.merged))}
              onBlur={() => !store.ui.dragging && store.setPreview(null)}
              onClick={() => {
                store.setPreview(null);
                if (check.ok) store.commit(`Joined ${other.name} into ${authored.name}`, opJoinRoofs(authored.id, other.id, check.merged));
              }}
            >Join with {other.name}</button>
          ))}
        </div>
      )}
      <Sec label="Section">
        <SectionThumb oh={oh} />
        <div class="row" style={{ marginTop: '8px' }}>
          <button class="btn small blue" onClick={() => enterShaping(oh.id)} title="Shape the section, with the building behind it">
            Edit shape
          </button>
        </div>
        <div class="note" style={{ marginTop: '6px' }}>Or double-click the roof, or press Enter while it is selected.</div>
      </Sec>
      <details class="more">
        <summary>Settings</summary>
        {round && (
          <div class="chips" style={{ marginTop: '8px' }}>
            <button class={'chip' + (oh.form === 'extrude' ? ' on' : '')} onClick={() => store.commit('Spanned it one way', opOverhead(oh.id, { form: 'extrude' }))}>
              Spans one way
            </button>
            <button
              class={'chip' + (oh.form === 'revolve' ? ' on' : '')}
              disabled={oh.oneSpan === false}
              title={oh.oneSpan === false ? 'Only an extruded section can cover several wings' : 'A dome over this outline'}
              onClick={() => oh.oneSpan !== false && store.commit('Spun it round', opOverhead(oh.id, { form: 'revolve' }))}
            >
              Spins round
            </button>
          </div>
        )}
        {oh.form === 'extrude' && (
          <Slider label="Span direction" value={((oh.dir * 180) / Math.PI + 360) % 180} min={0} max={179} step={1} fmt={(v) => `${Math.round(v)}°`} commit="Turned the span" make={(v) => opOverhead(oh.id, { dir: (v * Math.PI) / 180 })} />
        )}
        <Slider
          label={tied ? 'Eave (moving it unties it)' : 'Eave'}
          value={oh.baseY}
          min={1}
          max={14}
          commit={`Moved ${oh.name}`}
          make={(v) => opOverhead(oh.id, { baseY: v, ...(tied ? { restsOn: null } : {}) })}
          people
        />
        {oh.fit ? (
          <Slider label="Overhang past the walls" value={oh.fit.overhang} min={0} max={1.5} step={0.05} fmt={(v) => `${Math.round(v * 100)} cm`} commit="Changed the overhang" make={(v) => opOverhead(oh.id, { fit: { ...oh.fit!, overhang: v } })} />
        ) : coveredIds.length ? (
          <div class="row" style={{ marginTop: '8px' }}>
            <button class="btn small outline" title="Fit the outline to the rooms under it again, so it follows their walls" onClick={() => store.commit(`Fitted ${oh.name} to its walls`, opOverhead(oh.id, { fit: { rooms: coveredIds, overhang: 0.3 } }))}>
              Fit to the walls below
            </button>
          </div>
        ) : null}
        <Slider label="Thickness" value={oh.thick} min={0.05} max={0.8} step={0.01} fmt={(v) => `${Math.round(v * 100)} cm`} commit="Changed the thickness" make={(v) => opOverhead(oh.id, { thick: v })} />
      </details>
      <Remember
        items={[
          ...(tied ? [{ text: `Rests on ${tied.join(', ')} — follows if they change`, knot: true, untie: () => store.commit(`Untied ${oh.name}`, opOverhead(oh.id, { restsOn: null })) }] : [{ text: 'Its own height — not tied to any room' }]),
          ...(oh.fit ? [{ text: `Fits ${fitNames}'s walls — follows when they grow or move`, knot: true, untie: () => store.commit(`${oh.name} keeps its outline`, opOverhead(oh.id, { fit: null })) }] : [{ text: 'Its own outline — it stays as drawn' }]),
          { text: 'Sharp creases stay sharp; smooth points stay smooth' },
        ]}
      />
      <RemoveRow id={oh.id} />
    </>
  );
}

function DeckCard({ dk, p }: { dk: Deck; p: Project }) {
  const host = dk.restsOn ? elementName(p, dk.restsOn) : null;
  const hasStair = p.stairs.some((st) => st.to.kind === 'deck' && st.to.id === dk.id);
  const plans = useMemo(() => (hasStair ? [] : stairCandidates(p, dk.id)), [p, dk.id, hasStair]);
  return (
    <>
      <Head kind={dk.bridge ? 'Bridge' : 'Floor in the air'} name={dk.name} rename={(v) => store.commit(`Renamed it ${v}`, opDeck(dk.id, { name: v }))} />
      <div class="facts">
        <span class="num">{Math.abs(polyArea(dk.outline)).toFixed(1)} m²</span> at <span class="num">{fmtM(dk.y)}</span>, {inPeople(dk.y)} up
      </div>
      <Slider label={host ? 'Height (moving it unties it)' : 'Height'} value={dk.y} min={0.3} max={14} commit={`Moved ${dk.name}`} make={(v) => opDeck(dk.id, { y: v })} people />
      {plans.length > 0 && (
        <Sec label="Getting up here">
          <button
            class="btn small outline"
            title={`A ${plans[0].width.toFixed(2)} m stair from the floor below, landing on this edge`}
            onPointerEnter={() => store.setPreview(opAddStairTo(dk.id, plans[0]))}
            onPointerLeave={() => store.setPreview(null)}
            onClick={() => {
              store.setPreview(null);
              store.commit(`Added a stair to ${dk.name}`, opAddStairTo(dk.id, plans[0]));
            }}
          >
            + Add a stair
          </button>
        </Sec>
      )}
      <Sec label="Edges">
        <div class="chips">
          <button class={'chip' + (dk.bridge ? ' on' : '')} onClick={() => store.commit(dk.bridge ? 'Made it a floor' : 'Made it a bridge', opDeck(dk.id, { bridge: !dk.bridge }))}>
            Bridge (rails both sides, needs no posts)
          </button>
        </div>
      </Sec>
      <Remember items={host ? [{ text: `Rests on ${host}'s ceiling — rises with it`, knot: true, untie: () => store.commit(`Untied ${dk.name}`, opDeck(dk.id, { restsOn: null })) }] : [{ text: 'Its own height — independent of the rooms below' }]} />
      <RemoveRow id={dk.id} />
    </>
  );
}

function VoidCard({ vd }: { vd: Void }) {
  return (
    <>
      <Head kind="Void" name={vd.name} rename={(v) => store.commit(`Renamed it ${v}`, opVoid(vd.id, { name: v }))} />
      <div class="facts">
        Cuts through every floor and roof from <span class="num">{fmtM(vd.fromY)}</span> to <span class="num">{vd.toY > 50 ? 'the sky' : fmtM(vd.toY)}</span>. Floors keep their own outlines — close it and they fill back in.
      </div>
      <Slider label="From" value={vd.fromY} min={-2} max={Math.min(vd.toY - 0.3, 14)} commit="Changed the void" make={(v) => opVoid(vd.id, { fromY: v })} />
      <Slider label="Up to" value={Math.min(vd.toY, 20)} min={vd.fromY + 0.3} max={20} fmt={(v) => (v >= 19.9 ? 'the sky' : fmtM(v))} commit="Changed the void" make={(v) => opVoid(vd.id, { toY: v >= 19.9 ? 99 : v })} />
      <RemoveRow id={vd.id} label="Close it" />
    </>
  );
}

function StairCard({ st, p }: { st: Stair; p: Project }) {
  const mode = stairMode(st);
  const rise = Math.abs(st.toY - st.fromY);
  const n = stairSteps(st.fromY, st.toY);
  return (
    <>
      <Head kind={mode === 'ramp' ? 'Ramp' : 'Stair'} name={st.name} rename={(v) => store.commit(`Renamed it ${v}`, opStair(st.id, { name: v }))} />
      <div class="facts">
        Rises <span class="num">{fmtM(rise, 2)}</span>
        {mode === 'stair' ? <> in {n} steps</> : null} · from {surfaceName(p, st.from)} to {surfaceName(p, st.to)}
      </div>
      <Sec label="It is a">
        <div class="chips">
          {(['auto', 'stair', 'ramp'] as const).map((k) => (
            <button class={'chip' + (st.mode === k ? ' on' : '')} onClick={() => store.commit(`Made it ${k === 'auto' ? 'choose itself' : 'a ' + k}`, opStair(st.id, { mode: k }))}>
              {k === 'auto' ? 'let it choose' : k}
            </button>
          ))}
        </div>
      </Sec>
      <Slider label="Width" value={st.width} min={0.7} max={4} commit="Changed the width" make={(v) => opStair(st.id, { width: v })} />
      <Remember items={[{ text: `Ties ${surfaceName(p, st.from)} to ${surfaceName(p, st.to)} — follows if either moves`, knot: true }]} />
      <RemoveRow id={st.id} />
    </>
  );
}

function ObjCard({ o, p }: { o: Obj; p: Project }) {
  return (
    <>
      <Head kind={OBJ_NAMES[o.type]} name={o.name} rename={(v) => store.commit(`Renamed it ${v}`, opObj(o.id, { name: v }))} />
      <div class="facts">On {surfaceName(p, o.on)}. Drag it anywhere — even through a cut-away to another level.</div>
      <Slider label="Turn" value={((o.rot * 180) / Math.PI + 360) % 360} min={0} max={359} step={1} fmt={(v) => `${Math.round(v)}°`} commit="Turned it" make={(v) => opObj(o.id, { rot: (v * Math.PI) / 180 })} />
      <RemoveRow id={o.id} />
    </>
  );
}

function PostCard({ po }: { po: Post }) {
  return (
    <>
      <Head kind="Post" name="Post" />
      <div class="facts">Holds up whatever is above it, from the floor below.</div>
      <Slider label="Size" value={po.size} min={0.1} max={0.8} step={0.01} fmt={(v) => `${Math.round(v * 100)} cm`} commit="Changed the post" make={(v) => (q) => void (q.posts.find((x) => x.id === po.id)!.size = v)} />
      <RemoveRow id={po.id} />
    </>
  );
}

function BuildingCard({ p }: { p: Project }) {
  const d = derive(p);
  const b = d.bounds;
  return (
    <>
      <Head kind="Whole building" name={p.name} />
      <div class="facts">
        {d.rooms.length} rooms · <span class="num">{fmtM(b.max[0] - b.min[0])}</span> × <span class="num">{fmtM(b.max[1] - b.min[1])}</span> · tallest point <span class="num">{fmtM(b.top)}</span>
      </div>
      <Sec label="Scale handle (blue, at the corner)">
        <div class="chips">
          <button class={'chip' + (!store.scaleHeights ? ' on' : '')} onClick={() => ((store.scaleHeights = false), store.emit())}>
            Plan only
          </button>
          <button class={'chip' + (store.scaleHeights ? ' on' : '')} onClick={() => ((store.scaleHeights = true), store.emit())}>
            With heights
          </button>
        </div>
      </Sec>
      <Remember
        items={[
          { text: 'Round rooms stay round' },
          { text: `Doors stay person-sized (${p.openings.filter((o) => o.keepSize).length} of ${p.openings.length} openings)` },
          { text: 'Arches stay centred where they were centred' },
          { text: 'Curves keep their bend' },
        ]}
      />
    </>
  );
}

function ImportCard({ p }: { p: Project }) {
  const im = p.imported!;
  const setDisplay = (display: 'solid' | 'underlay') =>
    store.commit(display === 'underlay' ? 'Turned the import into a tracing underlay' : 'Showed the import solid', (q) => {
      if (q.imported) q.imported.display = display;
    });
  return (
    <>
      <Head kind={`Imported · ${im.source === 'prepared' ? 'prepared example' : 'your file'}`} name={im.name} />
      <div class="facts">
        Fixed geometry from another tool. You can slice it, x-ray it, furnish it, walk it and tell its story — but not reshape it.
      </div>
      <Sec label="Show it as">
        <div class="chips">
          <button class={'chip' + (im.display === 'solid' ? ' on' : '')} onClick={() => setDisplay('solid')}>
            Solid model
          </button>
          <button class={'chip' + (im.display === 'underlay' ? ' on' : '')} onClick={() => setDisplay('underlay')}>
            Tracing underlay
          </button>
        </div>
      </Sec>
      <div class="note pencil" style={{ marginTop: '10px' }}>
        <b>To change part of it, trace over it.</b> Draw walls on top of the underlay with the pen — they become native: rooms, heights, openings and honest revision. Keep the import for what Biskiq can't make: ornament, detailed façades, terrain.
      </div>
      <div class="sec">
        <button
          class="btn small red outline"
          onClick={() => {
            store.commit(`Removed the import`, (q) => void (q.imported = null));
            detachImport(app.stage);
          }}
        >
          <ITrash /> Remove import
        </button>
      </div>
    </>
  );
}

export function Inspector() {
  const ui = store.ui;
  if (ui.mode !== 'make' || !ui.selection || ui.start) return null;
  // The card describes what is shown (so numbers follow a live drag), but the chips act on what is committed:
  // a hover preview is added to `shown`, and a chip that read it would hide itself under the pointer.
  const p = store.project;
  const shown = store.shown;
  const id = ui.selection;
  let body: any = null;
  if (id === 'building') body = <BuildingCard p={shown} />;
  else if (id === 'import') body = shown.imported ? <ImportCard p={shown} /> : null;
  else {
    const e = findEl(shown, id);
    if (!e) return null;
    const d = derive(shown);
    switch (e.kind) {
      case 'room': body = <RoomCard s={e} dr={d.roomById.get(e.id)} dc={derive(p)} p={p} />; break;
      case 'run': body = <RunCard r={e} p={shown} />; break;
      case 'opening': body = <OpeningCard o={e} p={shown} />; break;
      case 'overhead': body = ui.shaping === e.id ? <ShapeCard oh={e} /> : <OverheadCard oh={e} p={shown} />; break;
      case 'deck': body = <DeckCard dk={e} p={p} />; break;
      case 'void': body = <VoidCard vd={e} />; break;
      case 'stair': body = <StairCard st={e} p={shown} />; break;
      case 'obj': body = <ObjCard o={e} p={shown} />; break;
      case 'post': body = <PostCard po={e} />; break;
    }
  }
  if (!body) return null;
  return (
    <div class={'card inspector' + (ui.shaping ? ' shaping' : '')} onPointerDown={(e) => e.stopPropagation()}>
      {body}
      {app.ov?.handles.some((h) => h.tier === 'detail') && (
        <label class="all-points" title="Corners, bends and fine handles otherwise appear as the pointer comes near">
          <input type="checkbox" checked={ui.allHandles} onChange={() => store.set({ allHandles: !ui.allHandles })} /> Show every point
        </label>
      )}
    </div>
  );
}

