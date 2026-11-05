"""Oran : le fort de Santa Cruz, perché sur sa montagne au-dessus de la baie, chapelle blanche à côté, maisons au pied."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'sea': '#2B8FBC', 'foam': '#EAF6F8', 'sand': '#EAD6A2', 'g1': '#74B058', 'g2': '#5B9846', 'rock': '#A08A6A', 'rock2': '#B7A07E',
       'wall': '#F4E8CC', 'wall2': '#DCC9A0', 'roof': '#C8553A', 'white': '#FFFFFF', 'dark': '#3C342B', 'path': '#D9C190',
       'h1': '#F7EEDA', 'h2': '#F0D9A8', 'h3': '#E8B98C', 'cross': '#F4F0E4'}
CX, CZ = 0.05, -0.15


def maison(m, x, z, hw, hd, h, col, rcol='roof'):
    sbox(m, x-hw, x+hw, 0.1, 0.1+h, z-hd, z+hd, col, col)
    gable(m, x-hw-0.01, x+hw+0.01, z-hd-0.01, z+hd+0.01, 0.1+h, 0.09, rcol, col, ridge='x')


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.04, -0.88, 0.88, 'sea', skip=('bot',))
    for (x0, x1, z0) in ((-0.78, -0.3, 0.76), (0.15, 0.7, 0.8)):
        m.box(x0, x1, 0.04, 0.046, z0, z0+0.035, 'foam', skip=('bot',))
    m.box(-0.88, 0.88, 0.04, 0.1, -0.88, 0.5, 'sand', skip=('bot',))
    # montagne en gradins
    cyl(m, CX, CZ, 0.1, 0.3, 0.72, 'g2', r1=0.62, n=9, col_top='g1')
    cyl(m, CX, CZ, 0.3, 0.66, 0.62, 'g1', r1=0.5, n=9, col_top='g2')
    cyl(m, CX, CZ, 0.66, 1.0, 0.5, 'rock', r1=0.4, n=9, col_top='rock2')
    cyl(m, CX, CZ, 1.0, 1.22, 0.4, 'rock2', r1=0.34, n=9, col_top='wall2')
    # maisons au pied, face à la baie
    for (x, z, hw, hd, h, c) in ((-0.5, 0.3, 0.12, 0.09, 0.14, 'h1'), (-0.28, 0.36, 0.1, 0.08, 0.12, 'h2'), (0.0, 0.34, 0.12, 0.09, 0.16, 'h3'),
                                 (0.3, 0.38, 0.1, 0.08, 0.12, 'h1'), (0.56, 0.3, 0.12, 0.09, 0.14, 'h2')):
        maison(m, x, z, hw, hd, h, c)
    # fort au sommet : enceinte, créneaux, tour carrée
    Y = 1.22
    sbox(m, CX-0.26, CX+0.26, Y, Y+0.14, CZ-0.17, CZ+0.17, 'wall', 'wall2')
    for i in range(5):
        x = CX-0.22+i*0.11
        m.box(x-0.03, x+0.03, Y+0.14, Y+0.2, CZ+0.14, CZ+0.2, 'wall', skip=('bot',))
        m.box(x-0.03, x+0.03, Y+0.14, Y+0.2, CZ-0.2, CZ-0.14, 'wall', skip=('bot',))
    decal(m, 'pz', CX-0.14, CX-0.08, Y+0.02, Y+0.1, CZ+0.173, 'dark')
    sbox(m, CX-0.26, CX-0.08, Y+0.14, Y+0.4, CZ-0.13, CZ+0.05, 'wall', 'wall2')
    # chapelle blanche
    sbox(m, CX+0.06, CX+0.22, Y+0.14, Y+0.3, CZ-0.12, CZ+0.04, 'white', 'white')
    gable(m, CX+0.05, CX+0.23, CZ-0.13, CZ+0.05, Y+0.3, 0.09, 'roof', 'white', ridge='z')
    decal(m, 'pz', CX+0.11, CX+0.17, Y+0.14, Y+0.24, CZ+0.043, 'dark')
    return m
