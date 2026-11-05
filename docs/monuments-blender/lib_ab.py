"""Aides géométriques pour les monuments d'Afrique du Nord, du Sénégal et du Brésil (Égypte, Algérie, Sénégal, Brésil).
S'appuie sur lib.Mesh (inchangé). Repère glTF : Y vers le haut, avant = +Z. Toutes les faces sont orientées par un point de référence intérieur."""
import math
from lib import Mesh, add, sub, mul, cross, norm, lerp, centroid, length, dot


# ---------- transformations ----------
def recenter(m):
    """Centre le monument en x et z (boîte englobante) et pose son point le plus bas à y = 0."""
    pts = [p for f, _ in m.faces for p in f]
    mnx = min(p[0] for p in pts); mxx = max(p[0] for p in pts)
    mnz = min(p[2] for p in pts); mxz = max(p[2] for p in pts)
    mny = min(p[1] for p in pts)
    dx, dy, dz = -(mnx+mxx)/2, -mny, -(mnz+mxz)/2
    m.faces[:] = [([(p[0]+dx, p[1]+dy, p[2]+dz) for p in pts_], col) for pts_, col in m.faces]


def rnd(seed):
    """Petit générateur pseudo-aléatoire déterministe (liste infinie de réels dans [0,1[)."""
    s = seed * 2654435761 % 4294967296
    while True:
        s = (s * 1664525 + 1013904223) % 4294967296
        yield s / 4294967296


# ---------- anneaux, solides simples ----------
def circle(cx, cz, y, r, n, rot=0.0, rz=None):
    rz = r if rz is None else rz
    return [(cx+r*math.cos(rot+2*math.pi*i/n), y, cz+rz*math.sin(rot+2*math.pi*i/n)) for i in range(n)]


def cyl(m, cx, cz, y0, y1, r0, col, r1=None, n=10, col_top=None, rot=0.0, bot=False, top=True, rz=1.0):
    """Cylindre ou tronc de cône (r1=0 : cône)."""
    r1 = r0 if r1 is None else r1
    ra = circle(cx, cz, y0, r0, n, rot, r0*rz)
    rb = circle(cx, cz, y1, r1, n, rot, r1*rz)
    m.band(ra, rb, col, (cx, (y0+y1)/2, cz))
    if top and r1 > 1e-6:
        m.poly(rb, col_top or col, (cx, y0, cz))
    if bot:
        m.poly(ra, col, (cx, y1, cz))


def prism(m, poly, y0, y1, col, col_top=None, bot=False):
    """Prisme droit sur un polygone convexe (liste de (x, z))."""
    cx = sum(p[0] for p in poly)/len(poly); cz = sum(p[1] for p in poly)/len(poly)
    ra = [(x, y0, z) for x, z in poly]; rb = [(x, y1, z) for x, z in poly]
    m.band(ra, rb, col, (cx, (y0+y1)/2, cz))
    m.poly(rb, col_top or col, (cx, y0, cz))
    if bot:
        m.poly(ra, col, (cx, y1, cz))


def rbox(m, cx, cz, hw, hd, y0, y1, rot, col, col_top=None, bot=False):
    """Boîte tournée de rot radians autour de l'axe vertical."""
    c, s = math.cos(rot), math.sin(rot)
    pts = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)]
    prism(m, [(cx+x*c-z*s, cz+x*s+z*c) for x, z in pts], y0, y1, col, col_top, bot)


def tbox(m, cx, cz, y0, y1, hw0, hd0, hw1, hd1, col, col_top=None, bot=False):
    """Tronc de pyramide à base rectangulaire (demi-largeurs en entrée)."""
    ra = [(cx-hw0, y0, cz-hd0), (cx+hw0, y0, cz-hd0), (cx+hw0, y0, cz+hd0), (cx-hw0, y0, cz+hd0)]
    rb = [(cx-hw1, y1, cz-hd1), (cx+hw1, y1, cz-hd1), (cx+hw1, y1, cz+hd1), (cx-hw1, y1, cz+hd1)]
    m.band(ra, rb, col, (cx, (y0+y1)/2, cz))
    if hw1 > 1e-6:
        m.poly(rb, col_top or col, (cx, y0, cz))
    if bot:
        m.poly(ra, col, (cx, y1, cz))


