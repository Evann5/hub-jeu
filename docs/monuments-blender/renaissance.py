"""Dakar : la colline des Mamelles, le monument de la Renaissance africaine vu comme une forme abstraite (trois fûts de bronze vert de hauteurs
différentes devant un grand disque de soleil, sur un socle de pierre à baies, grand escalier devant), le phare des Mamelles sur la petite colline
voisine et un baobab. Aucun personnage. Passe 2 (05/11/2026) : sol beige et collines sèches, socle avec fenêtres, phare et baobab de Dakar."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'ground': '#E3D2A8', 'g1': '#B68F58', 'g2': '#C8A56B', 'g3': '#D9BF86', 'scrub': '#8AA05A', 'trunk': '#8A7358', 'trunk2': '#6E5A44', 'dark': '#4A3A32', 'white': '#F4F1EA', 'red': '#C9503A', 'stone': '#D6CDB9', 'stone2': '#B5AB95', 'step': '#EFE6CF',
       'b1': '#3FA68C', 'b2': '#2B7F6C', 'b3': '#6CC7AE', 'sun': '#F6A93A', 'sun2': '#E9792F'}


def lean(m, c0, c1, hw0, hd0, hw1, hd1, col, col_top=None, col_side=None):
    """Lame qui penche : base rectangulaire en c0, sommet rectangulaire en c1 (c = (x, y, z))."""
    ra = [(c0[0]-hw0, c0[1], c0[2]-hd0), (c0[0]+hw0, c0[1], c0[2]-hd0), (c0[0]+hw0, c0[1], c0[2]+hd0), (c0[0]-hw0, c0[1], c0[2]+hd0)]
    rb = [(c1[0]-hw1, c1[1], c1[2]-hd1), (c1[0]+hw1, c1[1], c1[2]-hd1), (c1[0]+hw1, c1[1], c1[2]+hd1), (c1[0]-hw1, c1[1], c1[2]+hd1)]
    ref = centroid(ra+rb)
    cs = (col, col_side or col, col, col_side or col)       # nz, px, pz, nx
    for i in range(4):
        j = (i+1) % 4
        m.poly([ra[i], ra[j], rb[j], rb[i]], cs[i], ref)
    m.poly(rb, col_top or col, centroid(ra))


def disc_xy(m, cx, cy, cz, r, th, col, col2, n=12):
    f = [(cx+r*math.cos(2*math.pi*i/n), cy+r*math.sin(2*math.pi*i/n), cz+th/2) for i in range(n)]
    b = [(p[0], p[1], cz-th/2) for p in f]
    c = (cx, cy, cz)
    for i in range(n):
        j = (i+1) % n
        m.poly([f[i], f[j], b[j], b[i]], col2, c)
    m.poly(f, col, c)
    m.poly(b, col2, c)


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'ground', skip=('bot',))
    CX, CZ = 0.1, -0.12
    # colline principale en gradins secs
    cyl(m, CX, CZ, 0.05, 0.3, 0.76, 'g1', r1=0.66, n=12, col_top='g2')
    cyl(m, CX, CZ, 0.3, 0.6, 0.66, 'g2', r1=0.46, n=12, col_top='g3')
    cyl(m, CX, CZ, 0.6, 0.82, 0.46, 'g1', r1=0.33, n=12, col_top='g2')
    # grand escalier devant
    for k in range(6):
        y = 0.05+0.13*k
        z = CZ+0.86-0.1*k
        m.box(CX-0.11, CX+0.11, y, y+0.05, z-0.05, z+0.02, 'step', skip=('bot',))
    # socle de pierre : deux étages octogonaux, baies sombres sur les quatre faces
    cyl(m, CX, CZ, 0.82, 1.04, 0.33, 'stone', r1=0.29, n=8, col_top='stone2', rot=math.pi/8)
    cyl(m, CX, CZ, 1.04, 1.22, 0.25, 'stone', r1=0.22, n=8, col_top='stone2', rot=math.pi/8)
    for a in range(4):
        ang = a*math.pi/2
        px, pz = math.cos(ang), math.sin(ang)
        tx, tz = -pz, px
        for (ya, yb, rr, ws) in ((0.88, 1.0, 0.315*math.cos(math.pi/8)+0.004, (-0.1, 0.0, 0.1)), (1.07, 1.16, 0.24*math.cos(math.pi/8)+0.004, (-0.06, 0.06))):
            for u in ws:
                pts = [(CX+rr*px+tx*(u-0.032), ya, CZ+rr*pz+tz*(u-0.032)), (CX+rr*px+tx*(u+0.032), ya, CZ+rr*pz+tz*(u+0.032)),
                       (CX+rr*px+tx*(u+0.032), yb-0.02, CZ+rr*pz+tz*(u+0.032)), (CX+rr*px+tx*u, yb+0.01, CZ+rr*pz+tz*u), (CX+rr*px+tx*(u-0.032), yb-0.02, CZ+rr*pz+tz*(u-0.032))]
                m.poly(pts, 'dark', (CX, (ya+yb)/2, CZ))
    # trois fûts de bronze vert, hauteurs inégales, et le disque de soleil derrière le plus haut
    lean(m, (CX, 1.22, CZ), (CX-0.03, 2.3, CZ), 0.16, 0.1, 0.07, 0.06, 'b1', 'b3', 'b2')
    lean(m, (CX+0.21, 1.22, CZ+0.02), (CX+0.36, 1.85, CZ+0.02), 0.085, 0.08, 0.045, 0.045, 'b1', 'b3', 'b2')
    lean(m, (CX-0.2, 1.22, CZ+0.02), (CX-0.33, 1.65, CZ+0.02), 0.075, 0.07, 0.04, 0.04, 'b1', 'b3', 'b2')
    disc_xy(m, CX-0.03, 2.1, CZ-0.14, 0.3, 0.07, 'sun', 'sun2')
    # petite colline voisine et phare des Mamelles
    cyl(m, -0.62, 0.52, 0.05, 0.3, 0.27, 'g1', r1=0.17, n=9, col_top='g2')
    lathe(m, -0.62, 0.52, [(0.075, 0.3), (0.06, 0.62), (0.055, 0.8)], 8, lambda k, i: 'white' if k == 0 else 'red', cap='white')
    cyl(m, -0.62, 0.52, 0.8, 0.86, 0.075, 'dark', n=8)
    cyl(m, -0.62, 0.52, 0.86, 0.9, 0.025, 'red', r1=0.0, n=6)
    # baobab au coin, quelques buissons secs
    cyl(m, 0.64, 0.58, 0.05, 0.3, 0.085, 'trunk', r1=0.06, n=7)
    for i in range(5):
        a = 2*math.pi*i/5
        m.beam((0.64, 0.3, 0.58), (0.64+0.14*math.cos(a), 0.46, 0.58+0.14*math.sin(a)), 0.035, 'trunk2', w1=0.02, caps=True, sides=3)
        blob(m, 0.64+0.15*math.cos(a), 0.5, 0.58+0.15*math.sin(a), 0.07, 0.045, 0.07, 'scrub', n=5, lats=(-40, 0, 40))
    for (x, z) in ((-0.3, 0.7), (0.3, 0.74), (-0.76, -0.4), (0.78, -0.1)):
        blob(m, x, 0.1, z, 0.07, 0.05, 0.07, 'scrub', n=5, lats=(-40, 0, 40))
    return m
