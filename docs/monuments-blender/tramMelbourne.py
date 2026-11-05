"""Melbourne : un tram vert et crème devant la gare à coupole verte et façade jaune."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'ground': '#CFC3A6', 'road': '#4A4D55', 'rail': '#8A8A8F', 'walk': '#DDD1B6', 'line': '#F2EFE6',
    'yellow': '#E1B84B', 'yellow2': '#CFA43C', 'cream': '#F2E6C4', 'green': '#4F9A87', 'win': '#4A5568', 'dark': '#3A3633',
    'tgreen': '#2E7050', 'tcream': '#EFE3BF', 'troof': '#C9D2C8', 'glass': '#2F3B4D', 'wheel': '#26231F', 'gold': '#D9A93A',
    'clock': '#F7F4EA', 'black': '#26231F', 'wire': '#3A3633', 'pole': '#6E6A66',
}
Y0 = 0.04

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.88, 0.88, 'ground', skip=('bot',))
    m.box(-0.88, 0.88, Y0, Y0+0.01, -0.3, -0.2, 'walk', skip=('bot',))
    m.box(-0.88, 0.88, Y0, Y0+0.008, -0.2, 0.62, 'road', skip=('bot',))
    m.box(-0.88, 0.88, Y0+0.008, Y0+0.016, 0.1, 0.125, 'rail', skip=('bot',))
    m.box(-0.88, 0.88, Y0+0.008, Y0+0.016, 0.265, 0.29, 'rail', skip=('bot',))
    # gare
    st = B(-0.86, 0.86, Y0, 0.5, -0.78, -0.3)
    box(m, st, 'yellow')
    m.box(-0.88, 0.88, 0.5, 0.55, -0.8, -0.28, 'cream', skip=('bot',))
    for k in range(10):
        u = -0.74+k*0.165
        decal(m, st, 'pz', round_arch(u, Y0, 0.2, 0.05, 4), 'cream', 0.004)
        decal(m, st, 'pz', round_arch(u, Y0, 0.2, 0.038, 4), 'win', 0.007)
        decal(m, st, 'pz', rect(u-0.025, u+0.025, 0.3, 0.42), 'cream', 0.004)
        decal(m, st, 'pz', rect(u-0.017, u+0.017, 0.31, 0.41), 'win', 0.007)
    # tambour et coupole verte
    dr = B(0.1, 0.46, 0.55, 0.68, -0.72, -0.36)
    box(m, dr, 'cream')
    for face in ('pz', 'px', 'nx'):
        for u in (-0.1, 0.0, 0.1):
            decal(m, dr, face, round_arch(u, 0.58, 0.63, 0.025, 3), 'win', 0.004)
    lathe(m, [(0.2, 0.68), (0.2, 0.72), (0.17, 0.8), (0.11, 0.9), (0.04, 0.97), (0.0, 1.0)], 8, ['green']*5, 0.28, -0.54, 0.39)
    ball(m, 0.28, 1.03, -0.54, 0.03, 'gold', 5)
    # tour de l'horloge
    tw = B(-0.6, -0.36, 0.55, 0.9, -0.7, -0.46)
    box(m, tw, 'yellow')
    decal(m, tw, 'pz', disc(0.0, 0.76, 0.07, 10), 'cream', 0.004)
    decal(m, tw, 'pz', disc(0.0, 0.76, 0.056, 10), 'clock', 0.007)
    decal(m, tw, 'pz', rect(-0.005, 0.005, 0.76, 0.81), 'black', 0.01)
    m.box(-0.62, -0.34, 0.9, 0.94, -0.72, -0.44, 'cream', skip=('bot',))
    hip(m, -0.6, -0.36, -0.7, -0.46, 0.94, 0.3, 'green')
    m.beam((-0.48, 1.22, -0.58), (-0.48, 1.34, -0.58), 0.02, 'gold', w1=0.008)
    # tram
    x0, x1, z0, z1 = -0.3, 0.46, 0.12, 0.28
    lo = B(x0, x1, 0.1, 0.2, z0, z1)
    box(m, lo, 'tgreen')
    up = B(x0, x1, 0.2, 0.34, z0, z1)
    box(m, up, 'tcream')
    hip(m, x0-0.01, x1+0.01, z0-0.01, z1+0.01, 0.34, 0.05, 'troof', 0.05)
    for face in ('pz', 'nz'):
        for k in range(6):
            u = -0.31+k*0.125
            decal(m, up, face, rect(u-0.04, u+0.04, 0.23, 0.31), 'glass', 0.004)
    decal(m, up, 'px', rect(-0.05, 0.05, 0.23, 0.31), 'glass', 0.004)
    decal(m, up, 'nx', rect(-0.05, 0.05, 0.23, 0.31), 'glass', 0.004)
    for wx in (x0+0.14, x1-0.14):
        for wz in (z0+0.005, z1-0.04):
            m.box(wx-0.06, wx+0.06, Y0+0.016, 0.12, wz, wz+0.035, 'wheel', skip=('bot',))
    # perche et fil aérien
    m.beam((0.08, 0.34, 0.2), (0.08, 0.6, 0.2), 0.016, 'pole', w1=0.012)
    m.box(-0.88, 0.88, 0.6, 0.615, 0.19, 0.21, 'wire', skip=('bot',))
    for x in (-0.8, 0.8):
        m.box(x-0.015, x+0.015, Y0, 0.65, 0.5, 0.53, 'pole', skip=('bot',))
        m.box(x-0.015, x+0.015, 0.62, 0.65, 0.2, 0.53, 'pole', skip=('bot',))
    return m
