"""Kisangani (RD Congo) : les chutes Boyoma sur le fleuve Congo, rochers, tripodes de pêche en bois et pirogues."""
import math
from lib import Mesh
from lib_ico import *

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
    # pagaie
    m.beam(tr(0.1, 0.3, W*0.4), tr(0.3, 0.07, W*0.9), 0.025, 'paddle')


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
    left = [(-0.88, -0.88), (-0.62, -0.88), (-0.66, -0.4), (-0.6, 0.1), (-0.68, 0.55), (-0.62, 0.88), (-0.88, 0.88)]
    right = [(0.62, -0.88), (0.88, -0.88), (0.88, 0.88), (0.66, 0.88), (0.7, 0.45), (0.6, 0.0), (0.66, -0.45)]
    prism_xz(m, left, 0.05, 0.18, 'grass2', 'grass')
    prism_xz(m, right, 0.05, 0.18, 'grass2', 'grass')
    palm(m, -0.74, -0.5, 0.9, 0.12, 'trunk', 'leaf', 'leaf2', y0=0.18, fronds=6, flen=0.3)
    palm(m, 0.74, 0.2, 0.8, -0.12, 'trunk', 'leaf', 'leaf2', y0=0.18, fronds=6, flen=0.3)
    palm(m, -0.74, 0.45, 0.65, 0.12, 'trunk', 'leaf', 'leaf2', y0=0.18, fronds=6, flen=0.26)
    # seuil rocheux du fond et première cascade
    m.box(-0.65, 0.65, 0.05, 0.42, -0.88, -0.58, 'rock', skip=('bot',))
    m.box(-0.65, 0.65, 0.42, 0.44, -0.88, -0.56, 'rock2', skip=('bot',))
    ramps = [(-0.58, 0.42, -0.3, 0.2), (-0.3, 0.2, 0.02, 0.075)]
    for (za, ya, zb, yb) in ramps:
        for i in range(7):
            xa = -0.6+1.2*i/7; xb = -0.6+1.2*(i+1)/7
            m.poly([(xa, ya, za), (xb, ya, za), (xb, yb, zb), (xa, yb, zb)], 'foam' if i % 2 == 0 else 'foam2', (xa, ya-5, za))
    m.box(-0.65, 0.65, 0.05, 0.2, -0.32, -0.28, 'rock2', skip=('bot',))
    # rochers dans les rapides
    for (x, z, r, hh) in ((-0.45, -0.45, 0.1, 0.12), (-0.05, -0.5, 0.08, 0.1), (0.4, -0.42, 0.11, 0.13), (-0.38, -0.12, 0.09, 0.1), (0.1, -0.15, 0.1, 0.1), (0.5, -0.08, 0.08, 0.09)):
        yb = 0.34 if z < -0.3 else 0.15
        blob(m, x, yb, z, r, hh, r*0.9, 'rock', n=6, lats=(0, 40, 80))
    # tripodes de pêche
    perch(m, -0.25, -0.38, 0.2, 0.95)
    perch(m, 0.18, -0.34, 0.2, 0.85)
    perch(m, 0.42, -0.1, 0.1, 0.8)
    perch(m, -0.4, -0.02, 0.1, 0.7)
    # pirogues
    pirogue(m, -0.2, 0.52, 0.62, 0.17, 12)
    pirogue(m, 0.22, 0.64, 0.5, 0.14, -18)
    return m
