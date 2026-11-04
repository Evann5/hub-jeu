"""Extension de lib.py pour les monuments du Maroc et du Portugal d'Escales.
Ajoute : triangulation de polygones concaves (murs percés d'arcs), décalques sur les faces d'une boîte,
arcs (plein cintre, brisé, fer à cheval), toits, solides de révolution, prismes, palmiers, pots."""
import math
from lib import Mesh, add, sub, mul, cross, norm, lerp, centroid, length, dot

# ---------- transformations ----------
def xform(m, fn, start=0):
    m.faces[start:] = [([fn(p) for p in pts], col) for pts, col in m.faces[start:]]

def rot_y(deg, cx=0.0, cz=0.0):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    def f(p):
        x, z = p[0]-cx, p[2]-cz
        return (cx + x*c + z*s, p[1], cz - x*s + z*c)
    return f

def rot_z(deg, cx, cy):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    def f(p):
        x, y = p[0]-cx, p[1]-cy
        return (cx + x*c - y*s, cy + x*s + y*c, p[2])
    return f

def move(dx=0.0, dy=0.0, dz=0.0):
    return lambda p: (p[0]+dx, p[1]+dy, p[2]+dz)

def recenter(m):
    pts = [p for f, _ in m.faces for p in f]
    mnx = min(p[0] for p in pts); mxx = max(p[0] for p in pts)
    mnz = min(p[2] for p in pts); mxz = max(p[2] for p in pts)
    mny = min(p[1] for p in pts)
    xform(m, move(-(mnx+mxx)/2, -mny, -(mnz+mxz)/2))

# ---------- triangulation d'un polygone 2D (oreilles) ----------
def _area(p):
    n = len(p)
    return sum(p[i][0]*p[(i+1) % n][1]-p[(i+1) % n][0]*p[i][1] for i in range(n))/2

def ear_clip(pts):
    n = len(pts)
    idx = list(range(n))
    if _area(pts) < 0:
        idx.reverse()
    def cr(a, b, c):
        return (pts[b][0]-pts[a][0])*(pts[c][1]-pts[a][1])-(pts[b][1]-pts[a][1])*(pts[c][0]-pts[a][0])
    tris = []
    guard = 0
    while len(idx) > 3 and guard < 5000:
        guard += 1
        L = len(idx)
        done = False
        for k in range(L):
            a, b, c = idx[k-1], idx[k], idx[(k+1) % L]
            cv = cr(a, b, c)
            if abs(cv) < 1e-11:
                idx.pop(k); done = True; break
            if cv < 0:
                continue
            bad = False
            for p in idx:
                if p in (a, b, c):
                    continue
                if cr(a, b, p) > 1e-11 and cr(b, c, p) > 1e-11 and cr(c, a, p) > 1e-11:
                    bad = True; break
            if bad:
                continue
            tris.append((a, b, c)); idx.pop(k); done = True; break
        if not done:
            tris.append((idx[-1], idx[0], idx[1])); idx.pop(0)
    if len(idx) == 3 and abs(cr(*idx)) > 1e-11:
        tris.append(tuple(idx))
    return tris

def face2d(m, pts2, mp, col, ref):
    """Polygone 2D (u, v) concave ou non, posé par la fonction mp(u, v)->3D."""
    for a, b, c in ear_clip(pts2):
        m.poly([mp(*pts2[a]), mp(*pts2[b]), mp(*pts2[c])], col, ref)

def ring_band(m, mp, A, B, col, ref):
    """Bande entre deux contours 2D de même nombre de points (cadre d'un arc)."""
    for i in range(len(A)-1):
        m.poly([mp(*A[i]), mp(*A[i+1]), mp(*B[i+1]), mp(*B[i])], col, ref)

# ---------- arcs (listes de (u, v)) ----------
def arc(cu, cv, r, a0, a1, n):
    return [(cu+r*math.cos(math.radians(a0+(a1-a0)*i/n)), cv+r*math.sin(math.radians(a0+(a1-a0)*i/n))) for i in range(n+1)]

def round_arch(u, v0, vs, hw, n=6):
    """Porte à plein cintre : pieds en v0, naissance en vs. De gauche à droite."""
    return [(u-hw, v0)] + arc(u, vs, hw, 180, 0, n) + [(u+hw, v0)]

def pointed_arch(u, v0, vs, hw, n=3):
    left = arc(u+hw, vs, 2*hw, 180, 120, n)
    right = arc(u-hw, vs, 2*hw, 60, 0, n)
    return [(u-hw, v0)] + left + right[1:] + [(u+hw, v0)]

