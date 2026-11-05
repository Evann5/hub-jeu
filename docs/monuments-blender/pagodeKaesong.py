"""Kaesong (Corée du Nord) : porte ancienne à deux toits recourbés, sur un haut socle de pierre percé d'une arche."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'grass': '#7FAE62', 'stone': '#BDB6A4', 'stone_d': '#9A9482', 'stone_l': '#D3CCB9', 'red': '#B8372D', 'wallw': '#7A3B2A', 'under': '#2F8F7E',
       'blue': '#2E5FA8', 'roof': '#59616B', 'roof_l': '#7C848E', 'ridge': '#2B2F35', 'dark': '#2A211C', 'gold': '#D9A93A'}


def zf(y):
    """Avant du socle incliné à la hauteur y."""
    return 0.34-0.0833*(y-0.1)


def build():
    m = Mesh(PAL)
    plate(m, 'grass', 0.04)
    tbox(m, 0, 0, 0.04, 0.1, 0.84, 0.52, 0.8, 0.48, 'stone_d')
    tbox(m, 0, 0, 0.1, 0.58, 0.66, 0.34, 0.6, 0.3, 'stone')
    m.box(-0.64, 0.64, 0.58, 0.63, -0.33, 0.33, 'stone_l', skip=('bot',))
    # arche de passage, devant et derrière
    arch = [(-0.14, 0.1), (0.14, 0.1), (0.14, 0.34), (0.1, 0.43), (0.0, 0.47), (-0.1, 0.43), (-0.14, 0.34)]
    for s in (1, -1):
        m.poly([(x, y, s*(zf(y)+0.005)) for (x, y) in arch], 'dark', (0, 0.3, s*(zf(0.3)-1)))
    # pans de muraille de part et d'autre
    for s in (-1, 1):
        a, b = (0.6, 0.88) if s > 0 else (-0.88, -0.6)
        m.box(a, b, 0.1, 0.38, -0.14, 0.14, 'stone', skip=('bot',))
        m.box(a-0.01 if s > 0 else a-0.01, b+0.01, 0.38, 0.41, -0.16, 0.16, 'stone_l', skip=('bot',))
    # niveau 1 : colonnes rouges, murs brun, frise verte et bleue
    y1 = 0.63
    h1 = 0.3
    m.box(-0.5, 0.5, y1, y1+h1, -0.17, 0.17, 'wallw', skip=('bot', 'top'))
    for x in (-0.5, -0.25, 0.0, 0.25, 0.5):
        for z in (-0.17, 0.17):
            m.box(x-0.03, x+0.03, y1, y1+h1, z-0.03, z+0.03, 'red', skip=('bot', 'top'))
    m.box(-0.54, 0.54, y1+h1, y1+h1+0.06, -0.21, 0.21, 'under', skip=('bot',))
    m.box(-0.56, 0.56, y1+h1+0.06, y1+h1+0.09, -0.23, 0.23, 'blue', skip=('bot',))
    ye1 = y1+h1+0.08
    roof(m, 0, 0, ye1, 0.7, 0.34, 0.13, 'roof', top=(0.46, 0.0), lift=0.06, flare=0.04, col_top='roof_l')
    yr1 = ye1+0.13
    m.box(-0.46, 0.46, yr1, yr1+0.03, -0.02, 0.02, 'ridge', skip=('bot',))
    # niveau 2
    y2 = yr1
    h2 = 0.26
    m.box(-0.32, 0.32, y2, y2+h2, -0.13, 0.13, 'wallw', skip=('bot', 'top'))
    for x in (-0.32, -0.16, 0.0, 0.16, 0.32):
        for z in (-0.13, 0.13):
            m.box(x-0.025, x+0.025, y2, y2+h2, z-0.025, z+0.025, 'red', skip=('bot', 'top'))
    m.box(-0.36, 0.36, y2+h2, y2+h2+0.06, -0.17, 0.17, 'under', skip=('bot',))
    m.box(-0.38, 0.38, y2+h2+0.06, y2+h2+0.09, -0.19, 0.19, 'blue', skip=('bot',))
    ye2 = y2+h2+0.08
    roof(m, 0, 0, ye2, 0.58, 0.3, 0.18, 'roof', top=(0.3, 0.0), lift=0.065, flare=0.05, col_top='roof_l')
    yr2 = ye2+0.18
    m.box(-0.3, 0.3, yr2, yr2+0.035, -0.022, 0.022, 'ridge', skip=('bot',))
    for s in (-1, 1):
        m.box(s*0.3-0.035, s*0.3+0.035, yr2-0.01, yr2+0.1, -0.03, 0.03, 'ridge', skip=('bot',))
    return m
