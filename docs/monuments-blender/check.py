"""Contrôle d'un GLB sans Blender : python3 -I check.py fichier.glb ..."""
import sys, json, struct, os

def check(path):
    b = open(path, 'rb').read()
    magic, ver, total = struct.unpack('<4sII', b[:12])
    assert magic == b'glTF' and total == len(b), 'en-tête GLB'
    clen, ctype = struct.unpack('<I4s', b[12:20])
    j = json.loads(b[20:20+clen])
    meshes = j.get('meshes', [])
    prims = [p for m in meshes for p in m['primitives']]
    tris = 0
    mn = [1e9]*3; mx = [-1e9]*3
    for p in prims:
        acc = j['accessors'][p['indices']]
        tris += acc['count']//3
        pa = j['accessors'][p['attributes']['POSITION']]
        mn = [min(a, c) for a, c in zip(mn, pa['min'])]
        mx = [max(a, c) for a, c in zip(mx, pa['max'])]
    attrs = sorted({k for p in prims for k in p['attributes']})
    col = [j['accessors'][p['attributes']['COLOR_0']] for p in prims if 'COLOR_0' in p['attributes']]
    return {
        'fichier': os.path.basename(path), 'Ko': round(len(b)/1024, 1), 'meshes': len(meshes), 'primitives': len(prims),
        'noeuds': len(j.get('nodes', [])), 'triangles': tris, 'attributs': attrs,
        'COLOR_0': [(a['type'], a['componentType'], a['count']) for a in col],
        'images': len(j.get('images', [])), 'textures': len(j.get('textures', [])), 'animations': len(j.get('animations', [])),
        'materiaux': len(j.get('materials', [])), 'draco': 'KHR_draco_mesh_compression' in (j.get('extensionsUsed') or []),
        'min': [round(v, 3) for v in mn], 'max': [round(v, 3) for v in mx],
        'taille': [round(mx[i]-mn[i], 3) for i in range(3)],
    }

if __name__ == '__main__':
    for f in sys.argv[1:]:
        for k, v in check(f).items():
            print(f'  {k}: {v}')
        print()
