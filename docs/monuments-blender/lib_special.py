"""Extension de lib.py pour les 8 cases spéciales d'Escales (Départ, Douane, Festival, Contrôle, Escale, Télex, Impôts, Chantier).
Repère glTF : Y haut, avant = +Z. Les faces sont orientées vers l'extérieur grâce à un point de référence."""
import math
from lib import *


# ---------- transformations ----------
def xform(m, fn):
    m.faces = [([fn(p) for p in pts], col) for pts, col in m.faces]


def rot_y(deg, cx=0.0, cz=0.0):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    def f(p):
        x, z = p[0]-cx, p[2]-cz
        return (cx + x*c + z*s, p[1], cz - x*s + z*c)
    return f


def rot_x(deg, cy, cz):
    """Rotation autour d'un axe parallèle à X passant par (y=cy, z=cz) ; deg > 0 : le haut part vers -Z."""
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    def f(p):
        y, z = p[1]-cy, p[2]-cz
        return (p[0], cy + y*c - z*s, cz + y*s + z*c)
    return f


def move(dx=0.0, dy=0.0, dz=0.0):
    return lambda p: (p[0]+dx, p[1]+dy, p[2]+dz)


def scale(k):
    return lambda p: (p[0]*k, p[1]*k, p[2]*k)


def recenter(m):
    pts = [p for f, _ in m.faces for p in f]
    mnx = min(p[0] for p in pts); mxx = max(p[0] for p in pts)
    mnz = min(p[2] for p in pts); mxz = max(p[2] for p in pts)
    mny = min(p[1] for p in pts)
    xform(m, move(-(mnx+mxx)/2, -mny, -(mnz+mxz)/2))


def bbox(m):
    pts = [p for f, _ in m.faces for p in f]
    return [(min(p[i] for p in pts), max(p[i] for p in pts)) for i in range(3)]


# ---------- solides ----------
def _basis(d):
    d = norm(d)
    r = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)
    u = norm(cross(d, r)); v = cross(d, u)
    return u, v


def tube(m, a, b, ra, rb, n, col, caps=(False, False), rot=0.0, colfn=None, k=1.0, capcol=None):
    """Cylindre ou cône de l'axe a -> b (rayons ra, rb ; k aplatit la section selon la 2e direction)."""
    u, v = _basis(sub(b, a))
    def ring(p, r):
        return [add(p, add(mul(u, r*math.cos(rot+2*math.pi*i/n)), mul(v, r*k*math.sin(rot+2*math.pi*i/n)))) for i in range(n)]
    A, B = ring(a, ra), ring(b, rb)
    mid = lerp(a, b, 0.5)
    for i in range(n):
        j = (i+1) % n
        m.poly([A[i], A[j], B[j], B[i]], colfn(i) if colfn else col, mid)
    if caps[0]:
        m.poly(A, capcol or col, mid)
    if caps[1]:
        m.poly(B, capcol or col, mid)
    return A, B


def rod(m, a, b, r, col, n=3, caps=False):
    """Barre fine de section régulière à n côtés (3 = triangle, 6 triangles)."""
    return tube(m, a, b, r, r, n, col, (caps, caps))


def lathe(m, cx, cz, profile, n, col, rot=0.0, colfn=None, cap=None, capbot=None, rz=1.0, y_off=0.0):
    """Solide de révolution autour de l'axe vertical (cx, cz). profile : (rayon, y) de bas en haut.
    colfn(k, i) -> couleur de la face i de la bande k. Un ressaut horizontal regarde vers le haut."""
    rings = [[(cx+r*math.cos(rot+2*math.pi*i/n), y+y_off, cz+r*rz*math.sin(rot+2*math.pi*i/n)) for i in range(n)] for (r, y) in profile]
    for k in range(len(rings)-1):
        ya, yb = profile[k][1], profile[k+1][1]
        ref = (cx, ya-1, cz) if abs(yb-ya) < 1e-9 else (cx, (ya+yb)/2+y_off, cz)
        for i in range(n):
            j = (i+1) % n
            m.poly([rings[k][i], rings[k][j], rings[k+1][j], rings[k+1][i]], colfn(k, i) if colfn else col, ref)
    if cap is not None and profile[-1][0] > 1e-6:
        m.poly(rings[-1], cap, (cx, profile[-1][1]+y_off-1, cz))
    if capbot is not None and profile[0][0] > 1e-6:
        m.poly(rings[0], capbot, (cx, profile[0][1]+y_off+1, cz))
    return rings


def cyl(m, cx, cz, r, y0, y1, n, col, cap=None, rot=0.0, r1=None, capbot=None, colfn=None):
    r1 = r if r1 is None else r1
    return lathe(m, cx, cz, [(r, y0), (r1, y1)], n, col, rot, (lambda k, i: colfn(i)) if colfn else None, cap, capbot)


