"""Extension de lib.py pour les monuments du Mexique et d'Italie (Escales).
Repère glTF : Y haut, avant = +Z. Les façades sont décrites dans un repère local Fr (s = le long du mur, d = vers l'extérieur)."""
import math
from lib import *


class Fr:
    """Repère local posé au sol : P(s, y, d) -> point du monde. u = sens de s, n = sens de d (extérieur, 'devant')."""
    def __init__(self, o=(0.0, 0.0), u=(1.0, 0.0), n=(0.0, 1.0)):
        self.o, self.u, self.n = o, u, n

    def P(self, s, y, d=0.0):
        return (self.o[0]+self.u[0]*s+self.n[0]*d, y, self.o[1]+self.u[1]*s+self.n[1]*d)


ID = Fr()


def rot_frame(cx, cz, deg):
    """Repère tourné de deg degrés autour de (cx, cz) : s le long du mur, d vers l'avant tourné."""
    a = math.radians(deg)
    return Fr((cx, cz), (math.cos(a), -math.sin(a)), (math.sin(a), math.cos(a)))


# ---------- boîtes et toits ----------
def obox(m, F, s0, s1, y0, y1, d0, d1, col, skip=(), top=None):
    P = F.P
    c = P((s0+s1)/2, (y0+y1)/2, (d0+d1)/2)
    f = {
        'front': [P(s0, y0, d1), P(s1, y0, d1), P(s1, y1, d1), P(s0, y1, d1)],
        'back': [P(s0, y0, d0), P(s1, y0, d0), P(s1, y1, d0), P(s0, y1, d0)],
        'l': [P(s0, y0, d0), P(s0, y0, d1), P(s0, y1, d1), P(s0, y1, d0)],
        'r': [P(s1, y0, d0), P(s1, y0, d1), P(s1, y1, d1), P(s1, y1, d0)],
        'top': [P(s0, y1, d0), P(s1, y1, d0), P(s1, y1, d1), P(s0, y1, d1)],
    }
    for k, pts in f.items():
        if k not in skip:
            m.poly(pts, top if (k == 'top' and top) else col, c)


def gable(m, F, s0, s1, d0, d1, y0, yr, col, gcol=None, ridge='s', o=0.0, skip_gables=False):
    """Toit à deux pans. ridge='s' : faîtage le long de s ; 'd' : le long de d."""
    P = F.P
    gcol = gcol or col
    sm, dm = (s0+s1)/2, (d0+d1)/2
    ref = P(sm, y0-0.3, dm)
    if ridge == 's':
        m.poly([P(s0-o, y0, d0-o), P(s1+o, y0, d0-o), P(s1+o, yr, dm), P(s0-o, yr, dm)], col, ref)
        m.poly([P(s0-o, yr, dm), P(s1+o, yr, dm), P(s1+o, y0, d1+o), P(s0-o, y0, d1+o)], col, ref)
        if not skip_gables:
            m.poly([P(s0, y0, d0), P(s0, y0, d1), P(s0, yr, dm)], gcol, P(sm, y0, dm))
            m.poly([P(s1, y0, d0), P(s1, y0, d1), P(s1, yr, dm)], gcol, P(sm, y0, dm))
    else:
        m.poly([P(s0-o, y0, d0-o), P(sm, yr, d0-o), P(sm, yr, d1+o), P(s0-o, y0, d1+o)], col, ref)
        m.poly([P(sm, yr, d0-o), P(s1+o, y0, d0-o), P(s1+o, y0, d1+o), P(sm, yr, d1+o)], col, ref)
        if not skip_gables:
            m.poly([P(s0, y0, d0), P(sm, yr, d0), P(s1, y0, d0)], gcol, P(sm, y0, dm))
            m.poly([P(s0, y0, d1), P(sm, yr, d1), P(s1, y0, d1)], gcol, P(sm, y0, dm))


def hip(m, F, s0, s1, d0, d1, y0, yr, col, o=0.0, rl=0.0, cols=None):
    """Toit à quatre pans (rl = longueur du faîtage le long de s, 0 = pyramide)."""
    P = F.P
    sm, dm = (s0+s1)/2, (d0+d1)/2
    ref = P(sm, y0-0.3, dm)
    a, b = sm-rl/2, sm+rl/2
    c = cols or [col]*4
    m.poly([P(s0-o, y0, d1+o), P(s1+o, y0, d1+o), P(b, yr, dm), P(a, yr, dm)], c[0], ref)
    m.poly([P(s1+o, y0, d0-o), P(s0-o, y0, d0-o), P(a, yr, dm), P(b, yr, dm)], c[1], ref)
    m.poly([P(s0-o, y0, d0-o), P(s0-o, y0, d1+o), P(a, yr, dm)], c[2], ref)
    m.poly([P(s1+o, y0, d1+o), P(s1+o, y0, d0-o), P(b, yr, dm)], c[3], ref)


