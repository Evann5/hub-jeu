"""Lubumbashi (RD Congo) : la grande cheminée de fonderie en brique, son panache, le terril de scories et les lingots de cuivre."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'soil': '#C58A5B', 'soil2': '#B27547', 'brick': '#B5543A', 'brick2': '#9A4530', 'band': '#F1ECE2', 'iron': '#7B8087', 'shed': '#A8ADB3', 'shed_d': '#7C828A',
       'roof': '#5A6068', 'slag': '#2E2A2B', 'slag2': '#4A4143', 'cu': '#E0762E', 'cu2': '#F5A05A', 'mal': '#2FA58A', 'dark': '#2A211C',
       's0': '#6A6664', 's1': '#8B8785', 's2': '#ABA8A6', 's3': '#CAC8C6', 's4': '#E6E4E2'}

TX, TZ = -0.27, -0.28        # terril
CHX, CHZ = 0.46, -0.4       # cheminée


def tcol(k, i):
    if k == 1 and i % 5 == 0:
        return 'mal'
    if k == 2 and i % 4 == 1:
        return 'cu'
    return 'slag' if (k + i) % 2 == 0 else 'slag2'


def build():
    m = Mesh(PAL)
    plate(m, 'soil', 0.04)
    for (x, z, w, d) in ((0.1, 0.78, 0.5, 0.06), (-0.7, 0.2, 0.3, 0.05), (0.7, 0.35, 0.22, 0.05)):
        m.box(x-w/2, x+w/2, 0.04, 0.046, z-d, z+d, 'soil2', skip=('bot',))
    # terril : cône tronqué de scories noires, veines de malachite verte et de cuivre
    rings = cone(m, TX, TZ, [0.56, 0.47, 0.37, 0.27, 0.2], [0.04, 0.3, 0.55, 0.76, 0.84], 11, tcol, amp=0.07, seed=5)
    m.poly(rings[-1], 'slag2', (TX, 0, TZ))
    # cheminée en brique, bagues blanches, lèvre noire
    cyl(m, CHX, CHZ, 0.04, 0.12, 0.17, 'brick2', 0.14, n=10, caps=(False, False))
    cyl(m, CHX, CHZ, 0.12, 2.45, 0.14, 'brick', 0.075, n=10, caps=(False, False))
    for (ya, yb, r) in ((1.95, 2.05, 0.087), (2.2, 2.28, 0.0795)):
        cyl(m, CHX, CHZ, ya, yb, r, 'band', n=10, caps=(False, False))
    cyl(m, CHX, CHZ, 2.45, 2.52, 0.09, 'dark', 0.085, n=10, caps=(False, False))
    smoke(m, [(CHX+0.0, 2.6, CHZ, 0.1), (CHX+0.04, 2.78, CHZ, 0.14), (CHX+0.1, 2.98, CHZ, 0.16), (CHX+0.18, 3.14, CHZ, 0.15), (CHX+0.27, 3.26, CHZ, 0.12)],
          ['s0', 's1', 's2', 's3', 's4'])
    # halle de fonderie à toit en dents de scie
    m.box(0.02, 0.8, 0.04, 0.4, -0.02, 0.5, 'shed', skip=('bot', 'top'))
    for k in range(3):
        z0 = -0.02+0.17*k
        gable(m, 0.0, 0.82, z0, z0+0.17, 0.4, 0.1, 'roof', 'shed_d', 'x')
    m.box(0.3, 0.46, 0.04, 0.26, 0.5, 0.504, 'dark', skip=('bot',))
    cyl(m, 0.6, 0.62, 0.04, 0.42, 0.12, 'iron', n=8)
    # lingots de cuivre empilés
    for k, n in enumerate((4, 3, 2)):
        for j in range(n):
            x = -0.6+0.16*j+0.08*k
            m.box(x, x+0.14, 0.04+0.07*k, 0.11+0.07*k, 0.5, 0.64, 'cu' if (j+k) % 2 == 0 else 'cu2', skip=('bot',))
    # convoyeur incliné jusqu'au sommet du terril
    m.beam((0.0, 0.4, -0.02), (TX+0.1, 0.85, TZ+0.08), 0.06, 'iron')
    return m
