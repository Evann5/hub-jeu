"""Bangkok (Thaïlande) : Wat Arun, haute tour centrale à gradins, quatre tours d'angle, terrasses, le fleuve devant."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'stone': '#CDBEA2', 'river': '#4F93B8', 'foam': '#E8F2F4', 'white': '#F2ECDD', 'pink': '#E8AEB8', 'teal': '#7CC3B6',
       'grey': '#C5CCD6', 'gold': '#E3B341', 'niche': '#6B5E5A', 'step': '#E2D8C4', 'blue': '#7FA6D6'}

def prang(m, cx, cz, y0, hw, H, n_t, cols):
    """Tour à gradins : n_t étages droits de plus en plus étroits, lèvre saillante, petites pointes aux angles, niches sur chaque face."""
    th = H*0.82/n_t
    y = y0
    s0 = len(m.faces)
    for i in range(n_t):
        t = i/n_t
        w = hw*(1-t)**0.75+0.02
        h = th*(1.15-0.45*t)
        col = cols[i % len(cols)]
        m.box(cx-w, cx+w, y, y+h, cz-w, cz+w, col, skip=('bot',))
        m.box(cx-w-0.016, cx+w+0.016, y+h-0.018, y+h, cz-w-0.016, cz+w+0.016, 'grey', skip=('bot',))
        if i < n_t-1 and i % 2 == 0 and w > 0.07:
            s1 = len(m.faces)
            front(m, cz+w+0.003, arch2d(cx, y+h*0.12, y+h*0.5, y+h*0.78, w*0.34, 3), 'niche')
            sides4(m, s1, cx, cz)
        if i < n_t-2:
            for sx in (-1, 1):
                for sz in (-1, 1):
                    cone(m, cx+sx*(w+0.004), cz+sz*(w+0.004), y+h, y+h+hw*0.3, hw*0.075, 'white', n=4, rot=math.pi/4)
        y += h
    top_w = hw*(1-(n_t-1)/n_t)**0.75+0.02
    cone(m, cx, cz, y, y+H*0.17, top_w*0.8, 'white', n=4, rot=math.pi/4)
    cyl(m, cx, cz, y+H*0.17, y+H*0.3, 0.012, 'gold', n=4, caps=(False, False))
    cyl(m, cx, cz, y+H*0.22, y+H*0.235, 0.04, 'gold', n=6)

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.05, -0.88, 0.6, 'stone', skip=('bot',))
    m.box(-0.88, 0.88, 0.0, 0.025, 0.6, 0.88, 'river', skip=('bot', 'nz'))
    for x0 in (-0.6, 0.15):
        m.box(x0, x0+0.4, 0.025, 0.03, 0.72, 0.75, 'foam', skip=('bot',))
    m.box(-0.88, 0.88, 0.0, 0.06, 0.55, 0.62, 'step', skip=('bot',))
    CZ = -0.25
    tiers = [(0.72, 0.05, 0.16), (0.58, 0.16, 0.29), (0.44, 0.29, 0.42)]
    for hw, y0, y1 in tiers:
        m.box(-hw, hw, y0, y1, CZ-hw, CZ+hw, 'white', skip=('bot',))
        m.box(-hw-0.02, hw+0.02, y1-0.03, y1, CZ-hw-0.02, CZ+hw+0.02, 'grey', skip=('bot',))
    # escaliers vers le fleuve et vers la terrasse
    for s in range(4):
        m.box(-0.16, 0.16, 0.05, 0.05+0.028*(4-s), CZ+0.72, CZ+0.72+0.045*(s+1)*0+0.045*(4-s)+0.0, 'step', skip=('bot', 'nz'))
    for s in range(3):
        m.box(-0.14, 0.14, 0.16, 0.16+0.04*(3-s), CZ+0.58, CZ+0.58+0.04*(3-s), 'step', skip=('bot', 'nz'))
    # tour centrale et quatre tours d'angle
    prang(m, 0, CZ, 0.42, 0.3, 2.2, 10, ['white', 'pink', 'white', 'teal'])
    for sx in (-1, 1):
        for sz in (-1, 1):
            prang(m, sx*0.46, CZ+sz*0.46, 0.29, 0.1, 0.9, 6, ['white', 'pink', 'blue'])
    return m
