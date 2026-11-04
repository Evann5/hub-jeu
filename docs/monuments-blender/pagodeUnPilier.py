"""Hà Nội (Vietnam) : la pagode au pilier unique (Chùa Một Cột) sur son étang, escalier de pierre, lotus."""
import math
from lib import Mesh
from lib_vietnam_japon import *

PAL = {'stone': '#B8AE9E', 'stone_d': '#8F8576', 'stone_l': '#CFC7B8', 'water': '#5A9A94', 'wood': '#7A4A32', 'wall': '#6E2F25',
       'red': '#A63A2A', 'tile': '#6E4A38', 'tile_l': '#8A6249', 'gold': '#D1A63E', 'dark': '#2B211C',
       'leaf': '#5E9A52', 'leaf_d': '#4C8545', 'pink': '#E58CA7', 'pink_l': '#F3B7C8'}

def build():
    m = Mesh(PAL)
    # étang entouré d'une margelle
    R, T = 0.90, 0.10
    m.box(-R, R, 0, 0.07, -R, -R+T, 'stone', skip=('bot',))
    m.box(-R, R, 0, 0.07, R-T, R, 'stone', skip=('bot',))
    m.box(-R, -R+T, 0, 0.07, -R+T, R-T, 'stone', skip=('bot',))
    m.box(R-T, R, 0, 0.07, -R+T, R-T, 'stone', skip=('bot',))
    m.box(-R+T, R-T, 0, 0.05, -R+T, R-T, 'water', skip=('bot',))
    # feuilles et fleurs de lotus
    pads = [(-0.55, 0.45, 0.11), (-0.35, 0.10, 0.08), (-0.58, -0.30, 0.10), (0.55, 0.35, 0.10), (0.62, -0.05, 0.08),
            (0.40, -0.55, 0.11), (-0.25, -0.60, 0.08), (0.28, 0.70, 0.08), (-0.30, 0.68, 0.07)]
    for i, (x, z, r) in enumerate(pads):
        cyl(m, x, z, 0.05, 0.062, r, 'leaf' if i % 2 else 'leaf_d', n=8, caps=(False, True))
    for (x, z) in [(-0.50, 0.42), (0.58, 0.32), (0.38, -0.52), (-0.55, -0.28)]:
        cyl(m, x, z, 0.062, 0.14, 0.05, 'pink', 0.0, n=6, caps=(False, False))
        cyl(m, x+0.01, z-0.01, 0.062, 0.115, 0.035, 'pink_l', 0.0, n=5, caps=(False, False), rot=0.4)
    # pilier de pierre
    cyl(m, 0, 0, 0.05, 0.10, 0.20, 'stone_d', 0.17, n=8)
    cyl(m, 0, 0, 0.10, 0.86, 0.13, 'stone', 0.12, n=8, caps=(False, False))
    cyl(m, 0, 0, 0.44, 0.49, 0.155, 'stone_d', n=8)
    # consoles de bois, plancher
    m.box(-0.30, 0.30, 0.86, 0.92, -0.055, 0.055, 'wood', skip=('bot',))
    m.box(-0.055, 0.055, 0.86, 0.92, -0.30, 0.30, 'wood', skip=('bot',))
    m.box(-0.34, 0.34, 0.92, 0.98, -0.34, 0.34, 'wood', skip=('bot',))
    # escalier de pierre vers la porte, avec rampes de bois
    for k in range(12):
        top = 0.12+0.073*k
        m.box(-0.30, -0.12, 0.05, top, 0.34, 0.80-0.038*k, 'stone_l', skip=('bot', 'nz'))
    for s in (-1, 1):
        m.beam((-0.21+s*0.105, 0.22, 0.80), (-0.21+s*0.105, 1.05, 0.36), 0.026, 'wood', caps=True)
    # pavillon : quatre poteaux, fond sombre, toit à coins relevés
    y0, y1 = 0.98, 1.26
    m.box(-0.27, 0.27, y0, y1, -0.27, -0.23, 'wall', skip=('bot',))
    m.box(-0.27, -0.23, y0, y1, -0.23, 0.27, 'wall', skip=('bot',))
    m.box(0.23, 0.27, y0, y1, -0.23, 0.27, 'wall', skip=('bot',))
    for x in (-0.27, 0.27):
        m.box(x-0.022, x+0.022, y0, y1, 0.25, 0.30, 'red', skip=('bot',))
    m.box(-0.30, 0.30, y1-0.04, y1, -0.30, 0.30, 'red', skip=('bot',))
    m.box(-0.20, 0.20, y0, y0+0.10, 0.26, 0.285, 'red', skip=('bot',))   # garde-corps de façade
    roof(m, 0, 0, y1, 0.38, 0.38, 0.30, 'tile', top=(0.04, 0.04), lift=0.09, flare=0.07)
    cyl(m, 0, 0, y1+0.29, y1+0.37, 0.03, 'gold', n=6)
    blob(m, 0, y1+0.40, 0, 0.032, 0.04, 0.032, 'gold', n=6, lats=(-60, 0, 60))
    return m
