"""Planche groupée : chaque GLB à 256 px et à 96 px sur fond #2A2D38, vue plongeante 57 degrés, soleil chaud à gauche.
Usage : Blender -b --factory-startup -P planche_mp.py -- sortie.png [az] fichier.glb ...   (az = rotation du modèle en degrés, 0 par défaut)"""
import sys, os, math
import bpy, numpy as np
from mathutils import Vector

BG = (0x2A/255, 0x2D/255, 0x38/255)
def lin(c): return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def setup(glb):
    clear()
    bpy.ops.import_scene.gltf(filepath=glb)
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(objs) == 1, f'{len(objs)} objets au rechargement'
    obj = objs[0]
    me = obj.data
    me.polygons.foreach_set('use_smooth', [False]*len(me.polygons))
    ca = me.color_attributes[0].name
    mat = bpy.data.materials.new('m'); mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    att = nt.nodes.new('ShaderNodeAttribute'); att.attribute_name = ca
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.9
    bsdf.inputs['Specular IOR Level'].default_value = 0.1
    nt.links.new(att.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], nt.nodes['Material Output'].inputs['Surface'])
    me.materials.clear(); me.materials.append(mat)
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 4.2; sun.angle = math.radians(4); sun.color = (1.0, 0.86, 0.68)
    so = bpy.data.objects.new('sun', sun); bpy.context.scene.collection.objects.link(so)
    d = Vector((0.8, 0.22, -0.52)).normalized()
    so.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('w'); w.use_nodes = True
    nt2 = w.node_tree; bg = nt2.nodes['Background']
    lp = nt2.nodes.new('ShaderNodeLightPath'); mx = nt2.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    mx.inputs[6].default_value = (0.55, 0.58, 0.62, 1)
    mx.inputs[7].default_value = tuple(lin(c)/0.8 for c in BG) + (1,)
    nt2.links.new(lp.outputs['Is Camera Ray'], mx.inputs[0]); nt2.links.new(mx.outputs[2], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.8
    bpy.context.scene.world = w
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples = 24
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
    return obj

def camera(obj, elev=57.0, fill=1.12, sq=None):
    cs = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    mn = Vector((min(c.x for c in cs), min(c.y for c in cs), min(c.z for c in cs)))
    mx = Vector((max(c.x for c in cs), max(c.y for c in cs), max(c.z for c in cs)))
    sx, sy, sz = mx.x-mn.x, mx.y-mn.y, mx.z-mn.z
    e = math.radians(elev)
    w = sx; h = sz*math.cos(e)+sy*math.sin(e)
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = max(w, h)*fill
    co = bpy.data.objects.new('c', cam); bpy.context.scene.collection.objects.link(co)
    tgt = Vector(((mn.x+mx.x)/2, (mn.y+mx.y)/2, (mn.z+mx.z)/2))
    co.rotation_euler = (math.radians(90-elev), 0, 0)
    co.location = tgt + Vector((0, -math.cos(e), math.sin(e)))*30
    cam.clip_start = 0.1; cam.clip_end = 80
    bpy.context.scene.camera = co

def render(path, px):
    sc = bpy.context.scene
    sc.render.resolution_x = sc.render.resolution_y = px
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    a = np.array(img.pixels[:], dtype=np.float32).reshape(px, px, 4)[:, :, :3]
    bpy.data.images.remove(img)
    return a[::-1].copy()

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
    out = argv[0]
    az = 0.0
    files = argv[1:]
    if files and files[0].replace('.', '', 1).replace('-', '', 1).isdigit():
        az = float(files[0]); files = files[1:]
    tmp = out + '_tmp.png'
    cells = []
    for f in files:
        obj = setup(f)
        obj.rotation_mode = 'XYZ'; obj.rotation_euler = (0, 0, math.radians(az))
        bpy.context.view_layer.update()
        camera(obj)
        big = render(tmp, 256)
        small = down(render(tmp, 384), 4)
        cells.append((big, small))
    os.remove(tmp)
    cols = 4
    rows = (len(cells)+cols-1)//cols
    cw, ch = 256, 256+104
    sheet = np.ones((rows*ch, cols*cw, 3), dtype=np.float32)*np.array([BG[0] ** (1/2.2), BG[1] ** (1/2.2), BG[2] ** (1/2.2)], dtype=np.float32)
    ref = cells[0][0][0, 0]
    sheet[:] = ref
    for i, (big, small) in enumerate(cells):
        r, c = divmod(i, cols)
        y0, x0 = r*ch, c*cw
        sheet[y0:y0+256, x0:x0+256] = big
        sheet[y0+256+4:y0+256+4+96, x0+8:x0+8+96] = small
        sheet[y0+256+4:y0+256+4+96, x0+120:x0+120+96] = small
    save(sheet, out)
    print('planche', out)
