"""Construit un monument et l'exporte en GLB. Usage : Blender -b -P mk.py -- <eiffel|colisee|golden-gate> [sortie_dir]"""
import sys, os, importlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy

NAMES = {'eiffel': 'eiffel', 'colisee': 'colisee', 'golden-gate': 'goldengate'}
OUT = '/Users/bui/Hub jeu/games/escales/assets/monuments'

def export(name, out_dir=OUT):
    mod = importlib.import_module(NAMES[name])
    m = mod.build()
    verts, cols, tris = m.welded()
    print(f'[{name}] faces {len(m.faces)}  triangles {len(tris)}  sommets {len(verts)}')
    # repère glTF (x, y haut, z avant) -> repère Blender (x, -z, y)
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
    export(argv[0], argv[1] if len(argv) > 1 else OUT)
