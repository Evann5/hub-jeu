"""Fès : Bab Boujloud, la porte bleue (face bleue, arc en fer à cheval, intérieur vert) et un minaret tuilé de vert."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'blue': '#1D5FAE', 'blue2': '#3C86CF', 'blued': '#143F7A', 'cream': '#E6D4AB', 'cream2': '#F2E7C9',
    'green': '#1E7A4C', 'greend': '#155C39', 'greenl': '#38A06A', 'ground': '#CDB790', 'dark': '#2B2A2A',
    'gold': '#D9A93A', 'stone': '#B99C6E',
}
Y0 = 0.04

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.6, 0.62, 'ground', skip=('bot',))
    # ---------- la porte, construite centrée puis décalée vers la gauche ----------
    n0 = len(m.faces)
    X = 0.6; ZF = 0.17; ZB = -0.17; YT = 1.1
    m.box(-0.3, 0.3, Y0, Y0+0.03, ZF, ZF+0.08, 'stone', skip=('bot', 'nz'))      # seuil
    m.box(-X, X, Y0, YT, ZB, ZF, 'cream', skip=('bot', 'pz', 'nz'))
    yc = 0.62
    out = horseshoe(0, Y0, yc, 0.285, 25, 12)
    inn = horseshoe(0, Y0, yc, 0.205, 25, 12)
    mpf = lambda u, v: (u, v, ZF)
    face2d(m, [(-X, Y0)] + out + [(X, Y0), (X, YT), (-X, YT)], mpf, 'blue', (0, 0.5, ZB))
    ring_band(m, mpf, out, inn, 'cream2', (0, 0.5, ZB))
    for i in range(len(inn)-1):                                  # tunnel vert
        a, b = inn[i], inn[i+1]
        p = [(a[0], a[1], ZF), (b[0], b[1], ZF), (b[0], b[1], ZB), (a[0], a[1], ZB)]
        c = centroid(p)
        m.poly(p, 'green' if i % 2 == 0 else 'greend', (c[0]*2, c[1]*2-yc, c[2]))
    face2d(m, [(-X, Y0)] + inn + [(X, Y0), (X, YT), (-X, YT)], lambda u, v: (-u, v, ZB), 'green', (0, 0.5, ZF))
    f = B(-X, X, Y0, YT, ZB, ZF)
    decal(m, f, 'pz', rect(-X, X, Y0, Y0+0.09), 'stone', 0.003)
    decal(m, f, 'pz', rect(-X, X, YT-0.1, YT-0.03), 'cream2', 0.003)
    for k in range(-5, 6):
        u = k*0.108
        decal(m, f, 'pz', [(u-0.03, YT-0.065), (u, YT-0.04), (u+0.03, YT-0.065), (u, YT-0.09)], 'green', 0.006)
    for sd in (-1, 1):
        u = sd*0.445
        decal(m, f, 'pz', pointed_arch(u, 0.2, 0.5, 0.122, 3), 'cream2', 0.003)
        decal(m, f, 'pz', pointed_arch(u, 0.21, 0.5, 0.104, 3), 'blue2', 0.006)
        decal(m, f, 'pz', pointed_arch(u, 0.22, 0.46, 0.06, 3), 'blued', 0.009)
        decal(m, f, 'pz', disc(u, 0.86, 0.045, 8), 'cream2', 0.003)
        decal(m, f, 'pz', disc(u, 0.86, 0.03, 8), 'green', 0.006)
    gable(m, -X-0.04, X+0.04, ZB-0.07, ZF+0.07, YT, 0.09, 'green', 'x', 'greend')
    GX = -0.24
    xform(m, move(GX), n0)
    # ---------- minaret tuilé, au flanc de la porte ----------
    mx0, mx1, mz0, mz1 = 0.5, 0.82, -0.2, 0.12
    cx, cz = (mx0+mx1)/2, (mz0+mz1)/2
    m.box(mx0-0.03, mx1+0.03, Y0, Y0+0.07, mz0-0.03, mz1+0.03, 'stone', skip=('bot',))
    tw = B(mx0, mx1, Y0, 1.66, mz0, mz1)
    box(m, tw, 'cream')
    for face in ('pz', 'px', 'nx'):
        decal(m, tw, face, rect(-0.145, 0.145, 1.1, 1.58), 'green', 0.003)
        for uu in (-0.065, 0.065):
            decal(m, tw, face, pointed_arch(uu, 1.17, 1.37, 0.046, 3), 'cream2', 0.006)
            decal(m, tw, face, pointed_arch(uu, 1.18, 1.37, 0.035, 3), 'blued', 0.009)
        decal(m, tw, face, rect(-0.13, 0.13, 1.45, 1.54), 'greenl', 0.006)
        decal(m, tw, face, pointed_arch(0, 0.55, 0.78, 0.035, 3), 'dark', 0.003)
        decal(m, tw, face, pointed_arch(0, 0.9, 1.0, 0.035, 3), 'dark', 0.003)
    m.box(mx0-0.025, mx1+0.025, 1.66, 1.73, mz0-0.025, mz1+0.025, 'cream2', skip=('bot',))
    lt = B(mx0+0.06, mx1-0.06, 1.73, 1.96, mz0+0.06, mz1-0.06)
    box(m, lt, 'cream')
    for face in ('pz', 'px', 'nx'):
        decal(m, lt, face, pointed_arch(0, 1.79, 1.88, 0.04, 3), 'blued', 0.003)
    m.box(mx0+0.03, mx1-0.03, 1.96, 2.0, mz0+0.03, mz1-0.03, 'green', skip=('bot',))
    pyramid(m, cx, cz, 0.13, 2.0, 0.2, 'green')
    ball(m, cx, 2.24, cz, 0.035, 'gold')
    m.beam((cx, 2.17, cz), (cx, 2.26, cz), 0.012, 'gold')
    return m
