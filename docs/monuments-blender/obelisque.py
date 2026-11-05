"""Buenos Aires : l'obélisque blanc au centre d'une grande avenue, entre des immeubles et des arbres."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'ground': '#CFC3A6', 'road': '#4A4D55', 'line': '#F2EFE6', 'obel': '#F4F2EC', 'obel2': '#DAD6CB', 'base': '#BDB7A8',
    'b1': '#E3C79A', 'b2': '#D99A8A', 'b3': '#B9C7D6', 'win': '#4A5568', 'leaf': '#4E8F3A', 'trunk': '#6A4528', 'grass': '#7FA95A',
    'cap': '#E9E6DC',
}

def tree(m, x, z, s=1.0):
    lathe(m, [(0.02*s, 0.04), (0.02*s, 0.16*s)], 4, 'trunk', x, z)
    ball(m, x, 0.16*s+0.09*s, z, 0.09*s, 'leaf', 6)

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.04, -0.88, 0.88, 'ground', skip=('bot',))
    # grande avenue (nord-sud) et rue qui la croise
    m.box(-0.34, 0.34, 0.04, 0.045, -0.88, 0.88, 'road', skip=('bot',))
    m.box(-0.88, 0.88, 0.04, 0.045, -0.12, 0.12, 'road', skip=('bot',))
    for k in range(5):
        z = -0.78+k*0.4
        if abs(z) > 0.26 and z+0.2 <= 0.88:
            m.box(-0.015, 0.015, 0.045, 0.05, z, z+0.2, 'line', skip=('bot',))
    for k in range(4):
        x = -0.8+k*0.44
        if abs(x) > 0.4:
            m.box(x, x+0.2, 0.045, 0.05, -0.012, 0.012, 'line', skip=('bot',))
    # immeubles d'angle
    for (x0, x1, z0, z1, h, c) in ((-0.8, -0.48, -0.8, -0.3, 0.4, 'b1'), (0.5, 0.82, -0.8, -0.34, 0.5, 'b3'),
                                   (-0.8, -0.5, 0.3, 0.8, 0.34, 'b2'), (0.48, 0.82, 0.3, 0.8, 0.45, 'b1')):
        bb = B(x0, x1, 0.04, h, z0, z1)
        box(m, bb, c)
        m.box(x0-0.02, x1+0.02, h, h+0.03, z0-0.02, z1+0.02, 'base', skip=('bot',))
        for r in range(3):
            for u in (-0.08, 0.08):
                decal(m, bb, 'pz' if z0 > 0 else 'px', rect(u-0.04, u+0.04, 0.12+r*0.15, 0.2+r*0.15), 'win', 0.003)
    # arbres le long de l'avenue
    for z in (-0.65, -0.45, 0.45, 0.65):
        tree(m, -0.4, z); tree(m, 0.4, z)
    # place + obélisque
    m.box(-0.2, 0.2, 0.045, 0.07, -0.2, 0.2, 'base', skip=('bot',))
    m.box(-0.19, 0.19, 0.07, 0.11, -0.19, 0.19, 'obel2', skip=('bot',))
    m.box(-0.17, 0.17, 0.11, 0.2, -0.17, 0.17, 'obel2', skip=('bot',))
    ring = lambda y, h: [(-h, y, -h), (h, y, -h), (h, y, h), (-h, y, h)]
    m.band(ring(0.2, 0.15), ring(2.0, 0.085), 'obel', (0, 1, 0))
    pyramid(m, 0, 0, 0.085, 2.0, 0.3, 'cap')
    return m
