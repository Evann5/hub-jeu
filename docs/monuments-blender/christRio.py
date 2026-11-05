"""Rio de Janeiro : le Corcovado, montagne verte et rocheuse, statue blanche aux bras ouverts (silhouette simple), baie devant."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'sea': '#2D93C0', 'foam': '#EAF6F8', 'sand': '#F0DDA6', 'g1': '#4FA55A', 'g2': '#3E8F4D', 'g3': '#6DBE63', 'rock': '#8A8F7E',
       'rock2': '#A7AB98', 'ped': '#CFC8B8', 'ped2': '#B7AF9C', 'stat': '#F3F4EE', 'stat2': '#D9DBD2', 'tree': '#2F7A43'}


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
    # piédestal et statue
    tbox(m, 0, cz, 1.12, 1.4, 0.14, 0.12, 0.1, 0.09, 'ped', col_top='ped2')
    cyl(m, 0, cz, 1.4, 1.98, 0.11, 'stat', r1=0.065, n=6, col_top='stat2')       # corps en robe
    rod(m, (0, 1.92, cz), (-0.5, 1.74, cz), 0.1, 'stat', w1=0.06)                # bras gauche
    rod(m, (0, 1.92, cz), (0.5, 1.74, cz), 0.1, 'stat2', w1=0.06)                # bras droit
    ball(m, 0, 2.06, cz, 0.075, 'stat', n=7)
    return m
