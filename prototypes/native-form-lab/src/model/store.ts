import { evaluateDocument } from "../geometry";
import {
  createLabDocument,
  roleKey,
  type Attachment,
  type Carrier,
  type CommandResult,
  type DocumentEvaluation,
  type Form,
  type FormLabStore,
  type Frame,
  type HostLink,
  type HostTarget,
  type LabCommand,
  type LabDocument,
  type RoleAddress,
  type Vec2,
  type Vec3,
} from "./types";

export type DocumentEvaluator = (document: LabDocument) => DocumentEvaluation;

const EPSILON = 1e-8;

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
  if (value && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) copy[key] = clone(item);
    return copy as T;
  }
  return value;
}
function refuse(code: string, message: string, evaluation?: DocumentEvaluation): CommandResult {
  return { status: "refused", reason: { code, message }, ...(evaluation ? { evaluation } : {}) };
}

function allocate(document: LabDocument, family: string): string {
  const used = new Set<string>();
  for (const form of document.forms) {
    used.add(form.id);
    used.add(form.profile.id);
    for (const point of form.profile.points) used.add(point.id);
    for (const segment of form.profile.segments) used.add(segment.id);
    if (form.revolveCapLifetimeKeys) {
      used.add(form.revolveCapLifetimeKeys.start);
      used.add(form.revolveCapLifetimeKeys.end);
    }
    if (form.operation.kind === "sweep") {
      used.add(form.operation.carrier.id);
      used.add(form.operation.carrier.frameAnchorPointId);
      for (const point of form.operation.carrier.points) used.add(point.id);
      for (const segment of form.operation.carrier.segments) used.add(segment.id);
    }
    if (form.hostLink?.target.kind === "form-role") {
      used.add(form.hostLink.target.formId);
      used.add(form.hostLink.target.partKey);
    }
  }
  for (const attachment of document.attachments) {
    used.add(attachment.id);
    if (attachment.target.kind === "form-role") {
      used.add(attachment.target.formId);
      used.add(attachment.target.partKey);
    }
  }
  for (const finish of document.finishes) {
    used.add(finish.id);
    used.add(finish.target.formId);
    used.add(finish.target.partKey);
  }
  let id: string;
  do {
    id = `${family}:${document.nextId}`;
    document.nextId += 1;
  } while (used.has(id));
  return id;
}

function isFullRevolve(form: Pick<Form, "operation">): boolean {
  return form.operation.kind === "revolve" && Math.abs(form.operation.angleDegrees) >= 360 - 1e-6;
}

function findForm(document: LabDocument, formId: string): Form | undefined {
  return document.forms.find((form) => form.id === formId);
}

function findRole(evaluation: DocumentEvaluation, target: HostTarget | RoleAddress) {
  if ("kind" in target) {
    if (target.kind !== "form-role") return undefined;
    return evaluation.roles.find((role) => role.key === roleKey({ formId: target.formId, partKey: target.partKey }));
  }
  return evaluation.roles.find((role) => role.key === roleKey(target));
}

function isInsideRole(role: NonNullable<ReturnType<typeof findRole>>, point: Vec2): boolean {
  const boundary = role.boundary;
  if (boundary && boundary.length >= 3) return pointInPolygon(point, boundary);
  const region = role.region;
  if (!region) return true;
  return point[0] >= region.min[0] - EPSILON && point[0] <= region.max[0] + EPSILON &&
    point[1] >= region.min[1] - EPSILON && point[1] <= region.max[1] + EPSILON;
}

