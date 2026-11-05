"""Londres : la tour de l'horloge (Big Ben), le palais de Westminster et un bus rouge à impériale."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'ground': '#CFC3A6', 'road': '#4A5568', 'kerb': '#B8B2A4', 'line': '#F2EFE6', 'sand': '#D3BD8C', 'sand2': '#B9A272',
    'win': '#3F4A5C', 'clock': '#F7F4EA', 'ring': '#C9A748', 'black': '#26231F', 'slate': '#5E6A66', 'gold': '#D9A93A',
    'bus': '#C6322C', 'bus2': '#A82A25', 'glass': '#2F3B4D', 'wheel': '#26231F', 'river': '#4F8FB0', 'dark': '#3A3633',
}
Y0 = 0.04

def clock(m, b, face, u, v, r):
    decal(m, b, face, disc(u, v, r, 14), 'ring', 0.003)
    decal(m, b, face, disc(u, v, r*0.84, 14), 'clock', 0.006)
    decal(m, b, face, rect(u-0.007, u+0.007, v, v+r*0.62), 'black', 0.009)
    decal(m, b, face, rect(u, u+r*0.45, v-0.007, v+0.007), 'black', 0.009)

def bus(m, x0, z0, L=0.46, W=0.17):
    x1, z1 = x0+L, z0+W
    lo = B(x0, x1, Y0+0.03, 0.17, z0, z1)
    box(m, lo, 'bus')
    up = B(x0+0.01, x1-0.01, 0.17, 0.28, z0+0.005, z1-0.005)
    box(m, up, 'bus')
    m.box(x0, x1, 0.28, 0.295, z0, z1, 'bus2', skip=('bot',))
    for face, bb in (('pz', up), ('nz', up)):
        for k in range(5):
            u = -0.17+k*0.085
            decal(m, bb, face, rect(u-0.03, u+0.03, 0.2, 0.26), 'glass', 0.003)
    for face in ('pz', 'nz'):
        for k in range(4):
            u = -0.15+k*0.085
            decal(m, lo, face, rect(u-0.03, u+0.03, 0.11, 0.15), 'glass', 0.003)
    decal(m, up, 'px', rect(-0.06, 0.06, 0.2, 0.26), 'glass', 0.003)
    decal(m, lo, 'px', rect(-0.06, 0.06, 0.11, 0.15), 'glass', 0.003)
    for wx in (x0+0.09, x1-0.09):
        for wz in (z0-0.005, z1-0.03):
            m.box(wx-0.035, wx+0.035, Y0, 0.1, wz, wz+0.035, 'wheel', skip=('bot',))

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.88, 0.88, 'ground', skip=('bot',))
    # route, trottoir, lignes
    m.box(-0.88, 0.88, Y0, Y0+0.008, 0.18, 0.62, 'road', skip=('bot',))
    m.box(-0.88, 0.88, Y0, Y0+0.02, 0.12, 0.18, 'kerb', skip=('bot',))
    for k in range(6):
        m.box(-0.8+k*0.3, -0.6+k*0.3, Y0+0.008, Y0+0.012, 0.395, 0.405, 'line', skip=('bot',))
    m.box(-0.88, 0.88, 0.0, Y0, 0.62, 0.88, 'river', skip=('bot',))
    # tour de l'horloge
    TX, TZ, H = -0.5, -0.1, 0.17
    sh = B(TX-H, TX+H, Y0, 1.3, TZ-H, TZ+H)
    box(m, sh, 'sand')
    for (sx, sz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        cx = TX+sx*H; cz = TZ+sz*H
        m.box(cx-0.025, cx+0.025, Y0, 1.3, cz-0.025, cz+0.025, 'sand2', skip=('bot',))
    for face in ('pz', 'px', 'nz', 'nx'):
        for v0 in (0.2, 0.55, 0.9):
            decal(m, sh, face, pointed_arch(0.0, v0, v0+0.18, 0.035, 3), 'win', 0.004)
    m.box(TX-H-0.03, TX+H+0.03, 1.3, 1.36, TZ-H-0.03, TZ+H+0.03, 'sand2', skip=('bot',))
    ck = B(TX-H-0.01, TX+H+0.01, 1.36, 1.84, TZ-H-0.01, TZ+H+0.01)
    box(m, ck, 'sand')
    for face in ('pz', 'px', 'nz', 'nx'):
        clock(m, ck, face, 0.0, 1.6, 0.135)
    m.box(TX-H-0.04, TX+H+0.04, 1.84, 1.9, TZ-H-0.04, TZ+H+0.04, 'sand2', skip=('bot',))
    bl = B(TX-H+0.01, TX+H-0.01, 1.9, 2.12, TZ-H+0.01, TZ+H-0.01)
    box(m, bl, 'sand')
    for face in ('pz', 'px', 'nz', 'nx'):
        decal(m, bl, face, pointed_arch(0.0, 1.94, 2.04, 0.04, 3), 'win', 0.004)
    for (sx, sz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        cx = TX+sx*(H+0.01); cz = TZ+sz*(H+0.01)
        pyramid(m, cx, cz, 0.025, 2.12, 0.15, 'sand2')
    hip(m, TX-H-0.01, TX+H+0.01, TZ-H-0.01, TZ+H+0.01, 2.12, 0.62, 'slate')
    m.beam((TX, 2.7, TZ), (TX, 2.86, TZ), 0.02, 'gold', w1=0.01)
    ball(m, TX, 2.87, TZ, 0.03, 'gold')
    # palais de Westminster
    wing = B(-0.3, 0.86, Y0, 0.36, -0.42, 0.0)
    box(m, wing, 'sand')
    m.box(-0.32, 0.88, 0.36, 0.4, -0.44, 0.02, 'sand2', skip=('bot',))
    hip(m, -0.3, 0.86, -0.42, 0.0, 0.4, 0.1, 'slate', 0.14)
    for r in range(2):
        for k in range(8):
            u = -0.48+k*0.14
            decal(m, wing, 'pz', pointed_arch(u, 0.1+r*0.14, 0.15+r*0.14, 0.025, 3), 'win', 0.004)
    for x in (-0.18, 0.74):
        tb = B(x-0.08, x+0.08, Y0, 0.62, -0.3, -0.14)
        box(m, tb, 'sand')
        pyramid(m, x, -0.22, 0.09, 0.62, 0.2, 'slate')
        decal(m, tb, 'pz', pointed_arch(0.0, 0.3, 0.42, 0.03, 3), 'win', 0.004)
    bus(m, 0.1, 0.24)
    return m
