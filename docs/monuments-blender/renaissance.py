"""Dakar : la colline des Mamelles, le monument de la Renaissance africaine vu comme une forme abstraite : une grande lame élancée de bronze,
légèrement penchée, flanquée d'une lame plus courte, sur un socle de pierre à baies au sommet de la colline, grand escalier devant ; le phare des
Mamelles sur la petite colline voisine et un baobab. Aucun personnage. Passe 3 (05/11/2026) : plus de sommet vert ni de disque orange, du bronze
(brun doré) seulement, un seul étage de socle."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'ground': '#E3D2A8', 'g1': '#B68F58', 'g2': '#C8A56B', 'g3': '#D9BF86', 'scrub': '#8AA05A', 'trunk': '#8A7358', 'trunk2': '#6E5A44', 'dark': '#4A3A32', 'white': '#F4F1EA', 'red': '#C9503A', 'stone': '#D6CDB9', 'stone2': '#B5AB95', 'step': '#EFE6CF',
       'b1': '#9A6230', 'b2': '#6A4120', 'b3': '#C8954F'}


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


def blade(m, cx, cz, y0, H, hw, hd, drift, n=8, slant=0.2):
    """Lame de bronze qui s'amincit à peine en se penchant de `drift` vers la droite ; face avant claire, flancs sombres,
    sommet coupé en biais (le coin arrière gauche monte de `slant`)."""
    rings = []
    for k in range(n+1):
        t = k/n
        s = 1-0.5*t**1.2
        x = cx+drift*t**1.6
        w, d = hw*s, hd*s
        ring = [(x-w, y0+H*t, cz-d), (x+w, y0+H*t, cz-d), (x+w, y0+H*t, cz+d), (x-w, y0+H*t, cz+d)]
        if k == n:
            ring = [(px, py+slant*(1-(px-x)/w)/2*0.8+slant*(1-(pz-cz)/d)/2*0.2, pz) for (px, py, pz) in ring]
        rings.append(ring)
    for k in range(n):
        ra, rb = rings[k], rings[k+1]
        ref = centroid(ra+rb)
        for i, col in enumerate(('b2', 'b2', 'b1', 'b3')):     # nz, px, pz, nx
            j = (i+1) % 4
            m.poly([ra[i], ra[j], rb[j], rb[i]], col, ref)
    m.poly(rings[-1], 'b3', centroid(rings[-2]))


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
    # socle de pierre : un étage octogonal, baies sombres sur les quatre faces
    cyl(m, CX, CZ, 0.82, 1.04, 0.33, 'stone', r1=0.29, n=8, col_top='stone2', rot=math.pi/8)
    for a in range(4):
        ang = a*math.pi/2
        px, pz = math.cos(ang), math.sin(ang)
        tx, tz = -pz, px
        rr = 0.315*math.cos(math.pi/8)+0.004
        for u in (-0.1, 0.0, 0.1):
            pts = [(CX+rr*px+tx*(u-0.032), 0.88, CZ+rr*pz+tz*(u-0.032)), (CX+rr*px+tx*(u+0.032), 0.88, CZ+rr*pz+tz*(u+0.032)),
                   (CX+rr*px+tx*(u+0.032), 0.98, CZ+rr*pz+tz*(u+0.032)), (CX+rr*px+tx*u, 1.01, CZ+rr*pz+tz*u), (CX+rr*px+tx*(u-0.032), 0.98, CZ+rr*pz+tz*(u-0.032))]
            m.poly(pts, 'dark', (CX, 0.95, CZ))
    # le monument : une grande lame de bronze et une lame plus courte, penchées du même côté
    blade(m, CX+0.04, CZ, 1.035, 1.5, 0.15, 0.1, 0.1)
    blade(m, CX-0.2, CZ+0.02, 1.035, 0.95, 0.075, 0.07, 0.06, slant=0.12)
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
