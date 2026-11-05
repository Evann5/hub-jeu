"""Goma (RD Congo) : le volcan Nyiragongo qui fume, coulée de lave rouge, forêt sur les pentes, lac Kivu au premier plan."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'lake': '#2D8FB5', 'lake2': '#5BB8D0', 'beach': '#3A3330', 'land': '#5E9B45', 'forest': '#3E7F3A', 'forest2': '#336A38',
       'r1': '#4A3F3A', 'r2': '#5A4C44', 'r3': '#6A5A50', 'ash': '#2E2826', 'lava': '#F2552A', 'lava2': '#FFB02E',
       's0': '#4F4A48', 's1': '#6C6866', 's2': '#8B8886', 's3': '#AAA8A6', 's4': '#C8C6C4', 's5': '#E2E0DE',
       'h1': '#F4EBD6', 'h2': '#E8B15C', 'h3': '#E58C80', 'roof': '#B5402F', 'hull': '#F4F0E6'}

LAND = [(-0.88, -0.88), (0.88, -0.88), (0.88, 0.45), (0.5, 0.55), (0.1, 0.42), (-0.35, 0.58), (-0.88, 0.46)]
SHORE = [(-0.88, -0.88), (0.88, -0.88), (0.88, 0.53), (0.5, 0.63), (0.1, 0.5), (-0.35, 0.66), (-0.88, 0.54)]
CX, CZ = 0.0, -0.26
RS = [0.62, 0.54, 0.42, 0.3, 0.22, 0.17]
YS = [0.09, 0.36, 0.78, 1.18, 1.46, 1.6]
N = 14


def colfn(k, i):
    if i in (3, 4) and k >= 2:          # coulée de lave vers l'avant
        return 'lava' if (i + k) % 2 == 0 else 'lava2'
    if k == 0:
        return 'forest' if i % 2 else 'forest2'
    if k == 1:
        return 'forest2' if i % 3 == 0 else 'r1'
    return ('r1', 'r2', 'r3', 'r2')[(k + i) % 4]


def build():
    m = Mesh(PAL)
    plate(m, 'lake', 0.05)
    prism_xz(m, SHORE, 0.05, 0.062, 'lake2', 'lake2')
    prism_xz(m, LAND, 0.05, 0.09, 'beach', 'land')
    rings = cone(m, CX, CZ, RS, YS, N, colfn, amp=0.07, seed=2)
    top = rings[-1]
    inner = [(CX+(p[0]-CX)*0.7, p[1]-0.05, CZ+(p[2]-CZ)*0.7) for p in top]
    low = [(CX+(p[0]-CX)*0.5, 1.46, CZ+(p[2]-CZ)*0.5) for p in top]
    lid(m, top, inner, 'ash', CX, CZ)
    crater_wall(m, inner, low, 'ash', CX, CZ)
    m.poly(low, 'lava', (CX, 0, CZ))
    # panache qui dérive vers la droite
    puffs = [(0.0, 1.72, -0.26, 0.11), (0.03, 1.88, -0.26, 0.15), (0.1, 2.08, -0.25, 0.19), (0.22, 2.28, -0.24, 0.21), (0.38, 2.44, -0.22, 0.19), (0.55, 2.54, -0.2, 0.14)]
    smoke(m, puffs, ['s0', 's1', 's2', 's3', 's4', 's5'])
    # petites maisons au bord du lac
    for k, (x, c, rc) in enumerate(((-0.76, 'h1', 'roof'), (-0.6, 'h2', 'roof'), (0.62, 'h3', 'roof'), (0.77, 'h1', 'roof'))):
        z = 0.3
        house(m, x-0.07, x+0.07, z-0.06, z+0.06, 0.09, 0.1, c, rc, 'ash', pitched=True, rh=0.05)
    # pirogue-bateau
    m.box(-0.2, 0.0, 0.062, 0.1, 0.72, 0.8, 'hull', skip=('bot',))
    return m
