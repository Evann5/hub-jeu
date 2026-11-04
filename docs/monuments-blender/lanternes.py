"""Hội An (Vietnam) : maison jaune à toit de tuiles au bord de la rivière, guirlandes de lanternes, sampan."""
import math
from lib import Mesh, lerp
from lib_vietnam_japon import *

PAL = {'yellow': '#E0B03A', 'tile': '#A9532F', 'tile_d': '#7E3B24', 'wood': '#6B4A33', 'wood_l': '#A07A55',
       'shut': '#3F7A68', 'stone': '#B3A691', 'water': '#4F9490', 'water_l': '#7DB5AC',
       'coral': '#D4876A', 'blue': '#3E6FA5', 'dark': '#2E2824',
       'red': '#C5362B', 'orange': '#E0801F', 'lyel': '#EFC53D', 'pink': '#C23F73', 'green': '#6BA24E', 'sky': '#3F8FC0'}
LANT = ['red', 'orange', 'lyel', 'pink', 'green', 'sky']

def lantern(m, x, y, z, r, col):
    blob(m, x, y, z, r, r*1.2, r, col, n=6, lats=(-62, 0, 62))

def build():
    m = Mesh(PAL)
    # rive, berge et rivière
    m.box(-0.88, 0.88, 0, 0.10, -0.88, 0.0, 'stone', skip=('bot',))
    m.box(-0.88, 0.88, 0, 0.05, 0.0, 0.88, 'water', skip=('bot',))
    for (x0, x1, z0, z1) in [(-0.7, -0.35, 0.18, 0.21), (0.0, 0.5, 0.62, 0.65), (-0.45, 0.0, 0.76, 0.79)]:
        m.box(x0, x1, 0.05, 0.056, z0, z1, 'water_l', skip=('bot',))

    # maison jaune : rez-de-chaussée sous un balcon, étage, toit de tuiles
    m.box(-0.62, 0.28, 0.10, 0.66, -0.74, -0.24, 'yellow', skip=('bot',))
    m.box(-0.60, 0.26, 0.66, 1.08, -0.72, -0.26, 'yellow', skip=('bot',))
    # portes et fenêtres : volets verts, intérieur sombre
    def window(cx, y0, y1, z, hw=0.035, leaf=0.05):
        m.box(cx-hw, cx+hw, y0, y1, z-0.006, z, 'dark', skip=('bot', 'nz'))
        for s in (-1, 1):
            a, b = sorted([cx+s*hw, cx+s*(hw+leaf)])
            m.box(a, b, y0, y1, z-0.012, z, 'shut', skip=('bot', 'nz'))
    for cx in (-0.45, -0.17, 0.11):
        window(cx, 0.76, 1.0, -0.26)
    m.box(-0.25, -0.09, 0.10, 0.50, -0.248, -0.24, 'dark', skip=('bot', 'nz'))
    window(-0.52 + 0.04, 0.26, 0.50, -0.24)
    window(0.12, 0.26, 0.50, -0.24)
    # balcon de bois sur deux poteaux
    m.box(-0.54, 0.22, 0.62, 0.67, -0.26, -0.09, 'wood', skip=('bot',))
    for x in (-0.52, 0.20):
        m.box(x-0.018, x+0.018, 0.10, 0.62, -0.128, -0.092, 'wood', skip=('bot',))
    for i in range(6):
        x = -0.52 + 0.74*i/5
        m.box(x-0.012, x+0.012, 0.67, 0.78, -0.115, -0.095, 'wood_l', skip=('bot',))
    m.box(-0.54, 0.22, 0.78, 0.81, -0.12, -0.09, 'wood', skip=('bot',))
    # toit
    roof(m, -0.17, -0.49, 1.08, 0.48, 0.36, 0.32, 'tile', top=(0.32, 0.0), lift=0.05, flare=0.03)
    m.box(-0.51, 0.17, 1.38, 1.43, -0.52, -0.46, 'tile_d', skip=('bot',))

    # maison voisine
    m.box(0.36, 0.80, 0.10, 0.70, -0.70, -0.30, 'coral', skip=('bot',))
    window(0.58, 0.30, 0.56, -0.30, hw=0.03, leaf=0.045)
    m.box(0.52, 0.64, 0.10, 0.28, -0.306, -0.30, 'dark', skip=('bot', 'nz'))
    roof(m, 0.58, -0.50, 0.70, 0.27, 0.25, 0.24, 'tile', top=(0.10, 0.0), lift=0.04, flare=0.02)

    # deux mâts plantés dans l'eau et les guirlandes
    for x in (-0.80, 0.80):
        m.beam((x, 0.0, 0.62), (x, 1.12, 0.62), 0.05, 'wood', w1=0.036, caps=True)
    def garland(a, b, drop, k, c0=0, r=0.062):
        pts = sag(a, b, drop, k)
        tube(m, pts, 0.016, 'dark')
        for i in range(k):
            p = lerp(a, b, (i+0.5)/k)
            y = a[1]+(b[1]-a[1])*(i+0.5)/k-drop*4*((i+0.5)/k)*(1-(i+0.5)/k)
            lantern(m, p[0], y-0.1, p[2], r, LANT[(i+c0) % len(LANT)])
            m.beam((p[0], y, p[2]), (p[0], y-0.03, p[2]), 0.012, 'dark')
    garland((-0.80, 1.07, 0.62), (0.80, 1.07, 0.62), 0.28, 9)
    garland((-0.80, 1.02, 0.62), (-0.54, 0.86, -0.10), 0.07, 4, c0=2, r=0.056)
    garland((0.80, 1.02, 0.62), (0.22, 0.86, -0.10), 0.10, 5, c0=4, r=0.056)
    # grandes lanternes sous le balcon
    lantern(m, -0.17, 0.50, -0.12, 0.085, 'red')
    lantern(m, 0.07, 0.50, -0.12, 0.075, 'orange')

    # sampan
    cx, cz, L, B = 0.30, 0.40, 0.30, 0.09
    us = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1]
    rings, deck = [], []
    for u in us:
        x = cx+L*u
        w = B*math.sqrt(max(0.0, 1-u*u))+0.004
        yt = 0.15+0.08*abs(u)**3
        rings.append([(x, yt, cz-w), (x, yt, cz+w), (x, 0.04, cz+w*0.55), (x, 0.04, cz-w*0.55)])
        deck.append((x, 0.125, cz+w*0.8))
    m.loft(rings, 'blue')
    m.poly(deck+[(x, 0.125, 2*cz-z) for (x, _, z) in reversed(deck)], 'wood_l', (cx, 0.0, cz))
    m.beam((cx-0.2, 0.125, cz), (cx-0.2, 0.40, cz), 0.016, 'wood')
    lantern(m, cx-0.2, 0.44, cz, 0.05, 'red')
    return m
