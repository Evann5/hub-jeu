"""Construit les monuments d'Asie et de Turquie et les exporte en GLB (centrés, base à y = 0).
Usage : Blender -b --factory-startup -P mk_asie.py -- <dossier_sortie> <nom> [<nom> ...]   (un module Python du même nom chacun)"""
import sys, os, importlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
from lib_asie_turquie import recenter

def export(name, out_dir):
    mod = importlib.import_module(name)
    m = mod.build()
    recenter(m)
    verts, cols, tris = m.welded()
    print(f'[{name}] faces {len(m.faces)}  triangles {len(tris)}  sommets {len(verts)}')
    bv = [(x, -z, y) for (x, y, z) in verts]   # repère glTF -> repère Blender
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
    for n in argv[1:]:
        export(n, argv[0])
