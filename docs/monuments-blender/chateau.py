"""Osaka (Japon) : le château, socle de pierre à murs inclinés, étages blancs, toits vert-de-gris à pignons, ornements dorés."""
import math
from lib import Mesh
from lib_vietnam_japon import *

PAL = {'stone': '#948E80', 'stone_l': '#B8B2A3', 'stone_d': '#7A7568', 'white': '#EDE7D8', 'green': '#5F917F', 'green_d': '#487262',
       'gold': '#D4A73C', 'black': '#2B2B30', 'dark': '#3A3733', 'moat': '#4F8693'}

HB = [0.46, 0.40, 0.34, 0.28, 0.22]     # demi-largeur des murs
WH = [0.34, 0.32, 0.30, 0.28, 0.24]     # hauteur des murs
RH = 0.09                               # hauteur des toits

def panels(m, hw, y0, y1, xs, col, w):
    """Fenêtres plaquées sur les quatre faces."""
    d = hw+0.004
    for x in xs:
        a, b = x-w, x+w
        c = (0, (y0+y1)/2, 0)
        m.poly([(a, y0, d), (b, y0, d), (b, y1, d), (a, y1, d)], col, c)
        m.poly([(a, y0, -d), (b, y0, -d), (b, y1, -d), (a, y1, -d)], col, c)
        m.poly([(d, y0, a), (d, y0, b), (d, y1, b), (d, y1, a)], col, c)
        m.poly([(-d, y0, a), (-d, y0, b), (-d, y1, b), (-d, y1, a)], col, c)

def build():
    m = Mesh(PAL)
    # deux terrasses de pierre à murs inclinés, corniches claires
    tbox(m, 0, 0, 0, 0.22, 0.88, 0.88, 0.76, 0.76, 'stone')
    m.box(-0.78, 0.78, 0.22, 0.25, -0.78, 0.78, 'stone_l', skip=('bot',))
    tbox(m, 0, 0, 0.25, 0.44, 0.66, 0.66, 0.58, 0.58, 'stone')
    m.box(-0.60, 0.60, 0.44, 0.47, -0.60, 0.60, 'stone_l', skip=('bot',))
    # joints de pierre : deux lits plus sombres sur la face avant
    for (y, hw) in [(0.11, 0.83), (0.34, 0.62)]:
        m.box(-hw, hw, y, y+0.012, hw-0.012+0.002, hw+0.003, 'stone_d', skip=('bot',))
    y = 0.47
    for k in range(5):
        hb, wh = HB[k], WH[k]
        top = k == 4
        m.box(-hb, hb, y, y+wh, -hb, hb, 'black' if top else 'white', skip=('bot',))
        if not top:
            panels(m, hb, y+0.12, y+wh-0.05, [-hb*0.5, 0.0, hb*0.5], 'dark', 0.035)
            m.box(-hb-0.008, hb+0.008, y, y+0.035, -hb-0.008, hb+0.008, 'stone_d', skip=('bot',))
        else:
            panels(m, hb, y+0.06, y+wh-0.08, [-hb*0.45, hb*0.45], 'gold', 0.03)
            m.box(-hb-0.025, hb+0.025, y+wh-0.03, y+wh, -hb-0.025, hb+0.025, 'gold', skip=('bot',))
        ye = y+wh
        nxt = HB[k+1]+0.01 if k < 4 else 0.0
        if k < 4:
            roof(m, 0, 0, ye, HB[k]+0.075, HB[k]+0.075, RH, 'green', top=(nxt, nxt), lift=0.03, flare=0.02, cap=True, col_top='green_d')
            m.box(-HB[k]-0.115, HB[k]+0.115, ye-0.015, ye+0.01, -HB[k]-0.115, HB[k]+0.115, 'gold') if False else None
        else:
            roof(m, 0, 0, ye, hb+0.09, hb+0.09, 0.16, 'green', top=(0.12, 0.0), lift=0.04, flare=0.03)
        # pignons dorés sur les quatre faces (étages 1 et 3)
        if k in (0, 2):
            e = HB[k]+0.075
            gy = ye+0.012
            for (ax, sgn) in [('z', 1), ('z', -1), ('x', 1), ('x', -1)]:
                x0, x1 = -0.11, 0.11
                z0, z1 = sorted([sgn*(e-0.02), sgn*(e-0.22)])
                if ax == 'z':
                    gable(m, x0, x1, z0, z1, gy, 0.15, 'green', end_col='white', ridge='z')
                    zf = sgn*(e-0.02)+sgn*0.003
                    m.poly([(-0.04, gy+0.035, zf), (0.04, gy+0.035, zf), (0.0, gy+0.105, zf)], 'gold', (0, gy, 0))
                else:
                    gable(m, z0, z1, x0, x1, gy, 0.15, 'green', end_col='white', ridge='x')
                    xf = sgn*(e-0.02)+sgn*0.003
                    m.poly([(xf, gy+0.035, -0.04), (xf, gy+0.035, 0.04), (xf, gy+0.105, 0.0)], 'gold', (0, gy, 0))
        y = ye+RH
    # shachi dorés aux deux bouts du faîtage
    yt = y+0.05
    for s in (-1, 1):
        m.poly([(s*0.17-0.03, yt, -0.025), (s*0.17+0.03, yt, -0.025), (s*0.2, yt+0.12, 0.0)], 'gold', (s*0.17, yt, 0.05))
        m.poly([(s*0.17-0.03, yt, 0.025), (s*0.17+0.03, yt, 0.025), (s*0.2, yt+0.12, 0.0)], 'gold', (s*0.17, yt, -0.05))
        m.poly([(s*0.17-0.03, yt, -0.025), (s*0.17-0.03, yt, 0.025), (s*0.2, yt+0.12, 0.0)], 'gold', (s*0.17+0.1, yt, 0))
        m.poly([(s*0.17+0.03, yt, -0.025), (s*0.17+0.03, yt, 0.025), (s*0.2, yt+0.12, 0.0)], 'gold', (s*0.17-0.1, yt, 0))
    return m
