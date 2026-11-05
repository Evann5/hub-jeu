"""Planche de contrôle en grand : chaque GLB en 400 px sous deux azimuts (35 et 0 degré) puis à 96 px et 30 px (taille téléphone).
Usage : Blender -b --factory-startup -P grand.py -- sortie.png fichier.glb ...   (une ligne par monument)"""
import sys, os, math
import bpy, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import planche_mp as sh

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--')+1:]
    out, files = argv[0], argv[1:]
    tmp = out + '_tmp.png'
    rows = []
    for f in files:
        obj = sh.setup(f)
        cells = []
        for az in (35, 0):
            obj.rotation_mode = 'XYZ'; obj.rotation_euler = (0, 0, math.radians(az))
            bpy.context.view_layer.update()
            for c in [o for o in bpy.data.objects if o.type == 'CAMERA']:
                bpy.data.objects.remove(c)
            sh.camera(obj)
            cells.append(sh.render(tmp, 400))
            if az == 35:
                s96 = sh.down(sh.render(tmp, 384), 4)
                s30 = sh.down(sh.render(tmp, 480), 16)
        row = np.ones((400, 400*2+130, 3), dtype=np.float32)*cells[0][0, 0]
        row[:, :400] = cells[0]; row[:, 400:800] = cells[1]
        row[10:106, 806:902] = s96
        row[130:160, 806:836] = s30
        rows.append(row)
    os.remove(tmp)
    save = np.concatenate(rows, axis=0)
    sh.save(save, out)
    print('planche', out)
