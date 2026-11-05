"""Pékin (Chine) : un pavillon de la Cité interdite, murs rouges, double toit jaune à coins relevés, trois terrasses de marbre blanc."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'plaza': '#CFC6B8', 'marble': '#F4F1EA', 'marble2': '#DAD5C8', 'red': '#C2292E', 'red_d': '#8E1B20', 'gold': '#E8B92E',
       'gold_l': '#F4D152', 'teal': '#2F8C98', 'blue': '#2F5FA0', 'dark': '#3A2A28'}

def build():
    m = Mesh(PAL)
    slab(m, 'plaza', 0.04)
    # trois terrasses de marbre et leurs rambardes
    for (hx, z0, z1, y0, y1) in ((0.84, -0.84, 0.84, 0.04, 0.14), (0.72, -0.72, 0.72, 0.14, 0.26), (0.6, -0.6, 0.6, 0.26, 0.38)):
        m.box(-hx, hx, y0, y1, z0, z1, 'marble', skip=('bot',))
        m.box(-hx-0.012, hx+0.012, y1-0.025, y1, z0-0.012, z1+0.012, 'marble2', skip=('bot',))
    # escalier central (devant)
    for k in range(5):
        y = 0.04+0.068*(k+1)
        m.box(-0.17, 0.17, 0.04, y, 0.6+0.06*(5-k)-0.06, 0.6+0.06*(5-k), 'marble2', skip=('bot', 'nz'))
    # petites bornes (balustres) aux angles de la terrasse haute
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box(sx*0.56-0.025, sx*0.56+0.025, 0.38, 0.5, sz*0.56-0.025, sz*0.56+0.025, 'marble2', skip=('bot',))
    # salle : murs rouges, bandeau de poutres peintes, portes
    Y0 = 0.38
    HW, HD, WH = 0.52, 0.3, 0.5
    m.box(-HW, HW, Y0, Y0+WH, -HD, HD, 'red', skip=('bot',))
    m.box(-HW-0.015, HW+0.015, Y0+WH-0.07, Y0+WH+0.01, -HD-0.015, HD+0.015, 'teal', skip=('bot',))
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box(sx*HW-0.02, sx*HW+0.02, Y0, Y0+WH, sz*HD-0.02, sz*HD+0.02, 'red_d', skip=('bot',))
    for k in range(5):
        x = -0.36+0.18*k
        front(m, HD+0.004, rect(x-0.065, x+0.065, Y0+0.02, Y0+WH-0.1), 'red_d')
        front(m, HD+0.008, rect(x-0.012, x+0.012, Y0+0.1, Y0+0.24), 'gold')
        front(m, HD+0.004, rect(x-0.05, x+0.05, Y0+WH-0.095, Y0+WH-0.075), 'gold')
    for z in (-0.12, 0.12):
        for sx in (-1, 1):
            m.box(sx*HW-0.02, sx*HW+0.02, Y0, Y0+WH, z-0.02, z+0.02, 'red_d', skip=('bot',))
    # toit bas, petit étage, toit haut
    ya = Y0+WH+0.01
    roof(m, 0, 0, ya, 0.6, 0.38, 0.12, 'gold', top=(0.44, 0.2), lift=0.05, flare=0.03, cap=True, col_top='gold_l')
    m.box(-0.36, 0.36, ya+0.13, ya+0.3, -0.14, 0.14, 'red', skip=('bot',))
    m.box(-0.375, 0.375, ya+0.24, ya+0.31, -0.155, 0.155, 'teal', skip=('bot',))
    for k in range(4):
        x = -0.25+0.167*k
        front(m, 0.144, rect(x-0.05, x+0.05, ya+0.15, ya+0.23), 'red_d')
    yb = ya+0.31
    roof(m, 0, 0, yb, 0.5, 0.3, 0.19, 'gold', top=(0.26, 0.0), lift=0.06, flare=0.03)
    for sx in (-1, 1):
        m.box(sx*0.26-0.03, sx*0.26+0.03, yb+0.18, yb+0.27, -0.03, 0.03, 'gold_l', skip=('bot',))
    m.box(-0.26, 0.26, yb+0.19, yb+0.21, -0.02, 0.02, 'gold_l', skip=('bot',))
    return m
