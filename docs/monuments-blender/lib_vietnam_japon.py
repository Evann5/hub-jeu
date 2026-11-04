"""Extension de lib.py pour les monuments du Vietnam et du Japon d'Escales (cylindres, toits à coins relevés, pignons, lanternes, guirlandes).
Même repère que lib.py : Y vers le haut, avant = +Z."""
import math
from lib import *

def circle(cx, cz, y, r, n, rot=0.0, rz=None):
    rz = r if rz is None else rz
    return [(cx + r*math.cos(rot+2*math.pi*i/n), y, cz + rz*math.sin(rot+2*math.pi*i/n)) for i in range(n)]

def cyl(m, cx, cz, y0, y1, r0, col, r1=None, n=10, caps=(True, True), rot=0.0, rz_ratio=1.0):
    """Cylindre ou cône tronqué (r1 = 0 donne un cône)."""
    r1 = r0 if r1 is None else r1
    a = circle(cx, cz, y0, r0, n, rot, r0*rz_ratio)
    b = circle(cx, cz, y1, r1, n, rot, r1*rz_ratio)
    ref = (cx, (y0+y1)/2, cz)
    m.band(a, b, col, ref)
    if caps[0] and r0 > 1e-6:
        m.poly(a, col, ref)
    if caps[1] and r1 > 1e-6:
        m.poly(b, col, ref)

def tbox(m, cx, cz, y0, y1, hw0, hd0, hw1, hd1, col, bottom=False, top=True):
    """Bloc à murs inclinés (socle de pierre)."""
    a = [(cx-hw0, y0, cz-hd0), (cx+hw0, y0, cz-hd0), (cx+hw0, y0, cz+hd0), (cx-hw0, y0, cz+hd0)]
    b = [(cx-hw1, y1, cz-hd1), (cx+hw1, y1, cz-hd1), (cx+hw1, y1, cz+hd1), (cx-hw1, y1, cz+hd1)]
    ref = (cx, (y0+y1)/2, cz)
    m.band(a, b, col, ref)
    if bottom:
        m.poly(a, col, ref)
    if top:
        m.poly(b, col, ref)

def eave_ring(cx, cz, y, hw, hd, lift=0.0, flare=0.0):
    pts = []
    for (sx, sz) in [(-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0)]:
        if sx and sz:
            pts.append((cx+sx*(hw+flare), y+lift, cz+sz*(hd+flare)))
        else:
            pts.append((cx+sx*hw, y, cz+sz*hd))
    return pts

def roof(m, cx, cz, y, hw, hd, h, col, top=(0.0, 0.0), lift=0.0, flare=0.0, cap=False, col_top=None):
    """Toit en croupe à quatre coins relevés. top = demi-largeur et demi-profondeur du faîte (0 = arête ou pointe)."""
    lo = eave_ring(cx, cz, y, hw, hd, lift, flare)
    hi = eave_ring(cx, cz, y+h, top[0], top[1])
    ref = (cx, y-0.02, cz)
    m.band(lo, hi, col, ref)
    if cap and top[0] > 1e-6 and top[1] > 1e-6:
        m.poly(hi, col_top or col, (cx, y, cz))
    return hi

def gable(m, x0, x1, z0, z1, y0, h, col, end_col=None, ridge='x'):
    """Toit à deux pans (prisme). ridge='x' : faîtage le long de x."""
    end_col = end_col or col
    if ridge == 'x':
        P = lambda u, y, v: (u, y, v)
        u0, u1, v0, v1 = x0, x1, z0, z1
    else:
        P = lambda u, y, v: (v, y, u)
        u0, u1, v0, v1 = z0, z1, x0, x1
    vc = (v0+v1)/2
    uc = (u0+u1)/2
    ref = P(uc, y0, vc)
    m.poly([P(u0, y0, v1), P(u1, y0, v1), P(u1, y0+h, vc), P(u0, y0+h, vc)], col, ref)
    m.poly([P(u0, y0, v0), P(u1, y0, v0), P(u1, y0+h, vc), P(u0, y0+h, vc)], col, ref)
    m.poly([P(u0, y0, v0), P(u0, y0, v1), P(u0, y0+h, vc)], end_col, P(uc, y0+h*0.3, vc))
    m.poly([P(u1, y0, v0), P(u1, y0, v1), P(u1, y0+h, vc)], end_col, P(uc, y0+h*0.3, vc))

def blob(m, cx, cy, cz, rx, ry, rz, col, n=7, lats=(-70, -30, 30, 70), rot=0.0, caps=True):
    """Ellipsoïde bas polygone (lanternes, feuillage)."""
    rings = []
    for la in lats:
        a = math.radians(la)
        r = math.cos(a)
        rings.append([(cx+rx*r*math.cos(rot+2*math.pi*i/n), cy+ry*math.sin(a), cz+rz*r*math.sin(rot+2*math.pi*i/n)) for i in range(n)])
    ref = (cx, cy, cz)
    for k in range(len(rings)-1):
        m.band(rings[k], rings[k+1], col, ref)
    if caps:
        m.poly(rings[0], col, ref)
        m.poly(rings[-1], col, ref)

def sag(a, b, drop, n):
    """Points d'une guirlande qui pend entre a et b (parabole), n+1 points."""
    pts = []
    for i in range(n+1):
        t = i/n
        p = lerp(a, b, t)
        pts.append((p[0], p[1]-drop*4*t*(1-t), p[2]))
    return pts

def tube(m, pts, w, col, sides=3):
    for i in range(len(pts)-1):
        m.beam(pts[i], pts[i+1], w, col, sides=sides)

def spire(m, cx, cz, y0, y1, r0, col, r1=0.0, n=6):
    cyl(m, cx, cz, y0, y1, r0, col, r1, n=n, caps=(False, False))
