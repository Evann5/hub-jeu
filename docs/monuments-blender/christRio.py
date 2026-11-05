"""Rio de Janeiro : le Corcovado, montagne verte et rocheuse, statue blanche aux bras ouverts (silhouette simple), baie devant."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'sea': '#3E92B8', 'foam': '#EAF6F8', 'sand': '#F0DDA6', 'g1': '#7C9A5E', 'g2': '#6A8A52', 'g3': '#93AF70', 'rock': '#8A8F7E',
       'rock2': '#A7AB98', 'ped': '#CFC8B8', 'ped2': '#B7AF9C', 'stat': '#F3F4EE', 'stat2': '#D9DBD2', 'tree': '#4F7A45'}


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.04, -0.88, 0.88, 'sea', skip=('bot',))
    for (x0, x1, z0) in ((-0.7, -0.2, 0.74), (0.1, 0.6, 0.8)):
        m.box(x0, x1, 0.04, 0.046, z0, z0+0.035, 'foam', skip=('bot',))
    m.box(-0.88, 0.88, 0.04, 0.1, -0.88, 0.42, 'sand', skip=('bot',))
    cz = -0.1
    cyl(m, 0, cz, 0.1, 0.28, 0.76, 'g2', r1=0.68, n=9, col_top='g1')
    cyl(m, 0, cz, 0.28, 0.62, 0.66, 'g1', r1=0.5, n=9, col_top='g3')
    cyl(m, 0, cz, 0.62, 0.95, 0.46, 'rock', r1=0.3, n=9, col_top='rock2')
    cyl(m, 0, cz, 0.95, 1.12, 0.28, 'rock2', r1=0.2, n=9, col_top='ped2')
    # quelques arbres au flanc
    for (x, z, s) in ((-0.5, 0.25, 1.0), (0.46, 0.3, 0.9), (-0.22, 0.4, 0.8), (0.12, 0.38, 0.8)):
        blob(m, x, 0.17, z, 0.11*s, 0.09*s, 0.11*s, 'tree', n=6, lats=(-50, 0, 50), col2='g3')
    # le Pain de Sucre, dôme de roche dans la baie
    lathe(m, -0.62, 0.42, [(0.27, 0.04), (0.27, 0.16), (0.24, 0.36), (0.16, 0.54), (0.06, 0.68), (0.0, 0.72)], 9, lambda k, i: 'rock2' if (k+i) % 2 else 'rock')
    cyl(m, -0.62, 0.42, 0.5, 0.6, 0.12, 'g1', r1=0.07, n=9)
    # piédestal et statue (silhouette simple, sans visage)
    tbox(m, 0, cz, 1.12, 1.42, 0.17, 0.14, 0.11, 0.1, 'ped', col_top='ped2')
    m.box(-0.03, 0.03, 1.2, 1.34, cz+0.1, cz+0.112, 'ped2', skip=('bot', 'nz'))
    cyl(m, 0, cz, 1.42, 1.96, 0.16, 'stat', r1=0.085, n=6, col_top='stat2')        # robe
    m.box(-0.17, 0.17, 1.88, 1.99, cz-0.07, cz+0.07, 'stat', skip=('bot',))         # épaules
    rod(m, (-0.12, 1.94, cz), (-0.52, 1.82, cz), 0.15, 'stat', w1=0.09)            # bras
    rod(m, (0.12, 1.94, cz), (0.52, 1.82, cz), 0.15, 'stat2', w1=0.09)
    ball(m, 0, 2.09, cz, 0.1, 'stat', n=7)
    return m
