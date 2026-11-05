"""Kisangani (RD Congo) : les chutes Boyoma sur le fleuve Congo, rochers, tripodes de pêche en bois et pirogues.
Passe 3 (05/11/2026) : moins chargé : deux tripodes, trois rochers, deux palmiers, deux grandes pirogues nettes ; la chute et le fleuve se lisent d'un coup d'oeil."""
import math
from lib import Mesh
from lib_ico import *
import lib_ab      # palmiers à palmes en deux triangles plans (pas de quad gauche)

PAL = {'water': '#3C93B8', 'water_d': '#2B7599', 'foam': '#F4F8F8', 'foam2': '#CBE7F0', 'rock': '#6E5A4B', 'rock2': '#8A7260', 'grass': '#4E9A3F', 'grass2': '#3B8035',
       'pole': '#9A6B3C', 'basket': '#C99A55', 'canoe': '#7D4F2B', 'canoe_in': '#4A2D18', 'trunk': '#8A5E3A', 'leaf': '#2E9E4E', 'leaf2': '#4CBF63', 'paddle': '#B98A55'}


def pirogue(m, cx, cz, L, W, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)

    def tr(x, y, z):
        return (cx+x*c+z*s, y, cz-x*s+z*c)
    ts = [-1, -0.72, 0, 0.72, 1]
    ws = [0.0, 0.75, 1.0, 0.75, 0.0]
    rings = []
    for t, w in zip(ts, ws):
        yt = 0.14 if abs(t) == 1 else 0.115
        x = t*L/2
        rings.append([tr(x, yt, -w*W/2), tr(x, yt, w*W/2), tr(x, 0.07, w*W/4), tr(x, 0.07, -w*W/4)])
    ref = tr(0, 0.1, 0)
    for k in range(len(rings)-1):
        ra, rb = rings[k], rings[k+1]
        for i in range(4):
            j = (i+1) % 4
            m.poly([ra[i], ra[j], rb[j], rb[i]], 'canoe_in' if i == 0 else 'canoe', ref if i else (ref[0], ref[1]-1, ref[2]))


def perch(m, x, z, y0, h):
    apex = (x, y0+h, z)
    for k in range(3):
        a = math.radians(90+120*k)
        m.beam((x+0.12*math.cos(a), y0, z+0.12*math.sin(a)), apex, 0.035, 'pole', w1=0.02)
    m.beam((x-0.1, y0+h*0.4, z+0.03), (x+0.1, y0+h*0.4, z+0.03), 0.025, 'pole')
    cyl(m, x, z+0.05, y0+h*0.32, y0+h*0.32+0.26, 0.1, 'basket', 0.025, n=6, caps=(False, False))


def build():
    m = Mesh(PAL)
    plate(m, 'water', 0.05)
    # berges
    left = [(-0.88, -0.88), (-0.62, -0.88), (-0.54, -0.1), (-0.62, 0.88), (-0.88, 0.88)]      # berges convexes (faces dans le bon sens)
    right = [(0.62, -0.88), (0.88, -0.88), (0.88, 0.88), (0.62, 0.88), (0.54, -0.1)]
    prism_xz(m, left, 0.05, 0.18, 'grass2', 'grass')
    prism_xz(m, right, 0.05, 0.18, 'grass2', 'grass')
    lib_ab.palm(m, -0.74, -0.5, 0.95, 'trunk', 'leaf', 'leaf2', y0=0.18, lean=0.1, fronds=6, flen=0.22)
    lib_ab.palm(m, 0.76, 0.3, 0.8, 'trunk', 'leaf', 'leaf2', y0=0.18, lean=-0.1, fronds=6, flen=0.24)
    # la chute : deux bajoues de roche, le fleuve d'amont en haut, une chute d'écume à deux paliers, un bassin d'écume au pied
    for (x0, x1) in ((-0.66, -0.4), (0.4, 0.66)):
        m.box(x0, x1, 0.05, 0.42, -0.88, -0.5, 'rock', skip=('bot',))
        m.box(x0, x1, 0.42, 0.45, -0.88, -0.5, 'rock2', skip=('bot',))
    m.box(-0.4, 0.4, 0.05, 0.42, -0.88, -0.56, 'water_d', skip=('bot', 'top'))
    m.poly([(-0.4, 0.42, -0.88), (0.4, 0.42, -0.88), (0.4, 0.42, -0.56), (-0.4, 0.42, -0.56)], 'water', (0, 0, 0))
    m.poly([(-0.4, 0.42, -0.56), (0.4, 0.42, -0.56), (0.4, 0.24, -0.4), (-0.4, 0.24, -0.4)], 'foam', (0, 0, -5))
    m.poly([(-0.4, 0.24, -0.4), (0.4, 0.24, -0.4), (0.4, 0.24, -0.32), (-0.4, 0.24, -0.32)], 'foam2', (0, 0, -5))
    m.poly([(-0.4, 0.24, -0.32), (0.4, 0.24, -0.32), (0.4, 0.07, -0.12), (-0.4, 0.07, -0.12)], 'foam', (0, 0, -5))
    m.box(-0.66, -0.4, 0.05, 0.3, -0.5, -0.12, 'rock', skip=('bot', 'nz'))
    m.box(0.4, 0.66, 0.05, 0.3, -0.5, -0.12, 'rock', skip=('bot', 'nz'))
    m.box(-0.45, 0.45, 0.05, 0.065, -0.12, 0.04, 'foam2', skip=('bot',))
    # trois rochers : deux au bord de la chute, un dans le bassin
    blob(m, -0.2, 0.46, -0.58, 0.1, 0.11, 0.09, 'rock', n=6, lats=(0, 40, 80))
    blob(m, 0.18, 0.46, -0.6, 0.1, 0.11, 0.09, 'rock', n=6, lats=(0, 40, 80))
    blob(m, 0.0, 0.08, -0.04, 0.11, 0.1, 0.1, 'rock', n=6, lats=(0, 40, 80))
    # deux tripodes de pêche au pied de la chute
    perch(m, -0.3, 0.1, 0.06, 0.72)
    perch(m, 0.3, 0.12, 0.06, 0.72)
    # deux grandes pirogues devant
    pirogue(m, -0.2, 0.55, 0.8, 0.2, 12)
    pirogue(m, 0.22, 0.72, 0.66, 0.17, -18)
    return m
