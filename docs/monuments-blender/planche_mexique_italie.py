"""Planche groupée : Blender -b --factory-startup -P planche.py -- sortie.png az dossier_glb nom ...
Chaque case : rendu 256, 96 px (moyenne 4x4 de 384), 96 agrandi 2x. Fond #2A2D38, soleil chaud à gauche, vue plongeante 57 degrés."""
import sys, os, math
import bpy, numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R
from lib import hex_lin

TARGET = hex_lin('#2A2D38')

def setup(glb, albedo):
    obj = R.setup(glb, (0.1, 0.1))
    for o in list(bpy.context.scene.objects):
        if o.type == 'MESH' and o is not obj:
            bpy.data.objects.remove(o)
    bpy.ops.mesh.primitive_plane_add(size=1)
    g = bpy.context.active_object
    g.scale = (14, 14, 1); g.location = (0, 0, -0.002)
    gm = bpy.data.materials.new('g'); gm.use_nodes = True
    b = gm.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*albedo, 1); b.inputs['Roughness'].default_value = 1
    b.inputs['Specular IOR Level'].default_value = 0.0
    g.data.materials.append(gm)
    w = bpy.context.scene.world
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    return obj

def calibrate(glb):
    a = [0.3, 0.3, 0.3]
    obj = setup(glb, a); R.camera(obj)
    px = R.render('/tmp/_cal.png' if False else os.path.join(os.path.dirname(OUT), '_cal.png'), 32)
    c = px[0, 0]
    return [min(1.0, a[i]*TARGET[i]/max(c[i], 1e-4)) for i in range(3)]

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--')+1:]
    OUT, az, gdir, names = argv[0], float(argv[1]), argv[2], argv[3:]
    albedo = calibrate(os.path.join(gdir, names[0]+'.glb'))
    cells = []
    for n in names:
        obj = setup(os.path.join(gdir, n+'.glb'), albedo)
        R.camera(obj, fill=1.15)
        obj.rotation_euler = (0, 0, math.radians(az))
        tmp = os.path.join(os.path.dirname(OUT), '_tmp.png')
        big = R.render(tmp, 256)
        b384 = R.render(tmp, 384)
        small = R.down(b384, 4)
        cells.append((big, small))
    os.remove(os.path.join(os.path.dirname(OUT), '_tmp.png'))
    bg = np.array([0.0, 0.0, 0.0], dtype=np.float32)
    CW, CH = 304, 464
    cols = 4; rows = (len(cells)+cols-1)//cols
    sheet = np.ones((rows*CH, cols*CW, 3), dtype=np.float32)*0.5
    for idx, (big, small) in enumerate(cells):
        r, c = divmod(idx, cols)
        y0, x0 = r*CH, c*CW
        sheet[y0:y0+256, x0:x0+256] = big
        sheet[y0+264:y0+360, x0+8:x0+104] = small
        sheet[y0+264:y0+456, x0+112:x0+304] = np.kron(small, np.ones((2, 2, 1), dtype=np.float32))
    R.save(sheet, OUT)
    print('planche', OUT, sheet.shape)
