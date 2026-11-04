"""Extension de lib.py pour les monuments France / États-Unis d'Escales.
XM : maillage avec repère local (rotation autour de Y + translation) ; lathe, prismes, cônes, dômes, façades à bandes, arches."""
import math
from contextlib import contextmanager
from lib import Mesh, lerp, centroid

TAU = 2*math.pi

class XM(Mesh):
    def __init__(self, palette):
        super().__init__(palette)
        self.tf = None
    def _t(self, p):
        if self.tf is None:
            return tuple(p)
        c, s, ox, oy, oz = self.tf
        return (c*p[0]+s*p[2]+ox, p[1]+oy, -s*p[0]+c*p[2]+oz)
    def poly(self, pts, col, ref=None):
        super().poly([self._t(p) for p in pts], col, None if ref is None else self._t(ref))
    @contextmanager
    def frame(self, rot=0.0, ox=0.0, oy=0.0, oz=0.0):
        old = self.tf
        r = math.radians(rot)
        self.tf = (math.cos(r), math.sin(r), ox, oy, oz)
        try:
            yield
        finally:
            self.tf = old

def ring(cx, cz, rx, rz, y, n, rot=0.0):
    """Anneau à n points ; le point 0 est vers +Z, rot en radians."""
    return [(cx+rx*math.sin(rot+TAU*i/n), y, cz+rz*math.cos(rot+TAU*i/n)) for i in range(n)]

def lathe(m, cx, cz, prof, n, col, rot=0.0, zr=1.0, deg=0.0):
    """Solide de révolution. prof = [(r, y[, couleur]), ...] de bas en haut ; r = 0 permet une pointe.
    La couleur d'un segment est celle de son point haut. Un 4e élément True au point haut retourne le segment (face vers l'axe).
    deg = rotation de l'anneau en degrés."""
    rot += math.radians(deg)
    for k in range(len(prof)-1):
        a, b = prof[k], prof[k+1]
        c = b[2] if len(b) > 2 else col
        ra = ring(cx, cz, a[0], a[0]*zr, a[1], n, rot)
        rb = ring(cx, cz, b[0], b[0]*zr, b[1], n, rot)
        if len(b) > 3 and b[3]:
            for i in range(n):
                q = [ra[i], ra[(i+1) % n], rb[(i+1) % n], rb[i]]
                cxq = sum(p[0] for p in q)/4-cx; czq = sum(p[2] for p in q)/4-cz
                l = math.hypot(cxq, czq) or 1.0
                m.poly(q, c, (cx+cxq/l*10, (a[1]+b[1])/2, cz+czq/l*10))
            continue
        if abs(a[1]-b[1]) < 1e-9:
            if abs(a[0]-b[0]) < 1e-9:
                continue
            ref = (cx, a[1]-10, cz) if b[0] < a[0] else (cx, a[1]+10, cz)   # marche : dessus si on rentre, dessous si on sort
        else:
            ref = (cx, (a[1]+b[1])/2, cz)
        m.band(ra, rb, c, ref)

def prism(m, cx, cz, rx, rz, y0, y1, n, col, rot=0.0, k=1.0, top=True, deg=0.0):
    rot += math.radians(deg)
    r0 = ring(cx, cz, rx, rz, y0, n, rot)
    r1 = ring(cx, cz, rx*k, rz*k, y1, n, rot)
    ref = (cx, (y0+y1)/2, cz)
    m.band(r0, r1, col, ref)
    if top and k > 0:
        m.poly(r1, col, (cx, y0-1, cz))

def cone(m, cx, cz, rx, rz, y0, y1, n, col, deg=0.0):
    r0 = ring(cx, cz, rx, rz, y0, n, math.radians(deg))
    a = (cx, y1, cz)
    ref = (cx, (y0+y1)/2, cz)
    for i in range(n):
        m.poly([r0[i], r0[(i+1) % n], a], col, ref)

def dome(m, cx, cz, rx, rz, y0, h, n, k, col, deg=0.0):
    rings = [ring(cx, cz, rx*math.cos(math.pi/2*j/k), rz*math.cos(math.pi/2*j/k), y0+h*math.sin(math.pi/2*j/k), n, math.radians(deg)) for j in range(k)]
    ref = (cx, y0, cz)
    for j in range(k-1):
        m.band(rings[j], rings[j+1], col, ref)
    top = (cx, y0+h, cz)
    for i in range(n):
        m.poly([rings[-1][i], rings[-1][(i+1) % n], top], col, ref)

def frustum(m, b, t, y0, y1, col, top=True, bottom=False):
    """Tronc de pyramide rectangulaire. b, t = (x0, x1, z0, z1) en bas et en haut."""
    def rr(r, y): return [(r[0], y, r[2]), (r[1], y, r[2]), (r[1], y, r[3]), (r[0], y, r[3])]
    rb, rt = rr(b, y0), rr(t, y1)
    cx, cz = (b[0]+b[1])/2, (b[2]+b[3])/2
    m.band(rb, rt, col, (cx, (y0+y1)/2, cz))
    if top:
        m.poly(rt, col, (cx, y0-1, cz))
    if bottom:
        m.poly(rb, col, (cx, y1+1, cz))

