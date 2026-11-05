"""Jaipur (Inde) : le Hawa Mahal, façade de grès rose en cinq étages, chacun rythmé par une rangée de balcons-oriels saillants
(cadre crème, baie sombre, petite coupole), la porte à arc en bas, trois pavillons à coupole au sommet.
Passe 2 (05/11/2026) : façade mince (plus un bloc), étages qui se resserrent, rythme fenêtres / pleins, contraste crème sur rose."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'sand': '#D9B27E', 'pink': '#E7806F', 'pink_l': '#F0A08C', 'pink_d': '#B9564A', 'cream': '#FBEBD2', 'recess': '#42272B', 'dome': '#FFF1DE',
       'gold': '#EBB32E', 'step': '#F1DDB6', 'roofc': '#C4604F'}

Z0, ZF = -0.2, 0.2     # profondeur de la façade : mince, comme un écran
# (y0, y1, demi-largeur, nombre d'oriels)
LEVELS = [(0.05, 0.34, 0.84, 0), (0.34, 0.72, 0.72, 7), (0.72, 1.06, 0.6, 6), (1.06, 1.34, 0.46, 4), (1.34, 1.58, 0.3, 3)]


def build():
    m = Mesh(PAL)
    slab(m, 'sand', 0.05)
    # parvis et marches
    for k in range(3):
        m.box(-0.34-0.04*k, 0.34+0.04*k, 0.05, 0.05+0.03*(3-k), ZF, ZF+0.1+0.07*(3-k), 'step', skip=('bot', 'nz'))
    for li, (y0, y1, hw, nw) in enumerate(LEVELS):
        m.box(-hw, hw, y0, y1, Z0, ZF, 'pink', skip=('bot',))
        m.box(-hw-0.03, hw+0.03, y1-0.05, y1-0.02, Z0-0.02, ZF+0.04, 'cream', skip=('bot',))   # corniche crème
        m.box(-hw-0.03, hw+0.03, y1-0.02, y1, Z0-0.02, ZF+0.04, 'roofc', skip=('bot',))        # terrasse du niveau, plus sombre que le grès
        m.box(-hw-0.012, hw+0.012, y0, y0+0.035, Z0-0.01, ZF+0.02, 'pink_d', skip=('bot',))     # plinthe sombre
        if nw == 0:
            # rez-de-chaussée : trois grandes baies à arc, la porte au milieu
            for u, big in ((-0.5, False), (0.0, True), (0.5, False)):
                hh = 0.2 if big else 0.14
                window(m, ZF+0.001, u, y0+0.04, y0+0.04+hh+0.06, 0.1 if big else 0.07, 'recess', 'cream', True, 1, True)
            for u in (-0.75, -0.25, 0.25, 0.75):
                window(m, ZF+0.001, u, y0+0.1, y0+0.24, 0.03, 'recess', 'cream', True, 1, True)
            continue
        step = 2*hw/nw
        for k in range(nw):
            x = -hw+step*(k+0.5)
            bw = step*0.29
            by0, by1 = y0+0.1, y1-0.15
            # oriel saillant : cadre crème, baie sombre à arc, toit à coupole
            m.box(x-bw, x+bw, by0, by1, ZF, ZF+0.06, 'cream', skip=('bot', 'nz', 'top'))   # le dessus est caché par la coupole
            window(m, ZF+0.06, x, by0+0.035, by1-0.025, bw*0.62, 'recess', 'pink_l', True, 1, True)
            dome(m, x, ZF+0.03, by1, bw*1.05, bw*1.0, 6, 'dome', rows=2)
            cone(m, x, ZF+0.03, by1+bw*1.0, by1+bw*1.0+0.05, 0.008, 'gold', n=4, cap_bot=False)
            # petite baie dans le plein entre deux oriels
            if k < nw-1:
                window(m, ZF+0.001, x+step/2, by0+0.04, by1-0.0, 0.016, 'recess', None, True, 1, True)
    # pavillons du sommet
    y = LEVELS[-1][1]
    for x in (-0.19, 0.0, 0.19):
        hgt = 0.2 if x == 0 else 0.13
        m.box(x-0.06, x+0.06, y, y+hgt, -0.1, 0.06, 'cream', skip=('bot',))
        window(m, 0.06+0.001, x, y+0.03, y+hgt-0.03, 0.03, 'recess', None, True, 1, True)
        dome(m, x, -0.02, y+hgt, 0.085, 0.11, 8, 'dome', rows=2)
        cone(m, x, -0.02, y+hgt+0.11, y+hgt+0.2, 0.012, 'gold', n=4, cap_bot=False)
    return m