function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (pointOnSegment(point, a, b)) return true;
    const crosses = (a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointOnSegment(point: Vec2, a: Vec2, b: Vec2): boolean {
  const lengthSq = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  if (lengthSq <= EPSILON * EPSILON) {
    return (point[0] - a[0]) ** 2 + (point[1] - a[1]) ** 2 <= EPSILON * EPSILON;
  }
  const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
  if (Math.abs(cross) > EPSILON) return false;
  const dot = (point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1]);
  if (dot < -EPSILON) return false;
  return dot <= lengthSq + EPSILON;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function addScaled(base: Vec3, axes: Frame, coordinates: Vec3): Vec3 {
  return [
    base[0] + axes.u[0] * coordinates[0] + axes.v[0] * coordinates[1] + axes.normal[0] * coordinates[2],
    base[1] + axes.u[1] * coordinates[0] + axes.v[1] * coordinates[1] + axes.normal[1] * coordinates[2],
    base[2] + axes.u[2] * coordinates[0] + axes.v[2] * coordinates[1] + axes.normal[2] * coordinates[2],
  ];
}

function toLocal(vector: Vec3, frame: Frame): Vec3 {
  return [dot(vector, frame.u), dot(vector, frame.v), dot(vector, frame.normal)];
}

/** Transport a child world frame by the rigid delta from one host frame to another. */
function transportFrame(child: Frame, previousHost: Frame, currentHost: Frame): Frame {
  const relativeOrigin: Vec3 = [
    child.origin[0] - previousHost.origin[0],
    child.origin[1] - previousHost.origin[1],
    child.origin[2] - previousHost.origin[2],
  ];
  const mapDirection = (direction: Vec3): Vec3 => addScaled([0, 0, 0], currentHost, toLocal(direction, previousHost));
  return {
    origin: addScaled(currentHost.origin, currentHost, toLocal(relativeOrigin, previousHost)),
    u: mapDirection(child.u),
    v: mapDirection(child.v),
    normal: mapDirection(child.normal),
  };
}

/** Apply the same rigid host-frame delta to a world-space carrier anchor. */
function transportPoint(point: Vec3, previousHost: Frame, currentHost: Frame): Vec3 {
  const relative: Vec3 = [
    point[0] - previousHost.origin[0],
    point[1] - previousHost.origin[1],
    point[2] - previousHost.origin[2],
  ];
  return addScaled(currentHost.origin, currentHost, toLocal(relative, previousHost));
}

/** Sweep carriers are authored in world coordinates and must follow their form frame. */
function transportSweepCarrier(carrier: Carrier, previousFrame: Frame, currentFrame: Frame): void {
  carrier.points = carrier.points.map((point) => ({
    ...point,
    position: transportPoint(point.position, previousFrame, currentFrame),
  }));
  carrier.frameAnchor = transportFrame(carrier.frameAnchor, previousFrame, currentFrame);
}

function roleFrame(evaluation: DocumentEvaluation, target: HostTarget): Frame | undefined {
  if (target.kind !== "form-role") return undefined;
  return findRole(evaluation, target)?.frame;
}

function targetExists(evaluation: DocumentEvaluation, target: HostTarget, anchor?: Vec2): boolean {
  if (target.kind === "fixture-plane") return true;
  const role = findRole(evaluation, target);
  return Boolean(role?.frame && (anchor === undefined || isInsideRole(role, anchor)));
}

function updateTokenPose(attachment: Attachment, evaluation: DocumentEvaluation): void {
  if (attachment.target.kind !== "form-role") return;
  const frame = roleFrame(evaluation, attachment.target);
  if (!frame) return;
  attachment.lastFrame = {
    origin: addScaled(frame.origin, frame, [attachment.anchor[0], attachment.anchor[1], 0]),
    u: [...frame.u],
    v: [...frame.v],
    normal: [...frame.normal],
  };
}

/** Apply a newly accepted evaluation to links without ever guessing a replacement role. */
function reconcileLinks(document: LabDocument, evaluation: DocumentEvaluation): boolean {
  let changed = false;
  for (const form of document.forms) {
    const link = form.hostLink;
    if (!link || link.status !== "resolved" || link.target.kind !== "form-role") continue;
    const role = findRole(evaluation, link.target);
    if (!role?.frame) {
      link.status = "unresolved";
      link.reason = "The addressed host role is no longer available.";
      changed = true;
      continue;
    }
    const transportedFrame = sameFrame(link.lastFrame, role.frame)
      ? form.frame
      : transportFrame(form.frame, link.lastFrame, role.frame);
    const childAnchor = projectOriginToRole(transportedFrame.origin, role.frame);
    if (role.boundary || role.region) {
      if (!isInsideRole(role, childAnchor)) {
        link.status = "unresolved";
        link.reason = "The child origin lies outside the host role's current bounds.";
        changed = true;
        continue;
      }
    }
    if (!sameFrame(link.lastFrame, role.frame)) {
      if (form.operation.kind === "sweep") {
        transportSweepCarrier(form.operation.carrier, link.lastFrame, role.frame);
      }
      form.frame = transportedFrame;
      link.lastFrame = clone(role.frame);
      changed = true;
    }
  }

  for (const attachment of document.attachments) {
    if (attachment.status !== "resolved" || attachment.target.kind !== "form-role") continue;
    const role = findRole(evaluation, attachment.target);
    if (!role?.frame) {
      attachment.status = "unresolved";
      attachment.reason = "The addressed host role is no longer available as a planar anchor.";
      changed = true;
      continue;
    }
    if (!isInsideRole(role, attachment.anchor)) {
      attachment.status = "unresolved";
      attachment.reason = "The anchor lies outside the host role's current bounds.";
      changed = true;
      continue;
    }
    const before = clone(attachment.lastFrame);
    updateTokenPose(attachment, evaluation);
    if (!sameFrame(before, attachment.lastFrame)) changed = true;
  }
  return changed;
}

function projectOriginToRole(origin: Vec3, roleFrameValue: Frame): Vec2 {
  const delta: Vec3 = [origin[0] - roleFrameValue.origin[0], origin[1] - roleFrameValue.origin[1], origin[2] - roleFrameValue.origin[2]];
  return [dot(delta, roleFrameValue.u), dot(delta, roleFrameValue.v)];
}

function sameVec(a: Vec3, b: Vec3): boolean {
  return Math.abs(a[0] - b[0]) <= EPSILON && Math.abs(a[1] - b[1]) <= EPSILON && Math.abs(a[2] - b[2]) <= EPSILON;
}

function sameFrame(a: Frame, b: Frame): boolean {
  return sameVec(a.origin, b.origin) && sameVec(a.u, b.u) && sameVec(a.v, b.v) && sameVec(a.normal, b.normal);
}

function copyFinishToSplit(document: LabDocument, formId: string, oldSegmentId: string, firstId: string, secondId: string): void {
  for (const finish of [...document.finishes]) {
    if (finish.target.formId !== formId || finish.target.partKey !== oldSegmentId) continue;
    finish.target = { formId, partKey: firstId };
    document.finishes.push({
      id: allocate(document, "finish"),
      target: { formId, partKey: secondId },
      material: finish.material,
      color: finish.color,
      status: "resolved",
    });
    finish.status = "resolved";
    finish.reason = undefined;
  }
}

function mergeSegmentFinishes(document: LabDocument, formId: string, incomingId: string, outgoingId: string, mergedId: string): void {
  const incoming = document.finishes.filter((finish) => finish.target.formId === formId && finish.target.partKey === incomingId);
  const outgoing = document.finishes.filter((finish) => finish.target.formId === formId && finish.target.partKey === outgoingId);
  const primary = incoming[0] ?? outgoing[0];
  if (!primary) return;
  primary.target = { formId, partKey: mergedId };
  primary.status = "resolved";
  primary.reason = undefined;
  for (const secondary of [...incoming, ...outgoing]) {
    if (secondary.id === primary.id) continue;
    if (secondary.material === primary.material && secondary.color === primary.color) {
      document.finishes = document.finishes.filter((finish) => finish.id !== secondary.id);
    } else {
      secondary.status = "unresolved";
      secondary.reason = `The authored segment was merged into ${mergedId}; the incoming segment's finish was kept on the merged side.`;
    }
  }
}

function applyCommand(document: LabDocument, command: LabCommand, evaluator: DocumentEvaluator): CommandResult | LabDocument {
  const candidate = clone(document);
  switch (command.type) {
    case "addForm": {
      const form: Form = { ...clone(command.form), id: allocate(candidate, "form"), revolveCapLifetimeKeys: null };
      if (form.operation.kind === "revolve" && !isFullRevolve(form)) {
        form.revolveCapLifetimeKeys = { start: allocate(candidate, "cap"), end: allocate(candidate, "cap") };
      }
      candidate.forms.push(form);
      return candidate;
    }
    case "removeForm": {
      const index = candidate.forms.findIndex((form) => form.id === command.formId);
      if (index < 0) return refuse("form-not-found", `Form ${command.formId} does not exist.`);
      candidate.forms.splice(index, 1);
      candidate.finishes = candidate.finishes.filter((finish) => finish.target.formId !== command.formId);
      return candidate;
    }
    case "patchForm": {
      const form = findForm(candidate, command.formId);
      if (!form) return refuse("form-not-found", `Form ${command.formId} does not exist.`);
      const previousFrame = clone(form.frame);
      const previousOperation = form.operation;
      Object.assign(form, clone(command.patch));
      const includesOperation = Object.prototype.hasOwnProperty.call(command.patch, "operation");
      const includesFrame = Object.prototype.hasOwnProperty.call(command.patch, "frame");
      if (includesFrame && !includesOperation && previousOperation.kind === "sweep" && form.operation.kind === "sweep") {
        transportSweepCarrier(form.operation.carrier, previousFrame, form.frame);
      }
      if (form.operation.kind === "revolve" && !isFullRevolve(form)) {
        if (previousOperation.kind !== "revolve" || isFullRevolve({ operation: previousOperation }) || !form.revolveCapLifetimeKeys) {
          form.revolveCapLifetimeKeys = { start: allocate(candidate, "cap"), end: allocate(candidate, "cap") };
        }
      } else {
        form.revolveCapLifetimeKeys = null;
      }
      return candidate;
    }
    case "moveProfilePoint": {
      const form = findForm(candidate, command.formId);
      if (!form) return refuse("form-not-found", `Form ${command.formId} does not exist.`);
      const point = form.profile.points.find((item) => item.id === command.pointId);
      if (!point) return refuse("profile-point-not-found", `Profile point ${command.pointId} does not exist.`);
      point.position = [...command.position];
      return candidate;
    }
    case "insertProfilePoint": {
      const form = findForm(candidate, command.formId);
      if (!form) return refuse("form-not-found", `Form ${command.formId} does not exist.`);
      const segmentIndex = form.profile.segments.findIndex((segment) => segment.id === command.segmentId);
      if (segmentIndex < 0) return refuse("profile-segment-not-found", `Profile segment ${command.segmentId} does not exist.`);
      const segment = form.profile.segments[segmentIndex];
      const pointId = allocate(candidate, "point");
      const firstId = allocate(candidate, "segment");
      const secondId = allocate(candidate, "segment");
      const pointIndex = form.profile.points.findIndex((point) => point.id === segment.from);
      if (pointIndex < 0 || !form.profile.points.some((point) => point.id === segment.to)) {
        return refuse("profile-segment-invalid", `Segment ${segment.id} does not reference existing points.`);
      }
      form.profile.points.splice(pointIndex + 1, 0, { id: pointId, position: [...command.position] });
      form.profile.segments.splice(segmentIndex, 1,
        { id: firstId, from: segment.from, to: pointId },
        { id: secondId, from: pointId, to: segment.to });
      copyFinishToSplit(candidate, form.id, segment.id, firstId, secondId);
      return candidate;
    }
    case "removeProfilePoint": {
      const form = findForm(candidate, command.formId);
      if (!form) return refuse("form-not-found", `Form ${command.formId} does not exist.`);
      if (form.profile.points.length <= 3) return refuse("profile-minimum-points", "A closed profile must keep at least three points.");
      const pointIndex = form.profile.points.findIndex((point) => point.id === command.pointId);
      if (pointIndex < 0) return refuse("profile-point-not-found", `Profile point ${command.pointId} does not exist.`);
      const incomingIndex = form.profile.segments.findIndex((segment) => segment.to === command.pointId);
      const outgoingIndex = form.profile.segments.findIndex((segment) => segment.from === command.pointId);
      if (incomingIndex < 0 || outgoingIndex < 0) return refuse("profile-contour-invalid", "The point is not connected by one incoming and one outgoing segment.");
      const incoming = form.profile.segments[incomingIndex];
      const outgoing = form.profile.segments[outgoingIndex];
      const merged = { id: allocate(candidate, "segment"), from: incoming.from, to: outgoing.to };
      form.profile.points.splice(pointIndex, 1);
      if (outgoingIndex === 0 && incomingIndex === form.profile.segments.length - 1) {
        form.profile.segments.splice(incomingIndex, 1);
        form.profile.segments.splice(0, 1);
        form.profile.segments.push(merged);
      } else {
        const start = Math.min(incomingIndex, outgoingIndex);
        const count = Math.abs(incomingIndex - outgoingIndex) + 1;
        form.profile.segments.splice(start, count, merged);
      }
      mergeSegmentFinishes(candidate, form.id, incoming.id, outgoing.id, merged.id);
      return candidate;
    }
    case "reverseCarrier": {
      const form = findForm(candidate, command.formId);
      if (!form) return refuse("form-not-found", `Form ${command.formId} does not exist.`);
      if (form.operation.kind !== "sweep") return refuse("not-a-sweep", "Only sweep forms have a carrier to reverse.");
      const carrier = form.operation.carrier;
      carrier.points.reverse();
      carrier.segments = carrier.segments.reverse().map((segment) => ({ ...segment, from: segment.to, to: segment.from }));
      // frameAnchorPointId is a physical anchor, so it intentionally survives reversal.
      return candidate;
    }
    case "paint": {
      const address = command.target;
      if (!findForm(candidate, address.formId)) return refuse("form-not-found", `Form ${address.formId} does not exist.`);
      const key = roleKey(address);
      const exists = (evaluation: DocumentEvaluation) => evaluation.roles.some((role) => role.key === key);
      const currentEvaluation = evaluateSafely(candidate, evaluator);
      if (!exists(currentEvaluation)) return refuse("role-not-found", "The addressed semantic role does not exist.", currentEvaluation);
      const existing = candidate.finishes.find((finish) => roleKey(finish.target) === key);
      if (existing) {
        existing.material = command.material;
        existing.color = command.color;
        existing.status = "resolved";
        existing.reason = undefined;
      } else {
        candidate.finishes.push({ id: allocate(candidate, "finish"), target: clone(address), material: command.material, color: command.color, status: "resolved" });
      }
      return candidate;
    }
    case "attach": {
      if ("attachment" in command) {
        if (!targetExists(evaluateSafely(candidate, evaluator), command.attachment.target, command.attachment.anchor)) {
          return refuse("attachment-target-unavailable", "The selected host role or anchor is not available.");
        }
        candidate.attachments.push({ ...clone(command.attachment), id: allocate(candidate, "attachment"), status: "resolved" });
        return candidate;
      }
      const child = findForm(candidate, command.childFormId);
      if (!child) return refuse("form-not-found", `Child form ${command.childFormId} does not exist.`);
      const evaluation = evaluateSafely(candidate, evaluator);
      if (!targetExists(evaluation, command.target, command.target.kind === "form-role" ? projectOriginToRole(child.frame.origin, findRole(evaluation, command.target)?.frame ?? command.lastFrame) : undefined)) {
        return refuse("attachment-target-unavailable", "The selected host role or child origin is not available.", evaluation);
      }
      child.hostLink = {
        target: clone(command.target),
        lastFrame: clone(roleFrame(evaluation, command.target) ?? command.lastFrame),
        status: "resolved",
      };
      return candidate;
    }
    case "repairAttachment": {
      const attachment = candidate.attachments.find((item) => item.id === command.attachmentId);
      if (!attachment) return refuse("attachment-not-found", `Attachment ${command.attachmentId} does not exist.`);
      const evaluation = evaluateSafely(candidate, evaluator);
      if (!targetExists(evaluation, command.target, command.anchor)) return refuse("attachment-target-unavailable", "The selected host role or anchor is not available.", evaluation);
      attachment.target = clone(command.target);
      attachment.anchor = [...command.anchor];
      attachment.status = "resolved";
      attachment.reason = undefined;
      attachment.lastFrame = clone(command.lastFrame);
      updateTokenPose(attachment, evaluation);
      return candidate;
    }
    case "repairChildHost": {
      const child = findForm(candidate, command.childFormId);
      if (!child) return refuse("form-not-found", `Child form ${command.childFormId} does not exist.`);
      const evaluation = evaluateSafely(candidate, evaluator);
      const hostFrame = roleFrame(evaluation, command.target) ?? command.lastFrame;
      const repairedFrame = child.hostLink?.lastFrame ? transportFrame(child.frame, child.hostLink.lastFrame, hostFrame) : child.frame;
      if (!targetExists(evaluation, command.target, command.target.kind === "form-role" ? projectOriginToRole(repairedFrame.origin, hostFrame) : undefined)) {
        return refuse("attachment-target-unavailable", "The selected host role or child origin is not available.", evaluation);
      }
      if (child.operation.kind === "sweep") {
        transportSweepCarrier(child.operation.carrier, child.frame, repairedFrame);
      }
      child.frame = repairedFrame;
      child.hostLink = { target: clone(command.target), lastFrame: clone(hostFrame), status: "resolved" };
      return candidate;
    }
  }
}

function evaluateSafely(document: LabDocument, evaluator: DocumentEvaluator): DocumentEvaluation {
  try {
    const result = evaluator(document);
    if (!result.valid && !result.reason) {
      return { ...result, reason: { code: "invalid-document", message: "One or more forms could not be evaluated." } };
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The evaluator failed.";
    return {
      valid: false,
      reason: { code: "evaluation-error", message },
      mesh: { positions: [], indices: [], triangleRoleKeys: [] },
      roles: [],
      forms: {},
    };
  }
}

function evaluateCandidate(candidate: LabDocument, evaluator: DocumentEvaluator): { document?: LabDocument; evaluation: DocumentEvaluation; reason?: { code: string; message: string } } {
  const cycle = findHostCycle(candidate);
  if (cycle) {
    const reason = { code: "host-cycle", message: `Host links form a cycle: ${cycle.join(" → ")}.` };
    return { evaluation: emptyEvaluation(reason), reason };
  }
  let evaluation = evaluateSafely(candidate, evaluator);
  if (!evaluation.valid) return { evaluation, reason: evaluation.reason ?? { code: "invalid-document", message: "The candidate document is invalid." } };
  for (let pass = 0; pass <= candidate.forms.length; pass += 1) {
    if (!reconcileLinks(candidate, evaluation)) break;
    evaluation = evaluateSafely(candidate, evaluator);
    if (!evaluation.valid) return { evaluation, reason: evaluation.reason ?? { code: "invalid-document", message: "The candidate document is invalid." } };
  }
  return { document: candidate, evaluation };
}

function findHostCycle(document: LabDocument): string[] | undefined {
  const formsById = new Map(document.forms.map((form) => [form.id, form]));
  for (const start of document.forms) {
    const path: string[] = [];
    const seenAt = new Map<string, number>();
    let current: Form | undefined = start;
    while (current) {
      const prior = seenAt.get(current.id);
      if (prior !== undefined) return [...path.slice(prior), current.id];
      seenAt.set(current.id, path.length);
      path.push(current.id);
      const target: HostTarget | undefined = current.hostLink?.target;
      current = target?.kind === "form-role" ? formsById.get(target.formId) : undefined;
    }
  }
  return undefined;
}

function emptyEvaluation(reason: { code: string; message: string }): DocumentEvaluation {
  return { valid: false, reason, mesh: { positions: [], indices: [], triangleRoleKeys: [] }, roles: [], forms: {} };
}

export function createFormLabStore(
  initial: LabDocument = createLabDocument(),
  evaluator: DocumentEvaluator = evaluateDocument,
): FormLabStore {
  let committed = clone(initial);
  let shown = committed;
  let previewActive = false;
  let allocationHighWater = committed.nextId;
  const undoStack: LabDocument[] = [];
  const redoStack: LabDocument[] = [];
  const listeners = new Set<() => void>();

  const notify = () => { for (const listener of [...listeners]) listener(); };
  const discardPreview = () => {
    if (!previewActive) return;
    shown = committed;
    previewActive = false;
    notify();
  };
  const installCommitted = (document: LabDocument) => {
    committed = document;
    shown = committed;
    previewActive = false;
    allocationHighWater = Math.max(allocationHighWater, committed.nextId);
    notify();
  };
  const attempt = (command: LabCommand): { result: CommandResult; candidate?: LabDocument } => {
    const baseline = clone(committed);
    baseline.nextId = Math.max(baseline.nextId, allocationHighWater);
    const applied = applyCommand(baseline, command, evaluator);
    if (!("formatVersion" in applied)) return { result: applied };
    applied.nextId = Math.max(applied.nextId, allocationHighWater);
    const checked = evaluateCandidate(applied, evaluator);
    if (!checked.document) return { result: refuse(checked.reason?.code ?? "invalid-document", checked.reason?.message ?? "The candidate document is invalid.", checked.evaluation) };
    return { candidate: checked.document, result: { status: "accepted", document: checked.document, evaluation: checked.evaluation, changed: true } };
  };

  return {
    get document() { return committed; },
    get shownDocument() { return shown; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    preview(command) {
      const { result, candidate } = attempt(command);
      if (candidate) {
        shown = candidate;
        previewActive = true;
        notify();
      }
      return result;
    },
    commit(command) {
      let candidate: LabDocument | undefined;
      let evaluation: DocumentEvaluation | undefined;
      if (command) {
        const attempted = attempt(command);
        if (attempted.result.status === "refused") {
          discardPreview();
          return attempted.result;
        }
        candidate = attempted.candidate;
        evaluation = attempted.result.evaluation;
      } else if (previewActive) {
        candidate = clone(shown);
        const checked = evaluateCandidate(candidate, evaluator);
        if (!checked.document) {
          const result = refuse(checked.reason?.code ?? "invalid-document", checked.reason?.message ?? "The candidate document is invalid.", checked.evaluation);
          discardPreview();
          return result;
        }
        candidate = checked.document;
        evaluation = checked.evaluation;
      } else {
        const existingEvaluation = evaluateSafely(committed, evaluator);
        return { status: "accepted", document: committed, evaluation: existingEvaluation, changed: false };
      }
      if (!candidate || !evaluation) {
        const existingEvaluation = evaluateSafely(committed, evaluator);
        return { status: "accepted", document: committed, evaluation: existingEvaluation, changed: false };
      }
      if (JSON.stringify(candidate) === JSON.stringify(committed)) {
        shown = committed;
        previewActive = false;
        notify();
        return { status: "accepted", document: committed, evaluation, changed: false };
      }
      undoStack.push(clone(committed));
      redoStack.length = 0;
      allocationHighWater = Math.max(allocationHighWater, candidate.nextId);
      installCommitted(candidate);
      return { status: "accepted", document: committed, evaluation, changed: true };
    },
    cancel() {
      discardPreview();
    },
    undo() {
      if (previewActive) {
        shown = committed;
        previewActive = false;
        notify();
        return true;
      }
      const previous = undoStack.pop();
      if (!previous) return false;
      redoStack.push(clone(committed));
      previous.nextId = Math.max(previous.nextId, allocationHighWater);
      installCommitted(previous);
      return true;
    },
    redo() {
      if (previewActive) {
        shown = committed;
        previewActive = false;
        notify();
        return true;
      }
      const next = redoStack.pop();
      if (!next) return false;
      undoStack.push(clone(committed));
      next.nextId = Math.max(next.nextId, allocationHighWater);
      installCommitted(next);
      return true;
    },
    load(document) {
      const candidate = clone(document);
      if (!isLabDocument(candidate)) return refuse("document-shape-invalid", "The saved value is not a Native Form Lab document.");
      const checked = evaluateCandidate(candidate, evaluator);
      if (!checked.document) return refuse(checked.reason?.code ?? "invalid-document", checked.reason?.message ?? "The document is invalid.", checked.evaluation);
      undoStack.length = 0;
      redoStack.length = 0;
      allocationHighWater = checked.document.nextId;
      installCommitted(checked.document);
      return { status: "accepted", document: committed, evaluation: checked.evaluation, changed: true };
    },
    serialize() { return JSON.stringify(committed, null, 2); },
  };
}

export function deserialize(serialized: string): LabDocument {
  const parsed: unknown = JSON.parse(serialized);
  if (!isLabDocument(parsed)) throw new Error("Saved data is not a Native Form Lab document.");
  return parsed;
}

function isLabDocument(value: unknown): value is LabDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LabDocument>;
  return candidate.formatVersion === 1 && Number.isInteger(candidate.nextId) && (candidate.nextId ?? -1) >= 1 &&
    Array.isArray(candidate.forms) && Array.isArray(candidate.attachments) && Array.isArray(candidate.finishes);
}

export function createCarrier(points: Vec3[], frameAnchor: Frame, idPrefix = "carrier"): Carrier {
  const keyedPoints = points.map((position, index) => ({ id: `${idPrefix}:point:${index + 1}`, position: [...position] as Vec3 }));
  const segments = keyedPoints.slice(0, -1).map((point, index) => ({
    id: `${idPrefix}:segment:${index + 1}`,
    from: point.id,
    to: keyedPoints[index + 1].id,
  }));
  return {
    id: idPrefix,
    points: keyedPoints,
    segments,
    frameAnchor: clone(frameAnchor),
    frameAnchorPointId: keyedPoints[0]?.id ?? `${idPrefix}:missing-anchor`,
  };
}
