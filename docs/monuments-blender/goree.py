"""Gorée : une petite île, maisons ocre à balcons et volets, toits de tuiles, un baobab."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'sea': '#2B93BE', 'foam': '#EAF6F8', 'sand': '#F0D9A2', 'rock': '#A88D68', 'o1': '#E88C3C', 'o2': '#F2B54B', 'o3': '#DC6F3C', 'o4': '#F4CB7C',
       'trim': '#FCF3DC', 'roof': '#B84A2E', 'roof2': '#D26A42', 'shut': '#2E8F84', 'bal': '#7A4A2A', 'trunk': '#8A6A4A', 'leaf': '#3C9B4D', 'leaf2': '#57B35E'}


def maison(m, x, z, hw, hd, h, col, shut='shut'):
    Y = 0.14
    sbox(m, x-hw, x+hw, Y, Y+h, z-hd, z+hd, col, col)
    gable(m, x-hw-0.015, x+hw+0.015, z-hd-0.025, z+hd+0.025, Y+h, 0.12, 'roof', 'roof2', ridge='x')
    zf = z+hd
    n = 2 if hw > 0.15 else 1
    for i in range(n):
        u = x+(-hw+2*hw*(i+0.5)/n)
        decal(m, 'pz', u-0.025, u+0.025, Y+0.04, Y+0.17, zf+0.003, shut)
        if h > 0.36:
            decal(m, 'pz', u-0.025, u+0.025, Y+h-0.2, Y+h-0.07, zf+0.003, shut)
    if h > 0.36:      # balcon d'étage : dalle saillante et garde-corps
        yb = Y+h*0.5
        m.box(x-hw, x+hw, yb, yb+0.025, zf, zf+0.08, 'bal', skip=('bot',))
        m.box(x-hw, x+hw, yb+0.025, yb+0.075, zf+0.07, zf+0.08, 'trim', skip=('bot',))


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.04, -0.88, 0.88, 'sea', skip=('bot',))
    for (x0, x1, z0) in ((-0.8, -0.3, 0.8), (0.2, 0.7, 0.76)):
        m.box(x0, x1, 0.04, 0.046, z0, z0+0.035, 'foam', skip=('bot',))
    cyl(m, 0, 0, 0.04, 0.14, 0.85, 'rock', r1=0.8, n=9, col_top='sand')
    # rangée du fond, deux étages
    maison(m, -0.4, -0.32, 0.2, 0.17, 0.5, 'o1')
    maison(m, 0.03, -0.34, 0.18, 0.17, 0.55, 'o2')
    maison(m, 0.46, -0.3, 0.17, 0.16, 0.46, 'o3')
    # rangée de devant, plus basse
    maison(m, -0.48, 0.2, 0.17, 0.14, 0.32, 'o4')
    maison(m, -0.08, 0.22, 0.15, 0.14, 0.34, 'o2')
    maison(m, 0.3, 0.2, 0.16, 0.14, 0.3, 'o1')
    # baobab : tronc large, houppier plat
    cyl(m, 0.64, 0.46, 0.14, 0.4, 0.075, 'trunk', r1=0.05, n=7)
    blob(m, 0.64, 0.46, 0.46, 0.16, 0.08, 0.16, 'leaf', n=7, lats=(-50, 0, 50), col2='leaf2')
    return m
