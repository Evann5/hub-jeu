"""Bordeaux : la place de la Bourse. Pavillon central à grande arche, deux ailes à arcades concaves, pavillons d'angle coiffés
d'un toit d'ardoise, fontaine des Trois Grâces et miroir d'eau devant."""
import math
from lib_france_usa import *

PAL = {'stone': '#E4D6B2', 'stone2': '#D0C097', 'slate': '#5E6773', 'slate2': '#76808C', 'dark': '#5C4C3B', 'water': '#A6CAD6',
       'water2': '#C6DEE4', 'paving': '#CDBF9F', 'border': '#BBAC8A', 'gold': '#CFA94C', 'fount': '#D9CEB4'}

Y0, YA, YU, YC = 0.04, 0.29, 0.59, 0.63     # sol, haut des arcades, haut de l'étage, haut de la corniche

def wing(m, sgn):
    """Aile à 4 travées, repère local : façade dans le plan z = 0, u croissant vers l'extérieur (x = sgn * u)."""
    nb, bw = 4, 0.104
    def X(u): return sgn*u
    with m.frame(-10*sgn, sgn*0.20, 0, -0.40):
        L = nb*bw
        for k in range(nb):
            ua, ub = k*bw, (k+1)*bw
            xa, xb = sorted((X(ua), X(ub)))
            arch_bay(m, xa, xb, Y0, YA, 0.0, 0.05, 'stone', 'dark', S0=0.17, S1=0.83, gap=0.02)
            win_bay(m, xa, xb, YA+0.03, YU, 0.0, 0.03, 'stone', 'dark', S0=0.22, S1=0.78, G0=0.08, G1=0.08)
        xa, xb = sorted((X(0), X(L)))
        m.box(xa, xb, Y0, YU, -0.27, -0.001, 'stone', skip=('bot', 'pz', 'top'))
        m.box(xa, xb, YA, YA+0.03, -0.01, 0.014, 'stone2', skip=('bot', 'nz'))
        m.box(xa-0.0, xb+0.0, YU, YC, -0.27, 0.025, 'stone2', skip=('bot',))
        # comble mansardé à la Mansart + lucarnes
        x0m, x1m = xa+0.012, xb-0.012
        frustum(m, (xa, xb, -0.27, 0.025), (x0m, x1m, -0.23, -0.035), YC, YC+0.12, 'slate')
        for k in range(nb):
            xc = X((k+0.5)*bw)
            m.box(xc-0.018, xc+0.018, YC+0.025, YC+0.085, -0.045, 0.012, 'stone', skip=('bot',))
            flat_rect(m, xc-0.010, xc+0.010, YC+0.035, YC+0.075, 0.0125, 'dark')
        # pavillon d'extrémité, un peu en avant
        uc = L+0.10
        xa2, xb2 = sorted((X(L), X(L+0.20)))
        zf = 0.035
        arch_bay(m, xa2, xb2, Y0, YA+0.01, zf, 0.05, 'stone', 'dark', S0=0.2, S1=0.8, gap=0.02)
        win_bay(m, xa2, xb2, YA+0.04, YU+0.01, zf, 0.03, 'stone', 'dark', S0=0.28, S1=0.72, G0=0.1, G1=0.1)
        m.box(xa2, xb2, Y0, YU+0.01, -0.27, zf-0.001, 'stone', skip=('bot', 'pz', 'top'))
        m.box(xa2-0.012, xb2+0.012, YA+0.01, YA+0.04, -0.01, zf+0.015, 'stone2', skip=('bot', 'nz'))
        m.box(xa2-0.012, xb2+0.012, YU+0.01, YC+0.02, -0.28, zf+0.025, 'stone2', skip=('bot',))
        xs = sorted((X(L), X(L+0.20)))
        frustum(m, (xs[0]-0.012, xs[1]+0.012, -0.28, zf+0.025), (xs[0]+0.03, xs[1]-0.03, -0.22, zf-0.03), YC+0.02, YC+0.15, 'slate2')
        frustum(m, (xs[0]+0.03, xs[1]-0.03, -0.22, zf-0.03), (X(L+0.10)-0.025, X(L+0.10)+0.025, -0.16, -0.06), YC+0.15, YC+0.22, 'slate2')
        m.box(X(L+0.10)-0.008, X(L+0.10)+0.008, YC+0.22, YC+0.30, -0.118, -0.102, 'gold')

