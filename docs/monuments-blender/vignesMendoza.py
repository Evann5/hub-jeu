"""Mendoza : rangées de vignes avec leurs grappes, devant la cordillère des Andes enneigée."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'soil': '#C79A5E', 'soil2': '#B3844B', 'leaf': '#4E8F3A', 'leaf2': '#78B04A', 'grape': '#6B2B63', 'post': '#7A5230',
    'mA': '#8A5E4A', 'mB': '#A8715A', 'snow': '#F4F7FA', 'snow2': '#D5E0EC', 'hill': '#B9824A', 'trunk': '#6E4B2A',
    'cyp': '#2F6B3A', 'wire': '#3A3633',
}

def peak(m, cx, cz, r, h, y0, rot=0.0, n=6, cut=0.55):
    yc = y0+h*cut
    rc = r*(1-cut)
    for i in range(n):
        a0, a1 = rot+2*math.pi*i/n, rot+2*math.pi*(i+1)/n
        m.poly([(cx+r*math.sin(a0), y0, cz+r*math.cos(a0)), (cx+r*math.sin(a1), y0, cz+r*math.cos(a1)),
                (cx+rc*math.sin(a1), yc, cz+rc*math.cos(a1)), (cx+rc*math.sin(a0), yc, cz+rc*math.cos(a0))],
               'mA' if i % 2 == 0 else 'mB', (cx, yc, cz))
        m.poly([(cx+rc*math.sin(a0), yc, cz+rc*math.cos(a0)), (cx+rc*math.sin(a1), yc, cz+rc*math.cos(a1)), (cx, y0+h, cz)],
               'snow' if i % 2 == 0 else 'snow2', (cx, yc, cz))

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.04, -0.88, 0.88, 'soil', skip=('bot',))
    m.box(-0.88, 0.88, 0.04, 0.2, -0.88, -0.5, 'hill', skip=('bot',))
    peak(m, -0.5, -0.5, 0.38, 1.0, 0.2, 0.2)
    peak(m, 0.1, -0.48, 0.4, 1.45, 0.2, 0.0)
    peak(m, 0.55, -0.52, 0.33, 0.85, 0.2, 0.5)
    # rangées de vignes
    z0, z1 = -0.1, 0.8
    for i in range(7):
        x = -0.72+i*0.24
        m.box(x-0.06, x+0.06, 0.04, 0.16, z0, z1, 'leaf', skip=('bot',))
        m.box(x-0.045, x+0.045, 0.16, 0.21, z0, z1, 'leaf2', skip=('bot',))
        m.box(x-0.1, x-0.07, 0.04, 0.05, z0, z1, 'soil2', skip=('bot',))
        for zz in (z0+0.02, z1-0.04):    # poteaux de bout de rang
            m.box(x-0.015, x+0.015, 0.04, 0.3, zz, zz+0.03, 'post', skip=('bot',))
        for k in range(4):               # grappes
            zz = z0+0.12+k*0.2
            sx = 1 if (i+k) % 2 else -1
            m.box(x+sx*0.06-0.02, x+sx*0.06+0.02, 0.1, 0.17, zz, zz+0.05, 'grape', skip=('bot',))
    # deux cyprès sur le côté
    for (x, z) in ((-0.8, 0.5), (0.82, 0.0)):
        lathe(m, [(0.0, 0.04), (0.07, 0.05), (0.07, 0.12), (0.05, 0.4), (0.0, 0.55)], 5, ['trunk', 'cyp', 'cyp', 'cyp'], x, z)
    return m