def horseshoe(u, v0, vc, R, e=25, n=12):
    """Arc en fer à cheval : centre (u, vc), rayon R, il se referme de e degrés sous l'horizontale."""
    c = math.cos(math.radians(e))
    return [(u-R*c, v0)] + arc(u, vc, R, 180+e, -e, n) + [(u+R*c, v0)]

def rect(u0, u1, v0, v1):
    return [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]

def disc(u, v, r, n=14):
    return [(u+r*math.cos(2*math.pi*i/n), v+r*math.sin(2*math.pi*i/n)) for i in range(n)]

# ---------- boîtes et décalques ----------
class B:
    """Boîte repérée (pour poser des décalques sur ses faces)."""
    def __init__(self, x0, x1, y0, y1, z0, z1):
        self.x0, self.x1, self.y0, self.y1, self.z0, self.z1 = x0, x1, y0, y1, z0, z1
        self.cx, self.cz = (x0+x1)/2, (z0+z1)/2

def box(m, b, col, skip=('bot',)):
    m.box(b.x0, b.x1, b.y0, b.y1, b.z0, b.z1, col, skip)
    return b

def fmap(b, face, o=0.0):
    """(u, v) -> 3D. u = vers la droite quand on regarde la face de l'extérieur, v = hauteur absolue."""
    if face == 'pz': return lambda u, v: (b.cx+u, v, b.z1+o)
    if face == 'nz': return lambda u, v: (b.cx-u, v, b.z0-o)
    if face == 'px': return lambda u, v: (b.x1+o, v, b.cz-u)
    if face == 'nx': return lambda u, v: (b.x0-o, v, b.cz+u)
    raise ValueError(face)

def decal(m, b, face, pts, col, o=0.004):
    mp = fmap(b, face, o)
    face2d(m, pts, mp, col, (b.cx, pts[0][1], b.cz))

def face_width(b, face):
    return (b.x1-b.x0) if face in ('pz', 'nz') else (b.z1-b.z0)

# ---------- toits ----------
def gable(m, x0, x1, z0, z1, y0, hr, col, ridge='x', col_end=None):
    """Toit à deux pans. ridge='x' : faîtage le long de x. Les pignons ont col_end."""
    ce = col_end or col
    ym = y0+hr
    if ridge == 'x':
        zm = (z0+z1)/2
        c = ((x0+x1)/2, y0-1, zm)
        m.poly([(x0, y0, z1), (x1, y0, z1), (x1, ym, zm), (x0, ym, zm)], col, c)
        m.poly([(x0, y0, z0), (x1, y0, z0), (x1, ym, zm), (x0, ym, zm)], col, c)
        m.poly([(x0, y0, z0), (x0, y0, z1), (x0, ym, zm)], ce, c)
        m.poly([(x1, y0, z0), (x1, y0, z1), (x1, ym, zm)], ce, c)
    else:
        xm = (x0+x1)/2
        c = (xm, y0-1, (z0+z1)/2)
        m.poly([(x1, y0, z0), (x1, y0, z1), (xm, ym, z1), (xm, ym, z0)], col, c)
        m.poly([(x0, y0, z0), (x0, y0, z1), (xm, ym, z1), (xm, ym, z0)], col, c)
        m.poly([(x0, y0, z1), (x1, y0, z1), (xm, ym, z1)], ce, c)
        m.poly([(x0, y0, z0), (x1, y0, z0), (xm, ym, z0)], ce, c)

def hip(m, x0, x1, z0, z1, y0, hr, col, inset=0.0):
    """Toit en croupe ; inset > 0 laisse un faîtage (sinon pyramide)."""
    cx, cz = (x0+x1)/2, (z0+z1)/2
    hx = max((x1-x0)/2-inset, 0.0); hz = max((z1-z0)/2-inset, 0.0)
    ym = y0+hr
    base = [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)]
    top = [(cx-hx, ym, cz-hz), (cx+hx, ym, cz-hz), (cx+hx, ym, cz+hz), (cx-hx, ym, cz+hz)]
    c = (cx, y0-1, cz)
    for i in range(4):
        j = (i+1) % 4
        m.poly([base[i], base[j], top[j], top[i]], col, c)
    if hx > 1e-6 and hz > 1e-6:
        m.poly(top, col, c)

def pyramid(m, cx, cz, h, y0, hr, col):
    hip(m, cx-h, cx+h, cz-h, cz+h, y0, hr, col)