# ---------- ouvertures (arcs) ----------
def arch_pts(sc, hw, spring, apex, k=4, pointed=False):
    """Points (s, y) de gauche à droite, du pied gauche au pied droit."""
    pts = []
    if not pointed:
        for i in range(k+1):
            th = math.pi*(1-i/k)
            pts.append((sc+hw*math.cos(th), spring+(apex-spring)*math.sin(th)))
        return pts
    # arc brisé équilatéral : deux arcs de rayon 2*hw centrés sur le pied opposé
    h = apex-spring
    left = []
    for i in range(k+1):
        t = math.radians(60*i/k)
        left.append((-1+2*(1-math.cos(t)), 2*math.sin(t)))   # x de -1 à 0, y de 0 à 1.732
    # left : (x = -1 + 2(1-cos t)) va de -1 à 0
    pts = [(sc+hw*x, spring+h*y/1.732) for (x, y) in left]
    pts += [(sc-hw*x, spring+h*y/1.732) for (x, y) in reversed(left[:-1])]
    return pts


def wall_openings(m, F, s0, s1, y0, y1, d, ops, col, back, depth, k=4, pointed=False, jamb=None):
    """Mur plein s0..s1 x y0..y1 au retrait d, percé d'ouvertures (sc, hw, sill, spring, apex).
    Fond sombre à d-depth, jambages et appui."""
    P = F.P
    jamb = jamb or col
    cur = s0
    ref_o = lambda s, y: P(s, y, d-3)
    for (sc, hw, sill, spring, apex) in sorted(ops):
        sl, sr = sc-hw, sc+hw
        if sl > cur+1e-6:
            m.poly([P(cur, y0, d), P(sl, y0, d), P(sl, y1, d), P(cur, y1, d)], col, ref_o(cur, y0))
        cur = sr
        if sill > y0+1e-6:
            m.poly([P(sl, y0, d), P(sr, y0, d), P(sr, sill, d), P(sl, sill, d)], col, ref_o(sc, y0))
        if apex-spring < 1e-6:
            m.poly([P(sl, spring, d), P(sr, spring, d), P(sr, y1, d), P(sl, y1, d)], col, ref_o(sc, y0))
            a = [(sl, spring), (sr, spring)]
        else:
            a = arch_pts(sc, hw, spring, apex, k, pointed)
            for i in range(len(a)-1):
                (s_a, y_a), (s_b, y_b) = a[i], a[i+1]
                m.poly([P(s_a, y_a, d), P(s_b, y_b, d), P(s_b, y1, d), P(s_a, y1, d)], col, ref_o(sc, y0))
        ymid = (sill+spring)/2
        plate = [P(sl, sill, d-depth), P(sr, sill, d-depth)] + [P(s, y, d-depth) for (s, y) in reversed(a)]
        m.poly(plate, back, ref_o(sc, ymid-3) if False else P(sc, ymid, d-depth-3))
        m.poly([P(sl, sill, d), P(sl, sill, d-depth), P(sl, spring, d-depth), P(sl, spring, d)], jamb, P(sl-1, ymid, d-depth/2))
        m.poly([P(sr, sill, d), P(sr, sill, d-depth), P(sr, spring, d-depth), P(sr, spring, d)], jamb, P(sr+1, ymid, d-depth/2))
        if sill > y0+1e-6:
            m.poly([P(sl, sill, d), P(sr, sill, d), P(sr, sill, d-depth), P(sl, sill, d-depth)], jamb, P(sc, sill-1, d-depth/2))
    if s1 > cur+1e-6:
        m.poly([P(cur, y0, d), P(s1, y0, d), P(s1, y1, d), P(cur, y1, d)], col, ref_o(cur, y0))


def deco_rect(m, F, s0, s1, y0, y1, d, col, side=1):
    P = F.P
    m.poly([P(s0, y0, d), P(s1, y0, d), P(s1, y1, d), P(s0, y1, d)], col, P((s0+s1)/2, (y0+y1)/2, d-side*2))


def deco_arch(m, F, sc, hw, sill, spring, apex, d, col, k=3, pointed=False, side=1):
    P = F.P
    a = arch_pts(sc, hw, spring, apex, k, pointed)
    pts = [P(sc-hw, sill, d), P(sc+hw, sill, d)] + [P(s, y, d) for (s, y) in reversed(a)]
    m.poly(pts, col, P(sc, (sill+spring)/2, d-side*2))


def deco_poly(m, F, pts_sy, d, col, side=1):
    P = F.P
    cs = sum(p[0] for p in pts_sy)/len(pts_sy)
    cy = sum(p[1] for p in pts_sy)/len(pts_sy)
    m.poly([P(s, y, d) for (s, y) in pts_sy], col, P(cs, cy, d-side*2))