def disc(m, cx, y, cz, r, n, col, rot=0.0, up=True):
    pts = [(cx+r*math.cos(rot+2*math.pi*i/n), y, cz+r*math.sin(rot+2*math.pi*i/n)) for i in range(n)]
    m.poly(pts, col, (cx, y-1 if up else y+1, cz))


def slab(m, pts2, plane, lo, hi, col, cap0=None, cap1=None):
    """Prisme droit sur un polygone convexe. plane : 'xz' (hauteur y de lo à hi), 'xy' (profondeur z), 'zy' (largeur x, pts = (z, y))."""
    def P(p, t):
        if plane == 'xz': return (p[0], t, p[1])
        if plane == 'xy': return (p[0], p[1], t)
        return (t, p[1], p[0])
    A = [P(p, lo) for p in pts2]; B = [P(p, hi) for p in pts2]
    c = centroid(A+B)
    for i in range(len(A)):
        j = (i+1) % len(A)
        m.poly([A[i], A[j], B[j], B[i]], col, c)
    m.poly(A, cap0 or col, centroid(B))
    m.poly(B, cap1 or col, centroid(A))


def prism3(m, ringA, ringB, col, capA=None, capB=None):
    """Prisme entre deux anneaux 3D de même taille (aile, nacelle...)."""
    c = centroid(list(ringA)+list(ringB))
    n = len(ringA)
    for i in range(n):
        j = (i+1) % n
        m.poly([ringA[i], ringA[j], ringB[j], ringB[i]], col, c)
    m.poly(ringA, capA or col, centroid(ringB))
    m.poly(ringB, capB or col, centroid(ringA))


def flat(m, pts, col, toward):
    """Polygone plat orienté vers le point 'toward' (dessus de décor, drapeau...)."""
    c = centroid(pts)
    # ref = point opposé à 'toward' par rapport au polygone
    ref = (2*c[0]-toward[0], 2*c[1]-toward[1], 2*c[2]-toward[2])
    m.poly(pts, col, ref)


def flat2(m, pts, col, toward, gap=0.003):
    """Polygone visible des deux côtés (drapeau, fanion, feuille) : face avant tournée vers 'toward', face arrière décalée de 'gap' pour ne pas se superposer."""
    flat(m, pts, col, toward)
    n = norm(newell(pts))
    c = centroid(pts)
    if dot(n, sub(toward, c)) > 0:
        n = mul(n, -1)                  # n : sens opposé à 'toward'
    back = [add(p, mul(n, gap)) for p in pts]
    m.poly(back, col, add(c, mul(n, -1)))      # regarde vers l'arrière (loin de 'toward')


def quad_xy(m, x0, x1, y0, y1, z, col, face=1):
    """Rectangle dans un plan z = cste, tourné vers +Z (face=1) ou -Z."""
    m.poly([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], col, (0.5*(x0+x1), 0.5*(y0+y1), z-face))


def quad_zy(m, z0, z1, y0, y1, x, col, face=1):
    m.poly([(x, y0, z0), (x, y0, z1), (x, y1, z1), (x, y1, z0)], col, (x-face, 0.5*(y0+y1), 0.5*(z0+z1)))


def quad_xz(m, x0, x1, z0, z1, y, col, up=1):
    m.poly([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], col, (0.5*(x0+x1), y-up, 0.5*(z0+z1)))


# ---------- boules à facettes ----------
def _ico(sub_n):
    t = (1+5**0.5)/2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    v = [norm(p) for p in v]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    for _ in range(sub_n):
        cache, nf = {}, []
        def mid(a, b):
            key = (min(a, b), max(a, b))
            if key not in cache:
                v.append(norm(lerp(v[a], v[b], 0.5)))
                cache[key] = len(v)-1
            return cache[key]
        for (a, b, c) in f:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        f = nf
    return v, f


_ICO = {}


def blob(m, cx, cy, cz, rx, ry, rz, col, sub_n=0, colfn=None, ymin=None):
    if sub_n not in _ICO:
        _ICO[sub_n] = _ico(sub_n)
    v, f = _ICO[sub_n]
    for (a, b, c) in f:
        pts = [(cx+v[q][0]*rx, cy+v[q][1]*ry, cz+v[q][2]*rz) for q in (a, b, c)]
        if ymin is not None:
            pts = [(p[0], max(p[1], ymin), p[2]) for p in pts]
        m.poly(pts, colfn(pts) if colfn else col, (cx, cy, cz))


def balloon(m, cx, y0, cz, r, h, col, n=6, knot='dark'):
    """Ballon : solide de révolution allongé, noeud en dessous (y0 = pointe basse)."""
    prof = [(0.03*r, y0), (0.55*r, y0+0.14*h), (r, y0+0.45*h), (0.8*r, y0+0.78*h), (0.0, y0+h)]
    lathe(m, cx, cz, prof, n, col)
    # petit noeud
    lathe(m, cx, cz, [(0.0, y0-0.05*h), (0.06*r, y0)], n=3, col=knot)
