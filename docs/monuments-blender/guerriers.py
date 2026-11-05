"""Xi'an (Chine) : l'armée de terre cuite, trois couloirs de fouilles, guerriers alignés face au visiteur (deux ont perdu la tête)."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'earth': '#CDA874', 'ridge': '#A07C52', 'floor': '#7F5F40', 'terra': '#C06C43', 'terra2': '#B35E3A', 'terra_d': '#8A4829',
       'terra_l': '#DC9462', 'band': '#6E3A22'}

def warrior(m, cx, cz, y0, col, headless=False):
    """Un guerrier de terre cuite : socle, jupe, cuirasse, cou, tête avec chignon, bras le long du corps. Regarde vers +Z."""
    m.box(cx-0.09, cx+0.09, y0, y0+0.03, cz-0.07, cz+0.07, 'terra_d', skip=('bot',))
    lathe(m, [(0.06, y0+0.03), (0.075, y0+0.25)], 6, col, cx, cz, rot=0.5)
    lathe(m, [(0.09, y0+0.25), (0.1, y0+0.33), (0.092, y0+0.43), (0.05, y0+0.47)], 6, ['band', 'terra_l', col], cx, cz, rot=0.5, cap_top=True)
    for sx in (-1, 1):
        m.beam((cx+sx*0.108, y0+0.43, cz), (cx+sx*0.112, y0+0.27, cz+0.045), 0.04, col)
    if not headless:
        cyl(m, cx, cz, y0+0.47, y0+0.51, 0.026, 'terra_d', n=5)
        sphere(m, cx, y0+0.57, cz, 0.065, 'terra_l', n=7, rows=3)
        m.box(cx-0.02, cx+0.02, y0+0.62, y0+0.69, cz-0.02, cz+0.02, 'terra_d', skip=('bot',))
    else:
        m.box(cx-0.04, cx+0.04, y0+0.47, y0+0.5, cz-0.04, cz+0.04, 'terra_d', skip=('bot',))

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.04, -0.88, 0.88, 'floor', skip=('bot',))
    for (x0, x1) in ((-0.88, -0.72), (-0.3, -0.22), (0.22, 0.3), (0.72, 0.88)):
        m.box(x0, x1, 0.04, 0.17, -0.88, 0.88, 'ridge', skip=('bot',))
        m.box(x0, x1, 0.17, 0.185, -0.88, 0.88, 'earth', skip=('bot',))
    cols = [['terra', 'terra2', 'terra', 'terra2'], ['terra2', 'terra', 'terra2', 'terra'], ['terra', 'terra', 'terra2', 'terra2']]
    for ci, cx in enumerate((-0.51, 0.0, 0.51)):
        for ri, z in enumerate((-0.62, -0.2, 0.22, 0.64)):
            warrior(m, cx, z, 0.04, cols[ci][ri], headless=(ci, ri) in ((0, 1), (2, 2)))
    return m
