#!/usr/bin/env python3
"""RR-3/5/6 Probe 1 — repeatable glTF/GLB JSON-chunk audit (stdlib only, disposable).

Usage: python3 -I glb_audit.py [--json] FILE...

For each file: verify GLB magic/version/JSON chunk type (or read .gltf JSON), hash the bytes,
and report structure that decides part retention and capability admission: nodes, meshes,
parent nodes, empty (meshless leaf / meshless group) nodes, TRS vs matrix nodes, duplicate and
missing names, extras (root/scene/node/mesh/material), extensionsUsed/Required, animation
channel targets/paths, KHR_materials_variants declarations and primitive mappings, skins and
morph targets. Geometry buffers are never decoded; JSON alone proves no usable pivot.
"""
import hashlib
import json
import struct
import sys
from collections import Counter
from pathlib import Path


def read_json(path: Path):
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    if path.suffix.lower() == '.gltf':
        return json.loads(raw.decode('utf-8')), sha, len(raw), 'gltf'
    magic, version, length = struct.unpack_from('<III', raw, 0)
    assert magic == 0x46546C67, f'{path}: not a GLB (magic {magic:#x})'
    assert version == 2, f'{path}: GLB version {version}'
    assert length == len(raw), f'{path}: header length {length} != {len(raw)}'
    chunk_len, chunk_type = struct.unpack_from('<II', raw, 12)
    assert chunk_type == 0x4E4F534A, f'{path}: first chunk is not JSON'
    return json.loads(raw[20:20 + chunk_len]), sha, len(raw), 'glb'


def audit(path: Path) -> dict:
    j, sha, size, container = read_json(path)
    nodes = j.get('nodes', [])
    meshes = j.get('meshes', [])
    child_of = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            child_of[c] = i
    names = [n.get('name') for n in nodes]
    dupes = sorted(k for k, v in Counter(x for x in names if x).items() if v > 1)
    empty_leaf = [i for i, n in enumerate(nodes) if 'mesh' not in n and not n.get('children') and 'camera' not in n]
    empty_group = [i for i, n in enumerate(nodes) if 'mesh' not in n and n.get('children')]
    anims = []
    for a in j.get('animations', []):
        anims.append({
            'name': a.get('name'),
            'channels': [
                {'node': ch['target'].get('node'), 'path': ch['target'].get('path'),
                 'ext': sorted(ch['target'].get('extensions', {}).keys())}
                for ch in a.get('channels', [])
            ],
        })
    root_ext = j.get('extensions', {})
    variants = [v.get('name') for v in root_ext.get('KHR_materials_variants', {}).get('variants', [])]
    variant_mappings = 0
    morph_meshes = 0
    for m in meshes:
        for p in m.get('primitives', []):
            if 'KHR_materials_variants' in p.get('extensions', {}):
                variant_mappings += len(p['extensions']['KHR_materials_variants'].get('mappings', []))
        if any(p.get('targets') for p in m.get('primitives', [])):
            morph_meshes += 1

    def extras_count(items):
        return sum(1 for x in items if x.get('extras'))

    return {
        'file': str(path),
        'container': container,
        'bytes': size,
        'sha256': sha,
        'generator': j.get('asset', {}).get('generator'),
        'scenes': len(j.get('scenes', [])),
        'nodes': len(nodes),
        'meshes': len(meshes),
        'materials': len(j.get('materials', [])),
        'parentNodes': sum(1 for n in nodes if n.get('children')),
        'maxDepth': max((depth(i, child_of) for i in range(len(nodes))), default=0),
        'emptyLeafNodes': len(empty_leaf),
        'emptyGroupNodes': len(empty_group),
        'trsNodes': sum(1 for n in nodes if any(k in n for k in ('translation', 'rotation', 'scale'))),
        'matrixNodes': sum(1 for n in nodes if 'matrix' in n),
        'unnamedNodes': sum(1 for x in names if not x),
        'duplicateNodeNames': dupes,
        'extras': {
            'root': bool(j.get('extras')),
            'scenes': extras_count(j.get('scenes', [])),
            'nodes': extras_count(nodes),
            'meshes': extras_count(meshes),
            'materials': extras_count(j.get('materials', [])),
        },
        'extensionsUsed': sorted(j.get('extensionsUsed', [])),
        'extensionsRequired': sorted(j.get('extensionsRequired', [])),
        'animations': anims,
        'variants': variants,
        'variantMappings': variant_mappings,
        'skins': len(j.get('skins', [])),
        'morphTargetMeshes': morph_meshes,
    }


def depth(i, child_of):
    d = 0
    while i in child_of:
        i = child_of[i]
        d += 1
    return d


def row(r: dict) -> str:
    anim = ';'.join(f"{a['name']}:" + ','.join(f"n{c['node']}.{c['path']}" for c in a['channels']) for a in r['animations']) or '-'
    return (f"{r['file']} | {r['sha256'][:16]} | {r['bytes']} | nodes {r['nodes']} meshes {r['meshes']} mats {r['materials']} "
            f"| parents {r['parentNodes']} depth {r['maxDepth']} emptyLeaf {r['emptyLeafNodes']} emptyGroup {r['emptyGroupNodes']} "
            f"| TRS {r['trsNodes']} matrix {r['matrixNodes']} unnamed {r['unnamedNodes']} dupes {r['duplicateNodeNames'] or '-'} "
            f"| extras {r['extras']} | ext {r['extensionsUsed'] or '-'} req {r['extensionsRequired'] or '-'} "
            f"| anim {anim} | variants {r['variants'] or '-'} mappings {r['variantMappings']} skins {r['skins']} morph {r['morphTargetMeshes']}")


if __name__ == '__main__':
    args = sys.argv[1:]
    as_json = '--json' in args
    files = [Path(a) for a in args if a != '--json']
    results = [audit(f) for f in files]
    if as_json:
        print(json.dumps(results, indent=1))
    else:
        for r in results:
            print(row(r))
