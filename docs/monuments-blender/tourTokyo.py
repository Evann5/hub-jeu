"""Tokyo (Japon) : la tour de Tokyo, treillis orange et blanc, grande plateforme et plateforme haute, antenne."""
import math
from lib import Mesh, lerp
from lib_vietnam_japon import *

PAL = {'org': '#D8481E', 'wht': '#ECE6DA', 'org_d': '#B53B17', 'glass': '#394859', 'bldg': '#CBC3B4', 'bldg_d': '#9E968A', 'deck': '#E4DED2'}

YM0, YM1 = 2.07, 2.27      # grande plateforme
YS0, YS1 = 3.38, 3.58      # plateforme haute
SX = [(1, 1), (1, -1), (-1, 1), (-1, -1)]

def W(y):
    """Demi-largeur extérieure du fût."""
    if y <= YM0:
        return 0.27+(0.56-0.27)*(1-y/YM0)**1.3
    if y <= YS0:
        return 0.19-0.075*((y-YM1)/(YS0-YM1))**0.9
    return 0.075-0.05*((y-YS1-0.08)/0.5)

def stage_list(ys, cols, t_post, t_br, m, tri=True):
    for i in range(len(ys)-1):
        y0, y1 = ys[i], ys[i+1]
        col = cols[i % len(cols)]
        P = lambda y, sx, sz: (sx*(W(y)-t_post(y)/2), y, sz*(W(y)-t_post(y)/2))
        for (sx, sz) in SX:
            m.beam(P(y0, sx, sz), P(y1, sx, sz), t_post(y0), col, w1=t_post(y1))
        for (A, B) in [((1, 1), (1, -1)), ((-1, 1), (-1, -1)), ((1, 1), (-1, 1)), ((1, -1), (-1, -1))]:
            m.beam(P(y0, *A), P(y1, *B), t_br, col, sides=3)
            m.beam(P(y0, *B), P(y1, *A), t_br, col, sides=3)
            if i > 0:
                m.beam(P(y0, *A), P(y0, *B), t_br*1.2, col, sides=3)

def deck(m, y0, y1, hw, split, col_a, col_b, band_w):
    m.box(-hw, hw, y0, y0+split, -hw, hw, col_a, skip=('bot',))
    m.box(-hw-0.02, hw+0.02, y0+split, y0+split+0.02, -hw-0.02, hw+0.02, col_b, skip=('bot',))
    m.box(-hw+0.01, hw-0.01, y0+split+0.02, y1, -hw+0.01, hw-0.01, col_a, skip=('bot',))
    # bande vitrée
    d = hw+0.003
    ya, yb = y0+0.04, y0+split-0.015
    for (p, q) in [((-d, d), (-hw, hw))]:
        pass
    c = (0, (ya+yb)/2, 0)
    m.poly([(-band_w, ya, d), (band_w, ya, d), (band_w, yb, d), (-band_w, yb, d)], 'glass', c)
    m.poly([(-band_w, ya, -d), (band_w, ya, -d), (band_w, yb, -d), (-band_w, yb, -d)], 'glass', c)
    m.poly([(d, ya, -band_w), (d, ya, band_w), (d, yb, band_w), (d, yb, -band_w)], 'glass', c)
    m.poly([(-d, ya, -band_w), (-d, ya, band_w), (-d, yb, band_w), (-d, yb, -band_w)], 'glass', c)

def build():
    m = Mesh(PAL)
    # bâtiment d'accueil entre les pieds
    m.box(-0.46, 0.46, 0, 0.26, -0.46, 0.46, 'bldg', skip=('bot',))
    m.box(-0.47, 0.47, 0.26, 0.29, -0.47, 0.47, 'bldg_d', skip=('bot',))
    # fût inférieur : de la base à la grande plateforme
    ys1 = [0.0, 0.20, 0.40, 0.62, 0.86, 1.10, 1.36, 1.62, 1.86, YM0]
    cols1 = ['org', 'org', 'wht', 'wht', 'org', 'org', 'wht', 'wht', 'org']
    stage_list(ys1, cols1, lambda y: 0.060-0.025*(y/YM0), 0.026, m)
    deck(m, YM0, YM1, 0.34, 0.12, 'org', 'wht', 0.28)
    # fût intermédiaire
    ys2 = [YM1, 2.52, 2.78, 3.08, YS0]
    stage_list(ys2, ['wht', 'org', 'org', 'wht'], lambda y: 0.04-0.012*((y-YM1)/1.1), 0.02, m)
    deck(m, YS0, YS1+0.08, 0.135, 0.12, 'org', 'wht', 0.10)
    # antenne : petit treillis puis mât
    ys3 = [YS1+0.08, 3.86, 4.02, 4.16]
    stage_list(ys3, ['org', 'wht', 'org'], lambda y: 0.022, 0.014, m)
    top = 4.16
    marks = [top, 4.26, 4.36, 4.46, 4.60]
    for i in range(4):
        cyl(m, 0, 0, marks[i], marks[i+1], 0.014-0.002*i, 'org' if i % 2 == 0 else 'wht', 0.012-0.002*i, n=5, caps=(False, i == 3))
    return m