def build():
    m = XM(PAL)
    # place, miroir d'eau, bordure
    m.box(-0.89, 0.89, 0.0, Y0, -0.84, 0.84, 'paving', skip=('bot',))
    m.box(-0.64, 0.64, Y0, Y0+0.016, 0.28, 0.80, 'border', skip=('bot',))
    w = 0.60
    m.poly([(-w, Y0+0.0162, 0.31), (w, Y0+0.0162, 0.31), (w, Y0+0.0162, 0.77), (-w, Y0+0.0162, 0.77)], 'water', (0, 0, 0.5))
    # reflets de la façade dans l'eau
    for (xa, xb, za, zb) in ((-0.20, 0.20, 0.33, 0.46), (-0.55, -0.22, 0.33, 0.40), (0.22, 0.55, 0.33, 0.40), (-0.12, 0.12, 0.50, 0.58)):
        m.poly([(xa, Y0+0.0165, za), (xb, Y0+0.0165, za), (xb, Y0+0.0165, zb), (xa, Y0+0.0165, zb)], 'water2', (0, 0, 0.5))
    # ailes
    wing(m, 1); wing(m, -1)
    # pavillon central
    zf, zb = -0.36, -0.72
    arch_bay(m, -0.20, 0.20, Y0, 0.46, zf, 0.07, 'stone', 'dark', S0=0.17, S1=0.83, gap=0.02)
    m.box(-0.20, 0.20, Y0, 0.62, zb, zf-0.001, 'stone', skip=('bot', 'pz', 'top'))
    for sx in (-1, 1):
        prism(m, sx*0.192, zf+0.012, 0.022, 0.022, Y0, 0.46, 6, 'stone2')
    m.box(-0.22, 0.22, 0.46, 0.50, zb, zf+0.03, 'stone2', skip=('bot',))
    win_bay(m, -0.20, 0.20, 0.50, 0.66, zf, 0.03, 'stone', 'dark', S0=0.3, S1=0.7, G0=0.12, G1=0.12)
    m.box(-0.22, 0.22, 0.66, 0.70, zb-0.01, zf+0.03, 'stone2', skip=('bot',))
    # fronton triangulaire devant le comble
    m.poly([(-0.20, 0.70, zf+0.03), (0.20, 0.70, zf+0.03), (0.0, 0.80, zf+0.03)], 'stone', (0, 0.7, zf-1))
    frustum(m, (-0.22, 0.22, zb-0.01, zf+0.03), (-0.14, 0.14, -0.64, -0.44), 0.70, 0.93, 'slate')
    frustum(m, (-0.14, 0.14, -0.64, -0.44), (-0.08, 0.08, -0.60, -0.48), 0.93, 1.07, 'slate2')
    m.box(-0.05, 0.05, 1.07, 1.12, -0.59, -0.49, 'stone2')
    cone(m, 0, -0.54, 0.06, 0.06, 1.12, 1.26, 6, 'slate2')
    m.box(-0.008, 0.008, 1.26, 1.34, -0.548, -0.532, 'gold')
    # fontaine des Trois Grâces
    lathe(m, 0, -0.03, [(0.17, Y0), (0.17, 0.095, 'fount'), (0.145, 0.095), (0.145, 0.07, 'fount', True), (0.145, 0.07), (0.0, 0.07, 'water2'),
                        ], 16, 'fount')
    lathe(m, 0, -0.03, [(0.045, 0.07), (0.03, 0.22, 'fount'), (0.09, 0.25), (0.09, 0.275, 'fount'), (0.0, 0.275)], 10, 'fount')
    lathe(m, 0, -0.03, [(0.026, 0.275), (0.02, 0.36, 'gold'), (0.03, 0.40), (0.0, 0.43)], 6, 'gold')
    return m