def extrude(m, outline, y0, y1, col, top=True):
    """Prisme droit sur un contour convexe [(x, z), ...]."""
    r0 = [(x, y0, z) for x, z in outline]
    r1 = [(x, y1, z) for x, z in outline]
    cx = sum(p[0] for p in outline)/len(outline); cz = sum(p[1] for p in outline)/len(outline)
    m.band(r0, r1, col, (cx, (y0+y1)/2, cz))
    if top:
        m.poly(r1, col, (cx, y0-1, cz))

def gable(m, x0, x1, z0, z1, y0, h, col, end_col=None, axis='z', over=0.0):
    """Toit à deux pans. axis = sens du faîtage."""
    ec = end_col or col
    if axis == 'z':
        xm = (x0+x1)/2
        a = (x0-over, y0, z0), (x1+over, y0, z0), (x1+over, y0, z1), (x0-over, y0, z1)
        r = (xm, y0+h, z0), (xm, y0+h, z1)
        c = (xm, y0, (z0+z1)/2)
        m.poly([a[0], a[3], r[1], r[0]], col, (xm, y0-1, c[2]))
        m.poly([a[1], a[2], r[1], r[0]], col, (xm, y0-1, c[2]))
        m.poly([a[0], a[1], r[0]], ec, (xm, y0, z1))
        m.poly([a[3], a[2], r[1]], ec, (xm, y0, z0))
    else:
        zm = (z0+z1)/2
        a = (x0, y0, z0-over), (x1, y0, z0-over), (x1, y0, z1+over), (x0, y0, z1+over)
        r = (x0, y0+h, zm), (x1, y0+h, zm)
        m.poly([a[0], a[1], r[1], r[0]], col, ((x0+x1)/2, y0-1, zm))
        m.poly([a[3], a[2], r[1], r[0]], col, ((x0+x1)/2, y0-1, zm))
        m.poly([a[0], a[3], r[0]], ec, ((x0+x1)/2, y0, zm))
        m.poly([a[1], a[2], r[1]], ec, ((x0+x1)/2, y0, zm))

def pattern(n, pf, cp, cw):
    """n fenêtres séparées par des trumeaux : liste (fraction, couleur) sommant 1."""
    cell = 1.0/n
    pw = pf*cell
    ww = cell-pw
    out = [(pw/2, cp)]
    for k in range(n):
        out.append((ww, cw))
        out.append((pw if k < n-1 else pw/2, cp))
    return out

def strips(m, A, B, y0, y1, fc, ref):
    """Rectangle A->B (points xz) x [y0, y1] découpé en bandes verticales fc = [(fraction, couleur)]."""
    t = 0.0
    for f, c in fc:
        a = (A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t)
        b = (A[0]+(B[0]-A[0])*(t+f), A[1]+(B[1]-A[1])*(t+f))
        m.poly([(a[0], y0, a[1]), (b[0], y0, b[1]), (b[0], y1, b[1]), (a[0], y1, a[1])], c, ref)
        t += f

def hbands(m, A, B, y0, y1, cols, ref):
    """Rectangle découpé en bandes horizontales de couleurs alternées (cols = liste de couleurs, de bas en haut)."""
    n = len(cols)
    for k, c in enumerate(cols):
        ya = y0+(y1-y0)*k/n; yb = y0+(y1-y0)*(k+1)/n
        m.poly([(A[0], ya, A[1]), (B[0], ya, B[1]), (B[0], yb, B[1]), (A[0], yb, A[1])], c, ref)

def tower(m, cx, cz, w, d, y0, y1, front, side, top_col=None, bands=None, skip=()):
    """Tour rectangulaire à bandes verticales : front/side = motifs (liste fraction, couleur) pour les faces ±z / ±x.
    bands = couleurs horizontales (à la place des motifs)."""
    x0, x1, z0, z1 = cx-w/2, cx+w/2, cz-d/2, cz+d/2
    ref = (cx, (y0+y1)/2, cz)
    faces = [((x0, z1), (x1, z1), front), ((x1, z1), (x1, z0), side), ((x1, z0), (x0, z0), front), ((x0, z0), (x0, z1), side)]
    for fi, (A, B, pat) in enumerate(faces):
        if fi in skip:
            continue
        if bands:
            hbands(m, A, B, y0, y1, bands, ref)
        else:
            strips(m, A, B, y0, y1, pat, ref)
    if top_col:
        m.poly([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], top_col, (cx, y0-1, cz))

def arch_pts(xa, xb, ytop):
    """4 points d'un arc en plein cintre approché (de gauche à droite) entre xa et xb, sommet à ytop."""
    hw = (xb-xa)/2
    ysp = ytop-hw
    xc = (xa+xb)/2
    return [(xc+math.cos(math.pi*(1-k/3))*hw, ysp+math.sin(math.pi*(1-k/3))*hw) for k in range(4)]

