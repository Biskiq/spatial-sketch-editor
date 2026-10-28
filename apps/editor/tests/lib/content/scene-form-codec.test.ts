import { describe, expect, it } from 'vitest';
import { validateSceneDocument } from '@portfolio/project-model';
import { evaluateSceneForm } from '@portfolio/project-model/scene-planning';
import {
  SCENE_UNIT_FORMAT_VERSION,
  validateCameraFreeScenePayload
} from '@portfolio/project-model/units';

const ANCHORS = [
  { key: 1, u: 0, v: 0, smooth: false },
  { key: 2, u: 2, v: 0, smooth: false },
  { key: 3, u: 2, v: 1, smooth: true },
  { key: 4, u: 0, v: 1, smooth: false }
];

function formEntity(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'form',
    id: 'form-1',
    name: 'Display plinth',
    position: [1, 0, 2],
    rotation: [0, 0.5, 0],
    form: {
      generator: { kind: 'extrude', plane: 'plan', outline: ANCHORS, extent: 0.8 },
      scale: [1, 1, 1],
      nextKey: 5
    },
    materialId: 'wood-walnut',
    castShadow: true,
    receiveShadow: true,
    ...overrides
  };
}

function document(entity: unknown) {
  return {
    formatVersion: 1,
    textures: [],
    materials: [],
    entities: [entity],
    navigationNodes: [],
    connections: []
  };
}

function unit(entity: unknown) {
  return {
    formatVersion: SCENE_UNIT_FORMAT_VERSION,
    textures: [],
    materials: [],
    entities: [entity]
  };
}

function issueCodes(input: unknown): string[] {
  const result = validateSceneDocument(input);
  expect(result.success).toBe(false);
  return result.success ? [] : result.issues.map((issue) => issue.code);
}

