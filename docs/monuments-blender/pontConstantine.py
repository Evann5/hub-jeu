"""Constantine : un pont suspendu entre deux falaises, pylônes de pierre, câbles et suspentes, rivière au fond de la gorge."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'valley': '#86AE5C', 'river': '#3C98BC', 'foam': '#EAF6F8', 'cl1': '#C0925E', 'cl2': '#A87B4C', 'cl3': '#D2A76F', 'grass': '#7DB058',
       'deck': '#E4DDCB', 'deck2': '#9C958A', 'pylon': '#EADBB4', 'pylon2': '#CFBA8A', 'cable': '#2F3640', 'hang': '#5A6470', 'dark': '#3A322A'}
YD = 1.06


def falaise(m, sx):
    cx = sx*0.66
    tbox(m, cx, 0, 0.05, 0.5, 0.25, 0.7, 0.23, 0.68, 'cl1')
    tbox(m, cx, 0, 0.5, 0.82, 0.23, 0.68, 0.21, 0.66, 'cl2')
    tbox(m, cx, 0, 0.82, YD, 0.21, 0.66, 0.2, 0.64, 'cl3', col_top='grass')

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'valley', skip=('bot',))
    m.box(-0.2, 0.2, 0.05, 0.065, -0.88, 0.88, 'river', skip=('bot',))
    m.box(-0.2, -0.17, 0.065, 0.07, -0.3, 0.1, 'foam', skip=('bot',))
    m.box(0.13, 0.16, 0.065, 0.07, 0.25, 0.7, 'foam', skip=('bot',))
    falaise(m, -1)
    falaise(m, 1)
    # tablier
    sbox(m, -0.88, 0.88, YD-0.04, YD, -0.1, 0.1, 'deck', 'deck')
    m.box(-0.5, 0.5, YD-0.09, YD-0.04, -0.09, 0.09, 'deck2', skip=('top',))
    # pylônes (quatre jambes reliées en haut) et câbles
    TOP = 1.82
    for sx in (-1, 1):
        px = sx*0.52
        for sz in (-1, 1):
            tbox(m, px, sz*0.11, YD, TOP, 0.05, 0.045, 0.035, 0.035, 'pylon', col_top='pylon2')
        m.box(px-0.045, px+0.045, 1.5, 1.58, -0.115, 0.115, 'pylon2', skip=('bot',))
        m.box(px-0.055, px+0.055, TOP, TOP+0.06, -0.165, 0.165, 'pylon', skip=('bot',))
    for sz in (-1, 1):
        z = sz*0.11
        pts = sag((-0.52, TOP+0.02, z), (0.52, TOP+0.02, z), 0.6, 14)
        cable(m, pts, 0.035, 'cable')
        # suspentes
        for p in pts[1:-1]:
            m.beam((p[0], YD, z), (p[0], p[1], z), 0.016, 'hang', sides=3, caps=False)
        # haubans vers les falaises
        cable(m, [(-0.52, TOP+0.02, z), (-0.87, YD+0.02, z)], 0.035, 'cable')
        cable(m, [(0.52, TOP+0.02, z), (0.87, YD+0.02, z)], 0.035, 'cable')
    return m
