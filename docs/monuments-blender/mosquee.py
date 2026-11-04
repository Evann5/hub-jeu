"""Casablanca : la mosquée Hassan II, très haut minaret crème et vert, salle de prière à toit vert, face à l'océan."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'cream': '#E7D8B6', 'cream2': '#F3E9CF', 'cream3': '#D2BF98', 'green': '#1F7A5E', 'greend': '#175A46', 'greenl': '#3EA583',
    'sea': '#2D8FB5', 'sea2': '#4FB0CE', 'foam': '#EAF4F5', 'plat': '#DCCDA8', 'recess': '#2E5A4C', 'gold': '#D9A93A',
    'rock': '#8F7B60',
}
Y0 = 0.07

def build():
    m = Mesh(PAL)
    # ---------- océan (devant) et plateforme ----------
    m.box(-0.88, 0.88, 0.0, 0.035, 0.3, 0.88, 'sea', skip=('bot', 'nz'))
    for (x0, x1, z0, z1) in ((-0.7, -0.2, 0.52, 0.56), (0.05, 0.6, 0.64, 0.68), (-0.5, 0.0, 0.78, 0.82), (0.3, 0.8, 0.8, 0.84)):
        m.box(x0, x1, 0.035, 0.04, z0, z1, 'foam', skip=('bot',))
    m.box(-0.88, 0.88, 0.0, Y0, -0.88, 0.34, 'plat', skip=('bot',))
    m.box(-0.88, 0.88, 0.0, 0.045, 0.34, 0.42, 'cream3', skip=('bot', 'nz'))
    # ---------- salle de prière ----------
    hall = B(-0.2, 0.84, Y0, 0.5, -0.72, 0.18)
    box(m, hall, 'cream')
    m.box(-0.22, 0.86, 0.5, 0.55, -0.74, 0.2, 'cream2', skip=('bot',))
    for k in range(6):
        u = -0.4+k*0.162
        decal(m, hall, 'pz', horseshoe(u, Y0+0.03, 0.27, 0.055, 25, 7), 'cream2', 0.003)
        decal(m, hall, 'pz', horseshoe(u, Y0+0.035, 0.27, 0.045, 25, 7), 'recess', 0.006)
    decal(m, hall, 'pz', rect(-0.56, 0.56, 0.42, 0.47), 'green', 0.003)
    decal(m, hall, 'px', rect(-0.4, 0.4, 0.42, 0.47), 'green', 0.003)
    gable(m, -0.22, 0.86, -0.76, 0.22, 0.55, 0.14, 'green', 'x', 'greend')
    # ---------- minaret ----------
    TX, TZ, H = -0.54, -0.4, 0.29
    m.box(TX-H-0.04, TX+H+0.04, Y0, Y0+0.08, TZ-H-0.04, TZ+H+0.04, 'cream3', skip=('bot',))
    sh = B(TX-H, TX+H, Y0, 2.72, TZ-H, TZ+H)
    box(m, sh, 'cream')
    for face in ('pz', 'px', 'nx', 'nz'):
        # grandes arches en fer à cheval, étage bas
        for uu in (-0.135, 0.135):
            decal(m, sh, face, horseshoe(uu, Y0+0.1, 0.52, 0.1, 25, 8), 'cream2', 0.003)
            decal(m, sh, face, horseshoe(uu, Y0+0.11, 0.52, 0.083, 25, 8), 'recess', 0.006)
        # bandeau vert médian et second plus haut
        for (a, b_) in ((1.05, 1.17), (1.95, 2.1)):
            decal(m, sh, face, rect(-H, H, a, b_), 'green', 0.003)
            for uu in (-0.21, -0.07, 0.07, 0.21):
                decal(m, sh, face, [(uu-0.04, (a+b_)/2), (uu, b_-0.02), (uu+0.04, (a+b_)/2), (uu, a+0.02)], 'cream2', 0.006)
        # étage haut : arcs étroits
        for uu in (-0.18, -0.06, 0.06, 0.18):
            decal(m, sh, face, pointed_arch(uu, 1.3, 1.5, 0.038, 3), 'cream2', 0.003)
            decal(m, sh, face, pointed_arch(uu, 1.31, 1.5, 0.029, 3), 'recess', 0.006)
        for uu in (-0.12, 0.12):
            decal(m, sh, face, horseshoe(uu, 1.6, 1.78, 0.055, 25, 7), 'cream2', 0.003)
            decal(m, sh, face, horseshoe(uu, 1.61, 1.78, 0.045, 25, 7), 'recess', 0.006)
        decal(m, sh, face, rect(-0.24, 0.24, 2.4, 2.62), 'cream2', 0.003)
        for uu in (-0.12, 0.0, 0.12):
            decal(m, sh, face, pointed_arch(uu, 2.44, 2.54, 0.036, 3), 'recess', 0.006)
    m.box(TX-H-0.03, TX+H+0.03, 2.72, 2.8, TZ-H-0.03, TZ+H+0.03, 'cream2', skip=('bot',))
    # lanterne verte
    L = 0.21
    ln = B(TX-L, TX+L, 2.8, 3.0, TZ-L, TZ+L)
    box(m, ln, 'green')
    for face in ('pz', 'px', 'nx', 'nz'):
        for uu in (-0.08, 0.08):
            decal(m, ln, face, pointed_arch(uu, 2.86, 2.94, 0.036, 3), 'cream2', 0.003)
    m.box(TX-L-0.02, TX+L+0.02, 3.0, 3.04, TZ-L-0.02, TZ+L+0.02, 'cream2', skip=('bot',))
    pyramid(m, TX, TZ, L, 3.04, 0.07, 'greenl')
    m.beam((TX, 3.08, TZ), (TX, 3.19, TZ), 0.014, 'gold', w1=0.007)
    ball(m, TX, 3.14, TZ, 0.028, 'gold')
    return m
