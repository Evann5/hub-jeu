"""Jeju (Corée du Sud) : le Hallasan, volcan vert à lac de cratère, mandariniers et statue de pierre ronde (dol hareubang)."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'sea': '#2F86C2', 'shallow': '#6BC0D8', 'land': '#6EAF4C', 'g1': '#6EAF4C', 'g2': '#58A047', 'g3': '#3E8A3E', 'g4': '#2F7237',
       'rock': '#7D766D', 'rock2': '#948C80', 'lake': '#3FA6D6', 'stone': '#8C877D', 'stone_l': '#A9A59B', 'dark': '#2A2826',
       'trunk': '#7A5236', 'leaf': '#3E8E3E', 'orange': '#F28C28'}

LAND = [(-0.7, -0.88), (0.88, -0.88), (0.88, 0.6), (0.6, 0.75), (0.1, 0.6), (-0.3, 0.7), (-0.88, 0.4), (-0.88, -0.5)]
SHORE = grow(LAND, 1.1)
CX, CZ = 0.0, -0.14
RS = [0.7, 0.6, 0.48, 0.38, 0.31, 0.27]
YS = [0.08, 0.32, 0.64, 0.98, 1.24, 1.36]
N = 16


def colfn(k, i):
    if k <= 1:
        return 'g1' if (i + k) % 2 == 0 else 'g2'
    if k == 2:
        return 'g2' if i % 2 == 0 else 'g3'
    if k == 3:
        return 'g3' if i % 2 == 0 else 'g4'
    return 'rock' if i % 2 == 0 else 'rock2'


def build():
    m = Mesh(PAL)
    plate(m, 'sea', 0.04)
    prism_xz(m, SHORE, 0.04, 0.05, 'shallow', 'shallow')
    prism_xz(m, LAND, 0.04, 0.08, 'g3', 'land')
    rings = cone(m, CX, CZ, RS, YS, N, colfn, amp=0.04, seed=1)
    top = rings[-1]
    rim = [(CX+(p[0]-CX)*0.7, 1.29, CZ+(p[2]-CZ)*0.7) for p in top]
    floor = [(CX+(p[0]-CX)*0.58, 1.15, CZ+(p[2]-CZ)*0.58) for p in top]
    lid(m, top, rim, 'rock2', CX, CZ)
    crater_wall(m, rim, floor, 'rock', CX, CZ)
    m.poly(floor, 'lake', (CX, 0, CZ))
    # petits cônes parasites (oreum)
    cone(m, -0.58, 0.28, [0.26, 0.2, 0.12, 0.06], [0.08, 0.2, 0.3, 0.33], 8, lambda k, i: 'g2' if i % 2 else 'g1', amp=0.05, seed=3)
    cone(m, 0.62, 0.2, [0.24, 0.18, 0.1, 0.05], [0.08, 0.18, 0.27, 0.3], 8, lambda k, i: 'g3' if i % 2 else 'g2', amp=0.05, seed=4)
    # dol hareubang : corps, bras, tête ronde, chapeau, yeux et nez
    sx, sz, sy = 0.46, 0.56, 0.08
    lathe(m, [(0.1, sy), (0.12, sy+0.13), (0.1, sy+0.28), (0.07, sy+0.34)], 8, 'stone', sx, sz, cap_top=True)
    m.box(sx-0.07, sx-0.02, sy+0.15, sy+0.21, sz+0.08, sz+0.13, 'stone_l', skip=('bot',))
    m.box(sx+0.02, sx+0.07, sy+0.15, sy+0.21, sz+0.08, sz+0.13, 'stone_l', skip=('bot',))
    blob(m, sx, sy+0.44, sz, 0.115, 0.115, 0.1, 'stone_l', n=8, lats=(-60, -20, 25, 60))
    cyl(m, sx, sz, sy+0.52, sy+0.55, 0.14, 'stone', n=8)
    cyl(m, sx, sz, sy+0.55, sy+0.66, 0.085, 'stone', 0.045, n=8, caps=(False, True))
    for e in (-1, 1):
        m.poly([(sx+e*0.04-0.016, sy+0.45, sz+0.099), (sx+e*0.04+0.016, sy+0.45, sz+0.099), (sx+e*0.04+0.016, sy+0.49, sz+0.099), (sx+e*0.04-0.016, sy+0.49, sz+0.099)],
               'dark', (sx, sy+0.45, sz-1))
    m.box(sx-0.014, sx+0.014, sy+0.39, sy+0.44, sz+0.092, sz+0.12, 'stone', skip=('bot',))
    # mandariniers
    for (x, z) in ((-0.2, 0.55), (0.12, 0.62)):
        m.beam((x, 0.08, z), (x, 0.2, z), 0.035, 'trunk')
        blob(m, x, 0.3, z, 0.12, 0.1, 0.12, 'leaf', n=6, lats=(-45, 10, 60))
        for (dx, dz) in ((0.09, 0.05), (-0.06, 0.09), (0.0, -0.1)):
            ball(m, x+dx, 0.3+0.02*dz*3, z+dz, 0.03, 'orange')
    return m
