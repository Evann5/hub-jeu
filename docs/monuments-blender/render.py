"""Planche de contrôle d'un GLB rechargé. Usage : Blender -b --factory-startup -P render.py -- fichier.glb sortie_dir [az2]
Vue plongeante à 57 degrés, soleil bas et chaud à gauche, fond turquoise. Eevee, pas de Cycles."""
import sys, os, math
import bpy, numpy as np
from mathutils import Vector

def setup(glb, tile=(2.2, 2.2)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(objs) == 1, f'{len(objs)} objets au rechargement'
    obj = objs[0]
    obj.rotation_mode = 'XYZ'
    me = obj.data
    me.polygons.foreach_set('use_smooth', [False]*len(me.polygons))
    ca = me.color_attributes[0].name
    mat = bpy.data.materials.new('m')
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    out = nt.nodes['Material Output']
    att = nt.nodes.new('ShaderNodeAttribute'); att.attribute_name = ca
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.9
    bsdf.inputs['Specular IOR Level'].default_value = 0.1
    nt.links.new(att.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    me.materials.clear(); me.materials.append(mat)
    # sol : la dalle de la case
    bpy.ops.mesh.primitive_plane_add(size=1)
    g = bpy.context.active_object
    g.scale = (tile[0], tile[1], 1); g.location = (0, 0, -0.004)
    gm = bpy.data.materials.new('g'); gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.82, 0.70, 0.60, 1)
    gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
    g.data.materials.append(gm)
    # lumière : soleil bas et chaud venant de la gauche
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 4.2; sun.angle = math.radians(4)
    sun.color = (1.0, 0.86, 0.68)
    so = bpy.data.objects.new('sun', sun); bpy.context.scene.collection.objects.link(so)
    d = Vector((0.8, 0.22, -0.52)).normalized()
    so.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('w'); w.use_nodes = True
    nt2 = w.node_tree
    bg = nt2.nodes['Background']
    lp = nt2.nodes.new('ShaderNodeLightPath'); mx = nt2.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    mx.inputs[6].default_value = (0.55, 0.58, 0.62, 1)     # lumière ambiante neutre
    mx.inputs[7].default_value = (0.02, 0.37, 0.42, 1)     # ce que voit la caméra : turquoise
    nt2.links.new(lp.outputs['Is Camera Ray'], mx.inputs[0]); nt2.links.new(mx.outputs[2], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.8
    bpy.context.scene.world = w
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples = 24
    sc.view_settings.view_transform = 'Standard'
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    return obj

def bbox_blender(obj):
    cs = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    mn = Vector((min(c.x for c in cs), min(c.y for c in cs), min(c.z for c in cs)))
    mx = Vector((max(c.x for c in cs), max(c.y for c in cs), max(c.z for c in cs)))
    return mn, mx

def camera(obj, elev=57.0, fill=1.12):
    mn, mx = bbox_blender(obj)
    sx, sy, sz = mx.x-mn.x, mx.y-mn.y, mx.z-mn.z   # Blender : y = profondeur, z = hauteur
    e = math.radians(elev)
    w = sx; h = sz*math.cos(e)+sy*math.sin(e)
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = max(w, h)*fill
    co = bpy.data.objects.new('c', cam); bpy.context.scene.collection.objects.link(co)
    tgt = Vector(((mn.x+mx.x)/2, (mn.y+mx.y)/2, (mn.z+mx.z)/2))
    co.rotation_euler = (math.radians(90-elev), 0, 0)
    back = Vector((0, -math.cos(e), math.sin(e)))
    co.location = tgt + back*30
    cam.clip_start = 0.1; cam.clip_end = 80
    bpy.context.scene.camera = co
    return cam

def render(path, px):
    sc = bpy.context.scene
    sc.render.resolution_x = sc.render.resolution_y = px
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    a = np.array(img.pixels[:], dtype=np.float32).reshape(px, px, 4)[:, :, :3]
    bpy.data.images.remove(img)
    return a[::-1].copy()   # de haut en bas

def down(a, k):
    n = a.shape[0]//k
    return a.reshape(n, k, n, k, 3).mean(axis=(1, 3))

def save(a, path):
    h, w = a.shape[:2]
    img = bpy.data.images.new('s', w, h, alpha=False)
    rgba = np.ones((h, w, 4), dtype=np.float32); rgba[:, :, :3] = a[::-1]
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = path; img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--')+1:]
    glb, outdir = argv[0], argv[1]
    az2 = float(argv[2]) if len(argv) > 2 else 38.0
    tile = (2.2, 3.0) if 'golden' in glb else (2.2, 2.2)
    name = os.path.splitext(os.path.basename(glb))[0]
    os.makedirs(outdir, exist_ok=True)
    obj = setup(glb, tile)
    camera(obj)
    tmp = os.path.join(outdir, '_tmp.png')
    front = render(tmp, 512)
    big = render(tmp, 384)            # 384 -> 96 par moyenne 4x4 (anticrénelage comme dans le navigateur)
    small = down(big, 4)
    obj.rotation_euler = (0, 0, math.radians(az2))
    turn = render(tmp, 512)
    obj.rotation_euler = (0, 0, 0)
    os.remove(tmp)
    bgc = front[0, 0]
    # planche 1280 de large : 512 face, 512 tournée, colonne de 96 (1x et 3x au plus proche)
    sheet = np.ones((512, 1280, 3), dtype=np.float32)*bgc
    sheet[:, 0:512] = front
    sheet[:, 512:1024] = turn
    sheet[16:112, 1056:1152] = small
    sheet[16:112, 1168:1264] = small   # 96 px une deuxième fois, pour comparer côte à côte à d'autres tailles
    big3 = np.kron(small, np.ones((2, 2, 1), dtype=np.float32))   # 192 px, agrandi au plus proche
    sheet[136:328, 1056:1248] = big3
    save(sheet, os.path.join(outdir, f'planche-{name}.png'))
    save(small, os.path.join(outdir, f'{name}-96.png'))
    print('planche', os.path.join(outdir, f'planche-{name}.png'))
