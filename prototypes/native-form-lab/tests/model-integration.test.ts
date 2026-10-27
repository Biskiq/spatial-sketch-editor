import { describe, expect, it } from "vitest";
import { evaluateDocument } from "../src/geometry";
import { createLabDocument, createProfile, roleKey, type FormDraft, type Frame, type LabDocument, type GeneratedRole } from "../src/model/types";
import { createCarrier, createFormLabStore } from "../src/model/store";

const frame: Frame = {
  origin: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, 1, 0],
  normal: [0, 0, 1],
};

function pedestalDraft(name = "Pedestal"): FormDraft {
  return {
    name,
    profile: createProfile([[-1, -1], [1, -1], [1, 1], [-1, 1]], `${name.toLowerCase()}:profile`),
    frame: structuredClone(frame),
    operation: { kind: "extrude", height: 1 },
    rounding: { radius: 0, policy: "none" },
  };
}

function addForm(store: ReturnType<typeof createFormLabStore>, draft: FormDraft) {
  const result = store.commit({ type: "addForm", form: draft });
  expect(result.status).toBe("accepted");
  if (result.status !== "accepted") throw new Error(result.reason.message);
  return result.document.forms.at(-1)!;
}

function roleFor(document: LabDocument, predicate: (role: GeneratedRole) => boolean): GeneratedRole {
  const role = evaluateDocument(document).roles.find(predicate);
  if (!role) throw new Error("Expected semantic role was not generated.");
  return role;
}

function edgeAnchor(role: GeneratedRole): [number, number] {
  const points = role.boundary ?? [];
  if (points.length >= 3) {
    const center: [number, number] = [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ];
    const farthest = points.reduce((best, point) => {
      const distance = (point[0] - center[0]) ** 2 + (point[1] - center[1]) ** 2;
      const bestDistance = (best[0] - center[0]) ** 2 + (best[1] - center[1]) ** 2;
      return distance > bestDistance ? point : best;
    }, points[0]);
    return [center[0] + (farthest[0] - center[0]) * 0.65, center[1] + (farthest[1] - center[1]) * 0.65];
  }
  const region = role.region;
  if (!region) return [0, 0];
  const width = region.max[0] - region.min[0];
  const height = region.max[1] - region.min[1];
  return [region.min[0] + width * 0.65, region.min[1] + height * 0.65];
}

function meshBounds(document: LabDocument): number[] {
  const positions = evaluateDocument(document).mesh.positions;
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      bounds[axis] = Math.min(bounds[axis]!, positions[index + axis]!);
      bounds[axis + 3] = Math.max(bounds[axis + 3]!, positions[index + axis]!);
    }
  }
  return bounds;
}

function boundsOfPositions(positions: number[]): number[] {
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      bounds[axis] = Math.min(bounds[axis]!, positions[index + axis]!);
      bounds[axis + 3] = Math.max(bounds[axis + 3]!, positions[index + axis]!);
    }
  }
  return bounds;
}

function translatedFrame(source: Frame, delta: [number, number, number]): Frame {
  return {
    origin: [source.origin[0] + delta[0], source.origin[1] + delta[1], source.origin[2] + delta[2]],
    u: [...source.u],
    v: [...source.v],
    normal: [...source.normal],
  };
}

function hostedSweepDraft(name: string, anchor: Frame): FormDraft {
  const pathEnd: [number, number, number] = [
    anchor.origin[0] + anchor.normal[0] * 2,
    anchor.origin[1] + anchor.normal[1] * 2,
    anchor.origin[2] + anchor.normal[2] * 2,
  ];
  const draft = pedestalDraft(name);
  draft.profile = createProfile([[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]], `${name.toLowerCase()}:section`);
  draft.frame = structuredClone(anchor);
  draft.operation = { kind: "sweep", carrier: createCarrier([anchor.origin, pathEnd], anchor, `${name.toLowerCase()}:carrier`) };
  return draft;
}

function expectFramesNumericallyEqual(actual: Frame | undefined, expected: Frame | undefined): void {
  expect(actual === undefined).toBe(expected === undefined);
  if (!actual || !expected) return;
  for (const axis of ["origin", "u", "v", "normal"] as const) {
    for (let component = 0; component < 3; component += 1) {
      expect(actual[axis][component]).toBeCloseTo(expected[axis][component], 10);
    }
  }
}

