"""Manchester : un stade de football aux projecteurs et une usine de briques rouges à shed et haute cheminée."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'ground': '#CFC3A6', 'pitch': '#4F9A47', 'pitch2': '#5FB057', 'line': '#F2EFE6', 'wall': '#E4E2DC', 'wall2': '#C9CED6',
    'roof': '#C6322C', 'seat': '#3E6FB3', 'seat2': '#E8E8E8', 'mast': '#8A8A8F', 'lamp': '#FFF2B8', 'brick': '#B5543A',
    'brick2': '#9A4630', 'glass': '#7FB6D8', 'band': '#E4DAC2', 'smoke': '#BFC3C8', 'dark': '#3A3633', 'door': '#4A5568',
}
Y0 = 0.04

def ering(cx, cz, rx, rz, y, n=16):
    return [(cx+rx*math.sin(2*math.pi*i/n), y, cz+rz*math.cos(2*math.pi*i/n)) for i in range(n)]

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.88, 0.88, 'ground', skip=('bot',))
    cx, cz, rx, rz = 0.28, 0.0, 0.58, 0.46
    # tribunes : mur extérieur, toit rouge, gradins bleus, pelouse
    prof = [(1.0, Y0), (1.0, 0.34), (1.03, 0.36), (0.72, 0.42), (0.7, 0.3), (0.5, 0.08)]
    cols = ['wall', 'roof', 'roof', 'seat', 'seat2']
    for k in range(len(prof)-1):
        a = ering(cx, cz, rx*prof[k][0], rz*prof[k][0], prof[k][1])
        b = ering(cx, cz, rx*prof[k+1][0], rz*prof[k+1][0], prof[k+1][1])
        ym = (prof[k][1]+prof[k+1][1])/2
        ref = (cx, ym, cz) if k == 0 else (cx, ym-5, cz)
        if k == 3:
            ref = (cx, ym+5, cz)   # gradins: la surface regarde vers le haut et l'intérieur
            m.band(a, b, cols[k], (cx, 5, cz))
        else:
            m.band(a, b, cols[k], ref)
    # pelouse rayée
    n = 16
    pa = ering(cx, cz, rx*0.5, rz*0.5, 0.08, n)
    for i in range(n):
        j = (i+1) % n
        m.poly([(cx, 0.08, cz), pa[i], pa[j]], 'pitch' if i % 2 == 0 else 'pitch2', (cx, 0, cz))
    m.box(cx-0.005, cx+0.005, 0.08, 0.085, cz-rz*0.5, cz+rz*0.5, 'line', skip=('bot',))
    # arceaux des gradins
    for i in range(n):
        a = 2*math.pi*(i+0.5)/n
        x = cx+rx*math.sin(a); z = cz+rz*math.cos(a)
        m.box(x-0.012, x+0.012, Y0, 0.34, z-0.012, z+0.012, 'wall2', skip=('bot',))
    # projecteurs aux quatre coins
    for (sx, sz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        x = cx+sx*rx*0.78; z = cz+sz*rz*0.78
        m.beam((x, 0.3, z), (x, 0.95, z), 0.03, 'mast', w1=0.02)
        m.box(x-0.06, x+0.06, 0.93, 1.02, z-0.02, z+0.02, 'lamp')
        m.box(x-0.06, x+0.06, 1.02, 1.04, z-0.02, z+0.02, 'mast', skip=('bot',))
    # usine de briques
    fx0, fx1, fz0, fz1 = -0.86, -0.34, -0.42, 0.34
    fb = B(fx0, fx1, Y0, 0.3, fz0, fz1)
    box(m, fb, 'brick')
    m.box(fx0, fx1, 0.3, 0.33, fz0-0.01, fz1+0.01, 'band', skip=('bot',))
    for k in range(3):
        xa = fx0+k*0.17
        xb = xa+0.17
        yb = 0.33
        c = ((fx0+fx1)/2, yb-1, (fz0+fz1)/2)
        m.poly([(xa, yb, fz0), (xa, yb, fz1), (xb, yb+0.14, fz1), (xb, yb+0.14, fz0)], 'brick2', c)
        m.poly([(xb, yb, fz0), (xb, yb, fz1), (xb, yb+0.14, fz1), (xb, yb+0.14, fz0)], 'glass', c)
        m.poly([(xa, yb, fz1), (xb, yb, fz1), (xb, yb+0.14, fz1)], 'brick2', c)
        m.poly([(xa, yb, fz0), (xb, yb, fz0), (xb, yb+0.14, fz0)], 'brick2', c)
    for k in range(5):
        u = -0.3+k*0.15
        decal(m, fb, 'pz', rect(u-0.04, u+0.04, 0.12, 0.24), 'glass', 0.003)
    decal(m, fb, 'px', rect(-0.06, 0.06, Y0, 0.16), 'door', 0.003)
    # cheminée
    lathe(m, [(0.07, Y0), (0.05, 0.9), (0.055, 0.96), (0.055, 1.02)], 6, ['brick', 'band', 'brick2'], -0.55, -0.55)
    lathe(m, [(0.055, 1.02), (0.05, 1.02)], 6, 'dark', -0.55, -0.55)
    ball(m, -0.5, 1.18, -0.55, 0.05, 'smoke', 5)
    ball(m, -0.44, 1.3, -0.55, 0.065, 'smoke', 5)
    lathe(m, [(0.045, Y0), (0.03, 0.62)], 6, 'brick2', -0.7, -0.62)
    return m
