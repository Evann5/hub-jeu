"""Kinshasa (RD Congo) : la tour de l'échangeur de Limete, fût élancé à plateau tournant, au centre d'un rond-point.
Passe 3 (05/11/2026) : fût plus épais, plateau plus large, rond-point plus grand et planté d'herbe (il remplit mieux la dalle, sans la dépasser)."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'ground': '#BDB6A0', 'asphalt': '#4A4D55', 'line': '#F4F1E6', 'curb': '#D8D2C0', 'grass': '#6FA851', 'grass2': '#5B9A47',
       'tower': '#EDE8DC', 'tower_d': '#C7BFAE', 'pod': '#E8A93A', 'pod2': '#C7522E', 'glass': '#4D7FA6', 'steel': '#D2D8DC',
       'car1': '#E8433B', 'car2': '#2F7FD6', 'car3': '#F4C430', 'car4': '#FFFFFF', 'tree': '#3E8E45'}


def build():
    m = Mesh(PAL)
    plate(m, 'ground', 0.03)
    # deux routes qui se croisent, avec tirets
    m.box(-H, H, 0.03, 0.04, -0.15, 0.15, 'asphalt', skip=('bot',))
    m.box(-0.15, 0.15, 0.03, 0.04, -H, H, 'asphalt', skip=('bot',))
    for k in range(4):
        c = 0.7+0.05*k
        for s in (-1, 1):
            m.box(s*c-0.03, s*c+0.03, 0.04, 0.043, -0.008, 0.008, 'line', skip=('bot',))
            m.box(-0.008, 0.008, 0.04, 0.043, s*c-0.03, s*c+0.03, 'line', skip=('bot',))
    # rond-point : anneau d'asphalte, bordure, îlot d'herbe
    RO, RI, RC = 0.66, 0.4, 0.41
    outer = circle(0, 0, 0.041, RO, 24)
    inner = circle(0, 0, 0.041, RI, 24)
    for i in range(24):
        j = (i+1) % 24
        m.poly([outer[i], outer[j], inner[j], inner[i]], 'asphalt', (0, -3, 0))
    cyl(m, 0, 0, 0.03, 0.1, RC, 'curb', n=24, caps=(False, False))
    m.poly(circle(0, 0, 0.1, RC, 24), 'grass', (0, -1, 0))
    m.poly(circle(0, 0, 0.101, 0.3, 24), 'grass2', (0, -1, 0))
    # tour : fût épais, plateau large, couronne, antenne
    lathe(m, [(0.24, 0.1), (0.19, 0.4), (0.15, 1.2), (0.125, 2.5), (0.115, 3.0)], 8, ['tower', 'tower_d', 'tower', 'tower_d'], 0, 0)
    lathe(m, [(0.115, 3.0), (0.17, 3.08), (0.4, 3.22), (0.4, 3.4), (0.24, 3.54)], 8, ['pod2', 'pod', 'glass', 'pod2'], 0, 0)
    lathe(m, [(0.24, 3.54), (0.24, 3.64), (0.12, 3.72), (0.0, 3.74)], 8, ['glass', 'tower', 'tower_d'], 0, 0, cap_bot=False)
    spire(m, 0, 0, 3.72, 4.2, 0.03, 'steel', 0.006, n=4)
    # voitures et arbres
    for (x, z, c, w, d) in ((-0.77, 0.06, 'car1', 0.14, 0.07), (0.74, -0.06, 'car2', 0.14, 0.07), (0.07, 0.77, 'car3', 0.07, 0.14), (-0.07, -0.74, 'car4', 0.07, 0.14)):
        m.box(x-w/2, x+w/2, 0.04, 0.09, z-d/2, z+d/2, c, skip=('bot',))
        m.box(x-w/3.2, x+w/3.2, 0.09, 0.115, z-d/3.2, z+d/3.2, 'glass', skip=('bot',))
    for (x, z) in ((-0.68, -0.68), (0.7, 0.7), (-0.7, 0.7), (0.68, -0.68)):
        cyl(m, x, z, 0.03, 0.12, 0.012, 'tower_d', n=4, caps=(False, False))
        blob(m, x, 0.2, z, 0.1, 0.1, 0.1, 'tree', n=6, lats=(-50, 10, 60))
    return m
