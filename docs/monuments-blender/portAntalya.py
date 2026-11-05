"""Antalya (Turquie) : le vieux port, minaret cannelé de brique et mosquée à dôme sur le quai, maisons à toits de tuiles, tour de guet, bateaux."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'water': '#2F97B8', 'foam': '#E4F1F3', 'stone': '#CDB88E', 'stone_d': '#A8926A', 'house': '#F2E6CE', 'house2': '#EAD2A6', 'roof': '#C4552F',
       'brick': '#B5573B', 'brick_d': '#8E3F2C', 'cap': '#6E908A', 'dome': '#8FA59F', 'door': '#5A4030', 'recess': '#4B3226', 'white': '#F6F2E6',
       'blue': '#2F6FB0', 'red': '#C9552E', 'gold': '#E2B040', 'trunk': '#7A5A3C', 'leaf': '#4F8A45'}

def boat(m, cx, cz, rot, L, deck, mast=False):
    s = len(m.faces)
    hull(m, [(-L/2, 0.03, 0.03, 0.075), (-L*0.25, 0.07, 0.025, 0.07), (L*0.2, 0.07, 0.025, 0.07), (L/2, 0.012, 0.05, 0.12)], 'white', deck)
    m.box(-L*0.2, L*0.1, 0.07, 0.15, -0.045, 0.045, deck, skip=('bot',))
    if mast:
        m.beam((0.0, 0.07, 0), (0.0, 0.42, 0), 0.02, 'stone_d', caps=True)
    xform(m, lambda p: move(cx, 0, cz)(rot_y(rot)(p)), s)

def house(m, cx, cz, hw, hd, h, col, rf=0.14):
    m.box(cx-hw, cx+hw, 0.08, 0.08+h, cz-hd, cz+hd, col, skip=('bot',))
    hip(m, cx-hw-0.025, cx+hw+0.025, cz-hd-0.025, cz+hd+0.025, 0.08+h, rf, 'roof', top=(hw*0.3, 0.0))
    s = len(m.faces)
    for k in (-1, 1):
        window(m, cz+hd+0.001, cx+k*hw*0.45, 0.08+h*0.25, 0.08+h*0.7, 0.03, 'recess', None, True, 1)

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.03, 0.1, 0.88, 'water', skip=('bot', 'nz'))
    for (x0, z0, w) in ((-0.1, 0.62, 0.45), (0.3, 0.32, 0.35), (-0.7, 0.85, 0.4)):
        m.box(x0, x0+w, 0.03, 0.035, z0, z0+0.03, 'foam', skip=('bot',))
    m.box(-0.88, 0.88, 0.0, 0.08, -0.88, 0.1, 'stone', skip=('bot',))
    m.box(-0.88, -0.5, 0.0, 0.08, 0.1, 0.55, 'stone', skip=('bot', 'nz'))          # môle à gauche
    m.box(-0.9, -0.48, 0.07, 0.1, 0.08, 0.57, 'stone_d', skip=('bot',))
    # tour de guet au bout du môle
    cyl(m, -0.69, 0.4, 0.1, 0.5, 0.13, 'stone_d', 0.12, n=8)
    cyl(m, -0.69, 0.4, 0.5, 0.54, 0.145, 'stone', n=8)
    cone(m, -0.69, 0.4, 0.54, 0.68, 0.15, 'roof', n=8)
    # minaret cannelé et sa mosquée voisine
    mx, mz = 0.28, -0.45
    m.box(mx-0.13, mx+0.13, 0.08, 0.3, mz-0.13, mz+0.13, 'stone_d', skip=('bot',))
    fluted(m, mx, mz, 0.3, 1.4, 0.115, 0.095, 8, 'brick', 'brick_d')
    cyl(m, mx, mz, 1.4, 1.44, 0.15, 'stone', 0.17, n=10)
    cyl(m, mx, mz, 1.44, 1.52, 0.16, 'stone', n=10)
    cyl(m, mx, mz, 1.52, 1.6, 0.1, 'brick', n=8)
    cone(m, mx, mz, 1.6, 2.0, 0.115, 'cap', n=8)
    cone(m, mx, mz, 2.0, 2.1, 0.01, 'gold', n=4, cap_bot=False)
    m.box(-0.35, 0.1, 0.08, 0.42, -0.62, -0.28, 'house', skip=('bot',))
    cyl(m, -0.125, -0.45, 0.42, 0.48, 0.2, 'stone', n=10)
    dome(m, -0.125, -0.45, 0.48, 0.19, 0.2, 10, 'dome', rows=3)
    cone(m, -0.125, -0.45, 0.68, 0.76, 0.012, 'gold', n=4, cap_bot=False)
    front(m, -0.28+0.004, arch2d(-0.125, 0.08, 0.2, 0.28, 0.06, 4), 'recess')
    front(m, -0.28+0.004, arch2d(-0.28, 0.2, 0.28, 0.34, 0.03, 3), 'recess')
    front(m, -0.28+0.004, arch2d(0.03, 0.2, 0.28, 0.34, 0.03, 3), 'recess')
    # maisons à toits de tuiles
    house(m, 0.65, -0.62, 0.17, 0.15, 0.34, 'house')
    house(m, 0.7, -0.2, 0.15, 0.14, 0.3, 'house2')
    house(m, -0.6, -0.65, 0.2, 0.14, 0.38, 'house2')
    house(m, 0.62, 0.02, 0.14, 0.07, 0.22, 'house')
    # bateaux
    boat(m, -0.2, 0.5, 10, 0.5, 'blue', True)
    boat(m, 0.4, 0.62, -15, 0.46, 'red')
    boat(m, -0.2, 0.8, -6, 0.4, 'blue')
    return m
