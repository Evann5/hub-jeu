"""Barcelone : la Sagrada Família, basilique aux tours effilées, fruits colorés au sommet."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'ground': '#D9C9A5', 's1': '#D8B27C', 's2': '#C79A64', 's3': '#E6C99A', 'nave': '#D2AE78', 'roof': '#A88A5A',
    'win': '#3A4A66', 'orange': '#E8892B', 'yellow': '#F2C94C', 'red': '#C6402C', 'green': '#6FA05A', 'cream': '#F2E8D2',
    'dark': '#3A3633', 'gold': '#D9A93A',
}
Y0 = 0.04

def spire(m, x, z, h, r, tipcols=('orange', 'yellow', 'red'), n=6, bands=5, rot=0.0):
    prof = [(r-(r*0.45)*k/bands, Y0+h*k/bands) for k in range(bands+1)]
    lathe(m, prof, n, ['s1' if k % 2 == 0 else 's2' for k in range(bands)], x, z, rot)
    yt = Y0+h
    rt = prof[-1][0]
    lathe(m, [(rt, yt), (rt*1.35, yt+0.04), (rt*1.2, yt+0.1), (rt*0.5, yt+0.17), (0.0, yt+0.24)], n,
          [tipcols[0], tipcols[1], tipcols[0], tipcols[2]], x, z, rot)
    ball(m, x, yt+0.27, z, 0.025, 'gold')

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.88, 0.88, 'ground', skip=('bot',))
    # nef et façade
    nv = B(-0.62, 0.62, Y0, 0.5, -0.7, 0.2)
    box(m, nv, 'nave')
    gable(m, -0.64, 0.64, -0.72, 0.22, 0.5, 0.2, 'roof', 'x', 's3')
    for k in range(5):
        decal(m, nv, 'pz', round_arch(-0.45+k*0.225, Y0, 0.22, 0.05, 4), 'win', 0.004)
        decal(m, nv, 'pz', rect(-0.45+k*0.225-0.02, -0.45+k*0.225+0.02, 0.3, 0.44), 'win', 0.004)
    # quatre tours de la façade
    for k, x in enumerate((-0.5, -0.17, 0.17, 0.5)):
        base = B(x-0.075, x+0.075, Y0, 0.5, 0.05, 0.2)
        spire(m, x, 0.12, 1.55 if k in (1, 2) else 1.4, 0.085, rot=0.5)
    # tour centrale et quatre tours d'évangélistes
    spire(m, 0.0, -0.3, 2.35, 0.14, ('orange', 'yellow', 'red'), 8, 6)
    m.beam((0, Y0+2.35+0.27, -0.3), (0, Y0+2.35+0.5, -0.3), 0.02, 'gold', w1=0.012)
    m.box(-0.07, 0.07, Y0+2.35+0.4, Y0+2.35+0.43, -0.31, -0.29, 'gold')
    for (x, z) in ((-0.3, -0.3), (0.3, -0.3), (-0.17, -0.55), (0.17, -0.55)):
        spire(m, x, z, 1.8, 0.1, ('green', 'yellow', 'orange'), 6, 5, 0.2)
    return m
