"""Marrakech : la Koutoubia, tour carrée de grès ocre, bandeau de tuiles, lanternon, trois boules d'or, deux palmiers."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'ocre': '#C98B58', 'ocre2': '#DDA874', 'ocre3': '#E8C298', 'recess': '#6B432C', 'recess2': '#8A5A3A',
    'tile': '#2C8A78', 'tile2': '#E8DAB8', 'sand': '#DCC79C', 'lawn': '#7D9B52', 'gold': '#E0B040',
    'trunk': '#8A6B4A', 'leaf': '#4E8A3A', 'leaf2': '#6AA046', 'green': '#2C8A78',
}
Y0 = 0.05

def build():
    m = Mesh(PAL)
    TX, TZ, H = -0.28, -0.1, 0.25
    # ---------- sol ----------
    m.box(-0.88, 0.88, 0.0, Y0, -0.88, 0.88, 'sand', skip=('bot',))
    # petite pelouse devant
    m.box(-0.45, 0.35, Y0, Y0+0.008, 0.28, 0.76, 'lawn', skip=('bot',))
    # ---------- salle de prière attenante ----------
    hall = B(0.04, 0.84, Y0, 0.36, -0.72, 0.0)
    box(m, hall, 'ocre')
    m.box(0.02, 0.86, 0.36, 0.4, -0.74, 0.02, 'ocre3', skip=('bot',))
    for k in range(5):
        u = -0.3+k*0.15
        decal(m, hall, 'pz', pointed_arch(u, Y0+0.04, 0.2, 0.05, 3), 'ocre3', 0.003)
        decal(m, hall, 'pz', pointed_arch(u, Y0+0.045, 0.2, 0.04, 3), 'recess', 0.006)
    # créneaux du toit de la salle
    for k in range(8):
        x = 0.1+k*0.1
        m.box(x, x+0.06, 0.4, 0.45, -0.1, -0.06, 'ocre2', skip=('bot',))
    # ---------- tour ----------
    sh = B(TX-H, TX+H, Y0, 2.2, TZ-H, TZ+H)
    m.box(TX-H-0.03, TX+H+0.03, Y0, Y0+0.07, TZ-H-0.03, TZ+H+0.03, 'ocre2', skip=('bot',))    # socle
    box(m, sh, 'ocre')
    for face in ('pz', 'px', 'nx', 'nz'):
        # meurtrières, décalées d'une face à l'autre
        for (u, v) in ((-0.09, 0.45), (0.1, 0.85), (-0.06, 1.2), (0.0, 1.45)):
            uu = u if face in ('pz', 'px') else -u
            decal(m, sh, face, pointed_arch(uu, v, v+0.08, 0.017, 2), 'recess', 0.003)
        # zone décorée du haut : cadre, trois arcs aveugles, losanges
        decal(m, sh, face, rect(-0.205, 0.205, 1.62, 2.02), 'ocre3', 0.003)
        decal(m, sh, face, rect(-0.19, 0.19, 1.635, 2.005), 'ocre2', 0.006)
        for uu in (-0.115, 0.0, 0.115):
            decal(m, sh, face, pointed_arch(uu, 1.7, 1.86, 0.042, 3), 'ocre3', 0.009)
            decal(m, sh, face, pointed_arch(uu, 1.71, 1.86, 0.032, 3), 'recess', 0.012)
        for uu in (-0.115, 0.0, 0.115):
            decal(m, sh, face, [(uu-0.04, 1.93), (uu, 1.98), (uu+0.04, 1.93), (uu, 1.88)], 'recess2', 0.009)
        # bandeau de tuiles vert-turquoise sous la corniche
        decal(m, sh, face, rect(-H, H, 2.07, 2.17), 'tile', 0.003)
        for uu in (-0.18, -0.06, 0.06, 0.18):
            decal(m, sh, face, [(uu-0.035, 2.12), (uu, 2.155), (uu+0.035, 2.12), (uu, 2.085)], 'tile2', 0.006)
    # corniche et créneaux
    m.box(TX-H-0.025, TX+H+0.025, 2.2, 2.27, TZ-H-0.025, TZ+H+0.025, 'ocre3', skip=('bot',))
    ym = 2.27
    pos = [(-0.2, -0.2), (0.2, -0.2), (0.2, 0.2), (-0.2, 0.2), (-0.07, -0.2), (0.07, -0.2), (-0.07, 0.2), (0.07, 0.2),
           (-0.2, -0.07), (-0.2, 0.07), (0.2, -0.07), (0.2, 0.07)]
    for (a, b_) in pos:
        m.box(TX+a-0.04, TX+a+0.04, ym, ym+0.07, TZ+b_-0.04, TZ+b_+0.04, 'ocre2', skip=('bot',))
    # lanternon
    L = 0.115
    ln = B(TX-L, TX+L, ym, 2.62, TZ-L, TZ+L)
    box(m, ln, 'ocre')
    for face in ('pz', 'px', 'nx', 'nz'):
        decal(m, ln, face, pointed_arch(0, 2.36, 2.48, 0.04, 3), 'ocre3', 0.003)
        decal(m, ln, face, pointed_arch(0, 2.37, 2.48, 0.03, 3), 'recess', 0.006)
        decal(m, ln, face, rect(-L, L, 2.53, 2.58), 'tile', 0.003)
    m.box(TX-L-0.02, TX+L+0.02, 2.62, 2.67, TZ-L-0.02, TZ+L+0.02, 'ocre3', skip=('bot',))
    pyramid(m, TX, TZ, L+0.01, 2.67, 0.12, 'tile')
    # fleuron : mât et trois boules d'or
    m.beam((TX, 2.7, TZ), (TX, 3.06, TZ), 0.014, 'gold', w1=0.008)
    ball(m, TX, 2.8, TZ, 0.05, 'gold')
    ball(m, TX, 2.9, TZ, 0.04, 'gold')
    ball(m, TX, 2.99, TZ, 0.032, 'gold')
    # ---------- palmiers ----------
    palm(m, -0.56, 0.4, 0.95, 0.05, 'trunk', 'leaf', 'leaf2', y0=Y0, fronds=8, flen=0.34)
    palm(m, 0.5, 0.5, 0.8, -0.05, 'trunk', 'leaf', 'leaf2', y0=Y0, fronds=8, flen=0.3)
    return m
