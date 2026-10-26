#!/usr/bin/env node

/**
 * Small real-browser smoke check for the Native Form Lab.
 *
 * Run from this prototype after a preview server is already listening:
 *   node qa/browser-check.mjs [http://127.0.0.1:4193/]
 *
 * The script owns one named agent-browser session and always closes only that
 * session. It never starts or stops the app server. Page evaluation is limited
 * to reading the QA snapshot and viewport bounds; all edits use UI controls,
 * keyboard input, or real pointer events.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const session = 'native-form-lab-check';
const here = dirname(fileURLToPath(import.meta.url));
const evidence = join(here, 'evidence');
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4193/';
const url = new URL(baseUrl);
url.searchParams.set('qa', '1');

function browser(args, input) {
  try {
    return execFileSync('agent-browser', ['--session', session, ...args], {
      cwd: here,
      encoding: 'utf8',
      input,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString?.().trim();
    const stdout = error?.stdout?.toString?.().trim();
    throw new Error(`agent-browser ${args.join(' ')} failed${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ''}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clickButton(name, exact = false) {
  browser(['find', 'role', 'button', 'click', '--name', name, ...(exact ? ['--exact'] : [])]);
}

function press(key) {
  browser(['press', key]);
}

function wait(ms = 120) {
  browser(['wait', String(ms)]);
}

function unwrapEval(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Could not parse browser evaluation output: ${raw.slice(0, 300)}`);
  }
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
        continue;
      } catch {
        break;
      }
    }
    if (value && typeof value === 'object') {
      if (value.committed && value.shown && value.viewport) return value;
      if ('result' in value) { value = value.result; continue; }
      if ('value' in value) { value = value.value; continue; }
      if ('data' in value) { value = value.data; continue; }
    }
    break;
  }
  throw new Error(`QA snapshot not available; preview must be built with the QA flag. Output: ${raw.slice(0, 300)}`);
}

function snapshot() {
  const raw = browser(
    ['eval', '--stdin', '--json'],
    `JSON.stringify({ ...window.__nativeFormLab.snapshot(), viewportRect: document.querySelector('[aria-label="Interactive 3D form viewport"]').getBoundingClientRect().toJSON() })`,
  );
  return unwrapEval(raw);
}

function add(a, b) { return a.map((n, i) => n + b[i]); }
function sub(a, b) { return a.map((n, i) => n - b[i]); }
function scale(a, k) { return a.map((n) => n * k); }
function dot(a, b) { return a.reduce((sum, n, i) => sum + n * b[i], 0); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function unit(a) {
  const length = Math.hypot(...a);
  assert(length > 1e-8, 'Cannot project using a zero-length camera axis.');
  return scale(a, 1 / length);
}

function project(world, state) {
  const camera = state.viewport.camera;
  const rect = state.viewportRect;
  assert(camera && rect?.width > 0 && rect?.height > 0, 'Viewport camera or bounds are unavailable.');
  const forward = unit(sub(camera.target, camera.position));
  const right = unit(cross(forward, camera.up));
  const up = unit(cross(right, forward));
  const relative = sub(world, camera.position);
  const depth = dot(relative, forward);
  assert(depth > 0.1, 'Target point is behind the viewport camera.');
  const tangent = Math.tan((camera.fov * Math.PI) / 360);
  const aspect = rect.width / rect.height;
  const ndcX = dot(relative, right) / (depth * tangent * aspect);
  const ndcY = dot(relative, up) / (depth * tangent);
  return {
    x: rect.left + ((ndcX + 1) * rect.width) / 2,
    y: rect.top + ((1 - ndcY) * rect.height) / 2,
  };
}

function pointerClick(point) {
  browser(['mouse', 'move', String(Math.round(point.x)), String(Math.round(point.y))]);
  wait(70);
  browser(['mouse', 'down', 'left']);
  browser(['mouse', 'up', 'left']);
  wait();
}

function pointerDrag(from, to) {
  browser(['mouse', 'move', String(from.clientX ?? Math.round(from.x)), String(from.clientY ?? Math.round(from.y))]);
  wait(60);
  browser(['mouse', 'down', 'left']);
  browser(['mouse', 'move', String(Math.round(to.x)), String(Math.round(to.y))]);
  wait(140);
}

function currentForm(state, formId = state.selected.formId) {
  return state.shown.forms.find((form) => form.id === formId);
}

function heightOf(form) {
  return form?.operation?.kind === 'extrude' ? form.operation.height : NaN;
}

function profileCenterWorld(form) {
  const count = form.profile.points.length;
  const local = form.profile.points.reduce((sum, point) => [sum[0] + point.position[0] / count, sum[1] + point.position[1] / count], [0, 0]);
  return add(add(form.frame.origin, scale(form.frame.u, local[0])), scale(form.frame.v, local[1]));
}

function capture(name) {
  mkdirSync(evidence, { recursive: true });
  browser(['screenshot', join(evidence, name)]);
  console.log(`  screenshot: ${join('qa', 'evidence', name)}`);
}

let opened = false;
try {
  let reused = false;
  try {
    browser(['session', 'info', '--json']);
    reused = true;
  } catch {
    // No previous task-owned session. Opening below creates this session.
  }
  browser(['open', url.toString()]);
  opened = true;
  browser(['wait', '--load', 'networkidle']);
  assert(browser(['get', 'title']).includes('Native Form Lab'), 'Native Form Lab page did not load.');
  console.log(`Session: ${session} (${reused ? 'reused task-owned session' : 'new task-owned session'})`);

  // Journey 1: Draw is an actual pointer workflow, Escape cancels, and one
  // accepted drawing creates one authored form.
  clickButton('Blank form');
  clickButton('Draw D');
  let state = snapshot();
  const draftCorners = [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]];
  pointerClick(project([draftCorners[0][0], 0, -draftCorners[0][1]], state));
  state = snapshot();
  assert(state.drawing.points.length === 1, 'First pointer click did not place the first ground profile point.');
  press('Escape');
  state = snapshot();
  assert(state.drawing.points.length === 0 && state.committed.forms.length === 0, 'Escape did not cancel the blank profile draft.');

  clickButton('Draw D');
  state = snapshot();
  for (const [u, v] of draftCorners) pointerClick(project([u, 0, -v], state));
  state = snapshot();
  assert(state.drawing.points.length >= 3, 'Pointer profile did not collect at least three points.');
  clickButton('Create form');
  state = snapshot();
  assert(state.committed.forms.length === 1, 'Create form did not commit the drawn profile.');
  assert(state.committed.forms[0].operation.kind === 'extrude', 'New profile did not start as an extruded form.');
  capture('01-blank-profile.png');
  console.log('PASS blank profile: first point, Escape cancel, four-point draw, Create form.');

  // Journey 2: contextual height handle previews and commits through the same
  // model, undo restores it, and the preset marker follows the cap on a later
  // accepted height edit and survives local save/reload.
  clickButton('Custom pedestal');
  wait(220);
  state = snapshot();
  let form = currentForm(state);
  assert(form && form.operation.kind === 'extrude', 'Custom pedestal journey did not select an extruded form.');
  const formId = form.id;
  const initialHeight = heightOf(form);
  const initialAttachment = state.committed.attachments.find((item) => item.target.formId === formId);
  assert(initialAttachment?.status === 'resolved', 'Pedestal journey did not create its resolved marker.');
  const heightHandle = state.viewport.handles.find((handle) => handle.kind === 'height' && handle.formId === formId);
  assert(heightHandle?.screen, 'Pedestal height handle is missing.');
  const targetHeight = initialHeight + 0.5;
  const targetWorld = add(profileCenterWorld(form), scale(form.frame.normal, targetHeight));
  const targetScreen = project(targetWorld, state);
  pointerDrag(heightHandle.screen, targetScreen);
  const preview = snapshot();
  assert(heightOf(currentForm(preview, formId)) > initialHeight + 0.2, 'Dragging the height ray did not preview a taller form.');
  browser(['mouse', 'up', 'left']);
  wait();
  const afterDrag = snapshot();
  assert(heightOf(currentForm(afterDrag, formId)) > initialHeight + 0.2, 'Releasing the height ray did not commit the preview.');
  press('Control+z');
  wait();
  state = snapshot();
  form = currentForm(state, formId);
  assert(Math.abs(heightOf(form) - initialHeight) < 1e-6, 'Undo did not restore the pedestal height.');

  browser(['find', 'label', 'Pull height', 'fill', '1.65']);
  press('Tab');
  wait();
  state = snapshot();
  form = currentForm(state, formId);
  const movedAttachment = state.committed.attachments.find((item) => item.id === initialAttachment.id);
  assert(Math.abs(heightOf(form) - 1.65) < 1e-6, 'Typed height edit was not committed.');
  assert(movedAttachment?.status === 'resolved' && movedAttachment.lastFrame.origin.some((value, i) => Math.abs(value - initialAttachment.lastFrame.origin[i]) > 0.2), 'Marker pose did not follow the moved cap.');

  browser(['find', 'label', 'Corner radius', 'fill', '2']);
  press('Tab');
  state = snapshot();
  assert(Math.abs(currentForm(state, formId).rounding.radius - 0.11) < 1e-6, 'Refused corner radius changed authored geometry.');
  assert(state.status.toLowerCase().includes('overlap'), 'Refused corner radius did not explain the adjacent-corner overlap.');

  clickButton('Save locally');
  browser(['reload']);
  browser(['wait', '--load', 'networkidle']);
  state = snapshot();
  assert(state.committed.forms.length === 0, 'A page reload did not return to a fresh in-memory document before local reload.');
  clickButton('File ⌄', true);
  browser(['find', 'role', 'menuitem', 'click', '--name', 'Load local draft']);
  wait(180);
  state = snapshot();
  form = state.committed.forms.find((item) => item.id === formId);
  const reloadedAttachment = state.committed.attachments.find((item) => item.id === initialAttachment.id);
  assert(Math.abs(heightOf(form) - 1.65) < 1e-6, 'Local save/reload did not preserve the accepted form edit.');
  assert(reloadedAttachment?.status === 'resolved', 'Local save/reload did not preserve the marker address.');
  assert(Math.abs(reloadedAttachment.lastFrame.origin[1] - movedAttachment.lastFrame.origin[1]) < 1e-6, 'Local save/reload changed the marker pose.');
  capture('02-pedestal-marker-reload.png');
  console.log('PASS pedestal: height drag preview/commit, undo, marker follows typed height, radius refusal, local save/reload.');

  // Journey 3: a partial revolve cap has a finite lifetime; its marker stays
  // unresolved when that face retires and is not attached to the new cap.
  clickButton('Turned ornament');
  state = snapshot();
  const ornament = currentForm(state);
  assert(ornament?.operation.kind === 'revolve', 'Turned ornament journey did not select a revolve form.');
  const ornamentId = ornament.id;
  browser(['find', 'label', 'Turn angle', 'fill', '270']);
  press('Tab');
  wait();
  state = snapshot();
  const partial = currentForm(state, ornamentId);
  assert(partial?.operation.kind === 'revolve' && partial.revolveCapLifetimeKeys, 'The 270° form did not allocate partial-cap keys.');
  const firstCapKeys = { ...partial.revolveCapLifetimeKeys };
  // On the 270° end plane, this radial/height point lies inside the sampled
  // ornament section while staying off its axis and rim.
  const endCapPoint = [0, 0.62, 0.2];
  pointerClick(project(endCapPoint, state));
  state = snapshot();
  assert(state.selected.formId === ornamentId && state.selected.roleKey, 'Pointer selection did not address a generated revolve cap.');
  const selectedAddress = JSON.parse(state.selected.roleKey);
  assert(selectedAddress[1] === firstCapKeys.end, 'The projected cap point did not select the 270° end cap.');
  clickButton('Attach marker');
  state = snapshot();
  const revolveMarker = state.committed.attachments.find((item) => item.target.kind === 'form-role' && item.target.formId === ornamentId && item.target.partKey === firstCapKeys.end);
  assert(revolveMarker?.status === 'resolved', 'The 270° end cap marker was not created.');
  browser(['find', 'label', 'Turn angle', 'fill', '360']);
  press('Tab');
  wait();
  state = snapshot();
  assert(state.committed.attachments.find((item) => item.id === revolveMarker.id)?.status === 'unresolved', 'The old cap marker did not become unresolved at 360°.');
  browser(['find', 'label', 'Turn angle', 'fill', '270']);
  press('Tab');
  wait();
  state = snapshot();
  const returned = currentForm(state, ornamentId);
  assert(returned?.operation.kind === 'revolve' && returned.revolveCapLifetimeKeys, 'Returning to 270° did not create partial caps.');
  assert(!Object.values(returned.revolveCapLifetimeKeys).includes(firstCapKeys.end), 'The returning cap silently reused the retired end-cap key.');
  assert(state.committed.attachments.find((item) => item.id === revolveMarker.id)?.status === 'unresolved', 'The old marker silently reattached to a new cap.');
  capture('03-revolve-cap-lifetime.png');
  console.log('PASS revolve identity: actual cap pick, marker, 270° → 360° → 270° with a fresh cap address.');

  // Journey 4: revise a keyed carrier anchor with the actual pointer, then
  // reverse its authored traversal while keeping its physical anchor ID.
  clickButton('Room trim');
  wait(220);
  state = snapshot();
  const trim = currentForm(state);
  assert(trim?.operation.kind === 'sweep', 'Room trim journey did not select a sweep form.');
  const trimId = trim.id;
  const anchoredId = trim.operation.carrier.frameAnchorPointId;
  const movable = trim.operation.carrier.points.find((point) => point.id !== anchoredId);
  const movableHandle = state.viewport.handles.find((handle) => handle.kind === 'carrier-point' && handle.formId === trimId && handle.pointId === movable?.id);
  assert(movable && movableHandle?.screen, 'Room trim has no visible non-anchor carrier handle.');
  const draggedPoint = add(movable.position, [0.2, 0, 0]);
  pointerDrag(movableHandle.screen, project(draggedPoint, state));
  browser(['mouse', 'up', 'left']);
  wait();
  const afterCarrierDrag = snapshot();
  const editedTrim = currentForm(afterCarrierDrag, trimId);
  assert(editedTrim?.operation.kind === 'sweep', 'Carrier drag changed the selected operation unexpectedly.');
  const editedPoint = editedTrim.operation.carrier.points.find((point) => point.id === movable.id);
  assert(editedPoint && Math.abs(editedPoint.position[0] - movable.position[0]) > 0.05, 'Pointer drag did not revise the selected carrier point.');
  const beforeReverse = structuredClone(editedTrim.operation.carrier);
  clickButton('Reverse carrier direction');
  state = snapshot();
  const reversedTrim = currentForm(state, trimId);
  assert(reversedTrim?.operation.kind === 'sweep', 'Carrier reversal changed the selected operation unexpectedly.');
  assert(reversedTrim.operation.carrier.frameAnchorPointId === anchoredId, 'Carrier reversal changed the fixed frame-anchor identity.');
  assert(reversedTrim.operation.carrier.points.map((point) => point.id).join('|') === beforeReverse.points.map((point) => point.id).reverse().join('|'), 'Carrier reversal did not reverse keyed point traversal.');
  assert(reversedTrim.operation.carrier.points.every((point, index) => JSON.stringify(point.position) === JSON.stringify(beforeReverse.points.at(-1 - index)?.position)), 'Carrier reversal changed an authored point position.');
  assert(reversedTrim.operation.carrier.segments.map((segment) => segment.id).join('|') === beforeReverse.segments.map((segment) => segment.id).reverse().join('|'), 'Carrier reversal did not preserve/reverse explicit segment keys.');
  console.log('PASS sweep revision: pointer carrier edit and reverse preserve point/segment keys and fixed anchor ID.');
  console.log('Browser workflow check passed.');
} finally {
  // Close only the session named and owned by this runner; never close all.
  try {
    browser(['close']);
    if (opened) console.log(`Closed owned browser session: ${session}`);
  } catch {
    // Cleanup is best-effort when the CLI could not create a session.
  }
}