def arch_bay(m, xa, xb, y0, y1, zf, depth, col, rec, S0=0.2, S1=0.8, gap=0.03, reveal=True, ytop=None):
    """Baie à arc dans une façade (repère local : façade dans le plan z = zf, dehors = +z).
    [xa, xb] = travée entière, l'ouverture va de S0 à S1 ; le mur monte jusqu'à y1."""
    w = xb-xa
    oa, ob = xa+S0*w, xa+S1*w
    yt = (y1-gap) if ytop is None else ytop
    ap = arch_pts(oa, ob, yt)
    c = ((xa+xb)/2, (y0+y1)/2, zf-1)
    zb = zf-depth
    m.poly([(xa, y0, zf), (oa, y0, zf), (oa, y1, zf), (xa, y1, zf)], col, c)
    m.poly([(ob, y0, zf), (xb, y0, zf), (xb, y1, zf), (ob, y1, zf)], col, c)
    for k in range(3):
        (xs, ys), (xe, ye) = ap[k], ap[k+1]
        m.poly([(xs, ys, zf), (xe, ye, zf), (xe, y1, zf), (xs, y1, zf)], col, c)
    plate = [(oa, y0, zb), (ob, y0, zb)] + [(x, y, zb) for x, y in reversed(ap)]
    m.poly(plate, rec, c)
    if reveal:
        ysp = ap[0][1]
        ym = (y0+ysp)/2
        m.poly([(oa, y0, zf), (oa, ysp, zf), (oa, ysp, zb), (oa, y0, zb)], col, (oa-1, ym, zf))   # normales vers l'ouverture
        m.poly([(ob, y0, zf), (ob, ysp, zf), (ob, ysp, zb), (ob, y0, zb)], col, (ob+1, ym, zf))
        for k in range(3):
            (xs, ys), (xe, ye) = ap[k], ap[k+1]
            m.poly([(xs, ys, zf), (xe, ye, zf), (xe, ye, zb), (xs, ys, zb)], col, ((xs+xe)/2, ys+1, zf-depth/2))

def win_bay(m, xa, xb, y0, y1, zf, depth, col, rec, S0=0.25, S1=0.75, G0=0.12, G1=0.12):
    """Baie rectangulaire (fenêtre) dans une façade."""
    w = xb-xa
    oa, ob = xa+S0*w, xa+S1*w
    ya, yb = y0+G0*(y1-y0), y1-G1*(y1-y0)
    c = ((xa+xb)/2, (y0+y1)/2, zf-1)
    zb = zf-depth
    m.poly([(xa, y0, zf), (oa, y0, zf), (oa, y1, zf), (xa, y1, zf)], col, c)
    m.poly([(ob, y0, zf), (xb, y0, zf), (xb, y1, zf), (ob, y1, zf)], col, c)
    m.poly([(oa, y0, zf), (ob, y0, zf), (ob, ya, zf), (oa, ya, zf)], col, c)
    m.poly([(oa, yb, zf), (ob, yb, zf), (ob, y1, zf), (oa, y1, zf)], col, c)
    m.poly([(oa, ya, zb), (ob, ya, zb), (ob, yb, zb), (oa, yb, zb)], rec, c)

def flat_arch(m, xa, xb, y0, ytop, z, col):
    """Ouverture sombre en arc, plaquée sur une façade (repère local, dehors = +z), sans épaisseur."""
    ap = arch_pts(xa, xb, ytop)
    m.poly([(xa, y0, z), (xb, y0, z)] + [(x, y, z) for x, y in reversed(ap)], col, ((xa+xb)/2, y0, z-1))

def flat_rect(m, xa, xb, y0, y1, z, col):
    m.poly([(xa, y0, z), (xb, y0, z), (xb, y1, z), (xa, y1, z)], col, ((xa+xb)/2, y0, z-1))


def around4(m, cx, cz, fn, rots=(0, 90, 180, 270)):
    """Appelle fn() dans un repère local tourné pour chacune des 4 faces (dehors = +z local)."""
    for r in rots:
        with m.frame(r, cx, 0, cz):
            fn()

def rock_hill(m, levels, n=16, zr=0.94, seed=0.0):
    """Colline : levels = [(rayon, y, amplitude de bosses, couleur), ...] de bas en haut ; bords irréguliers, calotte plate."""
    rings = []
    for j, (R, y, amp, col) in enumerate(levels):
        pts = []
        for i in range(n):
            t = TAU*i/n
            r = R*(1+amp*(0.6*math.sin(3*t+1.3*j+seed)+0.4*math.cos(5*t+2*j+seed)))
            pts.append((r*math.sin(t), y, r*zr*math.cos(t)))
        rings.append(pts)
    for j in range(len(rings)-1):
        m.band(rings[j], rings[j+1], levels[j+1][3], None)
    top = rings[-1]
    m.poly(top, levels[-1][3], (0, levels[-1][1]-1, 0))
    return rings
