"""Louxor : Karnak, colonnes massives à chapiteaux, mur de pylône et grand obélisque de granit rose."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'sand': '#E8C98C', 'sand2': '#D9B574', 'col': '#E9CE94', 'col2': '#D3AF6C', 'cap': '#E4A24A', 'band': '#2FA9AE', 'band2': '#C4453A',
       'arch': '#DDBE82', 'archt': '#EFD9A4', 'wall': '#D8B678', 'wall2': '#C69B58', 'dark': '#7A5A36', 'ob': '#DC8D7B', 'ob2': '#C26F5E',
       'gold': '#F0BE3A', 'plinth': '#CBA865'}


def colonne(m, x, z):
    cyl(m, x, z, 0.05, 0.12, 0.14, 'plinth', n=8)
    cyl(m, x, z, 0.12, 0.98, 0.105, 'col', r1=0.1, n=8, rot=math.pi/8)
    cyl(m, x, z, 0.38, 0.44, 0.112, 'band', n=8, rot=math.pi/8)
    cyl(m, x, z, 0.78, 0.84, 0.108, 'band2', n=8, rot=math.pi/8)
    cyl(m, x, z, 0.98, 1.12, 0.1, 'cap', r1=0.17, n=8, rot=math.pi/8)       # chapiteau évasé
    m.box(x-0.15, x+0.15, 1.12, 1.18, z-0.15, z+0.15, 'col2', skip=('bot',))


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'sand', skip=('bot',))
    tbox(m, 0.2, 0.74, 0.05, 0.1, 0.55, 0.12, 0.3, 0.05, 'sand2')
    # mur de pylône au fond, bandes colorées
    tbox(m, -0.28, -0.7, 0.05, 0.85, 0.62, 0.17, 0.57, 0.14, 'wall', col_top='wall2')
    decal(m, 'pz', -0.8, 0.2, 0.6, 0.7, -0.5295+0.0, 'band2')
    decal(m, 'pz', -0.78, 0.18, 0.4, 0.46, -0.5295+0.0, 'band')
    # colonnade : deux rangées de quatre colonnes
    for z in (0.28, -0.12):
        for x in (-0.7, -0.38, -0.06, 0.26):
            colonne(m, x, z)
        sbox(m, -0.84, 0.42, 1.18, 1.3, z-0.12, z+0.12, 'arch', 'archt')
    # obélisque de granit rose sur son socle
    m.box(0.5, 0.86, 0.05, 0.16, -0.5, -0.14, 'plinth', skip=('bot',))
    tbox(m, 0.68, -0.32, 0.16, 2.1, 0.1, 0.1, 0.055, 0.055, 'ob', col_top='ob')
    pyr(m, 0.68, -0.32, 0.055, 0.055, 2.1, 0.17, 'gold')
    # face sombre sur un côté pour le volume
    m.poly([(0.78, 0.16, -0.22), (0.78, 0.16, -0.42), (0.735, 2.1, -0.375), (0.735, 2.1, -0.265)], 'ob2', (0.6, 1.0, -0.32))
    return m
