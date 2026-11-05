"""Chiang Mai (Thaïlande) : temple du nord (Lanna) aux toits rouges superposés, chédi doré, guirlandes de lanternes entre deux mâts."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'ground': '#D9C08E', 'court': '#EBDDB8', 'wall': '#F6EEDC', 'roof': '#B73A2E', 'roof_d': '#8C2A22', 'gold': '#E5B53A', 'gold_l': '#F2D06A',
       'wood': '#7A4A2E', 'dark': '#3B2A22', 'l1': '#F7B93C', 'l2': '#E9603C', 'l3': '#F5EBCB', 'l4': '#E8498A', 'string': '#6B5A48', 'white': '#F6EEDC'}

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
    # deux mâts, guirlandes et lanternes
    pa, pb = (-0.8, 0.9, 0.66), (0.8, 0.9, 0.66)
    for p in (pa, pb):
        cyl(m, p[0], p[2], 0.06, p[1], 0.022, 'wood', 0.015, n=5)
    cols = ['l1', 'l2', 'l3', 'l4']
    def string(a, b, drop, nl, off=0):
        pts = sag(a, b, drop, 10)
        tube(m, pts, 0.012, 'string')
        for i in range(nl):
            p = pts[1+int((i+0.5)*(len(pts)-2)/nl)]
            blob(m, p[0], p[1]-0.07, p[2], 0.05, 0.065, 0.05, cols[(i+off) % 4], n=6, lats=(-65, 0, 65))
            m.beam((p[0], p[1], p[2]), (p[0], p[1]-0.03, p[2]), 0.008, 'string', caps=True)
    string(pa, pb, 0.16, 7)
    string(pa, (-0.5, 0.78, 0.42), 0.12, 3, 1)
    string(pb, (0.5, 0.78, 0.42), 0.12, 3, 2)
    string((-0.8, 0.9, 0.66), (-0.78, 0.7, -0.3), 0.1, 3, 3)
    string((0.8, 0.9, 0.66), (0.78, 0.7, -0.3), 0.1, 3, 0)
    cyl(m, -0.78, -0.3, 0.075, 0.7, 0.018, 'wood', 0.014, n=5)
    cyl(m, 0.78, -0.3, 0.075, 0.7, 0.018, 'wood', 0.014, n=5)
    return m
