"""Jaipur (Inde) : le Hawa Mahal, façade de grès rose en gradins percée de dizaines de fenêtres, petites coupoles sur chaque étage."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'sand': '#E6CDA3', 'pink': '#E58D7C', 'pink_d': '#C9705F', 'cream': '#F8E8D2', 'recess': '#5E3D3F', 'dome': '#F4D6BE',
       'gold': '#E2B440', 'step': '#D9B88C'}

LEVELS = [(0.05, 0.4, 0.84, 0.3, 7), (0.4, 0.74, 0.72, 0.22, 6), (0.74, 1.06, 0.58, 0.14, 5), (1.06, 1.34, 0.44, 0.06, 4), (1.34, 1.6, 0.3, -0.02, 3)]

def build():
    m = Mesh(PAL)
    slab(m, 'sand', 0.05)
    for (y0, y1, hw, zf, nw) in LEVELS:
        m.box(-hw, hw, y0, y1, -0.34, zf, 'pink', skip=('bot',))
        m.box(-hw-0.025, hw+0.025, y1-0.035, y1, -0.34, zf+0.03, 'cream', skip=('bot',))
        m.box(-hw-0.012, hw+0.012, y0, y0+0.03, -0.34, zf+0.015, 'pink_d', skip=('bot',))
        step = 2*hw/nw
        for k in range(nw):
            x = -hw+step*(k+0.5)
            window(m, zf+0.001, x, y0+0.07, y1-0.1, step*0.3, 'recess', 'cream', True, 1)
            # petite coupole au-dessus de chaque travée
            dome(m, x, zf-0.04, y1, step*0.22, step*0.2, 6, 'dome', rows=2)
        # coupoles d'angle de l'étage
    # oriels saillants au centre des étages 2 à 4, avec toit en pointe
    for (y0, y1, hw, zf, nw) in LEVELS[1:4]:
        m.box(-0.14, 0.14, y0+0.04, y1-0.04, zf, zf+0.07, 'cream', skip=('bot',))
        window(m, zf+0.071, 0, y0+0.09, y1-0.12, 0.07, 'recess', 'pink_d', True, 1)
        hip(m, -0.16, 0.16, zf-0.01, zf+0.09, y1-0.04, 0.07, 'pink_d', top=(0.0, 0.0))
    # pavillons du sommet et fleurons
    y = LEVELS[-1][1]
    for x in (-0.18, 0.0, 0.18):
        m.box(x-0.055, x+0.055, y, y+0.12, -0.2, -0.08, 'cream', skip=('bot',))
        dome(m, x, -0.14, y+0.12, 0.075, 0.1, 8, 'dome', rows=2)
        cone(m, x, -0.14, y+0.22, y+0.3, 0.012, 'gold', n=4, cap_bot=False)
    # porte au rez-de-chaussée
    front(m, LEVELS[0][3]+0.004, arch2d(0, 0.05, 0.2, 0.3, 0.07, 4, True), 'recess')
    return m
