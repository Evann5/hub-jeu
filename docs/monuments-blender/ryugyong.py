"""Pyongyang (Corée du Nord) : l'hôtel Ryugyong, grande pyramide à trois ailes inclinées surmontée d'un cône de verre."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'plaza': '#CFCBC0', 'podium': '#9A9C9F', 'podium2': '#B8BABD', 'glass': '#5E86A8', 'glass2': '#7FA6C4', 'glass_d': '#34506A', 'steel': '#D2D8DC',
       'cap': '#E9EEF1', 'dark': '#2C3A48'}

NB = 9                     # bandes sur la hauteur d'une aile
YA, YB = 0.12, 3.5         # bas et haut des ailes


def wing_ring(a, t, y):
    d = (math.cos(a), math.sin(a))
    p = (-d[1], d[0])
    D = 0.4*(1-t)+0.075*t        # distance du centre
    W = 0.31*(1-t)+0.06*t         # demi-largeur
    T = 0.18*(1-t)+0.06*t         # demi-épaisseur
    pts = []
    for (u, v) in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
        pts.append(((D+v*T)*d[0]+u*W*p[0], y, (D+v*T)*d[1]+u*W*p[1]))
    return pts


def build():
    m = Mesh(PAL)
    plate(m, 'plaza', 0.03)
    tbox(m, 0, 0, 0.03, 0.12, 0.66, 0.66, 0.6, 0.6, 'podium')
    for ang in (90, 210, 330):
        a = math.radians(ang)
        rings = []
        for j in range(NB+1):
            t = j/NB
            rings.append(wing_ring(a, t, YA+(YB-YA)*t))
        for j in range(NB):
            c = 'glass' if j % 2 == 0 else 'glass2'
            if j == 0:
                c = 'glass_d'
            m.band(rings[j], rings[j+1], c)
        m.poly(rings[-1], 'cap', (0, 0, 0))
    # cœur et couronne
    cyl(m, 0, 0, 3.0, 3.58, 0.15, 'glass_d', 0.13, n=6, caps=(False, False))
    cyl(m, 0, 0, 3.55, 3.62, 0.2, 'steel', n=6)
    lathe(m, [(0.19, 3.62), (0.19, 3.78), (0.13, 3.92), (0.07, 4.02), (0.0, 4.08)], 6, ['glass2', 'glass', 'glass2', 'glass'], 0, 0)
    spire(m, 0, 0, 4.06, 4.36, 0.014, 'steel', 0.004, n=4)
    return m
