"""Izmir (Turquie) : la tour de l'Horloge de Konak sur sa place, pierre claire, bandeaux turquoise, quatre cadrans, petit dôme."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'plaza': '#D9CCAA', 'plaza2': '#C3B38C', 'stone': '#F0E5CB', 'stone_d': '#D9C9A2', 'teal': '#2F9C94', 'gold': '#E2B040', 'recess': '#4B4540',
       'clock': '#FBF6EA', 'hand': '#2B2B2B', 'dome': '#3F8E88', 'lawn': '#88B35C', 'trunk': '#7A5A3C', 'leaf': '#4F8A45'}

def disc(r, y, n=12):
    return [(r*math.cos(2*math.pi*i/n), y+r*math.sin(2*math.pi*i/n)) for i in range(n)]

def build():
    m = Mesh(PAL)
    slab(m, 'plaza', 0.05)
    prism(m, [(0.72*math.sin(2*math.pi*i/16), 0.72*math.cos(2*math.pi*i/16)) for i in range(16)], 0.05, 0.065, 'plaza2', 'plaza2')
    m.box(-0.88, -0.6, 0.05, 0.06, 0.45, 0.88, 'lawn', skip=('bot',))
    m.box(0.6, 0.88, 0.05, 0.06, 0.45, 0.88, 'lawn', skip=('bot',))
    m.box(-0.36, 0.36, 0.065, 0.12, -0.36, 0.36, 'stone_d', skip=('bot',))
    # étage 1 : porte à arc brisé, fenêtres, bandeau turquoise
    A = 0.28
    m.box(-A, A, 0.12, 0.62, -A, A, 'stone', skip=('bot',))
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box(sx*A-0.03 if sx > 0 else sx*A-0.03, sx*A+0.03, 0.12, 0.62, sz*A-0.03, sz*A+0.03, 'stone_d', skip=('bot',))
    m.box(-A-0.015, A+0.015, 0.5, 0.56, -A-0.015, A+0.015, 'teal', skip=('bot',))
    s0 = len(m.faces)
    front(m, A+0.003, arch2d(0, 0.12, 0.34, 0.46, 0.11, 5, True), 'stone_d')
    front(m, A+0.007, arch2d(0, 0.12, 0.33, 0.43, 0.085, 5, True), 'recess')
    for x in (-0.19, 0.19):
        window(m, A+0.003, x, 0.24, 0.42, 0.03, 'recess', 'stone_d', True, 1, True)
    sides4(m, s0)
    # étage 2 : fenêtres étroites
    B = 0.23
    m.box(-B-0.025, B+0.025, 0.62, 0.66, -B-0.025, B+0.025, 'stone_d', skip=('bot',))
    m.box(-B, B, 0.66, 1.08, -B, B, 'stone', skip=('bot',))
    m.box(-B-0.015, B+0.015, 1.0, 1.05, -B-0.015, B+0.015, 'teal', skip=('bot',))
    s1 = len(m.faces)
    for x in (-0.09, 0.09):
        window(m, B+0.001, x, 0.74, 0.94, 0.035, 'recess', 'stone_d', True, 1, True)
    sides4(m, s1)
    # étage 3 : les quatre cadrans
    C = 0.2
    m.box(-C-0.02, C+0.02, 1.08, 1.12, -C-0.02, C+0.02, 'stone_d', skip=('bot',))
    m.box(-C, C, 1.12, 1.52, -C, C, 'stone', skip=('bot',))
    s2 = len(m.faces)
    front(m, C+0.003, disc(0.145, 1.32), 'gold')
    front(m, C+0.007, disc(0.12, 1.32), 'clock')
    front(m, C+0.011, rect(-0.01, 0.01, 1.32, 1.42), 'hand')
    front(m, C+0.011, rect(0.0, 0.08, 1.31, 1.33), 'hand')
    sides4(m, s2)
    # corniche, pinacles d'angle, tambour et dôme
    m.box(-0.25, 0.25, 1.52, 1.58, -0.25, 0.25, 'stone_d', skip=('bot',))
    for sx in (-1, 1):
        for sz in (-1, 1):
            cyl(m, sx*0.22, sz*0.22, 1.58, 1.7, 0.025, 'stone', n=5)
            cone(m, sx*0.22, sz*0.22, 1.7, 1.78, 0.034, 'teal', n=5)
    m.box(-0.15, 0.15, 1.58, 1.74, -0.15, 0.15, 'teal', skip=('bot',))
    dome(m, 0, 0, 1.74, 0.17, 0.2, 8, 'dome', rows=3)
    cyl(m, 0, 0, 1.94, 2.12, 0.012, 'gold', n=4, caps=(False, True))
    sphere(m, 0, 2.0, 0, 0.03, 'gold', n=6, rows=3)
    for x in (-0.72, 0.72):
        cyl(m, x, 0.62, 0.06, 0.28, 0.025, 'trunk', n=5)
        blob(m, x, 0.42, 0.62, 0.16, 0.16, 0.16, 'leaf', n=6)
    return m
