"""Kaesong (Corée du Nord) : porte ancienne à deux toits recourbés, sur un haut socle de pierre percé d'une arche."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'grass': '#7FAE62', 'stone': '#BDB6A4', 'stone_d': '#9A9482', 'stone_l': '#D3CCB9', 'red': '#B8372D', 'wallw': '#7A3B2A', 'under': '#2F8F7E',
       'blue': '#2E5FA8', 'roof': '#4A4F57', 'roof_l': '#6A707A', 'ridge': '#2B2F35', 'dark': '#2A211C', 'gold': '#D9A93A'}


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
    m.box(-0.5, 0.5, y1, y1+0.22, -0.2, 0.2, 'wallw', skip=('bot', 'top'))
    for x in (-0.5, -0.25, 0.0, 0.25, 0.5):
        for z in (-0.2, 0.2):
            m.box(x-0.025, x+0.025, y1, y1+0.22, z-0.025, z+0.025, 'red', skip=('bot', 'top'))
    m.box(-0.025-0.5, 0.025+0.5, y1+0.22, y1+0.28, -0.25, 0.25, 'under', skip=('bot',))
    m.box(-0.54, 0.54, y1+0.28, y1+0.31, -0.28, 0.28, 'blue', skip=('bot',))
    roof(m, 0, 0, y1+0.3, 0.84, 0.52, 0.16, 'roof', top=(0.5, 0.0), lift=0.065, flare=0.05, col_top='roof_l')
    yr1 = y1+0.3+0.16
    m.box(-0.5, 0.5, yr1, yr1+0.03, -0.02, 0.02, 'ridge', skip=('bot',))
    # niveau 2
    y2 = yr1
    m.box(-0.34, 0.34, y2, y2+0.2, -0.15, 0.15, 'wallw', skip=('bot', 'top'))
    for x in (-0.34, -0.17, 0.0, 0.17, 0.34):
        for z in (-0.15, 0.15):
            m.box(x-0.022, x+0.022, y2, y2+0.2, z-0.022, z+0.022, 'red', skip=('bot', 'top'))
    m.box(-0.38, 0.38, y2+0.2, y2+0.25, -0.2, 0.2, 'under', skip=('bot',))
    m.box(-0.4, 0.4, y2+0.25, y2+0.275, -0.22, 0.22, 'blue', skip=('bot',))
    roof(m, 0, 0, y2+0.27, 0.7, 0.42, 0.22, 'roof', top=(0.34, 0.0), lift=0.07, flare=0.06, col_top='roof_l')
    yr2 = y2+0.27+0.22
    m.box(-0.36, 0.36, yr2, yr2+0.035, -0.022, 0.022, 'ridge', skip=('bot',))
    for s in (-1, 1):
        m.box(s*0.36-0.035, s*0.36+0.035, yr2-0.01, yr2+0.1, -0.03, 0.03, 'ridge', skip=('bot',))
    return m
