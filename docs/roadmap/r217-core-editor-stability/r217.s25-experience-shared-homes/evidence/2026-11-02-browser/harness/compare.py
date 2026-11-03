import json, glob, os, sys
S = '/private/tmp/claude-501/-Users-tony-Documents-Biskiq/9e6749c5-da58-4648-9ae5-5cb19e59965d/scratchpad/final2'
SIZES = ['1440x900', '1280x800', '1180x820', '820x1180']
def load(tree, size):
    f = glob.glob(f'{S}/journey-parity-{tree}-{size}.json')
    return json.load(open(f[0])) if f else None
def key(s):
    lens = 'Experience' if s['lens']['experience'] == 'true' else ('World' if s['lens']['world'] == 'true' else '?')
    return {
        'lens': lens,
        'presentations': s['presentations'],
        'stops': s['stops'],
        'preview': s['visitorPreview'],
        'feedback': s['feedback'] or '',
        'card': (s['cardKind'], s['cardTitle']),
        'undoDisabled': s['undoDisabled'],
        'overflowPx': s['overflowPx'],
        'guideOpen': s['guideOpen'],
    }
summary = {}
for size in SIZES:
    a, b = load('after', size), load('before', size)
    summary[size] = {'after': None if a is None else {'failure': a.get('failure'), 'steps': len(a['steps']), 'pageErrors': len(a['pageErrors']), 'consoleErrors': len(a['consoleErrors']), 'dialogs': len(a['dialogs'])},
                     'before': None if b is None else {'failure': b.get('failure'), 'steps': len(b['steps']), 'pageErrors': len(b['pageErrors']), 'consoleErrors': len(b['consoleErrors']), 'dialogs': len(b['dialogs'])}}
    if a and b and a['steps'] and b['steps']:
        rows = []
        for x, y in zip(a['steps'], b['steps']):
            kx, ky = key(x), key(y)
            diffs = {k: {'before': ky[k], 'after': kx[k]} for k in kx if kx[k] != ky[k]}
            rows.append({'index': x['index'], 'name': x['name'], 'same': not diffs, 'differs': diffs, 'after': kx, 'before': ky})
        summary[size]['rows'] = rows
        summary[size]['identicalSteps'] = sum(1 for r in rows if r['same'])
        summary[size]['totalSteps'] = len(rows)
json.dump(summary, open(f'{S}/parity-compare.json', 'w'), indent=2)
for size in SIZES:
    s = summary[size]
    print(size, 'after', s['after'], '\n         before', s['before'])
    if 'rows' in s:
        print('  identical steps: %d/%d' % (s['identicalSteps'], s['totalSteps']))
        for r in s['rows']:
            if not r['same']:
                print('   DIFF', r['index'], r['name'], {k: v for k, v in r['differs'].items()})