describe("model and geometry integration", () => {
  it("follows an extrusion cap as height changes, then leaves an out-of-cap token unresolved on shrink", () => {
    const store = createFormLabStore(createLabDocument());
    const form = addForm(store, pedestalDraft());
    const cap = roleFor(store.document, (role) => role.address.formId === form.id && role.label === "End cap");
    const anchor = edgeAnchor(cap);
    store.commit({
      type: "attach",
      attachment: {
        label: "Cap token",
        target: { kind: "form-role", formId: form.id, partKey: cap.address.partKey },
        anchor,
        lastFrame: structuredClone(cap.frame!),
      },
    });
    const heightOne = structuredClone(store.document.attachments[0]!.lastFrame);

    store.commit({ type: "patchForm", formId: form.id, patch: { operation: { kind: "extrude", height: 2 } } });
    const heightTwo = structuredClone(store.document.attachments[0]!.lastFrame);
    expect(heightTwo.origin[2] - heightOne.origin[2]).toBeCloseTo(1, 8);
    expect(store.document.attachments[0]!.status).toBe("resolved");

    const shrunk = structuredClone(store.document.forms[0]!.profile);
    shrunk.points = shrunk.points.map((point) => ({ ...point, position: [point.position[0] * 0.2, point.position[1] * 0.2] }));
    store.commit({ type: "patchForm", formId: form.id, patch: { profile: shrunk } });
    expect(store.document.attachments[0]!.status).toBe("unresolved");
    expect(store.document.attachments[0]!.anchor).toEqual(anchor);
    expect(store.document.attachments[0]!.lastFrame).toEqual(heightTwo);
  });

  it("broadcasts side paint to split descendants and retires the original singular attachment", () => {
    const store = createFormLabStore(createLabDocument());
    const form = addForm(store, pedestalDraft("Side split"));
    const segment = form.profile.segments[0]!;
    const side = roleFor(store.document, (role) => role.address.formId === form.id && role.address.partKey === segment.id && role.frame !== undefined);
    const anchor = edgeAnchor(side);
    store.commit({ type: "paint", target: side.address, material: "paint", color: "#9c6a45" });
    store.commit({
      type: "attach",
      attachment: {
        label: "Side pin",
        target: { kind: "form-role", formId: form.id, partKey: side.address.partKey },
        anchor,
        lastFrame: structuredClone(side.frame!),
      },
    });
    const lastPose = structuredClone(store.document.attachments[0]!.lastFrame);
    const from = form.profile.points.find((point) => point.id === segment.from)!.position;
    const to = form.profile.points.find((point) => point.id === segment.to)!.position;
    store.commit({
      type: "insertProfilePoint",
      formId: form.id,
      segmentId: segment.id,
      position: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
    });

    const split = store.document.forms[0]!;
    const inserted = split.profile.points.find((point) => point.position[0] === (from[0] + to[0]) / 2 && point.position[1] === (from[1] + to[1]) / 2)!;
    const descendants = split.profile.segments.filter((item) =>
      (item.from === segment.from && item.to === inserted.id) || (item.from === inserted.id && item.to === segment.to));
    expect(descendants).toHaveLength(2);
    expect(store.document.finishes.filter((finish) => finish.material === "paint").map((finish) => finish.target.partKey).sort())
      .toEqual(descendants.map((item) => item.id).sort());
    expect(store.document.attachments[0]!.status).toBe("unresolved");
    expect(store.document.attachments[0]!.lastFrame).toEqual(lastPose);
    expect(evaluateDocument(store.document).roles.some((role) => role.key === roleKey(side.address))).toBe(false);
  });

  it("does not revive a partial-revolve cap address after a full turn", () => {
    const store = createFormLabStore(createLabDocument());
    const draft = pedestalDraft("Lathe");
    draft.profile = createProfile([[0.4, -1], [1, -1], [1, 1], [0.4, 1]], "lathe:profile");
    draft.operation = { kind: "revolve", angleDegrees: 270 };
    const form = addForm(store, draft);
    const initialCap = roleFor(store.document, (role) => role.address.formId === form.id && role.kind === "cap");
    store.commit({
      type: "attach",
      attachment: {
        label: "Revolve cap pin",
        target: { kind: "form-role", formId: form.id, partKey: initialCap.address.partKey },
        anchor: edgeAnchor(initialCap),
        lastFrame: structuredClone(initialCap.frame!),
      },
    });
    store.commit({ type: "patchForm", formId: form.id, patch: { operation: { kind: "revolve", angleDegrees: 360 } } });
    expect(store.document.attachments[0]!.status).toBe("unresolved");
    store.commit({ type: "patchForm", formId: form.id, patch: { operation: { kind: "revolve", angleDegrees: 270 } } });
    const newCaps = evaluateDocument(store.document).roles.filter((role) => role.address.formId === form.id && role.kind === "cap");
    expect(newCaps.some((role) => role.address.partKey === initialCap.address.partKey)).toBe(false);
    expect(store.document.attachments[0]!.status).toBe("unresolved");
    expect(store.document.attachments[0]!.target).toEqual({ kind: "form-role", formId: form.id, partKey: initialCap.address.partKey });
  });

  it("keeps evaluated sweep bounds and semantic role frames unchanged after carrier reversal", () => {
    const store = createFormLabStore(createLabDocument());
    const draft = pedestalDraft("Sweep");
    draft.profile = createProfile([[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]], "sweep:profile");
    const carrier = createCarrier([[0, 0, 0], [0, 0, 2]], frame, "sweep:path");
    draft.operation = { kind: "sweep", carrier };
    const form = addForm(store, draft);
    const beforeBounds = meshBounds(store.document);
    const beforeEvaluation = evaluateDocument(store.document);
    const beforeFrames = new Map(beforeEvaluation.roles.map((role) => [role.key, role.frame]));

    store.commit({ type: "reverseCarrier", formId: form.id });
    const afterEvaluation = evaluateDocument(store.document);
    expect(meshBounds(store.document)).toEqual(beforeBounds);
    expect(afterEvaluation.roles.map((role) => role.key)).toEqual(beforeEvaluation.roles.map((role) => role.key));
    for (const role of afterEvaluation.roles) {
      expectFramesNumericallyEqual(role.frame, beforeFrames.get(role.key));
    }
  });

  it("transports a hosted sweep path and section anchor with its parent cap", () => {
    const store = createFormLabStore(createLabDocument());
    const host = addForm(store, pedestalDraft("Sweep host"));
    const hostCap = roleFor(store.document, (role) => role.address.formId === host.id && role.label === "End cap");
    const child = addForm(store, hostedSweepDraft("Hosted sweep", hostCap.frame!));
    const attach = store.commit({
      type: "attach",
      childFormId: child.id,
      target: { kind: "form-role", formId: host.id, partKey: hostCap.address.partKey },
      lastFrame: structuredClone(hostCap.frame!),
    });
    expect(attach.status).toBe("accepted");

    const beforeDocument = structuredClone(store.document);
    const beforeChild = beforeDocument.forms.find((form) => form.id === child.id)!;
    if (beforeChild.operation.kind !== "sweep") throw new Error("Expected a sweep child.");
    const beforeCarrierPoints = beforeChild.operation.carrier.points.map((point) => [...point.position]);
    const beforeFrameAnchor = structuredClone(beforeChild.operation.carrier.frameAnchor);
    const beforeChildEval = evaluateDocument(beforeDocument).forms[child.id]!;
    const beforeBounds = boundsOfPositions(beforeChildEval.mesh.positions);
    const beforeRoleFrame = beforeChildEval.roles.find((role) => role.frame)?.frame;

    store.commit({ type: "patchForm", formId: host.id, patch: { frame: translatedFrame(host.frame, [3, 0, 0]) } });
    const afterChild = store.document.forms.find((form) => form.id === child.id)!;
    if (afterChild.operation.kind !== "sweep") throw new Error("Expected a sweep child.");
    expect(afterChild.hostLink?.status).toBe("resolved");
    expect(afterChild.frame.origin[0] - beforeChild.frame.origin[0]).toBeCloseTo(3, 8);
    expect(afterChild.operation.carrier.points.map((point) => point.position[0] - beforeCarrierPoints[afterChild.operation.carrier.points.findIndex((prior) => prior.id === point.id)]![0]))
      .toEqual([3, 3]);
    expect(afterChild.operation.carrier.frameAnchor.origin[0] - beforeFrameAnchor.origin[0]).toBeCloseTo(3, 8);

    const afterChildEval = evaluateDocument(store.document).forms[child.id]!;
    const afterBounds = boundsOfPositions(afterChildEval.mesh.positions);
    expect(afterBounds[0] - beforeBounds[0]).toBeCloseTo(3, 6);
    expect(afterBounds[3] - beforeBounds[3]).toBeCloseTo(3, 6);
    const afterRoleFrame = afterChildEval.roles.find((role) => role.frame)?.frame;
    expect(beforeRoleFrame).toBeDefined();
    expect(afterRoleFrame?.origin[0]! - beforeRoleFrame!.origin[0]).toBeCloseTo(3, 8);
  });

  it("moves sweep path data on frame-only offset and rehost patches without double-moving explicit operation patches", () => {
    const store = createFormLabStore(createLabDocument());
    const firstHost = addForm(store, pedestalDraft("First sweep host"));
    const firstCap = roleFor(store.document, (role) => role.address.formId === firstHost.id && role.label === "End cap");
    const secondHostDraft = pedestalDraft("Second sweep host");
    secondHostDraft.frame = translatedFrame(frame, [5, 0, 0]);
    const secondHost = addForm(store, secondHostDraft);
    const secondCap = roleFor(store.document, (role) => role.address.formId === secondHost.id && role.label === "End cap");
    const child = addForm(store, hostedSweepDraft("Offset sweep", firstCap.frame!));
    store.commit({
      type: "attach",
      childFormId: child.id,
      target: { kind: "form-role", formId: firstHost.id, partKey: firstCap.address.partKey },
      lastFrame: structuredClone(firstCap.frame!),
    });

    const attached = store.document.forms.find((form) => form.id === child.id)!;
    if (attached.operation.kind !== "sweep") throw new Error("Expected a sweep child.");
    const fixedAnchorId = attached.operation.carrier.frameAnchorPointId;
    const offsetFrame = translatedFrame(attached.frame, [0, 0, 0.2]);
    const offsetResult = store.commit({ type: "patchForm", formId: child.id, patch: { frame: offsetFrame } });
    expect(offsetResult.status).toBe("accepted");
    let offset = store.document.forms.find((form) => form.id === child.id)!;
    if (offset.operation.kind !== "sweep") throw new Error("Expected a sweep child.");
    expect(offset.operation.carrier.frameAnchorPointId).toBe(fixedAnchorId);
    expect(offset.operation.carrier.points[0]!.position[2] - attached.operation.carrier.points[0]!.position[2]).toBeCloseTo(0.2, 8);
    expect(offset.operation.carrier.frameAnchor.origin[2] - attached.operation.carrier.frameAnchor.origin[2]).toBeCloseTo(0.2, 8);

    // When the caller supplies both a new frame and an explicitly authored
    // operation, those carrier coordinates already encode the intended move.
    const beforeExplicit = structuredClone(offset.operation);
    const explicitFrame = translatedFrame(offset.frame, [0.25, 0, 0]);
    const explicitOperation = structuredClone(offset.operation);
    explicitOperation.carrier.points = explicitOperation.carrier.points.map((point) => ({
      ...point,
      position: [point.position[0] + 0.25, point.position[1], point.position[2]],
    }));
    explicitOperation.carrier.frameAnchor = translatedFrame(explicitOperation.carrier.frameAnchor, [0.25, 0, 0]);
    store.commit({ type: "patchForm", formId: child.id, patch: { frame: explicitFrame, operation: explicitOperation } });
    offset = store.document.forms.find((form) => form.id === child.id)!;
    if (offset.operation.kind !== "sweep") throw new Error("Expected a sweep child.");
    expect(offset.operation.carrier.points[0]!.position).toEqual(explicitOperation.carrier.points[0]!.position);
    expect(offset.operation.carrier.frameAnchor.origin).toEqual(explicitOperation.carrier.frameAnchor.origin);
    expect(offset.operation.carrier.points[0]!.position[0] - beforeExplicit.carrier.points[0]!.position[0]).toBeCloseTo(0.25, 8);

    // Rehost through the UI's frame + hostLink patch shape, with no operation
    // payload; the keyed sweep path and anchor must follow the new cap frame.
    const previousCarrier = structuredClone(offset.operation.carrier);
    const previousFrame = structuredClone(offset.frame);
    const newFrame = structuredClone(secondCap.frame!);
    const target = { kind: "form-role" as const, formId: secondHost.id, partKey: secondCap.address.partKey };
    const rehostResult = store.commit({
      type: "patchForm",
      formId: child.id,
      patch: { frame: newFrame, hostLink: { target, lastFrame: structuredClone(secondCap.frame!), status: "resolved" } },
    });
    expect(rehostResult.status).toBe("accepted");
    const rehosted = store.document.forms.find((form) => form.id === child.id)!;
    if (rehosted.operation.kind !== "sweep") throw new Error("Expected a sweep child.");
    expect(rehosted.hostLink?.target).toEqual(target);
    expect(rehosted.operation.carrier.frameAnchorPointId).toBe(fixedAnchorId);
    const expectedDelta = [newFrame.origin[0] - previousFrame.origin[0], newFrame.origin[1] - previousFrame.origin[1], newFrame.origin[2] - previousFrame.origin[2]];
    expect(rehosted.operation.carrier.points[0]!.position).toEqual([
      previousCarrier.points[0]!.position[0] + expectedDelta[0],
      previousCarrier.points[0]!.position[1] + expectedDelta[1],
      previousCarrier.points[0]!.position[2] + expectedDelta[2],
    ]);
    expect(rehosted.operation.carrier.frameAnchor.origin).toEqual([
      previousCarrier.frameAnchor.origin[0] + expectedDelta[0],
      previousCarrier.frameAnchor.origin[1] + expectedDelta[1],
      previousCarrier.frameAnchor.origin[2] + expectedDelta[2],
    ]);
    expect(evaluateDocument(store.document).forms[child.id]?.valid).toBe(true);
  });
});
