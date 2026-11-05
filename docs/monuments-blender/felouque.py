"""Assouan : une felouque à voile blanche triangulaire sur le Nil, rive de sable avec un palmier."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'nile': '#2A8FB8', 'nile2': '#4DB0D0', 'foam': '#EAF6F8', 'sand': '#EBCB86', 'sand2': '#D9B26B', 'hull': '#C4552B', 'hull2': '#8A3C1E',
       'deck': '#9A6A3E', 'wood': '#6F4A2A', 'sail': '#FAF8F0', 'sail2': '#E4DFCF', 'trim': '#2FA9AE', 'trunk': '#7A5632', 'leaf': '#2FA05A',
       'leaf2': '#1E8049', 'rock': '#8E7A5E'}
BY = 0.06


def sail(m, pts, th, col, col2):
    (a, b, c) = pts
    f = [(p[0], p[1], th) for p in pts]
    k = [(p[0], p[1], -th) for p in pts]
    cen = ((a[0]+b[0]+c[0])/3, (a[1]+b[1]+c[1])/3, 0.0)
    m.poly(f, col, cen)
    m.poly(k, col2, cen)
    for i in range(3):
        j = (i+1) % 3
        m.poly([f[i], f[j], k[j], k[i]], col2, cen)


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.04, -0.88, 0.88, 'nile', skip=('bot',))
    for (x0, x1, z0) in ((-0.8, -0.3, 0.74), (0.25, 0.75, 0.6), (-0.6, -0.1, -0.3)):
        m.box(x0, x1, 0.04, 0.047, z0, z0+0.03, 'foam', skip=('bot',))
    # rive de sable au fond
    sbox(m, -0.88, 0.88, 0.04, 0.1, -0.88, -0.58, 'sand', 'sand')
    tbox(m, -0.2, -0.52, 0.04, 0.1, 0.5, 0.1, 0.4, 0.06, 'sand')
    tbox(m, 0.55, -0.5, 0.04, 0.12, 0.22, 0.12, 0.14, 0.07, 'sand2')
    palm(m, 0.62, -0.7, 0.62, 'trunk', 'leaf', 'leaf2', y0=0.1, lean=-0.06, fronds=6, flen=0.3)
    tbox(m, -0.62, -0.62, 0.1, 0.2, 0.08, 0.07, 0.05, 0.05, 'rock')
    # coque : tranches le long de x, bout relevé à l'avant
    secs = [(-0.8, 0.012, 0.01, 0.4, 0.32), (-0.58, 0.11, 0.06, 0.3, 0.12), (-0.12, 0.25, 0.14, 0.26, 0.06),
            (0.4, 0.24, 0.13, 0.26, 0.06), (0.72, 0.12, 0.08, 0.32, 0.14)]
    z0 = 0.22
    rings = [[(x, BY+yb, z0-wb), (x, BY+yb, z0+wb), (x, BY+yt, z0+wt), (x, BY+yt, z0-wt)] for (x, wt, wb, yt, yb) in secs]
    for k in range(len(rings)-1):
        ref = centroid(list(rings[k])+list(rings[k+1]))
        for i, col in enumerate(('hull2', 'hull', 'deck', 'hull')):
            j = (i+1) % 4
            m.poly([rings[k][i], rings[k][j], rings[k+1][j], rings[k+1][i]], col, ref)
    m.poly(rings[0], 'hull', centroid(rings[1]))
    m.poly(rings[-1], 'hull', centroid(rings[-2]))
    # liston clair le long du bord
    m.box(-0.3, 0.55, BY+0.15, BY+0.19, z0+0.245, z0+0.265, 'trim', skip=('bot',))
    m.box(0.3, 0.6, BY+0.26, BY+0.38, z0-0.12, z0+0.12, 'wood', skip=('bot',))    # petite cabine arrière
    # mât, antenne et grande voile latine
    zc = z0
    rod(m, (-0.1, BY+0.26, zc), (-0.04, 1.55, zc), 0.045, 'wood', w1=0.03)
    sail(m, [(-0.72, 0.5, zc), (0.2, 1.75, zc), (0.62, 0.5, zc)], 0.012, 'sail', 'sail2')
    rod(m, (-0.78, 0.43, zc), (0.24, 1.82, zc), 0.04, 'wood', w1=0.03)
    return m
