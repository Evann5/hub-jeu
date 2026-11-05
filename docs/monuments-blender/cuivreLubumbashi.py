"""Lubumbashi (RD Congo) : la grande cheminée de fonderie en brique, son panache, le terril de scories et les lingots de cuivre.
Passe 3 (05/11/2026) : panache rond et clair comme la fumée de Naples (plus de cubes gris)."""
import math
from lib import Mesh
from lib_ico import *
from lib_mexique_italie import blob as ico_blob      # boules à facettes de la fumée de Naples

PAL = {'soil': '#C58A5B', 'soil2': '#B27547', 'brick': '#B5543A', 'brick2': '#9A4530', 'band': '#F1ECE2', 'iron': '#7B8087', 'shed': '#A8ADB3', 'shed_d': '#7C828A',
       'roof': '#5A6068', 'slag': '#2E2A2B', 'slag2': '#4A4143', 'cu': '#E0762E', 'cu2': '#F5A05A', 'mal': '#2FA58A', 'dark': '#2A211C',
       's0': '#4F4945', 's1': '#6E6862', 's2': '#928D87', 's3': '#B9B5B0', 's4': '#D8D5D1', 's5': '#ECEAE7'}

TX, TZ = -0.27, -0.28        # terril
CHX, CHZ = 0.46, -0.4       # cheminée


def tcol(k, i):
    if k == 1 and i % 5 == 0:
        return 'mal'
    if k == 2 and i % 4 == 1:
        return 'cu'
    return 'slag' if (k + i) % 2 == 0 else 'slag2'


def fumee(m, puffs):
    """Fumée ronde et claire, comme celle du Vésuve de Naples (volcan.py) : boules à facettes, plus claires vers le haut.
    puffs : [(x, y, z, rayon, couleur de départ 's0'..'s5')]."""
    for (x, y, z, r, c) in puffs:
        def colfn(pts, c=c, r=r, y=y):
            yy = sum(p[1] for p in pts)/len(pts)
            lvl = int(c[1])+(1 if yy > y+r*0.25 else 0)-(1 if yy < y-r*0.45 else 0)
            return 's%d' % max(0, min(5, lvl))
        ico_blob(m, x, y, z, r*1.05, r*0.82, r*1.05, c, 1 if r >= 0.16 else 0, colfn)


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
    cyl(m, CHX, CHZ, 2.45, 2.52, 0.09, 'dark', 0.085, n=10, caps=(False, True))     # lèvre fermée en haut : plus de trou dans la cheminée
    fumee(m, [(CHX+0.0, 2.64, CHZ, 0.11, 's0'), (CHX+0.03, 2.84, CHZ, 0.15, 's1'), (CHX+0.08, 3.06, CHZ, 0.19, 's2'), (CHX+0.15, 3.28, CHZ, 0.2, 's3'),
              (CHX+0.21, 3.44, CHZ, 0.17, 's4'), (CHX-0.04, 2.9, CHZ-0.04, 0.09, 's1'), (CHX+0.1, 3.0, CHZ+0.04, 0.09, 's2')])
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
