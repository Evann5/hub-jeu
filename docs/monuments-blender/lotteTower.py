"""Séoul (Corée du Sud) : la Lotte World Tower, gratte-ciel effilé à pointe facettée, très haut, sur son socle commercial."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'plaza': '#CFCABD', 'podium': '#B8BCC2', 'podium2': '#9EA4AB', 'glass': '#7FB0D4', 'glass2': '#A4CDE8', 'glass_d': '#4F7DA6', 'steel': '#DDE3E8',
       'crown1': '#EAF2F7', 'crown2': '#9CC6E4'}

N = 16
Y0, Y1 = 0.3, 4.1
NB = 14


def sq_ring(r, y):
    pts = []
    for i in range(N):
        a = 2*math.pi*i/N
        c, s = math.cos(a), math.sin(a)
        k = 1.0/(c**4+s**4)**0.25
        pts.append((r*c*k, y, r*s*k))
    return pts


def rad(t):
    return 0.30-0.21*t**1.4


def build():
    m = Mesh(PAL)
    plate(m, 'plaza', 0.03)
    tbox(m, 0, 0, 0.03, 0.2, 0.7, 0.7, 0.62, 0.62, 'podium')
    tbox(m, 0, 0, 0.2, 0.32, 0.52, 0.52, 0.46, 0.46, 'podium2')
    rings = [sq_ring(rad(j/NB), Y0+(Y1-Y0)*j/NB) for j in range(NB+1)]
    for j in range(NB):
        c = 'glass' if j % 2 == 0 else 'glass2'
        if j % 5 == 4:
            c = 'glass_d'
        m.band(rings[j], rings[j+1], c)
    # couronne : fuseau facetté, une face sur deux plus claire
    top = rings[-1]
    mid = sq_ring(0.065, 4.42)
    for i in range(N):
        j = (i+1) % N
        m.poly([top[i], top[j], mid[j], mid[i]], 'crown1' if i % 2 == 0 else 'crown2', (0, 3, 0))
    apex = (0, 4.6, 0)
    for i in range(N):
        j = (i+1) % N
        m.poly([mid[i], mid[j], apex], 'crown2' if i % 2 == 0 else 'crown1', (0, 3, 0))
    spire(m, 0, 0, 4.58, 4.85, 0.012, 'steel', 0.004, n=4)
    return m
