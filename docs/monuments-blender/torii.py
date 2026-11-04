"""Kyoto (Japon) : un torii vermillon sur une allée de pierre, lanterne de pierre, cerisier en fleurs."""
import math
from lib import Mesh
from lib_vietnam_japon import *

PAL = {'sand': '#DACDB2', 'path': '#9C968B', 'path_l': '#B3ADA1', 'red': '#CC4329', 'red_d': '#A9331F', 'black': '#2A2523',
       'stone': '#A8A296', 'stone_d': '#857F74', 'glow': '#F0D79A', 'trunk': '#5B4337', 'pink': '#F0A9BC', 'pink_l': '#F8CDD8', 'pink_d': '#E08AA3'}

def torii(m, cz, k=1.0):
    hx, ht = 0.40*k, 1.38*k
    for s in (-1, 1):
        cyl(m, s*hx, cz, 0.06, 0.24*k, 0.074*k, 'black', 0.07*k, n=8, caps=(False, False))
        cyl(m, s*hx, cz, 0.24*k, ht, 0.068*k, 'red', 0.058*k, n=8, caps=(False, True))
    # nuki : poutre traversante ; gakuzuka : support central
    m.box(-hx-0.10*k, hx+0.10*k, 1.08*k, 1.19*k, cz-0.045, cz+0.045, 'red', skip=('bot',))
    m.box(-0.035, 0.035, 1.19*k, ht, cz-0.03, cz+0.03, 'red_d', skip=('bot',))
    # shimaki noir puis kasagi incurvé
    m.box(-hx-0.17*k, hx+0.17*k, ht, ht+0.06*k, cz-0.055, cz+0.055, 'black', skip=('bot',))
    xs = [-0.68, -0.5, -0.3, -0.1, 0.1, 0.3, 0.5, 0.68]
    rings = []
    for x in xs:
        x = x*k
        yb = ht+0.06*k+0.07*k*(abs(x/k)/0.68)**3
        rings.append([(x, yb, cz-0.085), (x, yb, cz+0.085), (x, yb+0.075*k, cz+0.085), (x, yb+0.075*k, cz-0.085)])
    m.loft(rings, 'black', caps=(True, True), ref_fn=lambda i: (0, 1.5, cz))

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.03, -0.88, 0.88, 'sand', skip=('bot',))
    # allée de dalles
    for i, z in enumerate([0.80, 0.52, 0.24, -0.04]):
        m.box(-0.20, 0.20, 0.03, 0.06, z-0.12, z+0.12, 'path' if i % 2 else 'path_l', skip=('bot',))
    m.box(-0.20, 0.20, 0.03, 0.06, -0.50, -0.24, 'path_l', skip=('bot',))
    torii(m, -0.12)
    # lanterne de pierre (ishidôrô)
    lx, lz = 0.58, 0.30
    m.box(lx-0.07, lx+0.07, 0.03, 0.07, lz-0.07, lz+0.07, 'stone_d', skip=('bot',))
    cyl(m, lx, lz, 0.07, 0.30, 0.03, 'stone', n=6)
    m.box(lx-0.07, lx+0.07, 0.30, 0.36, lz-0.07, lz+0.07, 'stone_d', skip=('bot',))
    m.box(lx-0.045, lx+0.045, 0.36, 0.45, lz-0.045, lz+0.045, 'glow', skip=('bot',))
    roof(m, lx, lz, 0.45, 0.11, 0.11, 0.09, 'stone', top=(0.0, 0.0), lift=0.015, flare=0.01)
    blob(m, lx, 0.56, lz, 0.025, 0.03, 0.025, 'stone_d', n=6, lats=(-60, 0, 60))
    # cerisier
    tx, tz = -0.42, -0.50
    f = 0.88
    pts = [(tx, 0.03, tz), (tx+0.03, 0.4, tz+0.02), (tx+0.08, 0.78, tz+0.0)]
    m.beam(pts[0], pts[1], 0.11, 'trunk', w1=0.08, caps=True, sides=4)
    m.beam(pts[1], pts[2], 0.08, 'trunk', w1=0.05, caps=True, sides=4)
    m.beam(pts[1], (tx-0.18, 0.82, tz+0.10), 0.05, 'trunk', w1=0.03)
    m.beam(pts[2], (tx+0.26, 1.08, tz-0.05), 0.04, 'trunk', w1=0.025)
    for (dx, dy, dz, r, c) in [(0.0, 1.10, 0.0, 0.30, 'pink'), (-0.24, 0.98, 0.12, 0.24, 'pink_d'), (0.30, 1.22, -0.04, 0.22, 'pink'),
                               (0.12, 1.40, -0.02, 0.20, 'pink_l'), (-0.14, 1.28, 0.10, 0.19, 'pink_l'), (0.18, 0.95, 0.20, 0.17, 'pink_d')]:
        blob(m, tx+dx*f, dy, tz+dz*f, r*f, r*0.78, r*f, c, n=7, lats=(-65, -25, 25, 65), rot=dx*5)
    # pétales sur l'allée
    for (x, z) in [(-0.10, 0.62), (0.12, 0.40), (-0.05, 0.12), (0.1, -0.35), (-0.14, 0.88), (0.05, 0.70)]:
        m.box(x-0.02, x+0.02, 0.06, 0.063, z-0.02, z+0.02, 'pink', skip=('bot',))
    return m
