/** Serializable authored data for the Native Form Lab prototype. Lengths are metres. */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/** Orthonormal, right-handed frame; normal is u × v. World Y points up. */
export interface Frame {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  normal: Vec3;
}

export interface ProfilePoint {
  id: string;
  position: Vec2;
}

export interface ProfileSegment {
  id: string;
  from: string;
  to: string;
}

/** One ordered, closed contour. Segment endpoints name points, never array offsets. */
export interface Profile {
  id: string;
  points: ProfilePoint[];
  segments: ProfileSegment[];
  closed: true;
}

export interface CarrierPoint {
  id: string;
  position: Vec3;
}

export interface CarrierSegment {
  id: string;
  from: string;
  to: string;
}

/** Open keyed path used by sweeps. frameAnchor defines the initial section orientation. */
export interface Carrier {
  id: string;
  points: CarrierPoint[];
  segments: CarrierSegment[];
  frameAnchor: Frame;
  /** Stable physical point identity whose endpoint owns frameAnchor, including after reversal. */
  frameAnchorPointId: string;
}

export type FormOperation =
  | { kind: "extrude"; height: number }
  | { kind: "revolve"; angleDegrees: number }
  | { kind: "sweep"; carrier: Carrier };

export interface Rounding {
  /** Corner radius in metres. */
  radius: number;
  policy: "profile-corners" | "none";
}

export interface RoleAddress {
  formId: string;
  /** Stable authored part key (for example a segment ID or cap lifetime ID). */
  partKey: string;
}

/** Canonical string encoding of [formId, partKey], not a mesh/output index. */
export type SourceRoleKey = string;

export type HostTarget =
  | { kind: "form-role"; formId: string; partKey: string }
  | { kind: "fixture-plane"; fixtureId: string; planeKey: string };

export interface HostLink {
  target: HostTarget;
  /** Previous host role frame; resolved motion deltas transport Form.frame with the host. */
  lastFrame: Frame;
  status: "resolved" | "unresolved";
  reason?: string;
}

export interface RevolveCapLifetimeKeys {
  start: string;
  end: string;
}

export interface Form {
  id: string;
  name: string;
  profile: Profile;
  /** Profile x/y map to frame.u/frame.v; extrusion follows frame.normal. */
  frame: Frame;
  operation: FormOperation;
  rounding: Rounding;
  /** Present only while a partial revolve's two end caps exist. */
  revolveCapLifetimeKeys: RevolveCapLifetimeKeys | null;
  /** Optional plane/face host for this form's authored profile. */
  hostLink?: HostLink;
}

export interface Attachment {
  id: string;
  label: string;
  target: HostTarget;
  /** Coordinates in metres in the target role's anchor frame. */
  anchor: Vec2;
  /** Last accepted world pose; preserved when the target retires or disappears. */
  lastFrame: Frame;
  status: "resolved" | "unresolved";
  reason?: string;
}

export interface Finish {
  id: string;
  target: RoleAddress;
  material: string;
  color: string;
  status: "resolved" | "unresolved";
  reason?: string;
}

/** Authored truth only: no mesh, camera, selection, session or history state. */
export interface LabDocument {
  formatVersion: 1;
  /** Monotonic document-local key allocator; keys are not reused after undo. */
  nextId: number;
  forms: Form[];
  attachments: Attachment[];
  finishes: Finish[];
}

export type RoleKind = "face" | "edge" | "cap";

export interface Bounds2 {
  min: Vec2;
  max: Vec2;
}

export interface Bounds3 {
  min: Vec3;
  max: Vec3;
}

export interface GeneratedRole {
  key: SourceRoleKey;
  address: RoleAddress;
  label: string;
  kind: RoleKind;
  /** Planar anchor frame when this role can host a child or attachment. */
  frame?: Frame;
  /** Role-local anchor region in metres, when available. */
  region?: Bounds2;
  /** Exact role-local planar boundary when an AABB is not a sufficient anchor test. */
  boundary?: Vec2[];
  bounds?: Bounds3;
}

export interface NumericMesh {
  /** Flat xyz triples, in world metres. */
  positions: number[];
  /** Flat triangle index triples. */
  indices: number[];
  /** One semantic source role key per triangle. */
  triangleRoleKeys: SourceRoleKey[];
}

export interface EvaluationRefusal {
  code: string;
  message: string;
}

export interface FormEvaluation {
  formId: string;
  valid: boolean;
  reason?: EvaluationRefusal;
  mesh: NumericMesh;
  roles: GeneratedRole[];
}

export interface DocumentEvaluation {
  valid: boolean;
  reason?: EvaluationRefusal;
  mesh: NumericMesh;
  roles: GeneratedRole[];
  forms: Record<string, FormEvaluation>;
}

export type FormDraft = Omit<Form, "id" | "revolveCapLifetimeKeys">;

export type LabCommand =
  | { type: "addForm"; form: FormDraft }
  | { type: "removeForm"; formId: string }
  | { type: "patchForm"; formId: string; patch: Partial<Pick<Form, "name" | "profile" | "frame" | "operation" | "rounding" | "hostLink">> }
  | { type: "moveProfilePoint"; formId: string; pointId: string; position: Vec2 }
  | { type: "insertProfilePoint"; formId: string; segmentId: string; position: Vec2 }
  | { type: "removeProfilePoint"; formId: string; pointId: string }
  | { type: "reverseCarrier"; formId: string }
  | { type: "paint"; target: RoleAddress; material: string; color: string }
  | { type: "attach"; attachment: Omit<Attachment, "id" | "status" | "reason"> }
  | { type: "attach"; childFormId: string; target: HostTarget; lastFrame: Frame }
  | { type: "repairAttachment"; attachmentId: string; target: HostTarget; anchor: Vec2; lastFrame: Frame }
  | { type: "repairChildHost"; childFormId: string; target: HostTarget; lastFrame: Frame };

export type CommandResult =
  | { status: "accepted"; document: LabDocument; evaluation: DocumentEvaluation; changed: boolean }
  | { status: "refused"; reason: EvaluationRefusal; evaluation?: DocumentEvaluation };

export interface FormLabStore {
  /** Last committed authored document. */
  readonly document: LabDocument;
  /** Preview document if accepted, otherwise the committed document. */
  readonly shownDocument: LabDocument;
  subscribe(listener: () => void): () => void;
  preview(command: LabCommand): CommandResult;
  commit(command?: LabCommand): CommandResult;
  cancel(): void;
  undo(): boolean;
  redo(): boolean;
  load(document: LabDocument): CommandResult;
  serialize(): string;
}

/** Profile constructor for fixtures and UI drafts; IDs are stable within the profile. */
export function createProfile(points: Vec2[], idPrefix = "profile"): Profile {
  const keyedPoints = points.map((position, index) => ({ id: `${idPrefix}:point:${index + 1}`, position: [...position] as Vec2 }));
  const segments = keyedPoints.map((point, index) => ({
    id: `${idPrefix}:segment:${index + 1}`,
    from: point.id,
    to: keyedPoints[(index + 1) % keyedPoints.length]?.id ?? point.id,
  }));
  return { id: idPrefix, points: keyedPoints, segments, closed: true };
}

export function createLabDocument(): LabDocument {
  return { formatVersion: 1, nextId: 1, forms: [], attachments: [], finishes: [] };
}

/** JSON tuple encoding avoids delimiter collisions and remains stable across save/load. */
export function roleKey(address: RoleAddress): SourceRoleKey {
  return JSON.stringify([address.formId, address.partKey]);
}