describe('native form Scene codec', () => {
  it('reads and canonically writes one form entity', () => {
    const result = validateSceneDocument(document(formEntity()));
    expect(result.success).toBe(true);
    if (!result.success) return;
    const parsed = JSON.parse(result.canonicalJson) as {
      entities: Array<Record<string, unknown>>;
    };
    const entity = parsed.entities[0]!;
    expect(Object.keys(entity)).toEqual([
      'kind',
      'id',
      'name',
      'position',
      'rotation',
      'form',
      'materialId',
      'castShadow',
      'receiveShadow'
    ]);
    expect(entity.form).toEqual({
      generator: { kind: 'extrude', plane: 'plan', outline: ANCHORS, extent: 0.8 },
      scale: [1, 1, 1],
      nextKey: 5
    });
    expect(JSON.parse(result.canonicalJson)).toEqual(result.document);
  });

  it('admits the form in Scene unit format 4 and refuses format 3', () => {
    expect(validateCameraFreeScenePayload(unit(formEntity())).success).toBe(true);
    const legacy = validateCameraFreeScenePayload({
      formatVersion: 3,
      textures: [],
      materials: [],
      entities: []
    });
    expect(legacy.success).toBe(false);
    if (!legacy.success) {
      expect(legacy.issues.map((issue) => issue.code)).toContain('unsupported_format_version');
    }
  });

  it('refuses entity-level scale and roomId by name', () => {
    expect(issueCodes(document(formEntity({ scale: 2 })))).toContain('unknown_property');
    expect(issueCodes(document(formEntity({ roomId: 'room-1' })))).toContain(
      'room_id_forbidden_in_world_local'
    );
  });

  it('refuses unknown generator, plane and shape keys', () => {
    const generator = (overrides: Record<string, unknown>) =>
      formEntity({
        form: {
          generator: {
            kind: 'extrude',
            plane: 'plan',
            outline: ANCHORS,
            extent: 0.8,
            ...overrides
          },
          scale: [1, 1, 1],
          nextKey: 5
        }
      });
    expect(issueCodes(document(generator({ kind: 'revolve' })))).toContain(
      'unsupported_generator'
    );
    expect(issueCodes(document(generator({ plane: 'section' })))).toContain(
      'unsupported_plane'
    );
    expect(issueCodes(document(generator({ extra: 1 })))).toContain('unknown_property');
    expect(
      issueCodes(
        document(
          formEntity({
            form: {
              generator: { kind: 'extrude', plane: 'plan', outline: ANCHORS, extent: 0.8 },
              scale: [1, 1, 1],
              nextKey: 5,
              extra: true
            }
          })
        )
      )
    ).toContain('unknown_property');
  });

  it('refuses extent, scale and key-allocator limits', () => {
    const withForm = (form: Record<string, unknown>) => formEntity({ form });
    const base = {
      generator: { kind: 'extrude', plane: 'plan', outline: ANCHORS, extent: 0.8 },
      scale: [1, 1, 1],
      nextKey: 5
    };
    expect(
      issueCodes(
        document(withForm({ ...base, generator: { ...base.generator, extent: 0.0005 } }))
      )
    ).toContain('invalid_extent');
    expect(issueCodes(document(withForm({ ...base, scale: [0.001, 1, 1] })))).toContain(
      'invalid_scale'
    );
    expect(issueCodes(document(withForm({ ...base, nextKey: 4 })))).toContain(
      'invalid_next_key'
    );
    expect(issueCodes(document(withForm({ ...base, nextKey: 4.5 })))).toContain(
      'invalid_next_key'
    );
  });

  it('refuses a malformed outline and each typed profile issue', () => {
    const withOutline = (outline: unknown) =>
      formEntity({
        form: {
          generator: { kind: 'extrude', plane: 'plan', outline, extent: 0.8 },
          scale: [1, 1, 1],
          nextKey: 5
        }
      });
    expect(issueCodes(document(withOutline('not-an-array')))).toContain('invalid_type');
    expect(
      issueCodes(
        document(withOutline([{ key: 1, u: 0, v: 0, smooth: false, extra: 1 }]))
      )
    ).toContain('unknown_property');
    expect(
      issueCodes(
        document(
          withOutline([
            { key: 1, u: 0, v: 0, smooth: false },
            { key: 1, u: 2, v: 0, smooth: false },
            { key: 3, u: 0, v: 1, smooth: false }
          ])
        )
      )
    ).toContain('duplicate-key');
    expect(
      issueCodes(
        document(
          withOutline([
            { key: 1, u: 0, v: 0, smooth: false },
            { key: 2, u: 2, v: 2, smooth: false },
            { key: 3, u: 2, v: 0, smooth: false },
            { key: 4, u: 0, v: 2, smooth: false }
          ])
        )
      )
    ).toContain('self-intersecting');
  });	it('refuses a body whose scaled dimensions leave the admitted range', () => {
    // The outline and every individual field are inside their ranges, but the
    // product (2 m wide × scale 100) is outside the scaled-dimension limit. The
    // renderer's own evaluator refuses that body, so admission must refuse it too.
    const result = validateSceneDocument(
      document(
        formEntity({
          form: {
            generator: { kind: 'extrude', plane: 'plan', outline: ANCHORS, extent: 0.8 },
            scale: [100, 1, 1],
            nextKey: 5
          }
        })
      )
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toContain('invalid_form_body');
  });

  it('preserves large safe-integer outline keys through evaluation', () => {
    const largeKey = 4294967296;
    const outline = [
      { key: largeKey, u: 0, v: 0, smooth: false },
      { key: largeKey + 1, u: 2, v: 0, smooth: false },
      { key: largeKey + 2, u: 2, v: 1, smooth: false },
      { key: largeKey + 3, u: 0, v: 1, smooth: false }
    ];
    const result = validateSceneDocument(
      document({
        ...formEntity(),
        form: {
          generator: { kind: 'extrude', plane: 'plan', outline, extent: 0.8 },
          scale: [1, 1, 1],
          nextKey: largeKey + 4
        }
      })
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const form = result.document.entities[0];
    expect(form?.kind).toBe('form');
    if (form?.kind !== 'form') return;
    const mesh = evaluateSceneForm(form.form);
    // A 32-bit key store would silently truncate these to 0, 1, 2, 3.
    expect([...mesh.segmentKeys]).toEqual([largeKey, largeKey + 1, largeKey + 2, largeKey + 3]);
  });

  it('canonically writes a material instance override on a form', () => {		const result = validateSceneDocument({
      ...document(formEntity({ materialInstanceId: 'instance-1' })),
      materials: [{ id: 'instance-1', name: 'Walnut instance', baseMaterialId: 'wood-walnut' }]
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const entity = (JSON.parse(result.canonicalJson) as { entities: Array<Record<string, unknown>> })
      .entities[0]!;
    expect(Object.keys(entity)).toEqual([
      'kind',
      'id',
      'name',
      'position',
      'rotation',
      'form',
      'materialId',
      'castShadow',
      'receiveShadow',
      'materialInstanceId'
    ]);
    expect(entity.materialInstanceId).toBe('instance-1');
  });

  it('refuses an unknown material and non-boolean shadow flags', () => {
    expect(issueCodes(document(formEntity({ materialId: 'unknown' })))).toContain(
      'unknown_material'
    );
    expect(issueCodes(document(formEntity({ castShadow: 'yes' })))).toContain(
      'invalid_type'
    );
    expect(issueCodes(document(formEntity({ receiveShadow: 0 })))).toContain(
      'invalid_type'
    );
  });
});
