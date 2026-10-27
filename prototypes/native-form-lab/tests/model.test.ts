import { describe, expect, it } from "vitest";
import {
  createLabDocument,
  createProfile,
  roleKey,
  type DocumentEvaluation,
  type FormDraft,
  type Frame,
  type LabDocument,
  type RoleAddress,
} from "../src/model/types";
import { createCarrier, createFormLabStore, deserialize } from "../src/model/store";

const frame: Frame = {
  origin: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, 1, 0],
  normal: [0, 0, 1],
};

function squareDraft(name = "Square", operation: FormDraft["operation"] = { kind: "extrude", height: 1 }): FormDraft {
  return {
    name,
    profile: createProfile([[-1, -1], [1, -1], [1, 1], [-1, 1]], `${name.toLowerCase()}:profile`),
    frame: structuredClone(frame),
    operation,
    rounding: { radius: 0, policy: "none" },
  };
}

function modelEvaluator(document: LabDocument): DocumentEvaluation {
  const roles = document.forms.flatMap((form) => {
    const xs = form.profile.points.map((point) => point.position[0]);
    const ys = form.profile.points.map((point) => point.position[1]);
    const boundary = form.profile.points.map((point) => [...point.position] as [number, number]);
    if (boundary.length) boundary.push([...boundary[0]] as [number, number]);
    const region = { min: [Math.min(...xs), Math.min(...ys)] as [number, number], max: [Math.max(...xs), Math.max(...ys)] as [number, number] };
    return form.profile.segments.map((segment) => {
      const address: RoleAddress = { formId: form.id, partKey: segment.id };
      return { key: roleKey(address), address, label: "Surface", kind: "face" as const, frame: structuredClone(form.frame), region, boundary };
    });
  });
  const invalid = document.forms.find((form) => form.operation.kind === "extrude" && form.operation.height <= 0);
  const mesh = { positions: [], indices: [], triangleRoleKeys: [] };
  const forms = Object.fromEntries(document.forms.map((form) => [form.id, {
    formId: form.id,
    valid: !invalid,
    ...(invalid ? { reason: { code: "invalid-height", message: "Height must be positive." } } : {}),
    mesh,
    roles: roles.filter((role) => role.address.formId === form.id),
  }]));
  return {
    valid: !invalid,
    ...(invalid ? { reason: { code: "invalid-height", message: "Height must be positive." } } : {}),
    mesh,
    roles,
    forms,
  };
}

function addSquare(store: ReturnType<typeof createFormLabStore>, name = "Square", operation?: FormDraft["operation"]) {
  const result = store.commit({ type: "addForm", form: squareDraft(name, operation) });
  expect(result.status).toBe("accepted");
  if (result.status !== "accepted") throw new Error(result.reason.message);
  return result.document.forms.at(-1)!;
}