# ---------- révolution ----------
def lathe(m, profile, n, cols, cx=0.0, cz=0.0, rot=0.0, cap_top=False, cap_bot=False):
    """profile : [(r, y), ...] de bas en haut. cols : une couleur ou une liste (une par segment)."""
    if isinstance(cols, str):
        cols = [cols]*(len(profile)-1)
    rings = []
    for r, y in profile:
        rings.append([(cx+r*math.sin(rot+2*math.pi*i/n), y, cz+r*math.cos(rot+2*math.pi*i/n)) for i in range(n)])
    for k in range(len(rings)-1):
        ym = (profile[k][1]+profile[k+1][1])/2
        dr = profile[k+1][0]-profile[k][0]
        dy = profile[k+1][1]-profile[k][1]
        if abs(dr) > abs(dy):   # surface plutôt horizontale : dessous si le rayon grandit en montant, dessus sinon
            ref = (cx, ym+1, cz) if dr > 0 else (cx, ym-1, cz)
        else:
            ref = (cx, ym, cz)
        m.band(rings[k], rings[k+1], cols[k], ref)
    if cap_top and profile[-1][0] > 1e-6:
        m.poly(rings[-1], cols[-1], (cx, profile[-1][1]-1, cz))
    if cap_bot and profile[0][0] > 1e-6:
        m.poly(rings[0], cols[0], (cx, profile[0][1]+1, cz))

def ball(m, cx, cy, cz, r, col, n=6):
    prof = [(0, cy-r), (r*0.8, cy-r*0.6), (r, cy), (r*0.8, cy+r*0.6), (0, cy+r)]
    lathe(m, prof, n, col, cx, cz)

# ---------- prisme à base polygonale (x, z) ----------
def prism_xz(m, poly, y0, y1, col_side, col_top, bottom=False):
    n = len(poly)
    cx = sum(p[0] for p in poly)/n; cz = sum(p[1] for p in poly)/n
    c = (cx, (y0+y1)/2, cz)
    for i in range(n):
        a, b = poly[i], poly[(i+1) % n]
        m.poly([(a[0], y0, a[1]), (b[0], y0, b[1]), (b[0], y1, b[1]), (a[0], y1, a[1])], col_side, c)
    face2d(m, poly, lambda u, v: (u, y1, v), col_top, (cx, y1-1, cz))
    if bottom:
        face2d(m, poly, lambda u, v: (u, y0, v), col_top, (cx, y0+1, cz))

# ---------- petits objets ----------
def pot(m, x, y, z, s, col_pot, col_plant, col_flower=None):
    """Pot à fleurs tronconique + touffe."""
    h = s*0.8
    ra = [(x+dx*s*0.4, y, z+dz*s*0.4) for dx, dz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    rb = [(x+dx*s*0.62, y+h, z+dz*s*0.62) for dx, dz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    m.band(ra, rb, col_pot, (x, y+h/2, z))
    m.poly(rb, col_pot, (x, y, z))
    top = [(x-s*0.5, y+h, z-s*0.5), (x+s*0.5, y+h, z-s*0.5), (x+s*0.5, y+h, z+s*0.5), (x-s*0.5, y+h, z+s*0.5)]
    pyr_h = s*0.55
    ap = (x, y+h+pyr_h, z)
    for i in range(4):
        j = (i+1) % 4
        m.poly([top[i], top[j], ap], col_plant if (col_flower is None or i % 2 == 0) else col_flower, (x, y+h-1, z))

def palm(m, x, z, h, lean, trunk, leaf, leaf2=None, y0=0.0, fronds=7, flen=0.3):
    """Palmier : tronc hexagonal penché (lean = décalage en x au sommet) et palmes en lames arquées."""
    top = (x+lean, y0+h, z)
    m.beam((x, y0, z), top, 0.045, trunk, w1=0.03, sides=3, up=(0, 0, 1))
    for i in range(fronds):
        a = 2*math.pi*i/fronds+0.3
        dx, dz = math.cos(a), math.sin(a)
        px, pz = -dz, dx
        w = 0.055
        r0 = top
        mid = (top[0]+dx*flen*0.55, top[1]+0.07, top[2]+dz*flen*0.55)
        tip = (top[0]+dx*flen, top[1]-0.06, top[2]+dz*flen)
        col = leaf if (leaf2 is None or i % 2 == 0) else leaf2
        ref = (top[0], top[1]-0.5, top[2])
        m.poly([r0, (mid[0]+px*w, mid[1], mid[2]+pz*w), tip, (mid[0]-px*w, mid[1], mid[2]-pz*w)], col, ref)
