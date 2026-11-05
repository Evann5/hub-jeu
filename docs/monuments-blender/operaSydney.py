"""Sydney : l'Opéra, voiles blanches en coques qui s'élèvent sur une esplanade au bord de l'eau."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'water': '#2B8FC0', 'foam': '#EAF6F8', 'plat': '#E2D2AE', 'plat2': '#CDBB92', 'step': '#EFE4C8', 'white': '#F6F4EE', 'white2': '#E3E8EC',
    'glass': '#8FB0C8', 'dark': '#3A3633', 'sun': '#F2D26A',
}
Y0 = 0.04

def shell(m, cx, cz, R, H, lean, rot=0.0, n=7, k=5, lx=0.2):
    """Une voile : coque convexe vers l'avant (+z), face vitrée à l'arrière, sommet penché de côté (lx) et vers l'arrière (lean)."""
    rings = []
    for j in range(k+1):
        t = j/k
        r = R*(1-t)
        y = Y0+0.08+H*(t**0.75)
        c = cz-lean*t
        pts = []
        for i in range(n):
            phi = math.pi*i/(n-1)
            pts.append((cx+lx*t+r*math.cos(phi), y, c+r*0.5*math.sin(phi)))
        rings.append(pts)
    ref = (cx, Y0, cz-0.05)
    for j in range(k):
        m.band(rings[j], rings[j+1], 'white' if j % 2 == 0 else 'white2', ref, closed=False)
    left = [r[0] for r in rings]
    right = [r[-1] for r in rings]
    poly = left+right[::-1][:-1]
    m.poly(poly, 'glass', (cx, Y0+0.3, cz+R*0.5))
    m.poly(poly, 'glass', (cx, Y0+0.3, cz-R*3))

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.88, 0.88, 'water', skip=('bot',))
    m.box(-0.62, 0.62, Y0, Y0+0.012, 0.64, 0.82, 'foam', skip=('bot',))
    # esplanade et marches
    m.box(-0.84, 0.84, Y0, 0.1, -0.6, 0.45, 'plat', skip=('bot',))
    for k in range(3):
        m.box(-0.5-0.06*k+0.0, 0.5+0.06*k, Y0, 0.1-0.02*k, 0.45+0.06*(k+1)-0.06, 0.45+0.06*(k+1), 'step', skip=('bot', 'nz'))
    m.box(-0.84, 0.84, 0.1, 0.12, -0.6, -0.56, 'plat2', skip=('bot',))
    # voiles : deux groupes de trois, les grandes derrière, les petites devant, toutes penchées du même côté
    shell(m, -0.5, -0.3, 0.42, 1.0, 0.28, lx=0.26)
    shell(m, -0.44, -0.12, 0.37, 0.78, 0.22, lx=0.22)
    shell(m, -0.38, 0.05, 0.3, 0.56, 0.16, lx=0.18)
    shell(m, 0.18, -0.34, 0.42, 1.2, 0.28, lx=0.26)
    shell(m, 0.24, -0.16, 0.37, 0.92, 0.22, lx=0.22)
    shell(m, 0.3, 0.02, 0.3, 0.66, 0.16, lx=0.18)
    return m
