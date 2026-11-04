"""Coimbra : la tour de l'université, blanche, horloge, beffroi et toit rouge, entre deux ailes à toit de tuiles."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'white': '#F2EEE4', 'stone': '#D6C7A2', 'stone2': '#BDAE88', 'red': '#B5402F', 'red2': '#9A3326', 'clock': '#F7F4EA',
    'ring': '#C9A748', 'dark': '#3A3633', 'win': '#4A5568', 'gold': '#D9A93A', 'ground': '#CFC3A6', 'step': '#E4DAC2',
    'black': '#26231F',
}
Y0 = 0.04

def clock(m, b, face, u, v, r):
    decal(m, b, face, disc(u, v, r, 14), 'ring', 0.003)
    decal(m, b, face, disc(u, v, r*0.82, 14), 'clock', 0.006)
    decal(m, b, face, rect(u-0.006, u+0.006, v, v+r*0.62), 'black', 0.009)
    decal(m, b, face, rect(u, u+r*0.45, v-0.006, v+0.006), 'black', 0.009)

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.62, 0.62, 'ground', skip=('bot',))
    # marches
    for k in range(3):
        m.box(-0.3-0.04*k, 0.3+0.04*k, Y0, Y0+0.03*(3-k), 0.3, 0.3+0.1*(k+1), 'step', skip=('bot', 'nz'))
    # ---------- ailes ----------
    for sd in (-1, 1):
        x0, x1 = (0.2, 0.85) if sd > 0 else (-0.85, -0.2)
        w = B(x0, x1, Y0, 0.56, -0.2, 0.3)
        box(m, w, 'white')
        m.box(x0-0.02, x1+0.02, 0.56, 0.6, -0.22, 0.32, 'stone', skip=('bot',))
        hip(m, x0-0.03, x1+0.03, -0.25, 0.35, 0.6, 0.2, 'red', 0.08)
        uc = 0.0
        for k in range(3):
            u = -0.2+0.2*k
            for (v0) in (Y0+0.06, 0.34):
                decal(m, w, 'pz', rect(u-0.04, u+0.04, v0, v0+0.12), 'stone', 0.003)
                decal(m, w, 'pz', rect(u-0.03, u+0.03, v0+0.01, v0+0.11), 'win', 0.006)
        for k in range(2):
            u = 0.0
    # ---------- tour ----------
    TX, TZ, H = 0.0, 0.1, 0.2
    base = B(TX-H, TX+H, Y0, 0.92, TZ-H, TZ+H)
    box(m, base, 'white')
    # chaînes d'angle en pierre
    for (sx, sz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        m.box(TX+sx*H-0.025 if sx < 0 else TX+sx*H-0.02, TX+sx*H+0.02 if sx > 0 else TX+sx*H+0.025,
              Y0, 2.0, TZ+sz*H-0.025 if sz < 0 else TZ+sz*H-0.02, TZ+sz*H+0.02 if sz > 0 else TZ+sz*H+0.025, 'stone', skip=('bot',))
    decal(m, base, 'pz', round_arch(0, Y0, 0.2, 0.06, 5), 'stone', 0.01)
    decal(m, base, 'pz', round_arch(0, Y0, 0.2, 0.048, 5), 'dark', 0.013)
    decal(m, base, 'pz', rect(-0.05, 0.05, 0.42, 0.68), 'stone', 0.01)
    decal(m, base, 'pz', rect(-0.038, 0.038, 0.435, 0.665), 'win', 0.013)
    m.box(TX-H-0.03, TX+H+0.03, 0.92, 0.98, TZ-H-0.03, TZ+H+0.03, 'stone', skip=('bot',))
    st2 = B(TX-H, TX+H, 0.98, 1.5, TZ-H, TZ+H)
    box(m, st2, 'white')
    for face in ('pz', 'px', 'nx'):
        clock(m, st2, face, 0.0, 1.24, 0.12)
    m.box(TX-H-0.03, TX+H+0.03, 1.5, 1.56, TZ-H-0.03, TZ+H+0.03, 'stone', skip=('bot',))
    bel = B(TX-H, TX+H, 1.56, 2.0, TZ-H, TZ+H)
    box(m, bel, 'white')
    for face in ('pz', 'px', 'nx', 'nz'):
        decal(m, bel, face, round_arch(0, 1.62, 1.84, 0.08, 5), 'stone', 0.003)
        decal(m, bel, face, round_arch(0, 1.64, 1.84, 0.065, 5), 'dark', 0.006)
    # balustrade et pinacles
    m.box(TX-H-0.03, TX+H+0.03, 2.0, 2.06, TZ-H-0.03, TZ+H+0.03, 'stone', skip=('bot',))
    for (sx, sz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        cx, cz = TX+sx*(H+0.0), TZ+sz*(H+0.0)
        m.box(cx-0.03, cx+0.03, 2.06, 2.14, cz-0.03, cz+0.03, 'stone', skip=('bot',))
        pyramid(m, cx, cz, 0.03, 2.14, 0.06, 'stone')
    # lanterne et toit rouge
    L = 0.14
    lt = B(TX-L, TX+L, 2.06, 2.3, TZ-L, TZ+L)
    box(m, lt, 'white')
    for face in ('pz', 'px', 'nx', 'nz'):
        decal(m, lt, face, round_arch(0, 2.12, 2.22, 0.05, 4), 'dark', 0.003)
    m.box(TX-L-0.02, TX+L+0.02, 2.3, 2.35, TZ-L-0.02, TZ+L+0.02, 'stone', skip=('bot',))
    rings = []
    for (hh, y) in ((0.17, 2.35), (0.15, 2.4), (0.1, 2.5), (0.05, 2.6), (0.02, 2.66)):
        rings.append([(TX-hh, y, TZ-hh), (TX+hh, y, TZ-hh), (TX+hh, y, TZ+hh), (TX-hh, y, TZ+hh)])
    for k in range(len(rings)-1):
        m.band(rings[k], rings[k+1], 'red' if k % 2 == 0 else 'red2', (TX, 2.5, TZ))
    m.beam((TX, 2.64, TZ), (TX, 2.78, TZ), 0.014, 'gold', w1=0.008)
    ball(m, TX, 2.7, TZ, 0.03, 'gold')
    return m
