"""Lance des rayons de la caméra (vue plongeante 57 degrés) sur le GLB et signale les faces à l'envers touchées en premier.
Usage : Blender -b --factory-startup -P flipcheck.py -- f.glb ..."""
import sys, math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

DEBUG = False

def check(path, az=0.0, n=140):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    obj = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
    me = obj.data
    ca = me.color_attributes[0]
    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(obj, deps)
    cs = [Vector(c) for c in obj.bound_box]
    mn = Vector((min(c.x for c in cs), min(c.y for c in cs), min(c.z for c in cs)))
    mx = Vector((max(c.x for c in cs), max(c.y for c in cs), max(c.z for c in cs)))
    e = math.radians(57)
    d = Vector((0, math.cos(e), -math.sin(e)))          # direction du regard (Blender : y = profondeur)
    d.rotate(__import__('mathutils').Euler((0, 0, math.radians(az))))
    up = Vector((0, math.sin(e), math.cos(e)))
    right = Vector((1, 0, 0))
    ctr = (mn+mx)/2
    R = (mx-mn).length*0.6
    bad = {}
    tot = 0
    for i in range(n):
        for j in range(n):
            u = (i/(n-1)-0.5)*2*R; v = (j/(n-1)-0.5)*2*R
            o = ctr + right*u + up*v - d*20
            loc, nor, idx, dist = bvh.ray_cast(o, d)
            if loc is None:
                continue
            tot += 1
            if nor.dot(d) > 0:
                poly = me.polygons[idx]
                col = tuple(round(x, 2) for x in ca.data[poly.vertices[0]].color[:3])
                key = (round(loc.x, 1), round(loc.z, 1), round(-loc.y, 1), col)
                bad[key] = bad.get(key, 0)+1
                if DEBUG and bad[key] == 1:
                    print('   poly', [tuple(round(c, 3) for c in (me.vertices[v].co.x, me.vertices[v].co.z, -me.vertices[v].co.y)) for v in poly.vertices], 'normal', tuple(round(c, 2) for c in nor))
    return tot, bad

if __name__ == '__main__':
    DEBUG = '--debug' in sys.argv
    for f in [a for a in sys.argv[sys.argv.index('--')+1:] if a != '--debug']:
        tot, bad = check(f)
        n = sum(bad.values())
        print('FLIP', f.split('/')[-1], 'rayons', tot, 'à envers', n, sorted(bad.items(), key=lambda kv: -kv[1])[:5])
