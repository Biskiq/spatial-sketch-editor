# R217.S23 contrast measurement. For each captured Sheet state: every visible ink is compared with
# the backing actually rendered behind it, sampled from the PNG (the modal colour of the backing's
# pixels). Line and tick inks sit on the pale track plate; text sits on its chip or the hint face.
# Thresholds: text 4.5:1, line / tick / knob / pin ring 3:1 (WCAG 2.x relative luminance).
import glob, json, os, re, sys
from collections import Counter
from PIL import Image

EV = sys.argv[1]

def srgb_to_lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def lum(rgb):
    r, g, b = (srgb_to_lin(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    hi, lo = sorted([lum(a), lum(b)], reverse=True)
    return (hi + 0.05) / (lo + 0.05)

def parse_css_rgb(value):
    m = re.match(r'rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)', value or '')
    if not m:
        return None
    alpha = float(m.group(4)) if m.group(4) is not None else 1.0
    if alpha < 0.5:
        return None
    return tuple(int(float(m.group(i))) for i in (1, 2, 3))

def mode_of(img, box):
    l, t, r, b = (int(round(v)) for v in box)
    l, t = max(0, l), max(0, t)
    r, b = min(img.width, r), min(img.height, b)
    if r <= l or b <= t:
        return None
    counts = Counter(img.crop((l, t, r, b)).get_flattened_data() if hasattr(img, 'get_flattened_data') else img.crop((l, t, r, b)).getdata())
    return counts.most_common(1)[0][0]

def shrink(box, px):
    l, t, r, b = box
    return [l + px, t + px, r - px, b - px]

results = {}
for path in sorted(glob.glob(os.path.join(EV, 'sheet-*.json'))):
    data = json.load(open(path))
    if 'items' not in data:
        continue
    name = data['name']
    img = Image.open(path[:-5] + '.png').convert('RGB')
    rows = []
    plate = next((i for i in data['items'] if i['name'] == 'capsule-plate'), None)
    sheet = data['shell']['sheet']
    # The ground beside the Sheet: pale plate or dark mat, to show what the ink is over.
    # Two fixed probes of the ground, away from the Card and the Sheet: the pale plate in the
    # middle of the Stage and the top-right corner, where the dark mat margin shows in 3D.
    W, H = img.width, img.height
    plate_probe = mode_of(img, [W * 0.40, H * 0.62, W * 0.40 + 24, H * 0.62 + 24])
    mat_probe = mode_of(img, [W - 40, 124, W - 16, 148])
    ground = plate_probe
    for item in data['items']:
        if not item.get('visible') or item.get('ink') is None:
            continue
        ink = parse_css_rgb(item['ink'])
        if ink is None:
            continue
        kind = item['kind']
        if kind == 'plate-face':
            continue
        if item['name'].startswith('label-') or item['name'] in ('readout', 'snap', 'hint', 'add-glyph') or item['name'].startswith('pin-glyph'):
            backing_box = shrink(item['rect'], 2)
            klass = 'text'
        elif kind == 'line':
            if plate is None:
                continue
            backing_box = shrink(plate['rect'], 3)
            klass = 'line'
        else:
            continue
        backing = mode_of(img, backing_box)
        if backing is None or ink is None:
            continue
        if item['name'] == 'add-glyph':
            add_face = next((i for i in data['items'] if i['name'] == 'add-face'), None)
            if add_face is not None:
                backing = mode_of(img, shrink(add_face['rect'], 3))
        if item['name'].startswith('pin-glyph'):
            pin_face_name = item['name'].replace('pin-glyph', 'pin-face')
            face = next((i for i in data['items'] if i['name'] == pin_face_name), None)
            if face is not None:
                backing = mode_of(img, shrink(face['rect'], 3))
        rows.append({'element': item['name'], 'class': klass, 'ink': '#%02x%02x%02x' % ink, 'backing': '#%02x%02x%02x' % backing, 'ratio': round(ratio(ink, backing), 2)})
    text = [r['ratio'] for r in rows if r['class'] == 'text']
    line = [r['ratio'] for r in rows if r['class'] == 'line']
    results[name] = {
        'viewport': data['viewport'],
        'mode': data['mode'],
        'state': data['state'],
        'ticks': data['ticks'],
        'labels': data['labels'],
        'plateSampled': '#%02x%02x%02x' % mode_of(img, shrink(plate['rect'], 3)) if plate else None,
        'groundPlateProbe': '#%02x%02x%02x' % plate_probe if plate_probe else None,
        'groundMatProbe': '#%02x%02x%02x' % mat_probe if mat_probe else None,
        'textMinRatio': min(text) if text else None,
        'lineMinRatio': min(line) if line else None,
        'textThreshold': 4.5,
        'lineThreshold': 3.0,
        'pass': bool(text) and bool(line) and min(text) >= 4.5 and min(line) >= 3.0,
        'elements': rows,
    }

out = os.path.join(EV, 'sheet-contrast-measured.json')
json.dump({'method': 'WCAG 2.x relative luminance; backing = modal rendered colour of the element backing in the PNG (plate for line inks, chip or face for text), ink = computed style colour', 'results': results}, open(out, 'w'), indent=2, sort_keys=True)
for name, r in results.items():
    print(f"{name:42s} text_min={r['textMinRatio']} line_min={r['lineMinRatio']} plate={r['plateSampled']} plateProbe={r['groundPlateProbe']} matProbe={r['groundMatProbe']} pass={r['pass']}")
