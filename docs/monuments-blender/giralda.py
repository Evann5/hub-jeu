"""Séville : la Giralda, haute tour carrée de brique ocre aux panneaux ouvragés, clocheton et statue au sommet."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'ground': '#D9C9A5', 'brick': '#C9985A', 'brick2': '#B5834A', 'panel': '#E3C28A', 'stone': '#E8DCC0', 'dark': '#3A3633',
    'win': '#4A5568', 'copper': '#9A7B4F', 'gold': '#D9A93A', 'roof': '#B5402F', 'leaf': '#4E8F3A', 'orange': '#E8892B',
    'trunk': '#6A4528', 'nave': '#DCCDA8',
}
Y0 = 0.04

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.7, 0.7, 'ground', skip=('bot',))
    # nef de la cathédrale, à gauche
    nv = B(-0.88, -0.3, Y0, 0.5, -0.5, 0.45)
    box(m, nv, 'nave')
    gable(m, -0.9, -0.28, -0.52, 0.47, 0.5, 0.2, 'roof', 'x', 'nave')
    for u in (-0.3, 0.0, 0.3):
        decal(m, nv, 'pz', round_arch(u*0.8, 0.14, 0.32, 0.05, 4), 'win', 0.004)
    # tour : fût
    H = 0.2
    sh = B(-H+0.05, H+0.05, Y0, 1.6, -H, H)
    box(m, sh, 'brick')
    for (sx, sz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        cx = sh.cx+sx*H*0.96; cz = sh.cz+sz*H*0.96
        m.box(cx-0.025, cx+0.025, Y0, 1.6, cz-0.025, cz+0.025, 'brick2', skip=('bot',))
    for face in ('pz', 'px', 'nz', 'nx'):
        for (v0, v1) in ((0.25, 0.6), (0.7, 1.05), (1.15, 1.5)):
            decal(m, sh, face, rect(-0.13, -0.03, v0, v1), 'panel', 0.003)
            decal(m, sh, face, rect(0.03, 0.13, v0, v1), 'panel', 0.003)
        decal(m, sh, face, rect(-0.02, 0.02, 0.4, 0.55), 'win', 0.004)
        decal(m, sh, face, rect(-0.02, 0.02, 0.85, 1.0), 'win', 0.004)
    m.box(sh.x0-0.02, sh.x1+0.02, 1.6, 1.65, sh.z0-0.02, sh.z1+0.02, 'stone', skip=('bot',))
    # beffroi
    bl = B(sh.x0+0.02, sh.x1-0.02, 1.65, 2.02, sh.z0+0.02, sh.z1-0.02)
    box(m, bl, 'brick')
    for face in ('pz', 'px', 'nz', 'nx'):
        decal(m, bl, face, round_arch(-0.08, 1.7, 1.86, 0.045, 4), 'dark', 0.004)
        decal(m, bl, face, round_arch(0.08, 1.7, 1.86, 0.045, 4), 'dark', 0.004)
    m.box(sh.x0-0.01, sh.x1+0.01, 2.02, 2.07, sh.z0-0.01, sh.z1+0.01, 'stone', skip=('bot',))
    # couronnement renaissance : deux étages qui se resserrent
    cx, cz = sh.cx, sh.cz
    t1 = B(cx-0.14, cx+0.14, 2.07, 2.3, cz-0.14, cz+0.14)
    box(m, t1, 'stone')
    for face in ('pz', 'px', 'nz', 'nx'):
        decal(m, t1, face, round_arch(0, 2.12, 2.2, 0.05, 4), 'dark', 0.004)
    m.box(cx-0.16, cx+0.16, 2.3, 2.34, cz-0.16, cz+0.16, 'brick2', skip=('bot',))
    lathe(m, [(0.1, 2.34), (0.1, 2.5), (0.13, 2.52), (0.13, 2.56)], 8, ['stone', 'stone', 'stone'], cx, cz)
    lathe(m, [(0.13, 2.56), (0.09, 2.62), (0.07, 2.72), (0.03, 2.84), (0.0, 2.9)], 8, ['copper', 'copper', 'copper', 'copper'], cx, cz)
    m.beam((cx, 2.88, cz), (cx, 3.0, cz), 0.025, 'gold', w1=0.012)
    ball(m, cx, 3.02, cz, 0.035, 'gold')
    # orangers
    for (x, z) in ((0.55, 0.3), (0.7, -0.2), (0.5, -0.45)):
        lathe(m, [(0.02, Y0), (0.02, 0.14)], 4, 'trunk', x, z)
        ball(m, x, 0.23, z, 0.1, 'leaf', 6)
        ball(m, x+0.06, 0.26, z+0.07, 0.025, 'orange', 4)
    return m
