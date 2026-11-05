"""Chiang Mai (Thaïlande) : temple du nord (Lanna) aux toits rouges superposés, chédi doré, et la fête des lanternes (Yi Peng) :
trois guirlandes de grosses lanternes vives entre deux hauts mâts, et des lanternes volantes qui montent au-dessus du temple.
Passe 2 (05/11/2026) : lanternes quatre fois plus grosses, couleurs saturées, temple assombri pour qu'elles ressortent."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'ground': '#8A7553', 'court': '#BCA578', 'wall': '#EFE3C8', 'roof': '#9A3027', 'roof_d': '#6F211D', 'gold': '#E5B53A', 'gold_l': '#F2D06A',
       'wood': '#6A3F28', 'dark': '#3B2A22', 'l1': '#FFC928', 'l2': '#FF6A2B', 'l3': '#FFF1C4', 'l4': '#F23D8E', 'l5': '#34C2D0', 'string': '#4A3A2E', 'white': '#F6EEDC',
       'glow': '#FFE9A8', 'glow2': '#FFC46B'}

def build():
    m = Mesh(PAL)
    slab(m, 'ground', 0.06)
    m.box(-0.78, 0.78, 0.06, 0.075, -0.7, 0.55, 'court', skip=('bot',))
    # salle : socle, murs, porche
    m.box(-0.46, 0.46, 0.075, 0.16, -0.5, 0.42, 'wall', skip=('bot',))
    m.box(-0.4, 0.4, 0.16, 0.5, -0.46, 0.34, 'wall', skip=('bot',))
    front(m, 0.34+0.004, arch2d(0, 0.16, 0.32, 0.42, 0.12, 4), 'dark')
    front(m, 0.34+0.008, rect(-0.012, 0.012, 0.16, 0.42), 'gold')
    for sx in (-1, 1):
        for x in (sx*0.36, sx*0.2):
            m.box(x-0.022, x+0.022, 0.16, 0.5, 0.36-0.022, 0.36+0.022, 'wood', skip=('bot',))
    # trois toits superposés (avec leurs murs de séparation), pignon face à l'avant
    gable(m, -0.56, 0.56, -0.58, 0.5, 0.5, 0.15, 'roof', 'gold_l', ridge='z')
    m.box(-0.58, 0.58, 0.48, 0.5, -0.6, 0.52, 'roof_d', skip=('bot',))
    m.box(-0.36, 0.36, 0.5, 0.74, -0.44, 0.36, 'wall', skip=('bot',))
    gable(m, -0.46, 0.46, -0.52, 0.42, 0.74, 0.15, 'roof', 'gold', ridge='z')
    m.box(-0.2, 0.2, 0.74, 0.92, -0.34, 0.26, 'wall', skip=('bot',))
    gable(m, -0.3, 0.3, -0.44, 0.34, 0.92, 0.14, 'roof_d', 'gold_l', ridge='z')
    # faîtage : épis dorés aux deux bouts
    for z in (-0.4, 0.32):
        m.beam((0, 1.04, z), (0, 1.18, z+(0.06 if z > 0 else -0.06)), 0.03, 'gold', w1=0.008, caps=True)
    # chédi doré
    cx, cz = -0.58, -0.5
    m.box(cx-0.13, cx+0.13, 0.075, 0.14, cz-0.13, cz+0.13, 'white', skip=('bot',))
    cyl(m, cx, cz, 0.14, 0.2, 0.115, 'white', n=8)
    lathe(m, [(0.13, 0.2), (0.15, 0.3), (0.13, 0.42), (0.09, 0.54), (0.06, 0.68), (0.035, 0.84), (0.02, 0.98), (0, 1.08)], 8, 'gold', cx, cz)
    for yb in (0.34, 0.5, 0.66):
        cyl(m, cx, cz, yb, yb+0.025, 0.12-0.2*(yb-0.34)*0.32, 'gold_l', n=8)
    # deux hauts mâts, trois guirlandes de grosses lanternes
    H = 1.32
    pa, pb = (-0.8, H, 0.66), (0.8, H, 0.66)
    for p in (pa, pb):
        cyl(m, p[0], p[2], 0.06, p[1], 0.026, 'wood', 0.017, n=5)
    cols = ['l1', 'l2', 'l3', 'l4', 'l5']
    def string(a, b, drop, nl, off=0, size=1.0):
        pts = sag(a, b, drop, 10)
        tube(m, pts, 0.012, 'string')
        for i in range(nl):
            p = pts[1+int((i+0.5)*(len(pts)-2)/nl)]
            r, h = 0.085*size, 0.115*size
            m.beam((p[0], p[1], p[2]), (p[0], p[1]-0.03, p[2]), 0.008, 'string', caps=False, sides=3)
            blob(m, p[0], p[1]-0.03-h, p[2], r, h, r, cols[(i+off) % 5], n=6, lats=(-62, 0, 62))
    string(pa, pb, 0.2, 9, 0)
    string((-0.8, H-0.2, 0.66), (0.8, H-0.2, 0.66), 0.16, 8, 2, 0.9)
    string((-0.8, H-0.4, 0.66), (0.8, H-0.4, 0.66), 0.12, 7, 4, 0.8)
    string(pa, (-0.78, 1.0, -0.3), 0.14, 4, 3)
    string(pb, (0.78, 1.0, -0.3), 0.14, 4, 1)
    cyl(m, -0.78, -0.3, 0.075, 1.0, 0.02, 'wood', 0.015, n=5)
    cyl(m, 0.78, -0.3, 0.075, 1.0, 0.02, 'wood', 0.015, n=5)
    # lanternes volantes (Yi Peng) qui montent au-dessus du temple
    for (x, y, z, k) in ((-0.2, 1.52, 0.12, 1.0), (0.3, 1.78, -0.2, 1.15), (0.02, 2.1, 0.0, 1.0), (-0.52, 1.82, 0.3, 0.9), (0.58, 1.56, 0.34, 0.85), (-0.35, 2.3, -0.3, 0.85), (0.5, 2.25, 0.1, 0.8)):
        blob(m, x, y, z, 0.075*k, 0.11*k, 0.075*k, 'glow', n=6, lats=(-60, 0, 60))
    return m
