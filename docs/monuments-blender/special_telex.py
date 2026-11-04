"""Télex : un télescripteur trapu, bleu, clavier à gauche, et un long ruban de dépêche qui sort de la bobine, passe en arche et retombe en S jusqu'au sol (lignes de texte, première ligne rouge)."""
import math
from lib import Mesh
from lib_special import *

PAL = {'blue': '#3A6DA8', 'blue2': '#2A4F80', 'blue3': '#4F85C2', 'dark': '#262A33', 'key': '#F1EBD8', 'keyf': '#2F3138',
       'paper': '#FBF7EA', 'ink': '#2E3640', 'red': '#D23B32', 'amber': '#EDAA2C', 'green': '#4FA05A', 'brass': '#C79A3E',
       'roll': '#E6DDC0'}

MX0, MX1 = -0.9, 0.9      # largeur de la machine
MZ0, MZ1 = -0.5, 0.2      # profondeur de la machine
RX0, RX1 = 0.3, 0.8
SCALE = 0.9     # largeur du ruban


def spline(pts, per=3):
    """Catmull-Rom sur des points (z, y), per points par tronçon."""
    P = [pts[0]]+pts+[pts[-1]]
    out = []
    for i in range(1, len(P)-2):
        p0, p1, p2, p3 = P[i-1], P[i], P[i+1], P[i+2]
        for s in range(per):
            t = s/per
            out.append(tuple(0.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t**3) for k in range(2)))
    out.append(pts[-1])
    return out


def build():
    m = Mesh(PAL)
    # ---------- caisson ----------
    m.box(MX0, MX1, 0, 0.5, MZ0, MZ1, 'blue', skip=('bot', 'top'))
    m.box(MX0-0.04, MX1+0.04, 0.5, 0.58, MZ0-0.04, MZ1+0.04, 'blue2', skip=('bot',))
    for (x0, x1) in ((-0.8, -0.05), (0.05, 0.8)):
        quad_xy(m, x0, x1, 0.08, 0.42, MZ1+0.003, 'blue3')
        xm = (x0+x1)/2
        quad_xy(m, xm-0.1, xm+0.1, 0.27, 0.32, MZ1+0.007, 'brass')
    # ---------- clavier à gauche : pente avec grosses touches ----------
    kx0, kx1 = -0.82, -0.06
    ya, yb, za, zb = 0.58, 0.8, MZ1, MZ0+0.2
    slope = lambda z: ya+(za-z)/(za-zb)*(yb-ya)
    m.poly([(kx0, ya, za), (kx1, ya, za), (kx1, yb, zb), (kx0, yb, zb)], 'dark', (0, 0, 0.0))
    m.box(kx0, kx1, yb-0.002, yb+0.4, MZ0, zb, 'blue2', skip=('bot',))
    for z in (0.1, -0.06, -0.22):
        y = slope(z)
        for i in range(6):
            xa = kx0+0.06+i*0.12; xb = xa+0.1
            m.poly([(xa, y+0.04, z-0.04), (xb, y+0.04, z-0.04), (xb, y+0.04, z+0.04), (xa, y+0.04, z+0.04)], 'key', (xa, y-1, z))
            m.poly([(xa, y, z+0.04), (xb, y, z+0.04), (xb, y+0.04, z+0.04), (xa, y+0.04, z+0.04)], 'keyf', (xa, y, z-1))
    for k, c in enumerate(('red', 'amber', 'green')):
        xc = kx0+0.2+k*0.2
        quad_xy(m, xc-0.06, xc+0.06, yb+0.14, yb+0.26, zb+0.003, c)
    # ---------- bobine de papier, à droite ----------
    RY, RZ = 0.9, MZ0+0.3
    m.box(RX0-0.1, RX0-0.02, 0.58, RY-0.05, RZ-0.2, RZ+0.2, 'blue2', skip=('bot',))
    m.box(RX1+0.02, RX1+0.1, 0.58, RY-0.05, RZ-0.2, RZ+0.2, 'blue2', skip=('bot',))
    tube(m, (RX0-0.02, RY, RZ), (RX1+0.02, RY, RZ), 0.22, 0.22, 10, 'roll', (False, False))
    tube(m, (RX0-0.06, RY, RZ), (RX0-0.02, RY, RZ), 0.25, 0.25, 10, 'red', (True, True))
    tube(m, (RX1+0.02, RY, RZ), (RX1+0.06, RY, RZ), 0.25, 0.25, 10, 'red', (True, True))
    # ---------- ruban : arche puis S jusqu'au sol (profil (z, y), largeur en x) ----------
    prof = [(RZ, RY+0.22), (RZ+0.02, 1.2), (0.0, 1.45), (0.35, 1.42), (0.62, 1.1), (0.7, 0.72), (0.74, 0.34), (0.9, 0.06), (1.12, 0.03)]
    pts = spline(prof, 3)
    n = len(pts)
    for k in range(n-1):
        (za_, ya_), (zb_, yb_) = pts[k], pts[k+1]
        q = [(RX0, ya_, za_), (RX1, ya_, za_), (RX1, yb_, zb_), (RX0, yb_, zb_)]
        cen = ((RX0+RX1)/2, (ya_+yb_)/2, (za_+zb_)/2)
        flat2(m, q, 'paper', (cen[0], cen[1]+4, cen[2]+4))
        dz, dy = zb_-za_, yb_-ya_
        L = math.hypot(dz, dy)
        if L < 1e-6 or k < 2 or k == n-2:
            continue
        nz, ny = -dy/L, dz/L
        if ny+nz < 0:
            nz, ny = -nz, -ny
        tcol = 'red' if k == 3 else 'ink'
        x1 = RX1-0.07-(0.14 if k % 3 == 0 else 0.0)
        cz, cy = cen[2]+nz*0.006, cen[1]+ny*0.006
        hz, hy = dz/L*0.035, dy/L*0.035
        quad = [(RX0+0.07, cy-hy, cz-hz), (x1, cy-hy, cz-hz), (x1, cy+hy, cz+hz), (RX0+0.07, cy+hy, cz+hz)]
        m.poly(quad, tcol, (cen[0], cy-ny, cz-nz))
    return m