describe("Native Form Lab authored model", () => {
  it("previews without committing, commits one revision, and restores exact addresses through undo/redo and reload", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const form = addSquare(store);
    const original = store.serialize();
    const point = form.profile.points[0];

    const preview = store.preview({ type: "moveProfilePoint", formId: form.id, pointId: point.id, position: [-0.8, -0.9] });
    expect(preview.status).toBe("accepted");
    expect(store.document.forms[0].profile.points[0].position).toEqual([-1, -1]);
    expect(store.shownDocument.forms[0].profile.points[0].position).toEqual([-0.8, -0.9]);
    store.cancel();
    expect(store.shownDocument.forms[0].profile.points[0].position).toEqual([-1, -1]);

    const commit = store.commit({ type: "moveProfilePoint", formId: form.id, pointId: point.id, position: [-0.8, -0.9] });
    expect(commit.status).toBe("accepted");
    expect(store.undo()).toBe(true);
    expect(store.serialize()).toBe(original);
    expect(store.redo()).toBe(true);
    expect(store.document.forms[0].profile.points[0].id).toBe(point.id);

    const restored = createFormLabStore(createLabDocument(), modelEvaluator);
    expect(restored.load(deserialize(store.serialize())).status).toBe("accepted");
    expect(restored.serialize()).toBe(store.serialize());
  });

  it("refuses invalid candidates without changing shown state, committed state, or undo history", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const form = addSquare(store);
    const before = store.serialize();
    const result = store.preview({ type: "patchForm", formId: form.id, patch: { operation: { kind: "extrude", height: 0 } } });
    expect(result.status).toBe("refused");
    expect(store.serialize()).toBe(before);
    expect(store.shownDocument.forms[0].operation).toEqual({ kind: "extrude", height: 1 });
    expect(store.undo()).toBe(true);
    expect(store.document.forms).toHaveLength(0);
    expect(store.undo()).toBe(false);
  });

  it("drops a valid preview when its explicit final commit is refused, so Undo reaches the prior edit", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const form = addSquare(store, "Preview refusal");
    store.commit({ type: "patchForm", formId: form.id, patch: { operation: { kind: "extrude", height: 2 } } });

    expect(store.preview({ type: "patchForm", formId: form.id, patch: { operation: { kind: "extrude", height: 3 } } }).status).toBe("accepted");
    expect(store.shownDocument.forms[0].operation).toEqual({ kind: "extrude", height: 3 });
    expect(store.preview({ type: "patchForm", formId: form.id, patch: { operation: { kind: "extrude", height: 0 } } }).status).toBe("refused");
    expect(store.shownDocument.forms[0].operation).toEqual({ kind: "extrude", height: 3 });

    const refused = store.commit({ type: "patchForm", formId: form.id, patch: { operation: { kind: "extrude", height: 0 } } });
    expect(refused.status).toBe("refused");
    expect(store.shownDocument).toEqual(store.document);
    expect(store.document.forms[0].operation).toEqual({ kind: "extrude", height: 2 });
    expect(store.undo()).toBe(true);
    expect(store.document.forms[0].operation).toEqual({ kind: "extrude", height: 1 });
  });

  it("allocates fresh partial-revolve cap lifetimes, while undo restores the prior cap addresses", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const form = addSquare(store, "Revolve", { kind: "revolve", angleDegrees: 270 });
    const firstKeys = structuredClone(form.revolveCapLifetimeKeys);
    expect(firstKeys).not.toBeNull();

    store.commit({ type: "patchForm", formId: form.id, patch: { operation: { kind: "revolve", angleDegrees: 360 } } });
    expect(store.document.forms[0].revolveCapLifetimeKeys).toBeNull();
    expect(store.undo()).toBe(true);
    expect(store.document.forms[0].revolveCapLifetimeKeys).toEqual(firstKeys);

    store.commit({ type: "patchForm", formId: form.id, patch: { operation: { kind: "revolve", angleDegrees: 360 } } });
    store.commit({ type: "patchForm", formId: form.id, patch: { operation: { kind: "revolve", angleDegrees: 270 } } });
    expect(store.document.forms[0].revolveCapLifetimeKeys).not.toEqual(firstKeys);
  });

  it("broadcasts a painted segment to both split descendants and leaves a singular attachment unresolved", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const form = addSquare(store);
    const segment = form.profile.segments[0];
    const originalRole: RoleAddress = { formId: form.id, partKey: segment.id };
    store.commit({ type: "paint", target: originalRole, material: "glaze", color: "#e85d38" });
    store.commit({
      type: "attach",
      attachment: {
        label: "Pin",
        target: { kind: "form-role", formId: form.id, partKey: segment.id },
        anchor: [0, 0],
        lastFrame: structuredClone(frame),
      },
    });

    store.commit({ type: "insertProfilePoint", formId: form.id, segmentId: segment.id, position: [0, -1] });
    const splitForm = store.document.forms[0];
    const descendants = splitForm.profile.segments.filter((item) => item.from === segment.from || item.to === segment.to);
    const painted = store.document.finishes.filter((finish) => finish.material === "glaze");
    expect(painted).toHaveLength(2);
    expect(painted.every((finish) => finish.target.formId === form.id && finish.target.partKey !== segment.id)).toBe(true);
    expect(store.document.attachments[0].status).toBe("unresolved");
    expect(store.document.attachments[0].lastFrame).toEqual(frame);

    store.undo();
    expect(store.document.attachments[0].status).toBe("resolved");
    expect(store.document.attachments[0].target).toEqual({ kind: "form-role", formId: form.id, partKey: segment.id });
    expect(store.document.finishes[0].target).toEqual(originalRole);
    expect(descendants.length).toBe(2);

    store.commit({ type: "insertProfilePoint", formId: form.id, segmentId: segment.id, position: [0, -1] });
    const splitPoint = store.document.forms[0].profile.points.find((point) => point.position[0] === 0 && point.position[1] === -1)!;
    store.commit({ type: "removeProfilePoint", formId: form.id, pointId: splitPoint.id });
    const merged = store.document.forms[0].profile.segments.find((item) => item.from === segment.from && item.to === segment.to)!;
    const mergedFinishes = store.document.finishes.filter((finish) => finish.material === "glaze");
    expect(mergedFinishes).toHaveLength(1);
    expect(mergedFinishes[0].target).toEqual({ formId: form.id, partKey: merged.id });
    expect(mergedFinishes[0].status).toBe("resolved");
  });

  it("keeps the incoming finish on a merged side and diagnoses an incompatible secondary", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const form = addSquare(store, "Merge finish");
    const incoming = form.profile.segments[0];
    const outgoing = form.profile.segments[1];
    store.commit({ type: "paint", target: { formId: form.id, partKey: incoming.id }, material: "matte", color: "#111111" });
    const incomingFinishId = store.document.finishes.find((finish) => finish.target.partKey === incoming.id)!.id;
    store.commit({ type: "paint", target: { formId: form.id, partKey: outgoing.id }, material: "gloss", color: "#eeeeee" });
    store.commit({ type: "removeProfilePoint", formId: form.id, pointId: incoming.to });

    const merged = store.document.forms[0].profile.segments.find((item) => item.from === incoming.from && item.to === outgoing.to)!;
    const primary = store.document.finishes.find((finish) => finish.id === incomingFinishId);
    const secondary = store.document.finishes.find((finish) => finish.material === "gloss");
    expect(primary?.target).toEqual({ formId: form.id, partKey: merged.id });
    expect(primary?.status).toBe("resolved");
    expect(secondary?.target.partKey).toBe(outgoing.id);
    expect(secondary?.status).toBe("unresolved");
    expect(secondary?.reason).toMatch(/incoming segment's finish was kept/);
  });

  it("keeps the contour segment order valid when removing the first profile point", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const form = addSquare(store, "Wrap merge");
    const removed = form.profile.points[0];
    const expectedFrom = form.profile.points[3].id;
    const expectedTo = form.profile.points[1].id;
    store.commit({ type: "removeProfilePoint", formId: form.id, pointId: removed.id });
    const profile = store.document.forms[0].profile;
    expect(profile.points.map((point) => point.id)).toEqual(form.profile.points.slice(1).map((point) => point.id));
    expect(profile.segments.map(({ from, to }) => [from, to])).toEqual([
      [form.profile.points[1].id, form.profile.points[2].id],
      [form.profile.points[2].id, form.profile.points[3].id],
      [expectedFrom, expectedTo],
    ]);
  });

  it("keeps a child form at its last world pose when its host form is removed", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const parent = addSquare(store, "Host");
    const child = addSquare(store, "Child");
    const parentRole = parent.profile.segments[0];
    const lastHostFrame = structuredClone(parent.frame);
    const attach = store.commit({
      type: "attach",
      childFormId: child.id,
      target: { kind: "form-role", formId: parent.id, partKey: parentRole.id },
      lastFrame: lastHostFrame,
    });
    expect(attach.status).toBe("accepted");
    const childPose = structuredClone(store.document.forms.find((form) => form.id === child.id)!.frame);

    store.commit({ type: "removeForm", formId: parent.id });
    expect(store.document.forms.map((form) => form.id)).toContain(child.id);
    const savedChild = store.document.forms.find((form) => form.id === child.id)!;
    expect(savedChild.hostLink?.status).toBe("unresolved");
    expect(savedChild.hostLink?.lastFrame).toEqual(lastHostFrame);
    expect(savedChild.frame).toEqual(childPose);
  });

  it("transports a resolved child by the host frame delta", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const parent = addSquare(store, "Moving host");
    const child = addSquare(store, "Hosted child");
    const part = parent.profile.segments[0];
    store.commit({
      type: "attach",
      childFormId: child.id,
      target: { kind: "form-role", formId: parent.id, partKey: part.id },
      lastFrame: structuredClone(parent.frame),
    });
    store.commit({ type: "patchForm", formId: parent.id, patch: { frame: { ...structuredClone(frame), origin: [3, 0, 0] } } });
    const movedChild = store.document.forms.find((form) => form.id === child.id)!;
    expect(movedChild.hostLink?.status).toBe("resolved");
    expect(movedChild.frame.origin).toEqual([3, 0, 0]);
    expect(movedChild.hostLink?.lastFrame.origin).toEqual([3, 0, 0]);
  });

  it("does not reuse allocated keys after undo and refuses cyclic host graphs", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const form = addSquare(store, "Key lifetime");
    const originalSegment = form.profile.segments[0];
    store.commit({ type: "insertProfilePoint", formId: form.id, segmentId: originalSegment.id, position: [0, -1] });
    const insertedId = store.document.forms[0].profile.points.find((point) => point.position[0] === 0)!.id;
    store.undo();
    store.commit({ type: "insertProfilePoint", formId: form.id, segmentId: originalSegment.id, position: [0.25, -1] });
    const newInsertedId = store.document.forms[0].profile.points.find((point) => point.position[0] === 0.25)!.id;
    expect(newInsertedId).not.toBe(insertedId);

    const other = addSquare(store, "Other");
    const ownSegment = store.document.forms.find((item) => item.id === form.id)!.profile.segments[0];
    const otherSegment = other.profile.segments[0];
    const firstLink = store.commit({
      type: "attach",
      childFormId: form.id,
      target: { kind: "form-role", formId: other.id, partKey: otherSegment.id },
      lastFrame: structuredClone(other.frame),
    });
    expect(firstLink.status).toBe("accepted");
    const selfCycle = store.commit({
      type: "patchForm",
      formId: form.id,
      patch: { hostLink: { target: { kind: "form-role", formId: form.id, partKey: ownSegment.id }, lastFrame: structuredClone(frame), status: "resolved" } },
    });
    expect(selfCycle.status).toBe("refused");
    const cycle = store.commit({
      type: "attach",
      childFormId: other.id,
      target: { kind: "form-role", formId: form.id, partKey: ownSegment.id },
      lastFrame: structuredClone(frame),
    });
    expect(cycle.status).toBe("refused");
    if (cycle.status === "refused") expect(cycle.reason.code).toBe("host-cycle");

    const before = store.serialize();
    const cyclicLoad = structuredClone(store.document);
    cyclicLoad.forms.find((item) => item.id === other.id)!.hostLink = {
      target: { kind: "form-role", formId: form.id, partKey: ownSegment.id },
      lastFrame: structuredClone(frame),
      status: "resolved",
    };
    expect(store.load(cyclicLoad).status).toBe("refused");
    expect(store.serialize()).toBe(before);
  });

  it("marks out-of-bounds anchors unresolved without clamping, and reverses carriers by stable keys", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const form = addSquare(store);
    const segment = form.profile.segments[0];
    store.commit({
      type: "attach",
      attachment: {
        label: "Edge token",
        target: { kind: "form-role", formId: form.id, partKey: segment.id },
        anchor: [0.8, 0],
        lastFrame: { ...structuredClone(frame), origin: [0.8, 0, 0] },
      },
    });
    const smaller = structuredClone(form.profile);
    smaller.points = smaller.points.map((point) => ({ ...point, position: [point.position[0] * 0.5, point.position[1] * 0.5] }));
    store.commit({ type: "patchForm", formId: form.id, patch: { profile: smaller } });
    expect(store.document.attachments[0].status).toBe("unresolved");
    expect(store.document.attachments[0].anchor).toEqual([0.8, 0]);
    expect(store.document.attachments[0].lastFrame.origin).toEqual([0.8, 0, 0]);

    const carrier = createCarrier([[0, 0, 0], [0, 0, 1], [1, 0, 1]], frame, "path");
    const sweep = addSquare(store, "Sweep", { kind: "sweep", carrier });
    const before = structuredClone(sweep.operation);
    store.commit({ type: "reverseCarrier", formId: sweep.id });
    const reversed = store.document.forms.find((item) => item.id === sweep.id)!.operation;
    expect(reversed.kind).toBe("sweep");
    if (reversed.kind !== "sweep" || before.kind !== "sweep") throw new Error("Expected sweep operation.");
    expect(reversed.carrier.points.map((point) => point.id)).toEqual([...before.carrier.points].reverse().map((point) => point.id));
    expect(reversed.carrier.segments.map((item) => item.id)).toEqual([...before.carrier.segments].reverse().map((item) => item.id));
    expect(reversed.carrier.frameAnchorPointId).toBe(before.carrier.frameAnchorPointId);
    expect(reversed.carrier.frameAnchor).toEqual(before.carrier.frameAnchor);
  });

  it("preserves addresses through a deterministic 100-edit and undo sequence", () => {
    const store = createFormLabStore(createLabDocument(), modelEvaluator);
    const form = addSquare(store, "Sequence");
    const firstPoint = form.profile.points[0];
    const originalId = firstPoint.id;
    const originalAddress = { formId: form.id, partKey: form.profile.segments[0].id };
    for (let index = 0; index < 100; index += 1) {
      store.commit({ type: "moveProfilePoint", formId: form.id, pointId: originalId, position: [-1 + (index + 1) / 1000, -1] });
    }
    expect(deserialize(store.serialize()).forms[0].profile.segments[0].id).toBe(originalAddress.partKey);
    for (let index = 0; index < 100; index += 1) expect(store.undo()).toBe(true);
    expect(store.document.forms[0].profile.points[0].position).toEqual([-1, -1]);
    expect(store.document.forms[0].profile.points[0].id).toBe(originalId);
  });
});
