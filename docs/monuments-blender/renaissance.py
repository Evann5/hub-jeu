"""Dakar : la colline des Mamelles et le monument de la Renaissance africaine, vu comme une forme abstraite :
deux grandes lames de bronze vert qui s'ouvrent en V, un disque de soleil entre elles, sur un socle de pierre. Aucun personnage."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'ground': '#DDC48C', 'g1': '#5E9E48', 'g2': '#79B955', 'g3': '#92CC66', 'stone': '#D6CDB9', 'stone2': '#B5AB95', 'step': '#EFE6CF',
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
    # colline en gradins, gazon
    cyl(m, 0, 0, 0.05, 0.3, 0.86, 'g1', r1=0.72, n=12, col_top='g2')
    cyl(m, 0, 0, 0.3, 0.62, 0.72, 'g2', r1=0.5, n=12, col_top='g3')
    cyl(m, 0, 0, 0.62, 0.9, 0.5, 'g1', r1=0.34, n=12, col_top='g2')
    # marches claires devant (rampe d'accès)
    for k in range(4):
        y = 0.05+0.21*k
        z = 0.86-0.14*k
        m.box(-0.1, 0.1, y, y+0.045, z-0.04, z+0.02, 'step', skip=('bot',))
    # socle de pierre : deux étages
    cyl(m, 0, 0, 0.9, 1.08, 0.32, 'stone', r1=0.28, n=8, col_top='stone2')
    cyl(m, 0, 0, 1.08, 1.3, 0.24, 'stone', r1=0.2, n=8, col_top='stone2')
    # deux grandes lames de bronze qui s'ouvrent en V, disque de soleil entre elles
    lean(m, (-0.07, 1.3, 0), (-0.2, 2.5, 0), 0.1, 0.075, 0.055, 0.05, 'b1', 'b3', 'b2')
    lean(m, (0.09, 1.3, 0), (0.28, 2.15, 0), 0.1, 0.075, 0.055, 0.05, 'b1', 'b3', 'b2')
    disc_xy(m, 0.04, 2.3, -0.01, 0.17, 0.07, 'sun', 'sun2')
    return m
