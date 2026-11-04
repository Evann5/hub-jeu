"""Planche groupée : chaque GLB à 256 px et à 96 px (moyenne 4x4 d'un rendu 384), fond #2A2D38, soleil chaud à gauche, Eevee, vue plongeante 57 degrés.
Usage : Blender -b --factory-startup -P render_groupe.py -- sortie.png fichier1.glb fichier2.glb ..."""
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy, numpy as np
from mathutils import Vector
import render as R
from lib import hex_lin

BG = hex_lin('#2A2D38')

def one(glb, px_list):
    obj = R.setup(glb, (6, 6))
    # fond sombre : ce que voit la caméra + sol de la même teinte (un peu plus clair pour lire l'ombre)
    w = bpy.context.scene.world
    mx = [n for n in w.node_tree.nodes if n.type == 'MIX'][0]
    mx.inputs[7].default_value = (*BG, 1)
    g = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o is not obj][0]
    g.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*hex_lin('#3A3E4C'), 1)
    R.camera(obj)
    import tempfile
    tmp = os.path.join(tempfile.gettempdir(), '_t_groupe.png')
    out = {}
    for px in px_list:
        out[px] = R.render(tmp, px)
    os.remove(tmp)
    return out

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--')+1:]
    sheet_path, glbs = argv[0], argv[1:]
    cols = 4
    cw, ch = 256+20, 256+96+30
    rows = (len(glbs)+cols-1)//cols
    res = [one(g, (256, 384)) for g in glbs]
    bgc = res[3][256][0, 0]
    sheet = np.ones((rows*ch+10, cols*cw+10, 3), dtype=np.float32)*bgc
    for i, r in enumerate(res):
        small = R.down(r[384], 4)
        x0 = 10+(i % cols)*cw; y0 = 10+(i//cols)*ch
        sheet[y0:y0+256, x0:x0+256] = r[256]
        sheet[y0+266:y0+266+96, x0+80:x0+80+96] = small
    R.save(sheet, sheet_path)
    print('planche', sheet_path)
