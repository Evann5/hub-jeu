"""Agra (Inde) : le Taj Mahal, mausolée de marbre blanc à bulbe, quatre minarets, bassin, cyprès."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'lawn': '#7DAE5A', 'marble': '#F4EFE6', 'marble2': '#DDD5C6', 'recess': '#6E7A9A', 'water': '#4FB3D4', 'edge': '#E8DFCC',
       'gold': '#E2B53C', 'cypress': '#2F7B4A', 'path': '#D9C9A3', 'inlay': '#9AA6C4'}

def build():
    m = Mesh(PAL)
    slab(m, 'lawn', 0.04)
    # allée centrale et bassin (devant)
    m.box(-0.14, 0.14, 0.04, 0.05, 0.3, 0.88, 'path', skip=('bot',))
    m.box(-0.09, 0.09, 0.04, 0.055, 0.34, 0.88, 'water', skip=('bot',))
    for z in (0.5, 0.7):
        m.box(-0.14, 0.14, 0.05, 0.075, z-0.015, z+0.015, 'edge', skip=('bot',))
    # cyprès de part et d'autre
    for x in (-0.36, 0.36):
        for z in (0.45, 0.72):
            cyl(m, x, z, 0.04, 0.09, 0.025, 'path', n=5)
            cone(m, x, z, 0.09, 0.4, 0.075, 'cypress', n=6)
    # terrasse de marbre
    m.box(-0.8, 0.8, 0.04, 0.22, -0.84, 0.3, 'marble', skip=('bot',))
    m.box(-0.82, 0.82, 0.04, 0.07, -0.86, 0.32, 'edge', skip=('bot',))
    # escalier central de la terrasse
    for s in range(3):
        m.box(-0.14, 0.14, 0.04, 0.22-0.045*(2-s), 0.3, 0.3+0.05*(3-s), 'marble2', skip=('bot', 'nz'))
    # mausolée : plan carré aux angles coupés
    CX, CZ, R = 0.0, -0.28, 0.42
    prism(m, octagon(CX, CZ, R, 0.2), 0.22, 0.98, 'marble', 'marble')
    m.box(CX-R-0.03, CX+R+0.03, 0.22, 0.27, CZ-R-0.03, CZ+R+0.03, 'edge', skip=('bot',))
    # iwans (grandes baies) sur les quatre faces : cadre, fond, petites baies hautes
    s0 = len(m.faces)
    z = CZ+R+0.004
    front(m, z, arch2d(0, 0.27, 0.66, 0.9, 0.165, 5, True), 'marble2')
    front(m, z+0.004, arch2d(0, 0.29, 0.62, 0.86, 0.135, 5, True), 'recess')
    front(m, z+0.008, rect(-0.135, 0.135, 0.29, 0.31), 'marble2')
    for x in (-0.31, 0.31):
        front(m, z, arch2d(x, 0.4, 0.56, 0.7, 0.05, 3, True), 'marble2')
        front(m, z+0.004, arch2d(x, 0.41, 0.56, 0.68, 0.036, 3, True), 'recess')
    sides4(m, s0, CX, CZ)
    # petits kiosques d'angle
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, zz = CX+sx*0.3, CZ+sz*0.3
            cyl(m, x, zz, 0.98, 1.12, 0.055, 'marble', n=6)
            dome(m, x, zz, 1.12, 0.07, 0.09, 6, 'marble', rows=2)
            cone(m, x, zz, 1.2, 1.28, 0.012, 'gold', n=4, cap_bot=False)
    # tambour, bulbe, fleuron
    cyl(m, CX, CZ, 0.98, 1.2, 0.21, 'marble', n=12)
    cyl(m, CX, CZ, 1.2, 1.23, 0.235, 'edge', n=12)
    onion(m, CX, CZ, 1.2, 0.27, 0.66, 12, 'marble')
    cyl(m, CX, CZ, 1.86, 1.98, 0.012, 'gold', 0.012, n=4, caps=(False, True))
    sphere(m, CX, 1.92, CZ, 0.03, 'gold', n=6, rows=3)
    # quatre minarets aux angles de la terrasse
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, zz = sx*0.7, 0.2 if sz > 0 else -0.74
            cyl(m, x, zz, 0.22, 0.3, 0.095, 'edge', 0.085, n=8)
            cyl(m, x, zz, 0.3, 1.34, 0.062, 'marble', 0.048, n=8)
            for yb in (0.62, 0.98):
                cyl(m, x, zz, yb, yb+0.03, 0.095, 'marble2', n=8)
            cyl(m, x, zz, 1.34, 1.38, 0.09, 'marble2', n=8)
            for k in range(4):
                a = math.pi/2*k+math.pi/4
                cyl(m, x+0.065*math.sin(a), zz+0.065*math.cos(a), 1.38, 1.5, 0.014, 'marble', n=4)
            dome(m, x, zz, 1.5, 0.085, 0.1, 8, 'marble', rows=2)
            cone(m, x, zz, 1.6, 1.68, 0.012, 'gold', n=4, cap_bot=False)
    return m
