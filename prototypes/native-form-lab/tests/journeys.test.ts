import { describe, expect, it } from 'vitest';
import { createFormLabStore } from '../src/model/store';
import { createProfile } from '../src/model/types';
import type { FormDraft, HostTarget } from '../src/model/types';
import { createJourneyDraft, createTiltedHostDraft } from '../src/fixtures/journeys';

describe('Native Form Lab journeys', () => {
  it.each(['pedestal', 'ornament', 'trim'] as const)('%s evaluates through the shared model and geometry path', (journey) => {
    const store = createFormLabStore();
    const draft: FormDraft = createJourneyDraft(journey);
    const result = store.commit({ type: 'addForm', form: draft });

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    const form = result.document.forms[0];
    expect(form?.operation.kind).toBe(journey === 'pedestal' ? 'extrude' : journey === 'ornament' ? 'revolve' : 'sweep');
    expect(result.evaluation.forms[form!.id]?.valid).toBe(true);
    expect(result.evaluation.mesh.indices.length).toBeGreaterThan(0);
    expect(result.evaluation.mesh.triangleRoleKeys.length).toBeGreaterThan(0);
  });

  it('supports a child profile on the 15 degree fixture cap', () => {
    const store = createFormLabStore();
    const hostResult = store.commit({ type: 'addForm', form: createTiltedHostDraft() });
    expect(hostResult.status).toBe('accepted');
    if (hostResult.status !== 'accepted') return;
    const host = hostResult.document.forms[0]!;
    const cap = hostResult.evaluation.forms[host.id]?.roles.find((role) => role.label === 'End cap' && role.frame);
    expect(cap?.frame?.normal[1]).toBeCloseTo(Math.cos(Math.PI / 12));
    expect(cap?.frame?.normal[2]).toBeCloseTo(Math.sin(Math.PI / 12));
    if (!cap?.frame) return;

    const target: HostTarget = { kind: 'form-role', formId: host.id, partKey: cap.address.partKey };
    const child: FormDraft = {
      name: 'Hosted child',
      profile: createProfile([[-0.16, -0.14], [0.16, -0.14], [0.16, 0.14], [-0.16, 0.14]], 'tilted-child-profile'),
      frame: cap.frame,
      operation: { kind: 'extrude', height: 0.18 },
      rounding: { radius: 0, policy: 'none' },
      hostLink: { target, lastFrame: cap.frame, status: 'resolved' },
    };
    const childResult = store.commit({ type: 'addForm', form: child });
    expect(childResult.status).toBe('accepted');
    if (childResult.status !== 'accepted') return;
    expect(childResult.document.forms[1]?.hostLink?.status).toBe('resolved');
    expect(childResult.evaluation.forms[childResult.document.forms[1]!.id]?.valid).toBe(true);
  });
});
