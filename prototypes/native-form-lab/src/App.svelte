<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Viewport, { type Workplane } from './viewport/Viewport.svelte';
  import { createCarrier, createFormLabStore, deserialize } from './model/store';
  import { createLabDocument, createProfile, roleKey } from './model/types';
  import type { Attachment, DocumentEvaluation, Form, FormDraft, Frame, GeneratedRole, HostTarget, LabCommand, LabDocument, SourceRoleKey, Vec2, Vec3 } from './model/types';
  import { evaluateDocument } from './geometry';
  import { createJourneyDraft, createTiltedHostDraft, groundFrame } from './fixtures/journeys';
  import type { AxisLock } from './drafting/constraints';

  type Workflow = 'blank' | 'pedestal' | 'ornament' | 'trim';
  type OperationKind = 'extrude' | 'revolve' | 'sweep';

  const store = createFormLabStore();
  let document = $state<LabDocument>(store.shownDocument);
  let evaluation = $state<DocumentEvaluation>(evaluateDocument(store.shownDocument));
  let selectedFormId = $state<string | null>(null);
  let selectedRoleKey = $state<SourceRoleKey | null>(null);
  let selectedSurfacePoint = $state<Vec3 | null>(null);
  let selectedAttachmentId = $state<string | null>(null);
  let hostSelectionFormId = $state<string | null>(null);
  let activeTool = $state<'select' | 'draw'>('select');
  let activeWorkflow = $state<Workflow>('blank');
  let interactionMode = $state<'context' | 'explicit'>('context');
  let showReview = $state(false);
  let menuOpen = $state(false);
  let snapEnabled = $state(true);
  let snapStep = $state(0.1);
  let axisLock = $state<AxisLock>('none');
  let hostOffset = $state(0);
  let draftPoints = $state<Vec2[]>([]);
  let workplane = $state<Workplane | null>(null);
  let statusMessage = $state('Choose a blank form or a journey to begin.');
  let isSaved = $state(false);
  let importInput: HTMLInputElement;
  let viewport: { setView: (mode: 'perspective' | 'plan' | 'face') => void; zoom: (factor: number) => void; focusAll: () => void; getDiagnostics: () => unknown };
  let cameraView = $state<'perspective' | 'plan' | 'face'>('perspective');
  let profileSequence = 1;

  let selectedForm = $derived(document.forms.find((form) => form.id === selectedFormId) ?? null);
  let selectedRole = $derived(evaluation.roles.find((role) => role.key === selectedRoleKey) ?? null);
  let selectedAttachment = $derived(document.attachments.find((attachment) => attachment.id === selectedAttachmentId) ?? null);
  let chosenTitle = $derived(activeWorkflow === 'blank' ? 'Blank form' : activeWorkflow === 'pedestal' ? 'Custom pedestal' : activeWorkflow === 'ornament' ? 'Turned ornament' : 'Room trim');

  function refreshFromStore() {
    document = store.shownDocument;
    evaluation = evaluateDocument(document);
    isSaved = false;
  }

  onMount(() => {
    const unsubscribe = store.subscribe(refreshFromStore);
    const qaEnabled = import.meta.env.DEV || new URLSearchParams(window.location.search).get('qa') === '1';
    if (qaEnabled) {
      window.__nativeFormLab = {
        snapshot: () => JSON.parse(JSON.stringify({
          committed: store.document,
          shown: store.shownDocument,
          selected: { formId: selectedFormId, roleKey: selectedRoleKey, surfacePoint: selectedSurfacePoint, attachmentId: selectedAttachmentId },
          hostSelectionFormId,
          drawing: { tool: activeTool, workplane, points: draftPoints, workflow: activeWorkflow },
          status: statusMessage,
          viewport: viewport?.getDiagnostics() ?? null,
        })),
      };
    }
    return () => {
      unsubscribe();
      delete window.__nativeFormLab;
    };
  });

  function statusFromResult(result: { status: string; reason?: { message: string } }, success: string) {
    if (result.status === 'refused') {
      statusMessage = result.reason?.message ?? 'The model refused that change.';
      return false;
    }
    statusMessage = success;
    return true;
  }

  function commit(command: LabCommand, success = 'Change saved to the local model.') {
    const result = store.commit(command);
    const accepted = statusFromResult(result, success);
    if (accepted) isSaved = false;
    return accepted;
  }

  function preview(command: unknown) {
    const result = store.preview(command as LabCommand);
    if (result.status === 'refused') statusMessage = result.reason.message;
    else statusMessage = 'Preview · release to keep this change.';
  }

  function commitGesture(command: unknown) {
    commit(command as LabCommand, 'Form updated.');
  }

  function cancelGesture() {
    store.cancel();
  }

  function cloneFrame(frame: Frame): Frame {
    return { origin: [...frame.origin], u: [...frame.u], v: [...frame.v], normal: [...frame.normal] };
  }

  function movedFrame(frame: Frame, distance: number): Frame {
    return { ...cloneFrame(frame), origin: [
      frame.origin[0] + frame.normal[0] * distance,
      frame.origin[1] + frame.normal[1] * distance,
      frame.origin[2] + frame.normal[2] * distance,
    ] };
  }

  function frameAtProfileAnchor(frame: Frame, anchor: Vec2, distance: number): Frame {
    return {
      ...cloneFrame(frame),
      origin: [
        frame.origin[0] + frame.u[0] * anchor[0] + frame.v[0] * anchor[1] + frame.normal[0] * distance,
        frame.origin[1] + frame.u[1] * anchor[0] + frame.v[1] * anchor[1] + frame.normal[1] * distance,
        frame.origin[2] + frame.u[2] * anchor[0] + frame.v[2] * anchor[1] + frame.normal[2] * distance,
      ],
    };
  }

  function formDraft(name: string, profilePoints: Vec2[], frame: Frame, operation: FormDraft['operation'], rounding: FormDraft['rounding'], hostLink?: FormDraft['hostLink']): FormDraft {
    const prefix = `${name.toLowerCase().replaceAll(' ', '-')}-${profileSequence++}`;
    return {
      name,
      profile: createProfile(profilePoints, `${prefix}-profile`),
      frame: cloneFrame(frame),
      operation,
      rounding,
      hostLink: hostLink ? { ...hostLink, lastFrame: cloneFrame(hostLink.lastFrame) } : undefined,
    };
  }

  function makeAttachment(target: HostTarget, role: GeneratedRole, label = 'Marker', surfacePoint?: Vec3 | null): Omit<Attachment, 'id'> {
    const anchor: Vec2 = surfacePoint && role.frame
      ? (() => {
          const delta = [surfacePoint[0] - role.frame.origin[0], surfacePoint[1] - role.frame.origin[1], surfacePoint[2] - role.frame.origin[2]];
          return [
            delta[0]! * role.frame.u[0] + delta[1]! * role.frame.u[1] + delta[2]! * role.frame.u[2],
            delta[0]! * role.frame.v[0] + delta[1]! * role.frame.v[1] + delta[2]! * role.frame.v[2],
          ] as Vec2;
        })()
      : role.region
      ? [(role.region.min[0] + role.region.max[0]) / 2, (role.region.min[1] + role.region.max[1]) / 2]
      : [0, 0];
    const frame = role.frame!;
    const lastFrame: Frame = {
      ...cloneFrame(frame),
      origin: [
        frame.origin[0] + frame.u[0] * anchor[0] + frame.v[0] * anchor[1],
        frame.origin[1] + frame.u[1] * anchor[0] + frame.v[1] * anchor[1],
        frame.origin[2] + frame.u[2] * anchor[0] + frame.v[2] * anchor[1],
      ],
    };
    return { label, target, anchor, lastFrame, status: 'resolved' };
  }

  function evaluateCommitted(): DocumentEvaluation {
    return evaluateDocument(store.document);
  }

  function attachMarkerToTop(formId: string) {
    const current = evaluateCommitted();
    const form = store.document.forms.find((item) => item.id === formId);
    if (!form) return;
    const normal = form.operation.kind === 'extrude' ? form.frame.normal : [0, 1, 0];
    const role = (current.forms[formId]?.roles ?? [])
      .filter((item) => item.kind === 'cap' && item.frame)
      .sort((a, b) => {
        const da = (a.frame!.origin[0] - form.frame.origin[0]) * normal[0] + (a.frame!.origin[1] - form.frame.origin[1]) * normal[1] + (a.frame!.origin[2] - form.frame.origin[2]) * normal[2];
        const db = (b.frame!.origin[0] - form.frame.origin[0]) * normal[0] + (b.frame!.origin[1] - form.frame.origin[1]) * normal[1] + (b.frame!.origin[2] - form.frame.origin[2]) * normal[2];
        return db - da;
      })[0];
    if (!role?.frame) {
      statusMessage = 'This form has no planar cap for a marker yet.';
      return;
    }
    const target: HostTarget = { kind: 'form-role', formId, partKey: role.address.partKey };
    commit({ type: 'attach', attachment: makeAttachment(target, role, 'Top marker') }, 'Marker attached to the top face.');
  }

  async function resetJourney(workflow: Workflow) {
    activeWorkflow = workflow;
    selectedFormId = null;
    selectedRoleKey = null;
    selectedSurfacePoint = null;
    selectedAttachmentId = null;
    hostSelectionFormId = null;
    activeTool = 'select';
    workplane = null;
    draftPoints = [];
    axisLock = 'none';
    viewport?.setView('perspective');
    store.load(createLabDocument());
    if (workflow === 'blank') {
      statusMessage = 'Blank form ready. Choose Draw and pick a surface to start a profile.';
      return;
    }

    const draft = createJourneyDraft(workflow);
    const result = store.commit({ type: 'addForm', form: draft });
    if (result.status === 'refused') {
      statusMessage = `Journey could not be created: ${result.reason.message}`;
      return;
    }
    const created = result.document.forms[result.document.forms.length - 1];
    if (!created) return;
    selectedFormId = created.id;
    if (workflow === 'pedestal') attachMarkerToTop(created.id);
    await tick();
    viewport?.focusAll();
    statusMessage = workflow === 'pedestal'
      ? 'Pedestal ready · drag a profile point, pull its height ray, or attach another face token.'
      : workflow === 'ornament'
        ? 'Ornament ready · edit the radial section or drag the turn ring.'
        : 'Trim ready · drag carrier anchors to revise the room path.';
    isSaved = false;
  }

  async function loadTiltedStudy() {
    activeWorkflow = 'blank';
    selectedFormId = null;
    selectedRoleKey = null;
    selectedSurfacePoint = null;
    selectedAttachmentId = null;
    hostSelectionFormId = null;
    activeTool = 'select';
    workplane = null;
    draftPoints = [];
    hostOffset = 0;
    axisLock = 'none';
    viewport?.setView('perspective');
    store.load(createLabDocument());
    const result = store.commit({ type: 'addForm', form: createTiltedHostDraft() });
    if (result.status === 'refused') {
      statusMessage = `Tilted host study could not be created: ${result.reason.message}`;
      return;
    }
    selectedFormId = result.document.forms[result.document.forms.length - 1]?.id ?? null;
    selectedRoleKey = null;
    showReview = false;
    await tick();
    viewport?.focusAll();
    statusMessage = '15° slab ready. Select Draw and click its top cap; the first profile point will be placed on that tilted face.';
  }

  function startDrawing() {
    activeTool = 'draw';
    selectedAttachmentId = null;
    selectedRoleKey = null;
    selectedSurfacePoint = null;
    hostSelectionFormId = null;
    if (!workplane) axisLock = 'none';
    if (!workplane) statusMessage = 'Click the ground or a planar face to latch the plane and place the first profile point.';
    else statusMessage = `Drawing on ${workplane.label}. Click to add points, then close the profile.`;
  }

  function addDraftPoint(position: Vec2) {
    draftPoints = [...draftPoints, position];
    statusMessage = draftPoints.length < 3 ? `Point ${draftPoints.length} placed · add at least ${3 - draftPoints.length} more.` : 'Profile is ready · click its first point, double-click, or press Enter to close.';
  }

  async function closeProfile() {
    if (draftPoints.length < 3 || !workplane) {
      statusMessage = 'A closed profile needs at least three points on a latched plane.';
      return;
    }
    const profileAnchor = draftPoints[0]!;
    const frame = frameAtProfileAnchor(workplane.frame, profileAnchor, hostOffset);
    const rebasedPoints = draftPoints.map((point): Vec2 => [point[0] - profileAnchor[0], point[1] - profileAnchor[1]]);
    const draft = formDraft('New form', rebasedPoints, frame, { kind: 'extrude', height: 1 }, { radius: 0, policy: 'none' }, {
      target: workplane.target,
      lastFrame: cloneFrame(workplane.frame),
      status: 'resolved',
    });
    const result = store.commit({ type: 'addForm', form: draft });
    if (result.status === 'refused') {
      statusMessage = result.reason.message;
      return;
    }
    const created = result.document.forms[result.document.forms.length - 1];
    selectedFormId = created?.id ?? null;
    selectedRoleKey = null;
    selectedSurfacePoint = null;
    selectedAttachmentId = null;
    hostSelectionFormId = null;
    draftPoints = [];
    workplane = null;
    activeTool = 'select';
    activeWorkflow = 'blank';
    viewport?.setView('perspective');
    await tick();
    viewport?.focusAll();
    statusMessage = 'Profile created. Pull its height ray, choose Revolve or Follow path, or edit source points.';
  }

  function chooseSurface(hit: { formId: string; role: GeneratedRole; point: Vec3 } | null) {
    if (hit) {
      if (hostSelectionFormId) {
        const subjectFormId = hostSelectionFormId;
        const roleCanHost = (hit.role.kind === 'face' || hit.role.kind === 'cap') && hit.role.frame !== undefined;
        if (hit.formId === subjectFormId) {
          statusMessage = 'Choose a planar face on another form or use the ground fixture.';
          return;
        }
        if (!roleCanHost) {
          statusMessage = `${hit.role.label} has no planar frame. Choose a flat face or cap.`;
          return;
        }
        selectedFormId = subjectFormId;
        selectedRoleKey = hit.role.key;
        selectedSurfacePoint = hit.point;
        selectedAttachmentId = null;
        hostSelectionFormId = null;
        statusMessage = `${hit.role.label} selected as the host face for ${document.forms.find((form) => form.id === subjectFormId)?.name ?? 'the form'}.`;
        return;
      }
      selectedFormId = hit.formId;
      selectedRoleKey = hit.role.key;
      selectedSurfacePoint = hit.point;
    } else {
      if (hostSelectionFormId) {
        hostSelectionFormId = null;
        selectedSurfacePoint = null;
        statusMessage = 'Host-face selection cancelled.';
        return;
      }
      selectedFormId = null;
      selectedRoleKey = null;
      selectedSurfacePoint = null;
      selectedAttachmentId = null;
    }
    if (hit) statusMessage = `${hit.role.label} selected · source profile and contextual operations are available.`;
    else if (activeTool === 'select') statusMessage = 'Nothing selected. Draw a profile or choose a prepared journey.';
  }

  function patchPoint(form: Form, pointId: string, axis: 0 | 1, raw: string) {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      statusMessage = 'Enter a finite value in metres.';
      return;
    }
    const point = form.profile.points.find((item) => item.id === pointId);
    if (!point) return;
    const position: Vec2 = [...point.position];
    position[axis] = value;
    commit({ type: 'moveProfilePoint', formId: form.id, pointId, position }, 'Profile point updated · input and drag use the same model validation.');
  }

  function changeOperation(kind: OperationKind) {
    if (!selectedForm) return;
    let patch: Partial<Pick<Form, 'operation' | 'frame'>>;
    if (kind === 'extrude') patch = { operation: { kind: 'extrude', height: 1 } };
    else if (kind === 'revolve') {
      const frame = Math.abs(selectedForm.frame.v[1]) > 0.88 ? selectedForm.frame : { ...cloneFrame(selectedForm.frame), u: [1, 0, 0] as Vec3, v: [0, 1, 0] as Vec3, normal: [0, 0, 1] as Vec3 };
      patch = { frame, operation: { kind: 'revolve', angleDegrees: 270 } };
    } else {
      const frame = selectedForm.frame;
      const normal = frame.normal;
      const end: Vec3 = [frame.origin[0] + normal[0] * 1.25, frame.origin[1] + normal[1] * 1.25, frame.origin[2] + normal[2] * 1.25];
      patch = { operation: { kind: 'sweep', carrier: createCarrier([frame.origin, end], frame, `${selectedForm.profile.id}-path`) } };
    }
    commit({ type: 'patchForm', formId: selectedForm.id, patch }, `${kind === 'extrude' ? 'Pull' : kind === 'revolve' ? 'Revolve' : 'Follow path'} operation applied.`);
  }

  function patchOperationNumber(raw: string) {
    if (!selectedForm) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      statusMessage = 'Enter a finite number.';
      return;
    }
    if (selectedForm.operation.kind === 'extrude') {
      commit({ type: 'patchForm', formId: selectedForm.id, patch: { operation: { kind: 'extrude', height: value } } }, 'Pull height updated.');
    } else if (selectedForm.operation.kind === 'revolve') {
      commit({ type: 'patchForm', formId: selectedForm.id, patch: { operation: { kind: 'revolve', angleDegrees: value } } }, 'Revolve angle updated.');
    }
  }

  function patchCarrierPoint(pointId: string, axis: 0 | 1 | 2, raw: string) {
    if (!selectedForm || selectedForm.operation.kind !== 'sweep') return;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      statusMessage = 'Enter a finite carrier coordinate in metres.';
      return;
    }
    const point = selectedForm.operation.carrier.points.find((item) => item.id === pointId);
    if (!point) return;
    const position: Vec3 = [...point.position];
    position[axis] = value;
    const pointDelta: Vec3 = [position[0] - point.position[0], position[1] - point.position[1], position[2] - point.position[2]];
    const operation = {
      ...selectedForm.operation,
      carrier: {
        ...selectedForm.operation.carrier,
        points: selectedForm.operation.carrier.points.map((item) => item.id === pointId ? { ...item, position } : item),
        frameAnchor: pointId === selectedForm.operation.carrier.frameAnchorPointId
          ? { ...selectedForm.operation.carrier.frameAnchor, origin: [
              selectedForm.operation.carrier.frameAnchor.origin[0] + pointDelta[0],
              selectedForm.operation.carrier.frameAnchor.origin[1] + pointDelta[1],
              selectedForm.operation.carrier.frameAnchor.origin[2] + pointDelta[2],
            ] as Vec3 }
          : selectedForm.operation.carrier.frameAnchor,
      },
    };
    const patch: Partial<Pick<Form, 'operation' | 'frame'>> = { operation };
    if (pointId === selectedForm.operation.carrier.frameAnchorPointId) {
      patch.frame = {
        ...cloneFrame(selectedForm.frame),
        origin: [
          selectedForm.frame.origin[0] + pointDelta[0],
          selectedForm.frame.origin[1] + pointDelta[1],
          selectedForm.frame.origin[2] + pointDelta[2],
        ],
      };
    }
    commit({ type: 'patchForm', formId: selectedForm.id, patch }, 'Carrier anchor updated with the same geometric validation as dragging.');
  }

  function patchRounding(raw: string) {
    if (!selectedForm) return;
    const radius = Number(raw);
    if (!Number.isFinite(radius)) {
      statusMessage = 'Enter a finite radius in metres.';
      return;
    }
    commit({ type: 'patchForm', formId: selectedForm.id, patch: { rounding: { radius, policy: radius > 0 ? 'profile-corners' : 'none' } } }, 'Corner rounding updated.');
  }

  function patchHostOffset(raw: string) {
    if (!selectedForm?.hostLink) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      statusMessage = 'Enter a finite host offset in metres.';
      return;
    }
    const origin = selectedForm.hostLink.lastFrame.origin;
    const normal = selectedForm.hostLink.lastFrame.normal;
    const frame: Frame = {
      ...cloneFrame(selectedForm.frame),
      origin: [origin[0] + normal[0] * value, origin[1] + normal[1] * value, origin[2] + normal[2] * value],
    };
    commit({ type: 'patchForm', formId: selectedForm.id, patch: { frame } }, 'Host-relative offset updated.');
  }

  function paintSelected(color: string, material: string) {
    if (!selectedRole) {
      statusMessage = 'Select a generated surface role to paint it.';
      return;
    }
    commit({ type: 'paint', target: selectedRole.address, color, material }, `${selectedRole.label} painted ${material}.`);
  }

  function attachSelectedRole() {
    if (!selectedRole?.frame || !selectedSurfacePoint) {
      statusMessage = 'Select a point on a planar face or cap before attaching a marker.';
      return;
    }
    const target: HostTarget = { kind: 'form-role', formId: selectedRole.address.formId, partKey: selectedRole.address.partKey };
    commit({ type: 'attach', attachment: makeAttachment(target, selectedRole, 'Marker', selectedSurfacePoint) }, `Marker attached to ${selectedRole.label}.`);
  }

  function repairSelectedAttachment() {
    if (!selectedAttachment || !selectedRole?.frame || !selectedSurfacePoint) {
      statusMessage = 'Select an unresolved marker and then a new planar host face.';
      return;
    }
    const target: HostTarget = { kind: 'form-role', formId: selectedRole.address.formId, partKey: selectedRole.address.partKey };
    const replacement = makeAttachment(target, selectedRole, selectedAttachment.label, selectedSurfacePoint);
    commit({ type: 'repairAttachment', attachmentId: selectedAttachment.id, target, anchor: replacement.anchor, lastFrame: replacement.lastFrame }, 'Marker repaired on the selected face.');
  }

  function changeFormHostToFace() {
    if (!selectedForm || !selectedRole?.frame || !selectedSurfacePoint) {
      statusMessage = 'Pick a planar generated face to use as this profile’s host.';
      return;
    }
    if (selectedRole.address.formId === selectedForm.id) {
      statusMessage = 'A form cannot use one of its own generated surfaces as its host.';
      return;
    }
    const offset = selectedForm.hostLink ? hostOffsetValue(selectedForm) : 0;
    const target: HostTarget = { kind: 'form-role', formId: selectedRole.address.formId, partKey: selectedRole.address.partKey };
    const frame: Frame = {
      ...cloneFrame(selectedRole.frame),
      origin: [
        selectedSurfacePoint[0] + selectedRole.frame.normal[0] * offset,
        selectedSurfacePoint[1] + selectedRole.frame.normal[1] * offset,
        selectedSurfacePoint[2] + selectedRole.frame.normal[2] * offset,
      ],
    };
    hostSelectionFormId = null;
    commit({ type: 'patchForm', formId: selectedForm.id, patch: { frame, hostLink: { target, lastFrame: cloneFrame(selectedRole.frame), status: 'resolved' } } }, `${selectedForm.name} hosted on ${selectedRole.label}.`);
  }

  function startFaceHostPick() {
    if (!selectedForm) return;
    hostSelectionFormId = selectedForm.id;
    selectedRoleKey = null;
    selectedSurfacePoint = null;
    selectedAttachmentId = null;
    activeTool = 'select';
    statusMessage = `Click a planar face on another form to host ${selectedForm.name}.`;
  }

  function changeFormHostToGround() {
    if (!selectedForm) return;
    const offset = selectedForm.hostLink ? hostOffsetValue(selectedForm) : 0;
    const target: HostTarget = { kind: 'fixture-plane', fixtureId: 'workspace', planeKey: 'ground' };
    const frame = movedFrame(groundFrame, offset);
    hostSelectionFormId = null;
    commit({ type: 'patchForm', formId: selectedForm.id, patch: { frame, hostLink: { target, lastFrame: cloneFrame(groundFrame), status: 'resolved' } } }, `${selectedForm.name} hosted on the ground fixture.`);
  }

  function deleteSelected() {
    if (selectedAttachmentId) {
      statusMessage = 'Markers stay in the model for this study; choose Repair to resolve this marker.';
      return;
    }
    if (!selectedForm) return;
    const formId = selectedForm.id;
    if (commit({ type: 'removeForm', formId }, `${selectedForm.name} removed. Attachments to it remain unresolved at their last pose.`)) {
      selectedFormId = null;
      selectedRoleKey = null;
      selectedSurfacePoint = null;
    }
  }

  function saveLocal() {
    menuOpen = false;
    try {
      localStorage.setItem('native-form-lab:v1', store.serialize());
      isSaved = true;
      statusMessage = 'Draft saved in this browser on this device.';
    } catch {
      statusMessage = 'Local save failed. Export the JSON file instead.';
    }
  }

  async function loadLocal() {
    menuOpen = false;
    const saved = localStorage.getItem('native-form-lab:v1');
    if (!saved) {
      statusMessage = 'No local draft has been saved in this browser yet.';
      return;
    }
    try {
      const result = store.load(deserialize(saved));
      if (result.status === 'refused') statusMessage = result.reason.message;
      else {
        resetSelectionAfterLoad();
        viewport?.setView('perspective');
        await tick();
        viewport?.focusAll();
        statusMessage = 'Local draft loaded and validated.';
      }
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : 'Could not read the saved draft.';
    }
  }

  function exportFile() {
    const blob = new Blob([store.serialize()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = 'native-form-lab.json';
    link.click();
    URL.revokeObjectURL(url);
    menuOpen = false;
    statusMessage = 'Authored document exported as JSON.';
  }

  async function importFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const result = store.load(deserialize(await file.text()));
      if (result.status === 'refused') statusMessage = result.reason.message;
      else {
        resetSelectionAfterLoad();
        activeWorkflow = 'blank';
        viewport?.setView('perspective');
        await tick();
        viewport?.focusAll();
        statusMessage = `Imported and validated ${file.name}.`;
      }
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : 'The selected file is not a valid Native Form Lab document.';
    } finally {
      importInput.value = '';
      menuOpen = false;
    }
  }

  function resetSelectionAfterLoad() {
    selectedFormId = null;
    selectedRoleKey = null;
    selectedSurfacePoint = null;
    selectedAttachmentId = null;
    hostSelectionFormId = null;
    draftPoints = [];
    workplane = null;
    activeTool = 'select';
    activeWorkflow = 'blank';
  }

  function undo() {
    if (store.undo()) statusMessage = 'Undo applied.';
    else statusMessage = 'Nothing to undo.';
  }
  function redo() {
    if (store.redo()) statusMessage = 'Redo applied.';
    else statusMessage = 'Nothing to redo.';
  }

  function cancelAction() {
    store.cancel();
    draftPoints = [];
    workplane = null;
    activeTool = 'select';
    axisLock = 'none';
    selectedSurfacePoint = null;
    hostSelectionFormId = null;
    statusMessage = 'Current action cancelled.';
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    const target = event.target;
    const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
    if (!editing && event.key.toLowerCase() === 'd') {
      activeTool = 'draw';
      startDrawing();
    } else if (!editing && event.key.toLowerCase() === 'v') {
      activeTool = 'select';
    } else if (!editing && event.key === 'Escape') {
      cancelAction();
    } else if (!editing && event.key === 'Enter' && activeTool === 'draw' && draftPoints.length >= 3) {
      closeProfile();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveLocal();
    }
  }

  function operationValue(form: Form): number {
    return form.operation.kind === 'extrude' ? form.operation.height : form.operation.kind === 'revolve' ? form.operation.angleDegrees : 0;
  }

  function hostOffsetValue(form: Form): number {
    if (!form.hostLink) return 0;
    const delta = [
      form.frame.origin[0] - form.hostLink.lastFrame.origin[0],
      form.frame.origin[1] - form.hostLink.lastFrame.origin[1],
      form.frame.origin[2] - form.hostLink.lastFrame.origin[2],
    ];
    return delta[0] * form.hostLink.lastFrame.normal[0] + delta[1] * form.hostLink.lastFrame.normal[1] + delta[2] * form.hostLink.lastFrame.normal[2];
  }

  function roleSource(role: GeneratedRole) {
    return roleKey(role.address);
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<svelte:head><title>Native Form Lab</title></svelte:head>

<main class="lab-shell">
  <header class="topbar">
    <div class="brand-lockup"><span class="brand-mark">N</span><div><strong>Native Form Lab</strong><small>INTERACTION STUDY / 01</small></div></div>
    <div class="topbar-center"><span class="status-dot"></span><span>{isSaved ? 'Saved locally' : 'Local draft'}</span><span class="divider"></span><span>{selectedForm?.name ?? chosenTitle}</span></div>
    <div class="topbar-actions">
      <div class="file-menu-wrap">
        <button class="quiet-button" onclick={() => menuOpen = !menuOpen}>File <span>⌄</span></button>
        {#if menuOpen}
          <div class="file-menu" role="menu">
            <button role="menuitem" onclick={saveLocal}>Save local draft</button>
            <button role="menuitem" onclick={loadLocal}>Load local draft</button>
            <button role="menuitem" onclick={exportFile}>Export JSON</button>
            <button role="menuitem" onclick={() => importInput.click()}>Import JSON</button>
          </div>
        {/if}
      </div>
      <button class="quiet-button" onclick={() => showReview = !showReview}>Review</button>
      <button class="primary-button" onclick={saveLocal}>Save locally <kbd>⌘ S</kbd></button>
      <input bind:this={importInput} class="visually-hidden" type="file" accept="application/json,.json" onchange={importFile} />
    </div>
  </header>

  <div class="workspace">
    <aside class="side-panel left-panel">
      <div class="section-label">START WITH</div>
      <button class:chosen={activeWorkflow === 'blank'} class="workflow-card" onclick={() => resetJourney('blank')}>
        <span class="card-icon blank-icon">＋</span><span><strong>Blank form</strong><small>Draw a profile on a surface</small></span><span class="radio-dot"></span>
      </button>
      <div class="section-label journeys-label">TRY A JOURNEY <span>3</span></div>
      <button class:chosen={activeWorkflow === 'pedestal'} class="workflow-card" onclick={() => resetJourney('pedestal')}>
        <span class="card-icon pedestal-icon"><i></i></span><span><strong>Custom pedestal</strong><small>Pull · round · attach</small></span><span class="radio-dot"></span>
      </button>
      <button class:chosen={activeWorkflow === 'ornament'} class="workflow-card" onclick={() => resetJourney('ornament')}>
        <span class="card-icon ornament-icon"><i></i></span><span><strong>Turned ornament</strong><small>Revolve · edit section</small></span><span class="radio-dot"></span>
      </button>
      <button class:chosen={activeWorkflow === 'trim'} class="workflow-card" onclick={() => resetJourney('trim')}>
        <span class="card-icon trim-icon"><i></i></span><span><strong>Room trim</strong><small>Section · follow path</small></span><span class="radio-dot"></span>
      </button>
      <div class="panel-rule"></div>
      <div class="section-label">TOOLS</div>
      <div class="tool-switcher">
        <button class:tool-active={activeTool === 'select'} onclick={() => activeTool = 'select'}><span>↖</span>Select <kbd>V</kbd></button>
        <button class:tool-active={activeTool === 'draw'} onclick={startDrawing}><span>⌁</span>Draw <kbd>D</kbd></button>
      </div>
      <p class="tool-hint">{activeTool === 'draw' ? workplane ? `Drawing on ${workplane.label}. Continue corners and close the profile.` : 'Click a ground or planar face to latch it and place the first point.' : 'Choose a form to see its editable source and next useful action.'}</p>
      {#if document.forms.length > 0}
        <div class="section-label forms-label">IN DOCUMENT <span>{document.forms.length}</span></div>
        <div class="form-list">
          {#each document.forms as form (form.id)}
            <button class:chosen={selectedFormId === form.id} class="form-row" onclick={() => { selectedFormId = form.id; selectedRoleKey = null; selectedSurfacePoint = null; selectedAttachmentId = null; hostSelectionFormId = null; }}><span class="form-marker"></span><span>{form.name}</span><small>{form.operation.kind === 'extrude' ? 'pull' : form.operation.kind === 'revolve' ? 'turn' : 'sweep'}</small></button>
          {/each}
        </div>
      {/if}
      {#if document.attachments.length > 0}
        <div class="section-label forms-label">MARKERS <span>{document.attachments.length}</span></div>
        <div class="form-list">
          {#each document.attachments as attachment (attachment.id)}
            <button class:chosen={selectedAttachmentId === attachment.id} class="form-row" onclick={() => { selectedAttachmentId = attachment.id; selectedFormId = null; selectedRoleKey = null; selectedSurfacePoint = null; hostSelectionFormId = null; statusMessage = attachment.status === 'unresolved' ? `${attachment.label} unresolved at its last pose.` : `${attachment.label} selected.`; }}>
              <span class:unresolved-marker={attachment.status === 'unresolved'} class="form-marker"></span><span>{attachment.label}</span><small>{attachment.status === 'unresolved' ? 'unresolved' : 'attached'}</small>
            </button>
          {/each}
        </div>
      {/if}
      <div class="left-spacer"></div>
      <button class="subtle-action" onclick={undo}>↶ <span>Undo</span><kbd>⌘ Z</kbd></button>
      <button class="subtle-action" onclick={redo}>↪ <span>Redo</span><kbd>⇧ ⌘ Z</kbd></button>
      <button class="subtle-action" onclick={() => resetJourney(activeWorkflow)}>↻ <span>Reset this journey</span></button>
      <div class="left-foot"><span class="offline-chip">● OFFLINE</span><span>Local file only</span></div>
    </aside>

    <section class="viewport-column">
      <div class="viewport-head">
        <div><span class="eyebrow">FORM WORKSPACE</span><strong>{selectedForm?.name ?? (activeWorkflow === 'blank' ? 'Untitled form' : chosenTitle)}</strong></div>
        <div class="view-controls">
          <button title="Plan view" aria-label="Plan view" class:current-view={cameraView === 'plan'} onclick={() => viewport?.setView('plan')}>⌑</button>
          <button title={selectedForm ? 'Align view to the selected profile frame' : 'Select a form to read its profile frame'} aria-label="Face profile" disabled={!selectedForm} class:current-view={cameraView === 'face'} onclick={() => viewport?.setView('face')}>▱</button>
          <button title="Return to perspective" aria-label="Return to perspective" class:current-view={cameraView === 'perspective'} onclick={() => viewport?.setView('perspective')}>◈</button>
          <button title="Fit geometry" aria-label="Fit geometry" onclick={() => viewport?.focusAll()}>◎</button>
          <span></span><button title="Zoom out" aria-label="Zoom out" onclick={() => viewport?.zoom(1.2)}>−</button><button title="Zoom in" aria-label="Zoom in" onclick={() => viewport?.zoom(0.82)}>+</button>
        </div>
      </div>
      <div class="viewport-stage">
        <Viewport
          bind:this={viewport}
          document={evaluation.valid ? document : store.document}
          evaluation={evaluation}
          {selectedFormId}
          {selectedRoleKey}
          {selectedAttachmentId}
          tool={activeTool}
          {workplane}
          {draftPoints}
          {axisLock}
          {snapEnabled}
          {snapStep}
          {interactionMode}
          onSelect={chooseSurface}
          onSelectAttachment={(id) => { if (id) { selectedAttachmentId = id; selectedFormId = null; selectedRoleKey = null; selectedSurfacePoint = null; hostSelectionFormId = null; statusMessage = document.attachments.find((item) => item.id === id)?.status === 'unresolved' ? 'Marker unresolved at its last pose. Select a new planar face, then repair.' : 'Marker selected.'; } }}
          onLatchPlane={(plane) => { workplane = plane; draftPoints = []; activeTool = 'draw'; }}
          onDraftPoint={addDraftPoint}
          onCloseProfile={closeProfile}
          onPreview={preview}
          onCommit={commitGesture}
          onCancel={cancelGesture}
          onStatus={(message) => statusMessage = message}
          onCameraMode={(mode) => cameraView = mode}
        >
          <div class="viewport-caption"><span>{cameraView === 'plan' ? 'Plan' : cameraView === 'face' ? 'Face profile' : 'Perspective'}</span><span class="caption-divider">/</span><span>{workplane?.label ?? selectedForm?.name ?? 'Ground plane'}</span></div>
          <div class="orientation-widget"><span class="axis-y">Y</span><span class="axis-x">X</span><span class="axis-z">Z</span><i></i></div>
          <div class="viewport-tip"><span>◉</span> Select: click <b>·</b> Orbit: right or space-drag <b>·</b> Pan: shift-drag <b>·</b> Zoom: scroll</div>
        </Viewport>
      </div>
      <div class="selection-bar">
        <span class="selection-state"><i class:selection-on={selectedForm !== null || selectedAttachment !== null}></i>{selectedForm?.name ?? selectedAttachment?.label ?? 'Nothing selected'}</span>
        <span class="selection-help">{statusMessage}</span>
        <span class="units">UNITS <b>m</b> <span>⌄</span></span>
      </div>
    </section>

    <aside class="side-panel right-panel">
      {#if selectedAttachment}
        <div class="context-title"><div><div class="section-label">MARKER</div><h2>{selectedAttachment.label}</h2></div><button class="more-button" title="Close marker selection" onclick={() => { selectedAttachmentId = null; selectedRoleKey = null; selectedSurfacePoint = null; }}>×</button></div>
        <div class:warning-card={selectedAttachment.status === 'unresolved'} class="state-card"><strong>{selectedAttachment.status === 'unresolved' ? 'Unresolved at last pose' : 'Attached to a face'}</strong><p>{selectedAttachment.reason ?? 'The marker stays at its addressed planar role and local anchor.'}</p></div>
        <p class="context-copy">Select a new planar face in the viewport to repair this marker. Its current position remains visible until repair.</p>
        <button class="action-button" disabled={!selectedRole?.frame || !selectedSurfacePoint} onclick={repairSelectedAttachment}>Repair on selected face</button>
      {:else if activeTool === 'draw' && workplane}
        <div class="context-title"><div><div class="section-label">DRAWING PLANE</div><h2>{workplane.label}</h2></div><button class="more-button" title="Focus all geometry" onclick={() => viewport?.focusAll()}>◎</button></div>
        <div class="state-card"><strong>{workplane.target.kind === 'fixture-plane' ? 'Fixture plane latched' : 'Generated face latched'}</strong><p>{workplane.target.kind === 'fixture-plane' ? 'World-aligned ground. The plane stays active until the profile closes or the action is cancelled.' : 'Profile coordinates use this face’s local U/V frame. The plane stays active for the complete stroke.'}</p></div>
        <label class="field-label compact-field">Host-relative offset <span>m</span><input type="number" step="0.01" bind:value={hostOffset} /></label>
        <div class="draw-instructions"><span class="action-glyph">⌁</span><strong>{draftPoints.length} points placed</strong><p>Add corners on the highlighted plane until there are at least three. Close on the first point, double-click, or press Enter.</p><button class="action-button" disabled={draftPoints.length < 3} onclick={closeProfile}>Create form <kbd>↵</kbd></button></div>
        <div class="constraint-row"><span class="section-label">AXIS LOCK</span><div class="axis-locks">{#each ['none', 'x', 'y', 'z', 'u', 'v'] as axis}<button class:axis-active={axisLock === axis} aria-label={axis === 'none' ? 'Release axis lock' : axis === 'u' ? 'Lock local U' : axis === 'v' ? 'Lock local V' : `Lock world ${axis.toUpperCase()}`} title={axis === 'none' ? 'No axis lock' : axis === 'u' || axis === 'v' ? `Lock local ${axis.toUpperCase()}` : `Lock world ${axis.toUpperCase()}`} onclick={() => axisLock = axis as AxisLock}>{axis === 'none' ? '—' : axis.toUpperCase()}</button>{/each}</div></div>
        <p class="micro-copy">The first point is unconstrained. World axes must lie in this plane; local U/V are always available.</p>
        <div class="hint-block"><span class="hint-icon">i</span><p>Snap applies in the latched plane’s local coordinates. Use Escape to cancel the profile action.</p></div>
        <div class="panel-bottom"><button class="subtle-action" onclick={cancelAction}>↶ <span>Cancel current action</span><kbd>Esc</kbd></button></div>
      {:else if selectedForm}
        <div class="context-title"><div><div class="section-label">FORM SOURCE</div><h2>{selectedForm.name}</h2></div><button class="more-button" title="Remove form" onclick={deleteSelected}>×</button></div>
        <label class="field-label">Form name<input value={selectedForm.name} onchange={(event) => commit({ type: 'patchForm', formId: selectedForm.id, patch: { name: event.currentTarget.value } }, 'Form name updated.')} /></label>
        <div class="section-rule"></div>
        <div class="section-label source-label">PROFILE POINTS <span>{selectedForm.profile.points.length}</span></div>
        <p class="micro-copy">Local metres in the profile plane. Drag the gold handles or edit exact U/V values.</p>
        <div class="point-list">
          {#each selectedForm.profile.points as point, i (point.id)}
            <div class="point-row"><span>{String(i + 1).padStart(2, '0')}</span><label>U<input type="number" step="0.01" value={point.position[0]} onchange={(event) => patchPoint(selectedForm!, point.id, 0, event.currentTarget.value)} /></label><label>V<input type="number" step="0.01" value={point.position[1]} onchange={(event) => patchPoint(selectedForm!, point.id, 1, event.currentTarget.value)} /></label></div>
          {/each}
        </div>
        <div class="point-actions"><button disabled={selectedForm.profile.points.length <= 3} onclick={() => {
          const point = selectedForm!.profile.points[selectedForm!.profile.points.length - 1];
          commit({ type: 'removeProfilePoint', formId: selectedForm!.id, pointId: point!.id }, 'Profile point removed.');
        }}>Remove last point</button><button onclick={() => {
          const segment = selectedForm!.profile.segments[0];
          if (!segment) return;
          const first = selectedForm!.profile.points.find((point) => point.id === segment.from)?.position ?? [0, 0];
          const second = selectedForm!.profile.points.find((point) => point.id === segment.to)?.position ?? [0, 0];
          commit({ type: 'insertProfilePoint', formId: selectedForm!.id, segmentId: segment.id, position: [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2] }, 'Profile point inserted.');
        }}>Add corner</button></div>
        <div class="section-rule"></div>
        <div class="section-label">NEXT ACTION</div>
        <div class="operation-actions">
          <button class:operation-active={selectedForm.operation.kind === 'extrude'} onclick={() => changeOperation('extrude')}>Pull</button>
          <button class:operation-active={selectedForm.operation.kind === 'revolve'} onclick={() => changeOperation('revolve')}>Revolve</button>
          <button class:operation-active={selectedForm.operation.kind === 'sweep'} onclick={() => changeOperation('sweep')}>Follow path</button>
        </div>
        {#if selectedForm.operation.kind === 'extrude'}
          <label class="field-label compact-field">Pull height <span>m</span><input type="number" min="0.01" step="0.01" value={operationValue(selectedForm)} onchange={(event) => patchOperationNumber(event.currentTarget.value)} /></label>
        {:else if selectedForm.operation.kind === 'revolve'}
          <label class="field-label compact-field">Turn angle <span>°</span><input type="number" min="1" max="360" step="1" value={operationValue(selectedForm)} onchange={(event) => patchOperationNumber(event.currentTarget.value)} /></label>
        {:else}
          <div class="state-card"><strong>{selectedForm.operation.carrier.points.length} carrier anchors</strong><p>Drag the gold path handles or edit XYZ coordinates below. Dragging snaps in the carrier frame; all edits use the same geometry checks. Sharp spatial corners are refused.</p><button class="inline-button" onclick={() => commit({ type: 'reverseCarrier', formId: selectedForm!.id }, 'Carrier direction reversed; its fixed section anchor stays in place.')}>Reverse carrier direction</button></div>
          <div class="carrier-list">
            {#each selectedForm.operation.carrier.points as point, i (point.id)}
              <div class="carrier-row"><span>{String(i + 1).padStart(2, '0')}</span>{#each ['X', 'Y', 'Z'] as axis, axisIndex}<label>{axis}<input aria-label={`Carrier ${i + 1} ${axis} m`} type="number" step="0.01" value={point.position[axisIndex as 0 | 1 | 2]} onchange={(event) => patchCarrierPoint(point.id, axisIndex as 0 | 1 | 2, event.currentTarget.value)} /></label>{/each}</div>
            {/each}
          </div>
        {/if}
        <label class="field-label compact-field">Corner radius <span>m</span><input type="number" min="0" step="0.01" value={selectedForm.rounding.radius} onchange={(event) => patchRounding(event.currentTarget.value)} /></label>
        {#if selectedForm.hostLink}
          <label class="field-label compact-field">Host-relative offset <span>m</span><input type="number" step="0.01" value={hostOffsetValue(selectedForm)} onchange={(event) => patchHostOffset(event.currentTarget.value)} /></label>
          <div class:warning-card={selectedForm.hostLink.status === 'unresolved'} class="state-card"><strong>{selectedForm.hostLink.status === 'resolved' ? 'Hosted profile' : 'Host needs repair'}</strong><p>{selectedForm.hostLink.reason ?? (selectedForm.hostLink.target.kind === 'fixture-plane' ? 'Profile coordinates are measured from the latched fixture plane.' : 'Profile follows the addressed planar role. Offset uses the host normal.')}</p></div>
        {/if}
        <div class="section-rule"></div>
        <div class="section-label">FORM HOST</div>
        {#if hostSelectionFormId === selectedForm.id}<div class="state-card"><strong>Choose a host face</strong><p>Click a planar face on another form. Its clicked point becomes the profile’s host-local placement anchor.</p><button class="inline-button" onclick={cancelAction}>Cancel face pick</button></div>{/if}
        <div class="host-buttons"><button onclick={startFaceHostPick}>Pick face…</button><button disabled={!selectedRole?.frame || !selectedSurfacePoint || selectedRole.address.formId === selectedForm.id} onclick={changeFormHostToFace}>{selectedForm.hostLink?.status === 'unresolved' ? 'Repair on selected face' : 'Use selected face'}</button><button onclick={changeFormHostToGround}>Use ground fixture</button></div>
        <p class="micro-copy">A hosted profile follows its selected planar face. Fixture and face hosts share the same local frame and offset rules.</p>
        <div class="section-rule"></div>
        <div class="constraint-row"><span class="section-label">AXIS LOCK</span><div class="axis-locks">{#each ['none', 'x', 'y', 'z', 'u', 'v'] as axis}<button class:axis-active={axisLock === axis} aria-label={axis === 'none' ? 'Release axis lock' : axis === 'u' ? 'Lock local U' : axis === 'v' ? 'Lock local V' : `Lock world ${axis.toUpperCase()}`} title={axis === 'none' ? 'No axis lock' : axis === 'u' || axis === 'v' ? `Lock local ${axis.toUpperCase()}` : `Lock world ${axis.toUpperCase()}`} onclick={() => axisLock = axis as AxisLock}>{axis === 'none' ? '—' : axis.toUpperCase()}</button>{/each}</div></div>
        <label class="snap-row"><input type="checkbox" bind:checked={snapEnabled} /><span>Snap in host-local coordinates</span></label>
        <label class="field-label snap-step">Snap increment <span>m</span><input type="number" min="0.001" step="0.01" value={snapStep} onchange={(event) => { const value = Number(event.currentTarget.value); if (Number.isFinite(value) && value > 0) snapStep = value; else statusMessage = 'Snap step must be greater than zero.'; }} /></label>
        <p class="micro-copy">Plane edits accept world axes only when tangent; local U/V always work. Carrier edits constrain in 3D and may be refused if the path bends invalidate the sweep.</p>
        <div class="section-rule"></div>
        <div class="section-label">SELECTED SURFACE</div>
        {#if selectedRole}
          <div class="role-card"><strong>{selectedRole.label}</strong><small>{selectedRole.kind}{selectedRole.frame ? ' · planar host' : ' · paintable surface'}</small></div>
          <div class="paint-row"><button aria-label="Paint moss" title="Moss finish" onclick={() => paintSelected('#80907c', 'moss')}><i style="--swatch:#80907c"></i></button><button aria-label="Paint clay" title="Clay finish" onclick={() => paintSelected('#af755f', 'clay')}><i style="--swatch:#af755f"></i></button><button aria-label="Paint limestone" title="Limestone finish" onclick={() => paintSelected('#d6cfba', 'limestone')}><i style="--swatch:#d6cfba"></i></button><button class="attach-button" disabled={!selectedRole.frame || !selectedSurfacePoint} onclick={attachSelectedRole}>＋ Attach marker</button></div>
        {:else}
          <p class="micro-copy">Click a generated face or cap to paint it, attach a marker, or use it as a child profile host.</p>
        {/if}
        <div class="panel-bottom"><button class="subtle-action" onclick={cancelAction}>↶ <span>Cancel current action</span><kbd>Esc</kbd></button></div>
      {:else}
        <div class="context-title"><div><div class="section-label">CONTEXT</div><h2>{workplane ? `${workplane.label} latched` : activeTool === 'draw' ? 'Choose a surface' : 'Ready to make'}</h2></div><button class="more-button" title="Focus all geometry" onclick={() => viewport?.focusAll()}>◎</button></div>
        <p class="context-copy">Forms use editable profiles with simple geometric operations. Click a drawing surface to latch it and place the first point; it stays latched as you close the profile.</p>
        {#if workplane}
          <div class="state-card"><strong>{workplane.label}</strong><p>{workplane.target.kind === 'fixture-plane' ? 'Fixture plane · world aligned.' : `Hosted by ${workplane.label} · local U/V axes are aligned to this generated face.`}</p></div>
          <label class="field-label compact-field">Host-relative offset <span>m</span><input type="number" step="0.01" bind:value={hostOffset} /></label>
          <div class="draw-instructions"><span class="action-glyph">⌁</span><strong>Draw a closed profile</strong><p>Click at least three corners on the highlighted plane. Close at the first point, double-click, or press Enter.</p><button class="action-button" disabled={draftPoints.length < 3} onclick={closeProfile}>Create form <kbd>↵</kbd></button></div>
        {:else}
          <div class="empty-action-card">
            <span class="action-glyph">⌁</span><strong>Draw a profile</strong>
            <p>Click the ground or a planar face to latch it and place the first corner. Add points to finish the profile.</p>
            <button class="action-button" onclick={startDrawing}><span>＋</span> Start drawing <kbd>D</kbd></button>
          </div>
          <div class="hint-block"><span class="hint-icon">i</span><p>Profile points stay editable. Pull, Revolve, and Follow path appear when a form is selected.</p></div>
        {/if}
        <div class="panel-bottom"><button class="subtle-action" onclick={cancelAction}>↶ <span>Cancel current action</span><kbd>Esc</kbd></button><button class="subtle-action" onclick={() => viewport?.focusAll()}>◎ <span>Show all geometry</span></button></div>
      {/if}
    </aside>
  </div>

  {#if showReview}
    <div class="review-overlay" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) showReview = false; }}>
      <section class="review-drawer" aria-label="Review interaction mode">
        <div class="drawer-head"><div><span class="section-label">REVIEW MODE</span><h2>Compare interaction styles</h2></div><button class="close-button" onclick={() => showReview = false}>×</button></div>
        <p>Change modes on the same model. Context mode exposes the geometric handles; explicit mode keeps the operation choice in the selected form panel.</p>
        <label class="review-choice"><input type="radio" name="interaction-mode" checked={interactionMode === 'context'} onchange={() => interactionMode = 'context'} /><span><strong>Contextual geometric handles</strong><small>Drag profile points, pull height, turn ring, or carrier anchors.</small></span></label>
        <label class="review-choice"><input type="radio" name="interaction-mode" checked={interactionMode === 'explicit'} onchange={() => interactionMode = 'explicit'} /><span><strong>Explicit action choice</strong><small>Pick Pull, Revolve, or Follow path in the form panel.</small></span></label>
        <div class="review-note"><strong>Source role diagnostics</strong>{#if selectedRole}<span>{selectedRole.label} · {selectedRole.kind}</span><code>{roleSource(selectedRole)}</code>{:else}<span>Select a generated surface to inspect its source address.</span>{/if}</div>
        {#if selectedForm}<div class="review-note"><strong>Operation</strong><code>{selectedForm.operation.kind}</code><span>{selectedForm.profile.points.length} source points · {evaluation.forms[selectedForm.id]?.valid ? 'valid generated volume' : evaluation.forms[selectedForm.id]?.reason?.message ?? 'no generated volume'}</span></div>{/if}
        {#each document.finishes.filter((finish) => finish.status === 'unresolved') as finish (finish.id)}
          <div class="review-note"><strong>Unresolved finish</strong><span>{finish.reason ?? 'This finish points to a retired source role.'} Repaint a current role to create a resolved finish.</span><code>{roleKey(finish.target)}</code></div>
        {/each}
        <div class="review-note"><strong>Study limits</strong><span>Three-anchor free planes are unavailable. Nonplanar carriers can be edited with explicit XYZ anchors; sharp spatial corners and invalid sweeps are refused.</span></div>
        <div class="review-note"><strong>Host fixture</strong><span>Load a tilted planar cap to test a hosted child profile with face-aligned drawing and offset.</span><button class="action-button" onclick={loadTiltedStudy}>Load 15° tilted slab</button></div>
      </section>
    </div>
  {/if}
</main>
