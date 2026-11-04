"""Douane : un poste-frontière. Guérite bleu et blanc, barrière rouge et blanche levée au-dessus de la route, petit drapeau."""
import math
from lib import Mesh
from lib_special import *

PAL = {'blue': '#2E5FA3', 'blue2': '#244C84', 'blue3': '#3B72BA', 'wht': '#F3F1EA', 'wht2': '#DAD6CA', 'red': '#C9332B', 'road': '#5A5D66',
       'line': '#ECE8DB', 'glass': '#2F4258', 'dark': '#2A2C33', 'pole': '#B9BDC4', 'yellow': '#E9B93A'}

SCALE = 1.12
RX0, RX1 = -0.3, 0.72      # bords de la route (elle file le long de Z)


def build():
    m = Mesh(PAL)
    # ---------- route ----------
    m.box(RX0, RX1, 0, 0.025, -0.72, 0.72, 'road', skip=('bot',))
    for k in range(5):
        z0 = -0.64+0.28*k
        quad_xz(m, 0.2, 0.25, z0, z0+0.15, 0.027, 'line')
    quad_xz(m, RX0, RX1, 0.32, 0.4, 0.027, 'line')          # ligne d'arrêt
    quad_xz(m, RX0+0.02, RX0+0.05, -0.72, 0.72, 0.027, 'line')
    quad_xz(m, RX1-0.05, RX1-0.02, -0.72, 0.72, 0.027, 'line')
    # ---------- guérite ----------
    gx0, gx1, gz0, gz1 = -1.0, -0.4, -0.3, 0.3
    m.box(gx0-0.02, gx1+0.02, 0, 0.1, gz0-0.02, gz1+0.02, 'wht2', skip=('bot',))
    m.box(gx0, gx1, 0.1, 0.55, gz0, gz1, 'blue', skip=('bot', 'top'))
    m.box(gx0-0.012, gx1+0.012, 0.55, 0.63, gz0-0.012, gz1+0.012, 'wht', skip=('bot', 'top'))     # bandeau blanc
    m.box(gx0, gx1, 0.63, 1.04, gz0, gz1, 'blue', skip=('bot', 'top'))
    # fenêtre avant, cadre blanc
    zf = gz1+0.001
    quad_xy(m, gx0+0.08, gx1-0.08, 0.7, 0.97, zf+0.002, 'wht')
    quad_xy(m, gx0+0.11, gx1-0.11, 0.73, 0.94, zf+0.005, 'glass')
    m.box(gx0+0.06, gx1-0.06, 0.66, 0.7, gz1, gz1+0.06, 'wht', skip=('bot',))        # tablette
    # porte et fenêtre côté route
    xs = gx1+0.001
    quad_zy(m, -0.2, 0.0, 0.1, 0.8, xs+0.002, 'wht')
    quad_zy(m, -0.17, -0.03, 0.14, 0.76, xs+0.005, 'blue3')
    quad_zy(m, 0.08, 0.24, 0.7, 0.94, xs+0.002, 'glass')
    # toit à quatre pans, bleu foncé, rive blanche
    m.box(gx0-0.07, gx1+0.07, 1.04, 1.1, gz0-0.07, gz1+0.09, 'wht', skip=('bot',))
    A = [(gx0-0.07, 1.1, gz0-0.07), (gx1+0.07, 1.1, gz0-0.07), (gx1+0.07, 1.1, gz1+0.09), (gx0-0.07, 1.1, gz1+0.09)]
    B = [(gx0+0.08, 1.3, gz0+0.06), (gx1-0.08, 1.3, gz0+0.06), (gx1-0.08, 1.3, gz1-0.04), (gx0+0.08, 1.3, gz1-0.04)]
    prism3(m, A, B, 'blue2', 'blue2', 'blue3')
    # ---------- barrière ----------
    px, pz = 0.84, 0.0
    m.box(px-0.12, px+0.12, 0, 0.5, pz-0.12, pz+0.12, 'wht', skip=('bot',))
    m.box(px-0.121, px+0.121, 0.12, 0.22, pz-0.121, pz+0.121, 'red', skip=('bot', 'top'))
    m.box(px-0.135, px+0.135, 0.5, 0.55, pz-0.135, pz+0.135, 'dark', skip=('bot',))
    piv = (px, 0.66, pz)
    ang = math.radians(56)
    d = (-math.cos(ang), math.sin(ang), 0)
    L, nseg = 1.35, 6
    for k in range(nseg):
        a = tuple(piv[i]+d[i]*L*k/nseg for i in range(3))
        b = tuple(piv[i]+d[i]*L*(k+1)/nseg for i in range(3))
        m.beam(a, b, 0.1, 'red' if k % 2 == 0 else 'wht', caps=True)
    m.beam(piv, tuple(piv[i]-d[i]*0.22 for i in range(3)), 0.1, 'wht', caps=True)
    m.box(px+0.07, px+0.2, 0.5, 0.7, pz-0.08, pz+0.08, 'dark', skip=('bot',))
    cyl(m, px, pz, 0.06, 0.55, 0.68, 8, 'pole', cap='pole')
    # ---------- drapeau (bleu, bande blanche en diagonale) ----------
    fx, fz = -0.86, -0.44
    cyl(m, fx, fz, 0.025, 0, 2.1, 6, 'pole', cap='pole')
    cyl(m, fx, fz, 0.07, 0, 0.05, 8, 'wht2', cap='wht2')
    blob(m, fx, 2.13, fz, 0.04, 0.04, 0.04, 'yellow', 0)
    fl, fh, y1 = 0.62, 0.4, 2.05
    y0 = y1-fh
    for side in (1, -1):
        Q = lambda s, t, dz: (fx+0.025+fl*s, y0+fh*t, fz+dz*side)
        ref = (fx, y0+fh/2, fz-side*3)
        m.poly([Q(0, 0, 0.003), Q(1, 0, 0.003), Q(1, 1, 0.003), Q(0, 1, 0.003)], 'blue', ref)
        m.poly([Q(0, 0, 0.006), Q(0.28, 0, 0.006), Q(1, 0.78, 0.006), Q(1, 1, 0.006), Q(0.72, 1, 0.006), Q(0, 0.22, 0.006)], 'wht', ref)
    return m
