"""Guanajuato : maisons de toutes les couleurs en terrasses sur la colline, un escalier central, l'église au sommet."""
import math
from lib import Mesh
from lib_mexique_italie import *

PAL = {'earth': '#B08B66', 'earth2': '#9C7A58', 'top': '#8FA85E', 'stair': '#E8D9B3', 'riser': '#8A6F52',
       'c0': '#E8567A', 'c1': '#F2B632', 'c2': '#3BA5C9', 'c3': '#EE7B30', 'c4': '#7BBF6A', 'c5': '#B759B5', 'c6': '#E2453C', 'c7': '#F4E3B5', 'c8': '#2DB5A3',
       'glass': '#3A302D', 'frame': '#FBF3DE', 'door': '#6A4630', 'tile': '#C4623F', 'tile2': '#B3552F', 'flat': '#E6D6B6',
       'church': '#F1DDA4', 'church2': '#E6C77A', 'dome': '#D9653B', 'dome2': '#C4512C', 'gold': '#E9B53C', 'dark': '#5A3F33'}
COLS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']
#       z0     z1     y     demi-largeur
ROWS = [(0.55, 0.88, 0.07, 0.88), (0.24, 0.55, 0.33, 0.80), (-0.08, 0.24, 0.59, 0.72), (-0.40, -0.08, 0.85, 0.64), (-0.88, -0.40, 1.11, 0.55)]
HGT = [0.30, 0.36, 0.28, 0.40, 0.32, 0.26, 0.38, 0.30, 0.34, 0.42, 0.28, 0.36]
GAP = 0.04   # demi-largeur de l'escalier central


def house(m, x0, x1, z0, z1, y0, h, col, idx):
    obox(m, ID, x0, x1, y0, y0+h, z0, z1, col, top='flat', skip=())
    cx = (x0+x1)/2
    w = x1-x0
    if idx % 3 != 1:
        gable(m, ID, x0, x1, z0, z1, y0+h, y0+h+0.08, 'tile' if idx % 2 else 'tile2', col, ridge='s', o=0.01)
    else:
        obox(m, ID, x0-0.006, x1+0.006, y0+h, y0+h+0.025, z0-0.006, z1+0.006, col, top='flat', skip=())
    if w > 0.2:
        for sx in (-0.05, 0.05):
            window(m, ID, cx+sx, 0.02, y0+h*0.5, y0+h*0.8, z1, 'glass', 'frame')
    else:
        window(m, ID, cx, 0.02, y0+h*0.5, y0+h*0.8, z1, 'glass', 'frame')
    # porte
    deco_rect(m, ID, cx-0.022, cx+0.022, y0, y0+h*0.36, z1+0.003, 'door') if idx % 2 == 0 else None


def build():
    m = Mesh(PAL)
    k = 0
    for r, (z0, z1, y, hw) in enumerate(ROWS):
        # terrasse : bloc de terre, dessus herbeux ; l'escalier central en clair
        m.box(-hw, hw, 0, y, z0, z1, 'earth', skip=('bot', 'top'))
        m.poly([(-hw, y, z0), (-GAP, y, z0), (-GAP, y, z1), (-hw, y, z1)], 'top', (0, y-1, 0))
        m.poly([(GAP, y, z0), (hw, y, z0), (hw, y, z1), (GAP, y, z1)], 'top', (0, y-1, 0))
        m.poly([(-GAP, y, z0), (GAP, y, z0), (GAP, y, z1), (-GAP, y, z1)], 'stair', (0, y-1, 0))
        m.poly([(-GAP, 0.0 if r == 0 else y-0.26, z1), (GAP, 0.0 if r == 0 else y-0.26, z1), (GAP, y, z1), (-GAP, y, z1)], 'riser', (0, y, z1-3))
        # maisons
        if r < 4:
            spans = [(-hw+0.02, -GAP-0.02), (GAP+0.02, hw-0.02)]
            nper = [3, 3] if r < 2 else [3, 3] if r == 2 else [2, 2]
        else:
            spans = [(-hw+0.02, -0.30), (0.30, hw-0.02)]
            nper = [1, 1]
        for (a, b), n in zip(spans, nper):
            ws = [1.0+0.35*math.sin(k*2.3+i*1.7) for i in range(n)]
            tot = sum(ws)
            x = a
            for i in range(n):
                w = ws[i]/tot*(b-a)
                h = HGT[(k*5+r*3) % len(HGT)]
                jit = 0.03*(((k*7+r) % 3)-1)
                house(m, x+0.007, x+w-0.007, z0+0.04, z1-0.04+jit, y, h, COLS[(k*4+r*2) % len(COLS)], k)
                x += w
                k += 1
    # église au sommet
    y = ROWS[4][2]
    zc0, zc1 = -0.84, -0.46
    obox(m, ID, -0.26, 0.26, y, y+0.34, zc0, zc1, 'church', top='church2')
    obox(m, ID, -0.28, 0.28, y+0.34, y+0.37, zc0-0.01, zc1+0.01, 'church2', top='church2')
    deco_arch(m, ID, 0, 0.06, y, y+0.16, y+0.23, zc1+0.004, 'dark', 3)
    deco_arch(m, ID, 0, 0.03, y+0.22, y+0.27, y+0.3, zc1+0.004, 'dark', 3)
    for sg in (-1, 1):
        deco_arch(m, ID, sg*0.17, 0.025, y+0.1, y+0.2, y+0.25, zc1+0.004, 'dark', 3)
        xc = sg*0.2
        obox(m, ID, xc-0.05, xc+0.05, y+0.37, y+0.5, zc1-0.12, zc1-0.02, 'church', top='church2')
        deco_arch(m, ID, xc, 0.02, y+0.4, y+0.45, y+0.48, zc1-0.02+0.004, 'dark', 3)
        lathe(m, xc, zc1-0.07, [(0.06, y+0.5), (0.05, y+0.55), (0.028, y+0.6), (0.0, y+0.63)], 8, lambda k, i: 'dome' if i % 2 == 0 else 'dome2', rot=math.pi/8)
    zc = (zc0+zc1)/2-0.02
    lathe(m, 0, zc, [(0.14, y+0.37), (0.14, y+0.5), (0.155, y+0.5), (0.155, y+0.53)], 8, lambda k, i: 'church' if k == 0 else 'church2', rot=math.pi/8)
    lathe(m, 0, zc, [(0.13, y+0.53), (0.118, y+0.6), (0.085, y+0.67), (0.04, y+0.72), (0.0, y+0.75)], 8, lambda k, i: 'dome' if i % 2 == 0 else 'dome2', rot=math.pi/8)
    cyl(m, 0, zc, 0.01, y+0.75, y+0.84, 4, 'gold', 'gold')
    return m