def sbox(m, x0, x1, y0, y1, z0, z1, col, col_top=None):
    """Boîte sans dessous, dessus d'une autre couleur."""
    m.box(x0, x1, y0, y1, z0, z1, col, skip=('bot', 'top'))
    m.poly([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], col_top or col, ((x0+x1)/2, y0, (z0+z1)/2))


def pyr(m, cx, cz, hw, hd, y0, h, cols, base=False):
    """Pyramide à base rectangulaire. cols : une couleur, ou (pz, px, nz, nx)."""
    if isinstance(cols, str):
        cols = (cols,)*4
    c1, c2, c3, c4 = (cx-hw, y0, cz-hd), (cx+hw, y0, cz-hd), (cx+hw, y0, cz+hd), (cx-hw, y0, cz+hd)
    ap = (cx, y0+h, cz)
    ref = (cx, y0+h*0.25, cz)
    m.poly([c3, c4, ap], cols[0], ref)
    m.poly([c2, c3, ap], cols[1], ref)
    m.poly([c1, c2, ap], cols[2], ref)
    m.poly([c4, c1, ap], cols[3], ref)
    if base:
        m.poly([c1, c2, c3, c4], cols[0], ap)


def gable(m, x0, x1, z0, z1, y0, h, col, end_col=None, ridge='x'):
    """Toit à deux pentes. ridge='x' : faîtage le long de x."""
    xc, zc = (x0+x1)/2, (z0+z1)/2
    ec = end_col or col
    if ridge == 'x':
        ref = (xc, y0+h*0.3, zc)
        m.poly([(x0, y0, z1), (x1, y0, z1), (x1, y0+h, zc), (x0, y0+h, zc)], col, ref)
        m.poly([(x0, y0, z0), (x1, y0, z0), (x1, y0+h, zc), (x0, y0+h, zc)], col, ref)
        m.poly([(x0, y0, z0), (x0, y0, z1), (x0, y0+h, zc)], ec, ref)
        m.poly([(x1, y0, z0), (x1, y0, z1), (x1, y0+h, zc)], ec, ref)
    else:
        ref = (xc, y0+h*0.3, zc)
        m.poly([(x1, y0, z0), (x1, y0, z1), (xc, y0+h, z1), (xc, y0+h, z0)], col, ref)
        m.poly([(x0, y0, z0), (x0, y0, z1), (xc, y0+h, z1), (xc, y0+h, z0)], col, ref)
        m.poly([(x0, y0, z0), (x1, y0, z0), (xc, y0+h, z0)], ec, ref)
        m.poly([(x0, y0, z1), (x1, y0, z1), (xc, y0+h, z1)], ec, ref)


def dome(m, cx, cz, y0, r, col, n=10, ry=None, lats=(0, 28, 52, 74, 90), colfn=None, rot=0.0):
    """Demi-sphère. colfn(k, i) -> couleur de la face i de l'étage k (sinon col)."""
    ry = r if ry is None else ry
    rings = [circle(cx, cz, y0+ry*math.sin(math.radians(a)), r*math.cos(math.radians(a)), n, rot) for a in lats]
    ref = (cx, y0, cz)
    for k in range(len(rings)-1):
        for i in range(n):
            j = (i+1) % n
            c = colfn(k, i) if colfn else col
            m.poly([rings[k][i], rings[k][j], rings[k+1][j], rings[k+1][i]], c, ref)


def ball(m, cx, cy, cz, r, col, n=8):
    blob(m, cx, cy, cz, r, r, r, col, n)


def blob(m, cx, cy, cz, rx, ry, rz, col, n=7, lats=(-60, -20, 20, 60), rot=0.0, col2=None):
    """Ellipsoïde bas polygone (feuillage, boules). col2 : couleur des faces du haut."""
    rings = []
    for la in lats:
        a = math.radians(la)
        rr = math.cos(a)
        rings.append([(cx+rx*rr*math.cos(rot+2*math.pi*i/n), cy+ry*math.sin(a), cz+rz*rr*math.sin(rot+2*math.pi*i/n)) for i in range(n)])
    ref = (cx, cy, cz)
    for k in range(len(rings)-1):
        up = col2 and k >= len(rings)//2
        m.band(rings[k], rings[k+1], col2 if up else col, ref)
    m.poly(rings[0], col, ref)
    m.poly(rings[-1], col2 or col, ref)


