"""Cherche les faces dont la normale pointe vers l'intérieur d'un solide : lancer un rayon dans le sens de la normale, nombre impair de croisements = face à l'envers.
Usage : python3 -I flip_asie.py <module> [<module> ...]   (hors Blender)"""
import sys, importlib
sys.path.insert(0, '.')
from lib import sub, cross, dot, newell, norm, centroid

def tri_list(m):
    T = []
    for pts, col in m.faces:
        for i in range(1, len(pts)-1):
            T.append((pts[0], pts[i], pts[i+1]))
    return T

def hit(o, d, t):
    a, b, c = t
    e1, e2 = sub(b, a), sub(c, a)
    p = cross(d, e2); det = dot(e1, p)
    if abs(det) < 1e-12: return False
    inv = 1/det; s = sub(o, a)
    u = dot(s, p)*inv
    if u < 0 or u > 1: return False
    q = cross(s, e1); v = dot(d, q)*inv
    if v < 0 or u+v > 1: return False
    return dot(e2, q)*inv > 1e-6

for name in sys.argv[1:]:
    m = importlib.import_module(name).build()
    T = tri_list(m)
    bad = {}
    for pts, col in m.faces:
        n = norm(newell(pts)); c = centroid(pts)
        o = (c[0]+n[0]*1e-4, c[1]+n[1]*1e-4, c[2]+n[2]*1e-4)
        d = (n[0]*0.9+0.02, n[1]*0.9+0.03, n[2]*0.9+0.01)
        k = sum(1 for t in T if hit(o, d, t))
        if k % 2 == 1:
            bad.setdefault(col, []).append(tuple(round(v, 2) for v in c))
    print(name, {c: (len(v), v[:3]) for c, v in bad.items()})
