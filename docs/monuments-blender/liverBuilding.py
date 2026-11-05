"""Liverpool : le Royal Liver Building, deux tours d'horloge à dômes verts surmontées d'un oiseau, au bord de l'eau."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'ground': '#CFC3A6', 'water': '#2B7FB0', 'wave': '#6FB3D6', 'quay': '#A8A39A', 'stone': '#DCD3BE', 'stone2': '#C4BAA2',
    'win': '#4A5568', 'clock': '#F7F4EA', 'ring': '#C9A748', 'black': '#26231F', 'dome': '#5F9E86', 'dome2': '#4E8A73',
    'bird': '#4F6F5C', 'gold': '#D9A93A', 'dark': '#3A3633',
}
Y0 = 0.04

def clock(m, b, face, u, v, r):
    decal(m, b, face, disc(u, v, r, 12), 'ring', 0.003)
    decal(m, b, face, disc(u, v, r*0.82, 12), 'clock', 0.006)
    decal(m, b, face, rect(u-0.006, u+0.006, v, v+r*0.6), 'black', 0.009)
    decal(m, b, face, rect(u, u+r*0.42, v-0.006, v+0.006), 'black', 0.009)

def bird(m, x, y, z, d):
    """Oiseau aux ailes déployées, tourné vers d (+1 ou -1 selon x)."""
    m.beam((x-d*0.07, y+0.01, z), (x+d*0.04, y+0.05, z), 0.055, 'bird', w1=0.04)         # corps
    m.beam((x+d*0.03, y+0.05, z), (x+d*0.06, y+0.14, z), 0.025, 'bird', w1=0.018)       # cou
    m.beam((x+d*0.05, y+0.14, z), (x+d*0.11, y+0.13, z), 0.02, 'gold', w1=0.006)        # bec
    for sd in (-1, 1):
        m.poly([(x-d*0.02, y+0.04, z+sd*0.01), (x-d*0.07, y+0.1, z+sd*0.1), (x+d*0.02, y+0.06, z+sd*0.1)], 'bird', (x, y-1, z))
        m.poly([(x-d*0.02, y+0.04, z+sd*0.01), (x-d*0.07, y+0.1, z+sd*0.1), (x+d*0.02, y+0.06, z+sd*0.1)], 'bird', (x, y+1, z))

def tower(m, cx):
    H = 0.15
    cz = -0.02
    b = B(cx-H, cx+H, Y0, 1.55, cz-H, cz+H)
    box(m, b, 'stone')
    for r in range(5):
        for u in (-0.07, 0.07):
            decal(m, b, 'pz', rect(u-0.025, u+0.025, 0.12+r*0.25, 0.26+r*0.25), 'win', 0.003)
    m.box(cx-H-0.02, cx+H+0.02, 1.55, 1.6, cz-H-0.02, cz+H+0.02, 'stone2', skip=('bot',))
    st = B(cx-H, cx+H, 1.6, 1.98, cz-H, cz+H)
    box(m, st, 'stone')
    for face in ('pz', 'nz', 'px', 'nx'):
        clock(m, st, face, 0.0, 1.79, 0.1)
    m.box(cx-H-0.02, cx+H+0.02, 1.98, 2.03, cz-H-0.02, cz+H+0.02, 'stone2', skip=('bot',))
    lathe(m, [(0.13, 2.03), (0.13, 2.14), (0.15, 2.15)], 8, ['stone', 'stone2'], cx, cz, 0.39)
    lathe(m, [(0.15, 2.15), (0.17, 2.17), (0.15, 2.2), (0.09, 2.34), (0.03, 2.44), (0.0, 2.46)], 8,
          ['dome', 'dome2', 'dome', 'dome2', 'dome'], cx, cz, 0.39)
    bird(m, cx, 2.46, cz, -1 if cx < 0 else 1)

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.88, 0.88, 'ground', skip=('bot',))
    # eau et quai
    m.box(-0.88, 0.88, 0.0, Y0, 0.32, 0.88, 'water', skip=('bot',))
    m.box(-0.88, 0.88, 0.0, Y0+0.03, 0.2, 0.32, 'quay', skip=('bot',))
    for k in range(5):
        m.box(-0.75+k*0.35, -0.5+k*0.35, Y0, Y0+0.012, 0.5+(k % 2)*0.2, 0.52+(k % 2)*0.2, 'wave', skip=('bot',))
    # bloc central
    ctr = B(-0.5, 0.5, Y0, 1.0, -0.17, 0.13)
    box(m, ctr, 'stone')
    for r in range(4):
        for k in range(7):
            u = -0.38+k*0.127
            if abs(u) < 0.1 and r == 0:
                continue
            decal(m, ctr, 'pz', rect(u-0.03, u+0.03, 0.14+r*0.2, 0.26+r*0.2), 'win', 0.003)
    decal(m, ctr, 'pz', round_arch(0.0, Y0, 0.16, 0.07, 5), 'dark', 0.003)
    m.box(-0.52, 0.52, 1.0, 1.05, -0.19, 0.15, 'stone2', skip=('bot',))
    lathe(m, [(0.0, 1.05), (0.0, 1.05)], 4, 'stone')
    tower(m, -0.4)
    tower(m, 0.4)
    # tourelle centrale basse
    m.box(-0.12, 0.12, 1.05, 1.2, -0.1, 0.06, 'stone', skip=('bot',))
    hip(m, -0.14, 0.14, -0.12, 0.08, 1.2, 0.1, 'dome')
    return m
