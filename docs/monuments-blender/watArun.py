"""Bangkok (Thaïlande) : Wat Arun, haute tour centrale à gradins, quatre tours d'angle, terrasses, le fleuve devant."""
import math
from lib import Mesh
from lib_asie_turquie import *   # prang() y est défini

PAL = {'stone': '#CDBEA2', 'river': '#4F93B8', 'foam': '#E8F2F4', 'white': '#F2ECDD', 'pink': '#E5679A', 'teal': '#35B0A6',
       'grey': '#C5CCD6', 'gold': '#E3B341', 'niche': '#6B5E5A', 'step': '#E2D8C4', 'blue': '#4A78D0'}

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.05, -0.88, 0.6, 'stone', skip=('bot',))
    m.box(-0.88, 0.88, 0.0, 0.025, 0.6, 0.88, 'river', skip=('bot', 'nz'))
    for x0 in (-0.6, 0.15):
        m.box(x0, x0+0.4, 0.025, 0.03, 0.72, 0.75, 'foam', skip=('bot',))
    m.box(-0.88, 0.88, 0.0, 0.06, 0.55, 0.62, 'step', skip=('bot',))
    CZ = -0.25
    tiers = [(0.72, 0.05, 0.16), (0.58, 0.16, 0.29), (0.44, 0.29, 0.42)]
    for hw, y0, y1 in tiers:
        m.box(-hw, hw, y0, y1, CZ-hw, CZ+hw, 'white', skip=('bot',))
        m.box(-hw-0.02, hw+0.02, y1-0.03, y1, CZ-hw-0.02, CZ+hw+0.02, 'grey', skip=('bot',))
    # escaliers vers le fleuve et vers la terrasse
    for s in range(4):
        m.box(-0.16, 0.16, 0.05, 0.05+0.028*(4-s), CZ+0.72, CZ+0.72+0.045*(s+1)*0+0.045*(4-s)+0.0, 'step', skip=('bot', 'nz'))
    for s in range(3):
        m.box(-0.14, 0.14, 0.16, 0.16+0.04*(3-s), CZ+0.58, CZ+0.58+0.04*(3-s), 'step', skip=('bot', 'nz'))
    # tour centrale et quatre tours d'angle
    prang(m, 0, CZ, 0.42, 0.33, 2.3, 10, ['white', 'pink', 'white', 'teal', 'white', 'blue'])
    for sx in (-1, 1):
        for sz in (-1, 1):
            prang(m, sx*0.46, CZ+sz*0.46, 0.29, 0.1, 0.9, 6, ['white', 'pink', 'blue'])
    return m
