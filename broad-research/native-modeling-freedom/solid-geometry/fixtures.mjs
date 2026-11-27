export const box = (id, lo, hi) => ({ id, lo, hi });
const base = box('stock', [0, 0, 0], [1, 1, 1]);
export const op = (kind, operand) => ({ id: operand.id, kind, operand });
const cut = (lo, hi) => op('cut', box('tool', lo, hi));
const add = (lo, hi) => op('add', box('tool', lo, hi));
const row = (name, operation, expected = 'ok') => ({ name, source: { base, ops: [operation] }, expected });

export function casework(width = 0.923456789, floor = 0.073456789) {
  return {
    base: box('stock', [0, 0, 0], [width, 0.624567891, 0.245678913]),
    ops: [
      op('cut', box('recess', [0.071234567, 0.064567891, floor], [0.84, 0.55, 0.28])),
      op('cut', box('rebate', [0.051, 0.044, 0.22], [0.862, 0.575, 0.29])),
      op('add', box('mount-pad', [0.19, 0.15, -0.034567891], [0.69, 0.46, 0.017])),
    ],
    finish: 'body:matte',
  };
}

const concave = {
  ...box('concave-stock', [0, 0, 0], [3, 3, 1]),
  ring: [[0, 0], [1, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]],
  cells: [[[0, 0, 0], [3, 1, 1]], [[0, 1, 0], [1, 3, 1]]],
};
const pierced = {
  ...box('pierced-stock', [0, 0, 0], [3, 3, 1]),
  ring: [[0, 0], [3, 0], [3, 3], [0, 3]],
  holes: [[[1, 1], [1, 2], [2, 2], [2, 1]]],
  cells: [
    [[0, 0, 0], [3, 1, 1]], [[0, 2, 0], [3, 3, 1]],
    [[0, 1, 0], [1, 2, 1]], [[2, 1, 0], [3, 2, 1]],
  ],
};

const orderSensitive = {
  base,
  ops: [
    op('cut', box('recess', [0.21, 0.22, 0.71], [0.81, 0.82, 1.3])),
    op('add', box('mount', [0.25, 0.3, 0.6], [0.65, 0.75, 1.2])),
  ],
};

export const cases = [
  { name: 'vitrine', source: casework(), expected: 'ok' },
  { name: 'ordered-cut-add', source: orderSensitive, expected: 'ok' },
  { name: 'ordered-add-cut', source: { base, ops: orderSensitive.ops.toReversed() }, expected: 'ok' },
  { name: 'sealed-void', expected: 'sealed-void', source: {
    base, ops: [orderSensitive.ops[0],
      op('add', box('lid', [0.1, 0.12, 0.93], [0.9, 0.92, 1.14]))],
  } },
  row('overlapping-add', add([0.1, 0.2, 0.9], [0.85, 0.75, 1.1])),
  row('through-cut', cut([0.2, 0.3, -0.02], [0.7, 0.8, 1.02])),
  row('open-sided-rebate', cut([-0.02, 0.1, 0.7], [0.7, 0.8, 1.02])),
  row('thin-back-1mm', cut([0.2, 0.3, 0.001], [0.7, 0.8, 1.02])),
  row('role-split-trench', cut([-0.02, 0.3, 0.7], [1.02, 0.8, 1.02])),
  row('role-vanished-top', cut([-0.02, -0.03, 0.7], [1.02, 1.03, 1.04])),
  row('coplanar-role-tie', add([0.2, 0.25, 0.9], [1.2, 0.75, 1]), 'coincident-planes'),
  row('closed-cavity', cut([0.2, 0.3, 0.4], [0.7, 0.8, 0.9]), 'interior-cut'),
  row('contained-add', add([0.2, 0.3, 0.4], [0.7, 0.8, 0.9]), 'ineffective'),
  row('boundary-wall-0.9mm', cut([0.2, 0.3, 0.0009], [0.7, 0.8, 1.02]), 'near-planes'),
  row('equal-cap-through', cut([0.2, 0.3, 0], [0.7, 0.8, 1]), 'coincident-planes'),
  row('full-face-stack', add([0, 0, 1], [1, 1, 2]), 'coincident-planes'),
  row('partial-face-stack', add([0.2, 0.25, 1], [0.6, 0.75, 2]), 'coincident-planes'),
  row('coplanar-overlap', add([0.2, 0.25, 0.9], [0.6, 0.75, 1]), 'coincident-planes'),
  row('edge-only-add', add([1, 1, 0.2], [2, 2, 0.8]), 'coincident-planes'),
  row('point-only-add', add([1, 1, 1], [2, 2, 2]), 'coincident-planes'),
  row('face-only-cut', cut([0.2, 0.25, 1], [0.6, 0.75, 2]), 'coincident-planes'),
  row('disjoint-add', add([0.2, 0.3, 1.01], [0.7, 0.8, 2]), 'disjoint-add'),
  row('disjoint-cut', cut([0.2, 0.3, 1.01], [0.7, 0.8, 2]), 'ineffective'),
  row('split-cut', cut([0.2, -0.1, -0.2], [0.7, 1.1, 1.2]), 'split'),
  row('self-cut', cut([0, 0, 0], [1, 1, 1]), 'empty'),
  row('surround-cut', cut([-0.1, -0.2, -0.3], [1.1, 1.2, 1.3]), 'empty'),
  { ...row('retained-L-collinear', cut([0.2, 0.3, 0.5], [0.7, 0.8, 1.02]), 'profile'),
    source: { base: concave, ops: [cut([0.2, 0.3, 0.5], [0.7, 0.8, 1.02])] } },
  { name: 'retained-pierced-panel', source: { base: pierced, ops: [cut([0.2, 0.3, 0.5], [0.7, 2.7, 1.02])] },
    expected: 'profile' },
];

export function translated(source, shift, scale = 1) {
  const move = ({ lo, hi, ...rest }) => ({
    ...rest, lo: lo.map((x, i) => x * scale + shift[i]),
    hi: hi.map((x, i) => x * scale + shift[i]),
  });
  return { ...source, base: move(source.base), ops: source.ops.map(operation =>
    ({ ...operation, operand: move(operation.operand) })) };
}

export function stressCases() {
  let seed = 0x5a17e;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  return Array.from({ length: 64 }, (_, i) => {
    const source = casework(0.89 + random() * 0.32, 0.002 + random() * 0.2);
    return translated(source, [0, 1, 2].map(() => 98 * random() - 49));
  });
}

export function windowWall(count) {
  const wall = box('stock', [0, 0, 0], [20, 3, 0.3]);
  return { base: wall, ops: Array.from({ length: count }, (_, i) => {
    const x = 0.2 + i * 0.49;
    return op('cut', box('window-' + i, [x, 1 + i * 0.003, -0.1 - i * 0.003],
      [x + 0.3, 2 + i * 0.003, 0.4 + i * 0.003]));
  }) };
}
