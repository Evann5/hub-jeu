"""Construit et exporte les 7 monuments Mexique / Italie.
Usage : Blender -b --factory-startup -P mk_mexique_italie.py -- <sortie_dir> [nom ...]
Chaque nom (maisonsColorees, maisonsColorees2, cathedrale, pyramide, volcan, duomo, gondole) est un module du même dossier."""
import sys, os, importlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy

ALL = ['maisonsColorees', 'maisonsColorees2', 'cathedrale', 'pyramide', 'volcan', 'duomo', 'gondole']

def export(name, out_dir):
    mod = importlib.import_module(name)
    m = mod.build()
    verts, cols, tris = m.welded()
    k = getattr(mod, 'SCALE', 1.0)
    verts = [(x*k, y*k, z*k) for (x, y, z) in verts]
    # centre en x et z (boîte englobante), base à y = 0
    xs = [v[0] for v in verts]; zs = [v[2] for v in verts]
    cx = (min(xs)+max(xs))/2; cz = (min(zs)+max(zs))/2
    verts = [(x-cx, y, z-cz) for (x, y, z) in verts]
    print(f'[{name}] faces {len(m.faces)}  triangles {len(tris)}  sommets {len(verts)}  décalage ({-cx:.3f}, {-cz:.3f})')
    bv = [(x, -z, y) for (x, y, z) in verts]
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(bv, [], tris)
    mesh.update()
    attr = mesh.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT')
    flat = []
    for c in cols:
        flat += [c[0], c[1], c[2], 1.0]
    attr.data.foreach_set('color', flat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, name + '.glb')
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True,
        export_yup=True, export_materials='NONE', export_normals=False,
        export_texcoords=False, export_vertex_color='ACTIVE',
        export_active_vertex_color_when_no_material=True,
        export_cameras=False, export_lights=False, export_animations=False)
    print('écrit', path, os.path.getsize(path), 'octets')

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--')+1:]
    out = argv[0]
    names = argv[1:] or ALL
    for n in names:
        export(n, out)
