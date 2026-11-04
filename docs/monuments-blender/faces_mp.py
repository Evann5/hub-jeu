"""Détecte les faces à l'envers : rend chaque GLB avec et sans élimination des faces arrière, sous 4 azimuts.
Un écart = une face visible dont le sens est faux. Usage : Blender -b --factory-startup -P cull.py -- f.glb ..."""
import sys, os, math
import bpy, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import planche_mp as sheet

if __name__ == '__main__':
    files = sys.argv[sys.argv.index('--')+1:]
    import tempfile, os; tmp = os.path.join(tempfile.gettempdir(), '_cull.png')
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
            n = int((d > 0.03).sum())
            ys, xs = np.nonzero(d > 0.03)
            res.append((az, n, (int(xs.mean()), int(ys.mean())) if n else None, [round(float(v), 2) for v in a[d > 0.03].mean(axis=0)] if n else None))
        print('CULL', f.split('/')[-1], res)
