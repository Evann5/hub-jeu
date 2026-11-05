"""Alice Springs : Uluru, le grand rocher rouge aux flancs rainurés, dans le désert."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'desert': '#E0A862', 'dune': '#CB8450', 'dune2': '#D99660', 'r1': '#C2502A', 'r2': '#AE4426', 'r3': '#D2643A', 'r4': '#8F3820',
    'top': '#CC5A31', 'bush': '#7A8A4A', 'bush2': '#5E7A3E', 'trunk': '#6A4528',
}

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.04, -0.88, 0.88, 'desert', skip=('bot',))
    prism_xz(m, [(-0.8, 0.5), (-0.3, 0.45), (0.3, 0.58), (0.8, 0.52), (0.84, 0.8), (-0.82, 0.82)], 0.04, 0.05, 'dune', 'dune2')
    prism_xz(m, [(-0.85, -0.7), (-0.4, -0.78), (0.1, -0.74), (0.2, -0.86), (-0.7, -0.86)], 0.04, 0.05, 'dune', 'dune2')
    n = 22
    cx, cz = 0.0, -0.08
    levels = [(0.04, 1.14), (0.14, 1.0), (0.45, 0.97), (0.7, 0.93), (0.88, 0.82), (0.97, 0.62), (1.0, 0.0)]
    H = 1.15
    rings = []
    for (fy, sc) in levels:
        ring = []
        for i in range(n):
            t = 2*math.pi*i/n
            w = 1+0.07*math.sin(3*t+1.0)+0.05*math.sin(5*t+0.4)+(0.035 if i % 2 == 0 and 0.2 < fy < 0.95 else 0)
            y = (fy if fy <= 0.04 else 0.04+H*fy)
            if 0.85 <= fy < 1.0:
                y += 0.06*math.sin(2*t+0.4)+0.04*math.sin(6*t)
            ring.append((cx+0.78*sc*w*math.sin(t), y, cz+0.38*sc*w*math.cos(t)))
        rings.append(ring)
    for k in range(len(rings)-1):
        ra, rb = rings[k], rings[k+1]
        yk = (ra[0][1]+rb[0][1])/2
        for i in range(n):
            j = (i+1) % n
            col = ['r1', 'r2', 'r3', 'r2', 'r1', 'r4'][i % 6] if k < 5 else 'top'
            if k == 5:
                col = 'top' if i % 2 else 'r3'
            m.poly([ra[i], ra[j], rb[j], rb[i]], col, (cx, yk, cz) if k < 4 else (cx, yk-1, cz))
    # buissons
    for (x, z) in ((-0.7, 0.62), (-0.2, 0.7), (0.5, 0.66), (0.78, 0.32), (-0.78, -0.2), (0.76, -0.55)):
        lathe(m, [(0.07, 0.04), (0.05, 0.1), (0.0, 0.14)], 5, ['bush', 'bush2'], x, z)
    return m
