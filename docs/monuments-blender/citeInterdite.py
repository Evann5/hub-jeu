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
    for s in range(5):
        m.box(-0.17, 0.17, 0.04, 0.38-0.068*(4-s)-0.0, 0.6+0.07*(4-s)+0.0+0.0, 0.6+0.07*(5-s)+0.0, 'marble2', skip=('bot', 'nz')) if False else None
    for k in range(5):
        y = 0.04+0.068*(k+1)
        m.box(-0.17, 0.17, 0.04, y, 0.6+0.06*(5-k)-0.06, 0.6+0.06*(5-k), 'marble2', skip=('bot', 'nz'))
    # petites bornes (balustres) aux angles de la terrasse haute
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box(sx*0.56-0.025, sx*0.56+0.025, 0.38, 0.5, sz*0.56-0.025, sz*0.56+0.025, 'marble2', skip=('bot',))
    # salle : murs rouges, bandeau de poutres peintes, portes
    Y0 = 0.38
    HW, HD = 0.5, 0.3
    m.box(-HW, HW, Y0, Y0+0.3, -HD, HD, 'red', skip=('bot',))
    m.box(-HW-0.015, HW+0.015, Y0+0.26, Y0+0.34, -HD-0.015, HD+0.015, 'teal', skip=('bot',))
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box(sx*HW-0.02 if sx > 0 else sx*HW-0.02, sx*HW+0.02, Y0, Y0+0.3, sz*HD-0.02, sz*HD+0.02, 'red_d', skip=('bot',))
    for k in range(5):
        x = -0.36+0.18*k
        front(m, HD+0.004, rect(x-0.065, x+0.065, Y0+0.02, Y0+0.22), 'red_d')
        front(m, HD+0.008, rect(x-0.012, x+0.012, Y0+0.07, Y0+0.17), 'gold')
        front(m, HD+0.004, rect(x-0.035, x+0.035, Y0+0.23, Y0+0.255), 'gold')
    for z in (-0.12, 0.12):
        for sx in (-1, 1):
            m.box(sx*HW-0.02 if sx > 0 else sx*HW-0.02, sx*HW+0.02, Y0, Y0+0.3, z-0.02, z+0.02, 'red_d', skip=('bot',))
    # toit bas, petit étage, toit haut
    ya = Y0+0.34
    hi = roof(m, 0, 0, ya, 0.72, 0.5, 0.14, 'gold', top=(0.46, 0.22), lift=0.07, flare=0.05, cap=True, col_top='gold_l')
    m.box(-0.38, 0.38, ya+0.14, ya+0.28, -0.16, 0.16, 'red', skip=('bot',))
    m.box(-0.395, 0.395, ya+0.24, ya+0.3, -0.175, 0.175, 'teal', skip=('bot',))
    for k in range(4):
        x = -0.27+0.18*k
        front(m, 0.164, rect(x-0.05, x+0.05, ya+0.16, ya+0.23), 'red_d')
    yb = ya+0.3
    roof(m, 0, 0, yb, 0.6, 0.36, 0.2, 'gold', top=(0.28, 0.0), lift=0.08, flare=0.05)
    # faîtière et ornements de bout de faîte
    for sx in (-1, 1):
        m.box(sx*0.3-0.03, sx*0.3+0.03, yb+0.2, yb+0.29, -0.03, 0.03, 'gold_l', skip=('bot',))
    m.box(-0.28, 0.28, yb+0.2, yb+0.22, -0.02, 0.02, 'gold_l', skip=('bot',))
    return m
