"""Huế (Vietnam) : la porte du Midi (Ngọ Môn) de la cité impériale : socle de pierre à cinq passages, pavillon rouge, toits jaunes à deux étages."""
import math
from lib import Mesh
from lib_vietnam_japon import *

PAL = {'stone': '#B7A78A', 'stone_l': '#CDBF9F', 'dark': '#2B211C', 'red': '#B52B22', 'wall': '#7A2420',
       'yellow': '#E1B52E', 'yellow_d': '#B98A1E', 'gold': '#D9A935'}

def pavilion(m, cx, y0, hw, hd, wall_h, roof_hw, roof_hd, roof_h, top, cols=0, tall_col=None):
    """Salle à murs sombres, colonnes rouges devant, toit jaune à coins relevés."""
    m.box(cx-hw, cx+hw, y0, y0+wall_h, -hd, hd, 'wall', skip=('bot',))
    for i in range(cols):
        x = cx-hw+2*hw*i/(cols-1)
        m.box(x-0.016, x+0.016, y0, y0+wall_h, hd, hd+0.032, 'red', skip=('bot',))
    m.box(cx-hw-0.01, cx+hw+0.01, y0+wall_h-0.03, y0+wall_h, -hd-0.01, hd+0.04, 'red', skip=('bot',))
    return roof(m, cx, 0, y0+wall_h, roof_hw, roof_hd, roof_h, 'yellow', top=top, lift=0.05, flare=0.05, cap=True, col_top='yellow_d')

def build():
    m = Mesh(PAL)
    # socle de pierre aux murs inclinés, corniche claire
    tbox(m, 0, 0, 0, 0.44, 0.88, 0.50, 0.84, 0.46, 'stone')
    m.box(-0.86, 0.86, 0.44, 0.48, -0.48, 0.48, 'stone_l', skip=('bot',))
    # cinq passages (face avant légèrement inclinée)
    zf = lambda y: 0.50-0.09*y+0.004
    def arch(xc, w, h):
        hs = h-w
        pts = [(xc-w, 0.0), (xc-w, hs)]
        for k in range(1, 4):
            a = math.pi*k/4
            pts.append((xc-w*math.cos(a), hs+w*math.sin(a)))
        pts += [(xc+w, hs), (xc+w, 0.0)]
        m.poly([(x, y, zf(y)) for (x, y) in pts], 'dark', (xc, h/2, 0.0))
    arch(0, 0.11, 0.32)
    for s in (-1, 1):
        arch(s*0.28, 0.075, 0.25)
        arch(s*0.52, 0.065, 0.21)
    # corps central : salle basse, grand toit, étage, second toit
    y0 = 0.48
    hi = pavilion(m, 0, y0, 0.40, 0.22, 0.30, 0.50, 0.30, 0.15, (0.36, 0.10), cols=9)
    y1 = y0+0.30+0.15
    pavilion(m, 0, y1, 0.26, 0.12, 0.22, 0.38, 0.22, 0.17, (0.20, 0.0), cols=5)
    ytop = y1+0.22+0.17
    # ornements de faîte
    for s in (-1, 1):
        m.poly([(s*0.20-0.025, ytop, -0.02), (s*0.20+0.025, ytop, -0.02), (s*0.20, ytop+0.08, 0.0)], 'gold', (s*0.2, ytop, 0.03))
        m.poly([(s*0.20-0.025, ytop, 0.02), (s*0.20+0.025, ytop, 0.02), (s*0.20, ytop+0.08, 0.0)], 'gold', (s*0.2, ytop, -0.03))
    # galeries et pavillons d'extrémité
    for s in (-1, 1):
        gx0, gx1 = sorted([s*0.40, s*0.64])
        m.box(gx0, gx1, y0, y0+0.12, -0.09, 0.09, 'wall', skip=('bot',))
        gable(m, gx0, gx1, -0.14, 0.14, y0+0.12, 0.08, 'yellow', ridge='x')
        cx = s*0.70
        m.box(cx-0.10, cx+0.10, y0, y0+0.24, -0.10, 0.10, 'wall', skip=('bot',))
        for dx in (-0.10, 0.10):
            m.box(cx+dx-0.015, cx+dx+0.015, y0, y0+0.24, 0.09, 0.12, 'red', skip=('bot',))
        roof(m, cx, 0, y0+0.24, 0.15, 0.15, 0.17, 'yellow', top=(0.025, 0.025), lift=0.05, flare=0.04)
        m.beam((cx, y0+0.41, 0), (cx, y0+0.50, 0), 0.025, 'gold', w1=0.008)
    return m
