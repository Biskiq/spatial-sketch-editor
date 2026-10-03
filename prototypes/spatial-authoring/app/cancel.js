// One cancellation policy for every unaccepted thing the pointer, the keyboard or a numeric draft
// can leave on the model. Owners register how to undo what they are holding: a candidate snapshot,
// a typed draft, a previewed consequence, an aim, a refusal, a captured pointer, a temporary picker.
//
// Every exit that is not an acceptance goes through here — Esc, pointercancel, lost capture, lens
// change, task teardown — so no path can half-cancel, and no late pointerup/change/blur can commit
// something the user already dropped.
const owners = [];

export function onCancel(fn, order = 50, name = '') {
  owners.push({ fn, order, name });
  owners.sort((a, b) => a.order - b.order);
}

let cancelling = false;
export function isCancelling() { return cancelling; }

// Esc, pointercancel and lens changes call this once. It is idempotent: a second call with nothing
// held does nothing.
export function cancelProposal(reason = 'cancel') {
  if (cancelling) return;
  cancelling = true;
  try {
    for (const o of owners) {
      try { o.fn(reason); } catch (e) { console.error(`cancel(${o.name}) failed`, e); }
    }
  } finally {
    cancelling = false;
  }
}

export function cancelOwners() { return owners.map((o) => o.name); }
