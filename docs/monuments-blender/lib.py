"""Petite bibliothèque de géométrie pour les monuments d'Escales.
Repère de travail = repère glTF : Y vers le haut, avant = +Z. Les faces sont orientées vers l'extérieur grâce à un point de référence."""
import math

def sub(a, b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def add(a, b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
def mul(a, k): return (a[0]*k, a[1]*k, a[2]*k)
def dot(a, b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def length(a): return math.sqrt(dot(a, a))
def norm(a):
    l = length(a)
    return (a[0]/l, a[1]/l, a[2]/l) if l > 1e-12 else (0, 1, 0)
def lerp(a, b, t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t)
def centroid(pts):
    n = len(pts)
    return (sum(p[0] for p in pts)/n, sum(p[1] for p in pts)/n, sum(p[2] for p in pts)/n)

def newell(pts):
    nx = ny = nz = 0.0
    for i in range(len(pts)):
        a, b = pts[i], pts[(i+1) % len(pts)]
        nx += (a[1]-b[1])*(a[2]+b[2])
        ny += (a[2]-b[2])*(a[0]+b[0])
        nz += (a[0]-b[0])*(a[1]+b[1])
    return (nx, ny, nz)

def hex_lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(x/12.92 if x <= 0.04045 else ((x+0.055)/1.055)**2.4 for x in c)

class Mesh:
    def __init__(self, palette):
        self.faces = []
        self.palette = palette  # nom -> '#rrggbb'

    def poly(self, pts, col, ref=None):
        pts = [tuple(p) for p in pts]
        n = newell(pts)
        if length(n) < 1e-10:
            return
        if ref is not None and dot(n, sub(centroid(pts), ref)) < 0:
            pts = pts[::-1]
        self.faces.append((pts, col))

    def quad(self, a, b, c, d, col, ref=None):
        self.poly([a, b, c, d], col, ref)

    # ---------- solides ----------
    def box(self, x0, x1, y0, y1, z0, z1, col, skip=()):
        c = ((x0+x1)/2, (y0+y1)/2, (z0+z1)/2)
        P = lambda x, y, z: (x, y, z)
        f = {
            'bot': [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)],
            'top': [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)],
            'nz': [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)],
            'pz': [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)],
            'nx': [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)],
            'px': [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)],
        }
        for k, pts in f.items():
            if k not in skip:
                self.poly(pts, col, c)

    def band(self, ra, rb, col, ref=None, closed=True):
        """Faces entre deux anneaux de même nombre de points."""
        n = len(ra)
        rng = range(n) if closed else range(n-1)
        if ref is None:
            ref = centroid(list(ra)+list(rb))
        for i in rng:
            j = (i+1) % n
            self.poly([ra[i], ra[j], rb[j], rb[i]], col, ref)

    def cap(self, ring, col, ref):
        self.poly(ring, col, ref)

    def loft(self, rings, col, closed=True, caps=(False, False), ref_fn=None):
        for k in range(len(rings)-1):
            ref = ref_fn(k) if ref_fn else centroid(list(rings[k])+list(rings[k+1]))
            self.band(rings[k], rings[k+1], col, ref, closed)
        if caps[0]:
            self.poly(rings[0], col, centroid(rings[1]))
        if caps[1]:
            self.poly(rings[-1], col, centroid(rings[-2]))

    def beam(self, a, b, w, col, w1=None, up=(0, 1, 0), caps=False, sides=4):
        w1 = w if w1 is None else w1
        d = norm(sub(b, a))
        u = cross(d, up)
        if length(u) < 1e-6:
            u = cross(d, (1, 0, 0))
        u = norm(u)
        v = cross(d, u)
        if sides == 4:
            offs = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
            k = 0.5
        else:
            offs = [(math.cos(math.radians(90+120*i)), math.sin(math.radians(90+120*i))) for i in range(3)]
            k = 0.5
        ring = lambda p, ww: [add(p, add(mul(u, o[0]*ww*k), mul(v, o[1]*ww*k))) for o in offs]
        ra, rb = ring(a, w), ring(b, w1)
        mid = lerp(a, b, 0.5)
        self.band(ra, rb, col, mid)
        if caps:
            self.poly(ra, col, mid)
            self.poly(rb, col, mid)

    def tri_count(self):
        return sum(len(p)-2 for p, _ in self.faces)

    # ---------- export : soudure des sommets (position + couleur) ----------
    def welded(self, nd=5):
        vid, verts, cols, tris = {}, [], [], []
        for pts, col in self.faces:
            idx = []
            for p in pts:
                key = (round(p[0], nd), round(max(p[1], 0.0), nd), round(p[2], nd), col)
                if key not in vid:
                    vid[key] = len(verts)
                    verts.append(key[:3])
                    cols.append(hex_lin(self.palette[col]))
                idx.append(vid[key])
            for i in range(1, len(idx)-1):
                t = (idx[0], idx[i], idx[i+1])
                if len(set(t)) == 3:
                    tris.append(t)
        return verts, cols, tris

def square_ring(c, s):
    h = s/2
    return [(c[0]-h, c[1], c[2]-h), (c[0]+h, c[1], c[2]-h), (c[0]+h, c[1], c[2]+h), (c[0]-h, c[1], c[2]+h)]
