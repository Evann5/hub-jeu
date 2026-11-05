"""Alexandrie : la citadelle de Qaitbay, forteresse carrée de pierre claire sur son promontoire au bord de la mer."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'sea': '#2B8FBC', 'sea2': '#4FB2D2', 'foam': '#EAF6F8', 'rock': '#A08A68', 'rock2': '#B9A27C', 'sand': '#E6D29C',
       'stone': '#EEE2C0', 'stone2': '#D9C99C', 'stone3': '#C2AE80', 'dark': '#3B342B', 'green': '#2EA58C', 'greend': '#1E7C69', 'gold': '#E3B03A'}
Y0 = 0.15


def merlons(m, x0, x1, z0, z1, y, h=0.06, step=0.125):
    """Créneaux le long d'un côté (x0..x1 à z fixe ou z0..z1 à x fixe)."""
    if abs(z1-z0) < 1e-6:
        n = int((x1-x0)/step)
        for i in range(n+1):
            x = x0+(x1-x0)*i/n
            m.box(x-0.03, x+0.03, y, y+h, z0-0.03, z0+0.03, 'stone', skip=('bot',))
    else:
        n = int((z1-z0)/step)
        for i in range(n+1):
            z = z0+(z1-z0)*i/n
            m.box(x0-0.03, x0+0.03, y, y+h, z-0.03, z+0.03, 'stone', skip=('bot',))


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.04, -0.88, 0.88, 'sea', skip=('bot',))
    for (x0, x1, z0) in ((-0.8, -0.35, 0.8), (0.2, 0.7, 0.74), (-0.7, -0.25, -0.82)):
        m.box(x0, x1, 0.04, 0.047, z0, z0+0.035, 'foam', skip=('bot',))
    # promontoire rocheux
    cyl(m, 0, 0, 0.04, Y0, 0.84, 'rock', r1=0.78, n=8, rot=math.pi/8, col_top='sand')
    tbox(m, 0.72, 0.62, 0.04, 0.12, 0.1, 0.1, 0.06, 0.06, 'rock2')
    tbox(m, -0.7, 0.66, 0.04, 0.1, 0.12, 0.08, 0.07, 0.05, 'rock2')
    # mur d'enceinte et créneaux
    sbox(m, -0.62, 0.62, Y0, 0.46, -0.62, 0.62, 'stone', 'stone2')
    for z in (-0.6, 0.6):
        merlons(m, -0.45, 0.45, z, z, 0.46)
    for x in (-0.6, 0.6):
        merlons(m, x, x, -0.45, 0.45, 0.46)
    decal(m, 'pz', -0.08, 0.08, Y0, Y0+0.19, 0.623, 'dark')
    decal(m, 'pz', -0.1, 0.1, Y0+0.19, Y0+0.23, 0.623, 'stone3')
    # quatre tours d'angle rondes
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx*0.62, sz*0.62
            cyl(m, x, z, Y0, 0.66, 0.16, 'stone', r1=0.15, n=8, col_top='stone2')
            cyl(m, x, z, 0.58, 0.66, 0.175, 'stone3', n=8, col_top='stone2')
            cyl(m, x, z, 0.66, 0.74, 0.1, 'stone', n=8, col_top='stone2')
    # donjon carré à deux étages, petite coupole
    sbox(m, -0.32, 0.32, 0.46, 1.1, -0.32, 0.32, 'stone', 'stone2')
    for u in (-0.17, 0.0, 0.17):
        decal(m, 'pz', u-0.03, u+0.03, 0.7, 0.84, 0.323, 'dark')
        decal(m, 'pz', u-0.03, u+0.03, 0.92, 1.0, 0.323, 'dark')
    decal(m, 'pz', -0.32, 0.32, 0.6, 0.64, 0.323, 'stone3')
    sbox(m, -0.2, 0.2, 1.1, 1.4, -0.2, 0.2, 'stone', 'stone2')
    for u in (-0.08, 0.08):
        decal(m, 'pz', u-0.03, u+0.03, 1.2, 1.32, 0.203, 'dark')
    for sx in (-1, 1):
        for sz in (-1, 1):
            cyl(m, sx*0.32, sz*0.32, 1.1, 1.26, 0.05, 'stone', r1=0.045, n=6, col_top='stone3')
    cyl(m, 0, 0, 1.4, 1.46, 0.15, 'stone3', n=8)
    dome(m, 0, 0, 1.46, 0.12, 'green', n=8, ry=0.13, colfn=lambda k, i: 'green' if i % 2 == 0 else 'greend')
    ball(m, 0, 1.63, 0, 0.025, 'gold', n=6)
    return m
