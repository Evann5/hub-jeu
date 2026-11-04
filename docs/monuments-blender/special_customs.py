"""Douane : un poste-frontière. Grosse guérite bleu et blanc, route étroite, barrière rouge et blanche épaisse levée au-dessus de la route, petit drapeau."""
import math
from lib import Mesh
from lib_special import *

PAL = {'blue': '#2E5FA3', 'blue2': '#244C84', 'blue3': '#3B72BA', 'wht': '#F3F1EA', 'wht2': '#DAD6CA', 'red': '#CF3128', 'road': '#5A5D66',
       'line': '#ECE8DB', 'glass': '#2F4258', 'dark': '#2A2C33', 'pole': '#B9BDC4', 'yellow': '#E9B93A'}

SCALE = 1.2
RX0, RX1 = 0.0, 0.62       # bords de la route (elle file le long de Z)


def build():
    m = Mesh(PAL)
    # ---------- route (courte, étroite) ----------
    m.box(RX0, RX1, 0, 0.03, -0.5, 0.5, 'road', skip=('bot',))
    for k in range(3):
        z0 = -0.42+0.32*k
        quad_xz(m, 0.28, 0.34, z0, z0+0.18, 0.032, 'line')
    quad_xz(m, RX0, RX1, 0.38, 0.46, 0.032, 'line')          # ligne d'arrêt
    # ---------- guérite ----------
    gx0, gx1, gz0, gz1 = -0.88, -0.14, -0.4, 0.4
    m.box(gx0-0.03, gx1+0.03, 0, 0.1, gz0-0.03, gz1+0.03, 'wht2', skip=('bot',))
    m.box(gx0, gx1, 0.1, 0.58, gz0, gz1, 'blue', skip=('bot', 'top'))
    m.box(gx0-0.015, gx1+0.015, 0.58, 0.67, gz0-0.015, gz1+0.015, 'wht', skip=('bot', 'top'))     # bandeau blanc
    m.box(gx0, gx1, 0.67, 1.12, gz0, gz1, 'blue', skip=('bot', 'top'))
    zf = gz1+0.001
    quad_xy(m, gx0+0.08, gx1-0.08, 0.74, 1.06, zf+0.002, 'wht')
    quad_xy(m, gx0+0.12, gx1-0.12, 0.78, 1.02, zf+0.005, 'glass')
    # porte et fenêtre côté route
    xs = gx1+0.001
    quad_zy(m, -0.3, -0.02, 0.1, 0.9, xs+0.002, 'wht')
    quad_zy(m, -0.26, -0.06, 0.14, 0.86, xs+0.005, 'blue3')
    quad_zy(m, 0.08, 0.3, 0.74, 1.04, xs+0.002, 'glass')
    # toit à quatre pans, rive blanche
    m.box(gx0-0.08, gx1+0.08, 1.12, 1.19, gz0-0.08, gz1+0.1, 'wht', skip=('bot',))
    A = [(gx0-0.08, 1.19, gz0-0.08), (gx1+0.08, 1.19, gz0-0.08), (gx1+0.08, 1.19, gz1+0.1), (gx0-0.08, 1.19, gz1+0.1)]
    B = [(gx0+0.1, 1.42, gz0+0.08), (gx1-0.1, 1.42, gz0+0.08), (gx1-0.1, 1.42, gz1-0.04), (gx0+0.1, 1.42, gz1-0.04)]
    prism3(m, A, B, 'blue2', 'blue2', 'blue3')
    # ---------- barrière : poteau massif, bras épais levé ----------
    px, pz = 0.8, 0.0
    m.box(px-0.15, px+0.15, 0, 0.62, pz-0.15, pz+0.15, 'wht', skip=('bot',))
    m.box(px-0.151, px+0.151, 0.14, 0.28, pz-0.151, pz+0.151, 'red', skip=('bot', 'top'))
    m.box(px-0.17, px+0.17, 0.62, 0.68, pz-0.17, pz+0.17, 'dark', skip=('bot',))
    piv = (px, 0.8, pz)
    ang = math.radians(24)
    d = (-math.cos(ang), math.sin(ang), 0)
    L, nseg = 0.95, 5
    for k in range(nseg):
        a = tuple(piv[i]+d[i]*L*k/nseg for i in range(3))
        b = tuple(piv[i]+d[i]*L*(k+1)/nseg for i in range(3))
        m.beam(a, b, 0.17, 'red' if k % 2 == 0 else 'wht', caps=True)
    m.beam(piv, tuple(piv[i]-d[i]*0.2 for i in range(3)), 0.17, 'wht', caps=True)
    # ---------- drapeau, derrière la guérite ----------
    fx, fz = -0.75, -0.46
    cyl(m, fx, fz, 0.03, 1.1, 2.0, 6, 'pole', cap='pole')
    blob(m, fx, 2.04, fz, 0.05, 0.05, 0.05, 'yellow', 0)
    fl, fh, y1 = 0.5, 0.34, 1.96
    y0 = y1-fh
    for side in (1, -1):
        Q = lambda s, t, dz: (fx+0.03+fl*s, y0+fh*t, fz+dz*side)
        ref = (fx, y0+fh/2, fz-side*3)
        m.poly([Q(0, 0, 0.003), Q(1, 0, 0.003), Q(1, 1, 0.003), Q(0, 1, 0.003)], 'blue', ref)
        m.poly([Q(0, 0, 0.006), Q(0.28, 0, 0.006), Q(1, 0.78, 0.006), Q(1, 1, 0.006), Q(0.72, 1, 0.006), Q(0, 0.22, 0.006)], 'wht', ref)
    return m
