"""Détecte les faces à l'envers (copie de faces_mp.py avec un fichier temporaire à soi, pour ne pas se marcher dessus avec d'autres lots).
Usage : Blender -b --factory-startup -P faces_asie.py -- f.glb ..."""
import sys, os, math, tempfile
import bpy, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import planche_mp as sheet

if __name__ == '__main__':
    files = sys.argv[sys.argv.index('--')+1:]
    tmp = os.path.join(tempfile.gettempdir(), f'_cull_asie_{os.getpid()}.png')
    for f in files:
        obj = sheet.setup(f)
        mat = obj.data.materials[0]
        res = []
        for az in (0, 90, 180, 270):
            obj.rotation_mode = 'XYZ'; obj.rotation_euler = (0, 0, math.radians(az))
            bpy.context.view_layer.update()
            for c in [o for o in bpy.data.objects if o.type == 'CAMERA']:
                bpy.data.objects.remove(c)
            sheet.camera(obj)
            mat.use_backface_culling = False
            a = sheet.render(tmp, 256)
            mat.use_backface_culling = True
            b = sheet.render(tmp, 256)
            d = np.abs(a-b).max(axis=2)
            res.append((az, int((d > 0.03).sum())))
        print('CULL', f.split('/')[-1], res)
    if os.path.exists(tmp): os.remove(tmp)
