"""Kinshasa (RD Congo) : la tour de l'échangeur de Limete, fût élancé à plateau tournant, au centre d'un rond-point."""
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
        c = 0.6+0.08*k
        for s in (-1, 1):
            m.box(s*c-0.03, s*c+0.03, 0.04, 0.043, -0.008, 0.008, 'line', skip=('bot',))
            m.box(-0.008, 0.008, 0.04, 0.043, s*c-0.03, s*c+0.03, 'line', skip=('bot',))
    # rond-point : anneau d'asphalte, bordure, îlot d'herbe
    outer = circle(0, 0, 0.041, 0.5, 20)
    inner = circle(0, 0, 0.041, 0.3, 20)
    for i in range(20):
        j = (i+1) % 20
        m.poly([outer[i], outer[j], inner[j], inner[i]], 'asphalt', (0, -3, 0))
    cyl(m, 0, 0, 0.03, 0.1, 0.31, 'curb', n=20, caps=(False, False))
    m.poly(circle(0, 0, 0.1, 0.31, 20), 'grass', (0, -1, 0))
    m.poly(circle(0, 0, 0.101, 0.2, 20), 'grass2', (0, -1, 0))
    # tour : fût, plateau, couronne, antenne
    lathe(m, [(0.14, 0.1), (0.1, 0.35), (0.075, 1.0), (0.065, 2.4), (0.06, 3.05)], 8, ['tower', 'tower_d', 'tower', 'tower_d'], 0, 0)
    lathe(m, [(0.06, 3.05), (0.1, 3.12), (0.26, 3.25), (0.26, 3.4), (0.15, 3.52)], 8, ['pod2', 'pod', 'glass', 'pod2'], 0, 0)
    lathe(m, [(0.15, 3.52), (0.15, 3.62), (0.08, 3.68), (0.0, 3.7)], 8, ['glass', 'tower', 'tower_d'], 0, 0, cap_bot=False)
    spire(m, 0, 0, 3.68, 4.2, 0.02, 'steel', 0.005, n=4)
    # voitures et arbres
    for (x, z, c, w, d) in ((-0.72, 0.06, 'car1', 0.14, 0.07), (0.62, -0.06, 'car2', 0.14, 0.07), (0.07, 0.65, 'car3', 0.07, 0.14), (-0.07, -0.62, 'car4', 0.07, 0.14)):
        m.box(x-w/2, x+w/2, 0.04, 0.09, z-d/2, z+d/2, c, skip=('bot',))
        m.box(x-w/3.2, x+w/3.2, 0.09, 0.115, z-d/3.2, z+d/3.2, 'glass', skip=('bot',))
    for (x, z) in ((-0.6, -0.55), (0.62, 0.58), (-0.62, 0.6), (0.6, -0.6)):
        cyl(m, x, z, 0.03, 0.12, 0.012, 'tower_d', n=4, caps=(False, False))
        blob(m, x, 0.2, z, 0.1, 0.1, 0.1, 'tree', n=6, lats=(-50, 10, 60))
    return m