def window(m, F, sc, hw, y0, y1, d, glass, frame, side=1, fm=0.012):
    """Fenêtre rectangulaire : cadre clair + vitre sombre posés sur le mur (4 triangles)."""
    deco_rect(m, F, sc-hw-fm, sc+hw+fm, y0-fm, y1+fm, d+0.002*side, frame, side)
    deco_rect(m, F, sc-hw, sc+hw, y0, y1, d+0.004*side, glass, side)


# ---------- solides de révolution ----------
def ring_pts(cx, cz, rx, rz, y, n, rot=0.0):
    return [(cx+rx*math.cos(rot+2*math.pi*i/n), y, cz+rz*math.sin(rot+2*math.pi*i/n)) for i in range(n)]


def lathe(m, cx, cz, profile, n, colfn, rot=0.0, cap=None, rz_k=1.0):
    """profile : liste (r, y) de bas en haut ; colfn(k, i) -> nom de couleur de la face i de la bande k."""
    rings = [ring_pts(cx, cz, r, r*rz_k, y, n, rot) for (r, y) in profile]
    for k in range(len(rings)-1):
        ya, yb = profile[k][1], profile[k+1][1]
        for i in range(n):
            j = (i+1) % n
            if abs(yb-ya) < 1e-9:
                ref = (cx, ya-1, cz)    # ressaut horizontal : face tournée vers le haut
            else:
                ref = (cx, (ya+yb)/2, cz)
            m.poly([rings[k][i], rings[k][j], rings[k+1][j], rings[k+1][i]], colfn(k, i), ref)
    if cap is not None and profile[-1][0] > 1e-6:
        m.poly(rings[-1], cap, (cx, profile[-1][1]-1, cz))
    return rings


def cyl(m, cx, cz, r, y0, y1, n, col, cap=None, rot=0.0, r1=None):
    r1 = r if r1 is None else r1
    return lathe(m, cx, cz, [(r, y0), (r1, y1)], n, lambda k, i: col, rot, cap)


def cone(m, cx, cz, r, y0, y1, n, col, rot=0.0, cols=None):
    return lathe(m, cx, cz, [(r, y0), (0.0, y1)], n, (lambda k, i: cols[i % len(cols)]) if cols else (lambda k, i: col), rot)


# ---------- boules à facettes ----------
def _ico(sub):
    t = (1+5**0.5)/2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    v = [norm(p) for p in v]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    for _ in range(sub):
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


def blob(m, cx, cy, cz, rx, ry, rz, col, sub=0, colfn=None, ymin=None):
    if sub not in _ICO:
        _ICO[sub] = _ico(sub)
    v, f = _ICO[sub]
    for fi, (a, b, c) in enumerate(f):
        pts = [(cx+v[q][0]*rx, cy+v[q][1]*ry, cz+v[q][2]*rz) for q in (a, b, c)]
        if ymin is not None:
            pts = [(p[0], max(p[1], ymin), p[2]) for p in pts]
        m.poly(pts, colfn(pts) if colfn else col, (cx, cy, cz))


def tree(m, cx, cz, h, r, trunk, leaf, y0=0.0, leaf2=None):
    t = r*0.14
    m.box(cx-t, cx+t, y0, y0+h*0.45, cz-t, cz+t, trunk, skip=('bot', 'top'))
    blob(m, cx, y0+h*0.45+r*0.8, cz, r, r*0.85, r, leaf, 0, (lambda pts: leaf2 if (leaf2 and pts[0][0]+pts[0][2] > cx+cz) else leaf))


def pillar(m, cx, cz, r, y0, y1, n, col, cap=None, r1=None):
    cyl(m, cx, cz, r, y0, y1, n, col, cap, r1=r1)


def poly_floor(m, pts_xz, y, col):
    """Polygone horizontal convexe tourné vers le haut."""
    m.poly([(x, y, z) for (x, z) in pts_xz], col, (sum(p[0] for p in pts_xz)/len(pts_xz), y-1, sum(p[1] for p in pts_xz)/len(pts_xz)))


def hull_poly(m, pts_xz, y0, y1, col, topcol=None):
    """Prisme droit sur un polygone convexe (parois + dessus)."""
    n = len(pts_xz)
    cx = sum(p[0] for p in pts_xz)/n; cz = sum(p[1] for p in pts_xz)/n
    for i in range(n):
        a, b = pts_xz[i], pts_xz[(i+1) % n]
        m.poly([(a[0], y0, a[1]), (b[0], y0, b[1]), (b[0], y1, b[1]), (a[0], y1, a[1])], col, (cx, (y0+y1)/2, cz))
    m.poly([(x, y1, z) for (x, z) in pts_xz], topcol or col, (cx, y0, cz))
