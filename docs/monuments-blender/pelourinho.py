"""Salvador : le Pelourinho, maisons colorées étagées sur la pente, église blanche à deux tours au sommet."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'stone': '#D8C29A', 'stone2': '#BFA678', 'c1': '#E8567F', 'c2': '#F6C93D', 'c3': '#F18A3B', 'c4': '#3E92D8', 'c5': '#2FB6A6', 'c6': '#5CB85C',
       'c7': '#8F6FCC', 'c8': '#D8433B', 'roof': '#B5532F', 'roof2': '#CC6B40', 'white': '#FAF3E0', 'cream': '#F3E4BC', 'dark': '#3A2D2A',
       'blue': '#3E7FD0', 'gold': '#E5B13A', 'cobble': '#C9B48C'}
WALLS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']
TOPS = [0.1, 0.27, 0.44, 0.61]
ZS = [0.88, 0.44, 0.0, -0.44, -0.88]


def maison(m, x, zc, hw, hd, y0, h, col):
    sbox(m, x-hw, x+hw, y0, y0+h, zc-hd, zc+hd, col, col)
    gable(m, x-hw-0.012, x+hw+0.012, zc-hd-0.02, zc+hd+0.02, y0+h, 0.1, 'roof', 'roof2', ridge='x')
    zf = zc+hd
    decal(m, 'pz', x-0.095, x-0.045, y0+h*0.3, y0+h*0.75, zf+0.003, 'dark')
    decal(m, 'pz', x+0.045, x+0.095, y0+h*0.3, y0+h*0.75, zf+0.003, 'dark')
    decal(m, 'pz', x-0.02, x+0.02, y0, y0+h*0.34, zf+0.003, 'white')


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'cobble', skip=('bot',))
    # terrasses : la pente en quatre marches
    for r in range(4):
        z1, z0 = ZS[r], ZS[r+1]
        sbox(m, -0.88, 0.88, 0.05, TOPS[r], z0, z1, 'stone', 'cobble')
    k = 0
    for r in range(4):
        zc = (ZS[r]+ZS[r+1])/2+0.02
        for i in range(5):
            x = -0.68+0.34*i
            if r == 3 and abs(x) < 0.4:
                continue
            h = 0.2+0.06*((i+r) % 3)
            maison(m, x, zc, 0.155, 0.16, TOPS[r], h, WALLS[k % 8])
            k += 1
    # église blanche : corps central à fronton, deux tours, clochetons
    Y = TOPS[3]
    zc, zf = -0.66, -0.5
    sbox(m, -0.16, 0.16, Y, Y+0.55, zc-0.16, zf, 'white', 'white')
    gable(m, -0.18, 0.18, zc-0.18, zf+0.02, Y+0.55, 0.15, 'roof', 'white', ridge='z')
    decal(m, 'pz', -0.06, 0.06, Y, Y+0.26, zf+0.003, 'dark')
    decal(m, 'pz', -0.1, 0.1, Y+0.26, Y+0.3, zf+0.003, 'cream')
    decal(m, 'pz', -0.035, 0.035, Y+0.38, Y+0.48, zf+0.003, 'blue')
    for sx in (-1, 1):
        x = sx*0.26
        sbox(m, x-0.1, x+0.1, Y, Y+0.95, zc-0.16, zf+0.04, 'white', 'cream')
        decal(m, 'pz', x-0.03, x+0.03, Y+0.55, Y+0.75, zf+0.043, 'dark')
        decal(m, 'pz', x-0.1, x+0.1, Y+0.3, Y+0.34, zf+0.043, 'cream')
        pyr(m, x, zc-0.06, 0.11, 0.11, Y+0.95, 0.3, 'roof')
        ball(m, x, Y+1.27, zc-0.06, 0.025, 'gold', n=6)
    return m
