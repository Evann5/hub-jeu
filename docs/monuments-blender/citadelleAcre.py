"""Saint-Jean-d'Acre (Israël) : remparts de pierre crénelés au bord de l'eau, tour de porte, tours rondes et donjon."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'sea': '#2F86C2', 'shallow': '#6BC0D8', 'foam': '#EEF6F7', 'sand': '#E6D3A0', 'stone': '#DCC48F', 'stone_d': '#BFA06E', 'stone_l': '#EBD9AE',
       'dark': '#3E2E24', 'tile': '#B5543A', 'tile2': '#9C4430', 'hull': '#7B4F2B', 'sail': '#F4F0E6'}

LAND = [(-0.88, -0.88), (0.88, -0.88), (0.88, 0.14), (0.6, 0.38), (0.2, 0.32), (-0.2, 0.4), (-0.6, 0.28), (-0.88, 0.3)]
SHALLOW = [(-0.88, -0.88), (0.88, -0.88), (0.88, 0.3), (0.6, 0.5), (0.2, 0.44), (-0.2, 0.52), (-0.6, 0.4), (-0.88, 0.42)]


def round_tower(m, x, z, r, h):
    cyl(m, x, z, 0.09, 0.22, r+0.04, 'stone_d', r, n=10, caps=(False, False))
    cyl(m, x, z, 0.22, h, r, 'stone', n=10, caps=(False, False))
    cyl(m, x, z, h, h+0.025, r+0.025, 'stone_l', n=10, caps=(False, True))
    for k in range(8):
        a = 2*math.pi*k/8
        cx, cz = x+(r-0.02)*math.cos(a), z+(r-0.02)*math.sin(a)
        m.box(cx-0.03, cx+0.03, h+0.025, h+0.095, cz-0.03, cz+0.03, 'stone', skip=('bot',))


def build():
    m = Mesh(PAL)
    plate(m, 'sea', 0.04)
    prism_xz(m, SHALLOW, 0.04, 0.055, 'shallow', 'shallow')
    prism_xz(m, LAND, 0.04, 0.09, 'stone_d', 'sand')
    # écume au pied du rempart
    for (x, z, w) in ((-0.6, 0.5, 0.2), (-0.15, 0.55, 0.16), (0.3, 0.5, 0.22), (0.7, 0.4, 0.14), (-0.82, 0.45, 0.1)):
        m.box(x-w/2, x+w/2, 0.055, 0.067, z, z+0.035, 'foam', skip=('bot',))
    # courtine de front sur l'eau (pied incliné + mur + chemin de ronde)
    tbox(m, 0, 0.1, 0.09, 0.22, 0.82, 0.14, 0.79, 0.11, 'stone_d')
    m.box(-0.79, 0.79, 0.22, 0.52, -0.01, 0.21, 'stone', skip=('bot',))
    m.box(-0.8, 0.8, 0.52, 0.55, -0.02, 0.22, 'stone_l', skip=('bot',))
    crenels(m, -0.76, 0.76, 0.17, 0.215, 0.55, 'stone', 0.13, 0.065, 0.075)
    crenels(m, -0.76, 0.76, -0.015, 0.03, 0.55, 'stone', 0.13, 0.065, 0.075)
    # murs de retour et mur du fond
    for sgn in (-1, 1):
        x0, x1 = (0.6, 0.82) if sgn > 0 else (-0.82, -0.6)
        m.box(x0, x1, 0.09, 0.44, -0.72, 0.0, 'stone', skip=('bot',))
        m.box(x0-0.01, x1+0.01, 0.44, 0.465, -0.73, 0.0, 'stone_l', skip=('bot',))
        crenels(m, sgn*0.8-0.022, sgn*0.8+0.022, -0.7, -0.03, 0.465, 'stone', 0.13, 0.06, 0.07, 'z')
    m.box(-0.6, 0.6, 0.09, 0.44, -0.78, -0.64, 'stone', skip=('bot',))
    m.box(-0.61, 0.61, 0.44, 0.465, -0.79, -0.63, 'stone_l', skip=('bot',))
    crenels(m, -0.58, 0.58, -0.78, -0.745, 0.465, 'stone', 0.13, 0.065, 0.07)
    # tours rondes aux angles de la façade
    round_tower(m, -0.64, 0.1, 0.2, 0.8)
    round_tower(m, 0.64, 0.1, 0.2, 0.8)
    # tour de porte centrale avec son arc
    m.box(-0.2, 0.2, 0.09, 0.84, -0.08, 0.3, 'stone', skip=('bot', 'top'))
    m.box(-0.22, 0.22, 0.84, 0.87, -0.1, 0.32, 'stone_l', skip=('bot',))
    crenels(m, -0.19, 0.19, 0.28, 0.32, 0.87, 'stone', 0.12, 0.06, 0.075)
    crenels(m, -0.19, 0.19, -0.1, -0.06, 0.87, 'stone', 0.12, 0.06, 0.075)
    crenels(m, -0.2, -0.16, -0.05, 0.27, 0.87, 'stone', 0.12, 0.06, 0.075, 'z')
    crenels(m, 0.16, 0.2, -0.05, 0.27, 0.87, 'stone', 0.12, 0.06, 0.075, 'z')
    zf = 0.304
    arch = [(-0.09, 0.09), (0.09, 0.09), (0.09, 0.3), (0.05, 0.38), (0.0, 0.4), (-0.05, 0.38), (-0.09, 0.3)]
    m.poly([(x, y, zf) for x, y in arch], 'dark', (0, 0.2, zf-1))
    m.box(-0.1, 0.1, 0.09, 0.095, 0.3, 0.34, 'stone_l', skip=('bot',))
    # donjon derrière, toit de tuiles
    m.box(-0.26, 0.26, 0.09, 1.0, -0.58, -0.2, 'stone', skip=('bot', 'top'))
    m.box(-0.28, 0.28, 1.0, 1.03, -0.6, -0.18, 'stone_l', skip=('bot',))
    gable(m, -0.3, 0.3, -0.62, -0.16, 1.03, 0.2, 'tile', 'tile2', 'x')
    for yy in (0.45, 0.75):
        m.poly([(-0.04, yy, -0.196), (0.04, yy, -0.196), (0.04, yy+0.12, -0.196), (-0.04, yy+0.12, -0.196)], 'dark', (0, yy, -2))
    # barque
    m.box(0.3, 0.5, 0.055, 0.1, 0.62, 0.7, 'hull', skip=('bot',))
    tri = [(0.4, 0.1, 0.66), (0.4, 0.3, 0.66), (0.48, 0.1, 0.66)]
    m.poly(tri, 'sail', (0.4, 0.1, 9)); m.poly(tri, 'sail', (0.4, 0.1, -9))
    return m
