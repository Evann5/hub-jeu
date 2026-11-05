"""Brasília : la cathédrale, couronne de seize colonnes de béton courbes (hyperboloïde), verrière bleue entre elles, clocher à quatre mâts."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'lawn': '#7FB55C', 'lawn2': '#6AA24E', 'plat': '#F1ECE0', 'plat2': '#D9D3C3', 'col': '#F7F3E8', 'ring': '#FFFFFF', 'glass': '#6EC3EC',
       'glass2': '#3B97D0', 'dark': '#7A7466', 'bell': '#B9B2A2'}
N = 16
RB, RT, YB, YT, TW = 0.66, 0.6, 0.14, 1.5, 1.4


def pt(k, t, scale=1.0):
    a0 = 2*math.pi*k/N
    xb, zb = RB*math.cos(a0), RB*math.sin(a0)
    xt, zt = RT*math.cos(a0+TW), RT*math.sin(a0+TW)
    return ((xb+(xt-xb)*t)*scale, YB+(YT-YB)*t, (zb+(zt-zb)*t)*scale)


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'lawn', skip=('bot',))
    cyl(m, 0, 0, 0.05, 0.1, 0.8, 'plat2', n=16, col_top='plat2')
    cyl(m, 0, 0, 0.1, YB, 0.74, 'plat', n=16, col_top='plat')
    # verrière : anneaux tirés légèrement vers l'axe
    ts = [0, 0.3, 0.6, 0.85, 1.0]
    rings = [[pt(k, t, 0.93) for k in range(N)] for t in ts]
    for a in range(len(rings)-1):
        for k in range(N):
            j = (k+1) % N
            m.poly([rings[a][k], rings[a][j], rings[a+1][j], rings[a+1][k]], 'glass' if (a+k) % 2 == 0 else 'glass2', (0, (YB+YT)/2, 0))
    m.poly(rings[-1], 'glass2', (0, YB, 0))
    # seize colonnes courbes (droites d'un hyperboloïde), couronne au sommet
    for k in range(N):
        m.beam(pt(k, 0), pt(k, 1), 0.1, 'col', w1=0.07, caps=True)
    prism(m, [(RT*math.cos(2*math.pi*i/N+TW), RT*math.sin(2*math.pi*i/N+TW)) for i in range(N)], YT, YT+0.05, 'ring', col_top='glass')
    # clocher à quatre mâts, en coin du parvis
    bx, bz = 0.68, -0.66
    for (dx, dz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        m.beam((bx+dx*0.07, 0.05, bz+dz*0.07), (bx+dx*0.02, 1.05, bz+dz*0.02), 0.045, 'bell', w1=0.025, caps=True)
    for y in (0.35, 0.7):
        w = 0.07-0.05*(y-0.05)/1.0
        m.box(bx-w, bx+w, y, y+0.03, bz-w, bz+w, 'bell', skip=('bot',))
    return m