def lathe(m, cx, cz, profile, n, colfn, rot=0.0, cap=None):
    """Solide de révolution. profile : liste de (rayon, y) de bas en haut. colfn(k, i) -> couleur."""
    rings = [circle(cx, cz, y, r, n, rot) for r, y in profile]
    ymid = sum(y for _, y in profile)/len(profile)
    for k in range(len(rings)-1):
        for i in range(n):
            j = (i+1) % n
            m.poly([rings[k][i], rings[k][j], rings[k+1][j], rings[k+1][i]], colfn(k, i), (cx, ymid, cz))
    if cap:
        m.poly(rings[-1], cap, (cx, profile[0][1], cz))


# ---------- tiges, câbles ----------
def rod(m, a, b, w, col, w1=None, sides=4, up=(0, 1, 0)):
    m.beam(a, b, w, col, w1=w1, up=up, caps=True, sides=sides)


def sag(a, b, drop, n):
    """n+1 points d'une chaînette (parabole) entre a et b."""
    pts = []
    for i in range(n+1):
        t = i/n
        p = lerp(a, b, t)
        pts.append((p[0], p[1]-drop*4*t*(1-t), p[2]))
    return pts


def cable(m, pts, w, col, sides=3):
    for i in range(len(pts)-1):
        m.beam(pts[i], pts[i+1], w, col, sides=sides, caps=False)


# ---------- décalques (quads plaqués sur une face) ----------
def decal(m, face, a0, a1, y0, y1, pos, col):
    """face : pz/nz (a = x, pos = z) ou px/nx (a = z, pos = x)."""
    if face in ('pz', 'nz'):
        pts = [(a0, y0, pos), (a1, y0, pos), (a1, y1, pos), (a0, y1, pos)]
        ref = ((a0+a1)/2, (y0+y1)/2, pos + (-1 if face == 'pz' else 1))
    else:
        pts = [(pos, y0, a0), (pos, y0, a1), (pos, y1, a1), (pos, y1, a0)]
        ref = (pos + (-1 if face == 'px' else 1), (y0+y1)/2, (a0+a1)/2)
    m.poly(pts, col, ref)


# ---------- palmier ----------
def palm(m, x, z, h, trunk, leaf, leaf2=None, y0=0.0, lean=0.0, fronds=6, flen=0.25, tw=0.04):
    top = (x+lean, y0+h, z)
    m.beam((x, y0, z), top, tw, trunk, w1=tw*0.7, sides=3, up=(0, 0, 1), caps=True)
    for i in range(fronds):
        a = 2*math.pi*i/fronds+0.3
        dx, dz = math.cos(a), math.sin(a)
        px, pz = -dz, dx
        w = flen*0.2
        mid = (top[0]+dx*flen*0.55, top[1]+flen*0.25, top[2]+dz*flen*0.55)
        tip = (top[0]+dx*flen, top[1]-flen*0.25, top[2]+dz*flen)
        col = leaf if (leaf2 is None or i % 2 == 0) else leaf2
        m.poly([top, (mid[0]+px*w, mid[1], mid[2]+pz*w), tip, (mid[0]-px*w, mid[1], mid[2]-pz*w)], col, (top[0], top[1]-0.5, top[2]))


def tree(m, x, z, y0, h, trunk, leaf, leaf2=None, r=0.14):
    """Arbre simple : tronc court et houppier en ellipsoïde."""
    m.beam((x, y0, z), (x, y0+h*0.5, z), 0.05, trunk, w1=0.04, sides=3, up=(0, 0, 1), caps=True)
    blob(m, x, y0+h*0.72, z, r, h*0.32, r, leaf, n=6, lats=(-55, 0, 55), col2=leaf2)
