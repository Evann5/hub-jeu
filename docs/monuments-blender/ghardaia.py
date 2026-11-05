"""Ghardaïa : la ville du M'Zab, maisons ocre en cercles concentriques sur sa colline, minaret pointu au sommet."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'ground': '#D8B77C', 'h1': '#A8683A', 'h2': '#9A5A32', 'h3': '#8C4E2C', 'h4': '#7E4527',
       'o1': '#F3C27A', 'o2': '#EBA95C', 'o3': '#F8D9A0', 'o4': '#F0B96E', 'roof': '#FBEBC4', 'blue': '#2F9FB0',
       'min': '#EBC184', 'min2': '#C98A4A', 'mintop': '#B5683A', 'dark': '#4A3426'}
TIERS = [(0.05, 0.2, 0.86, 0.8, 'h1'), (0.2, 0.46, 0.8, 0.62, 'h2'), (0.46, 0.74, 0.62, 0.42, 'h3'), (0.74, 0.96, 0.42, 0.22, 'h4')]
HOUSE = ['o1', 'o2', 'o3', 'o4']


def slope_y(t, r):
    ya, yb, ra, rb, _ = t
    return ya + (yb-ya)*(ra-r)/(ra-rb)


def build():
    m = Mesh(PAL)
    rg = rnd(7)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'ground', skip=('bot',))
    for (ya, yb, ra, rb, col) in TIERS:
        cyl(m, 0, 0, ya, yb, ra, col, r1=rb, n=12, rot=math.pi/12, col_top=col)
    # maisons cubiques en anneaux (le dernier anneau est le plus bas en nombre)
    rings = [(0, 0.71, 13, 0.19), (1, 0.52, 9, 0.17), (2, 0.34, 6, 0.15)]
    for (ti, r, n, s) in rings:
        t = TIERS[ti]
        for i in range(n):
            a = 2*math.pi*i/n + 0.15*ti
            hh = 0.1 + 0.1*next(rg)
            hw = s/2*(0.8+0.4*next(rg))
            yb = slope_y(t, r)-0.03
            col = HOUSE[(i+ti) % 4]
            rbox(m, r*math.cos(a), r*math.sin(a), hw, hw*0.9, yb, yb+hh, -a, col, 'roof')
            if i % 3 == 0:     # porte bleue sur la face tournée vers l'extérieur, petit bloc sombre
                rbox(m, (r+hw*0.9)*math.cos(a), (r+hw*0.9)*math.sin(a), 0.012, 0.025, yb, yb+hh*0.55, -a, 'blue')
    # minaret pointu au sommet
    cx = cz = 0.0
    tbox(m, cx, cz, 0.96, 1.9, 0.19, 0.19, 0.11, 0.11, 'min', col_top='min')
    tbox(m, cx, cz, 1.28, 1.34, 0.16, 0.16, 0.155, 0.155, 'min2')
    tbox(m, cx, cz, 1.62, 1.68, 0.13, 0.13, 0.125, 0.125, 'min2')
    tbox(m, cx, cz, 1.9, 1.96, 0.14, 0.14, 0.14, 0.14, 'min2')
    pyr(m, cx, cz, 0.11, 0.11, 1.96, 0.55, 'mintop')
    for sx in (-1, 1):
        for sz in (-1, 1):
            pyr(m, cx+sx*0.13, cz+sz*0.13, 0.025, 0.025, 1.96, 0.12, 'min2')
    decal(m, 'pz', -0.035, 0.035, 1.4, 1.54, 0.1145, 'dark')
    return m
