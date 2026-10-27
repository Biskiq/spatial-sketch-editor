// The sheet: a scene's UI description becomes DOM. Knows nothing about state or
// geometry; it renders what it is given and reports clicks through handlers.

const GROUP_LABEL = {
  plan: 'Plan', section: 'Section', mode: 'Reading', do: 'Do',
  kind: 'Walk', turn: 'Turn', frame: 'Rail frame', infill: 'Infill',
};

const el = (id) => document.getElementById(id);

export function updateSheet(ui, handlers) {
  el('kicker').textContent = ui.kicker || '';
  el('title').textContent = ui.title || '';
  el('lede').textContent = ui.lede || '';
  el('note').textContent = ui.note || '';
  el('note').style.display = ui.note ? '' : 'none';
  el('hint').textContent = ui.hint || '';

  el('chips').replaceChildren(...chipRows(ui.chips || [], handlers.onChip));
  el('facts').replaceChildren(...factRows(ui.facts || []));
  el('facts').style.display = (ui.facts || []).length ? '' : 'none';
  el('issues').replaceChildren(...issueBoxes(ui.issues || []));
  el('actions').replaceChildren(...actionButtons((ui.selection && ui.selection.actions) || [], handlers.onChip));
  el('table').replaceChildren(...(ui.table
    ? [
      corpusTable('Roofs', ui.table.roofRows, ['Fixture', 'Status', 'Cost', 'Valley'], handlers.onRow),
      corpusTable('Walks & rails', ui.table.walkRows, ['Fixture', 'Status', 'Cost', 'Treads'], handlers.onRow),
    ]
    : []));
}

function chipRows(chips, onChip) {
  const groups = [];
  for (const c of chips) {
    let g = groups.find((x) => x.id === c.group);
    if (!g) { g = { id: c.group, items: [] }; groups.push(g); }
    g.items.push(c);
  }
  return groups.map((g) => {
    const row = document.createElement('div');
    row.className = 'chiprow';
    if (GROUP_LABEL[g.id]) {
      const label = document.createElement('span');
      label.className = 'glabel';
      label.textContent = GROUP_LABEL[g.id];
      row.append(label);
    }
    for (const c of g.items) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = c.label;
      b.setAttribute('aria-pressed', c.active ? 'true' : 'false');
      b.addEventListener('click', () => onChip(c.id));
      row.append(b);
    }
    return row;
  });
}

function factRows(facts) {
  return facts.map(([k, v]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    row.append(dt, dd);
    return row;
  });
}

function issueBoxes(issues) {
  return issues.map((i) => {
    const box = document.createElement('div');
    box.className = 'issue';
    const title = document.createElement('b');
    title.textContent = 'Refused in words';
    const text = document.createElement('div');
    text.textContent = i.text;
    box.append(title, text);
    if (i.fix) {
      const fix = document.createElement('span');
      fix.textContent = `→ ${i.fix}`;
      box.append(fix);
    }
    return box;
  });
}

function actionButtons(actions, onChip) {
  return actions.map((a) => {
    const b = document.createElement('button');
    b.className = 'action';
    b.textContent = a.label;
    b.addEventListener('click', () => onChip(a.id));
    return b;
  });
}

function corpusTable(label, rows, head, onRow) {
  const box = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'sectionlabel';
  title.textContent = label;
  box.append(title);

  const table = document.createElement('table');
  table.className = 'corpus';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const h of head) {
    const th = document.createElement('th');
    th.textContent = h;
    hr.append(th);
  }
  thead.append(hr);
  table.append(thead);

  const body = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.setAttribute('aria-selected', r.sel ? 'true' : 'false');
    r.cells.forEach((cell, i) => {
      const td = document.createElement('td');
      td.textContent = cell;
      if (i === 1) td.className = `st ${r.status}`;
      if (i >= 2) td.className = 'num';
      tr.append(td);
    });
    tr.addEventListener('click', () => onRow(r.id));
    body.append(tr);
  }
  table.append(body);
  box.append(table);
  return box;
}
