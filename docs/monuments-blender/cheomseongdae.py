"""Gyeongju (Corée du Sud) : Cheomseongdae, l'observatoire de pierre en forme de bouteille, avec sa fenêtre carrée et son cadre en haut."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'grass': '#7DBB5F', 'grass2': '#6AA84F', 'stone': '#D9CFB6', 'stone2': '#C4B89B', 'stone_d': '#A89C80', 'dark': '#2E2A26',
       'gk': '#F2C230', 'gk2': '#E8A02A', 'trunk': '#7A5236', 'path': '#E9DEC0'}

Y0, Y1 = 0.2, 1.5
N = 12
ROT = math.pi/12


def r_at(y):
    s = min(1.0, max(0.0, (y-Y0)/(Y1-Y0)))
    return 0.225+0.165*(1-s)**1.8


def build():
    m = Mesh(PAL)
    plate(m, 'grass', 0.04)
    m.box(-0.12, 0.12, 0.04, 0.045, 0.3, 0.88, 'path', skip=('bot',))
    tbox(m, 0, 0, 0.04, 0.12, 0.5, 0.5, 0.46, 0.46, 'stone2')
    tbox(m, 0, 0, 0.12, 0.2, 0.42, 0.42, 0.4, 0.4, 'stone')
    ys = [Y0+(Y1-Y0)*j/13 for j in range(14)]
    prof = [(r_at(y), y) for y in ys]
    lathe(m, prof, N, ['stone' if j % 2 == 0 else 'stone2' for j in range(13)], 0, 0, rot=ROT, cap_top=True)
    # fenêtre carrée, côté avant
    ya, yb = 0.72, 0.96
    za, zb = r_at(ya)*math.cos(math.pi/12)+0.004, r_at(yb)*math.cos(math.pi/12)+0.004
    m.poly([(-0.05, ya, za), (0.05, ya, za), (0.05, yb, zb), (-0.05, yb, zb)], 'dark', (0, ya, 0))
    # échelons sous la fenêtre
    for yy in (0.5, 0.58, 0.66):
        zz = r_at(yy)*math.cos(math.pi/12)+0.01
        m.box(-0.05, 0.05, yy, yy+0.02, zz-0.012, zz+0.012, 'stone_d', skip=('bot',))
    # cadre carré sommital : deux couches croisées
    m.box(-0.3, 0.3, Y1, Y1+0.07, -0.19, -0.09, 'stone', skip=('bot',))
    m.box(-0.3, 0.3, Y1, Y1+0.07, 0.09, 0.19, 'stone', skip=('bot',))
    m.box(-0.19, -0.09, Y1+0.07, Y1+0.14, -0.3, 0.3, 'stone2', skip=('bot',))
    m.box(0.09, 0.19, Y1+0.07, Y1+0.14, -0.3, 0.3, 'stone2', skip=('bot',))
    # deux ginkgos d'automne
    for (x, z, s) in ((-0.68, 0.5, 1.0), (0.7, 0.18, 0.85)):
        m.beam((x, 0.04, z), (x, 0.04+0.3*s, z), 0.05, 'trunk', w1=0.035)
        blob(m, x, 0.04+0.45*s, z, 0.2*s, 0.18*s, 0.2*s, 'gk', n=7, lats=(-40, 20, 65))
        blob(m, x+0.1*s, 0.04+0.42*s, z+0.08*s, 0.1*s, 0.09*s, 0.1*s, 'gk2', n=6, lats=(-30, 30, 70))
    return m
