"""Eilat (Israël) : plage de la mer Rouge, récif de corail aux couleurs vives et palmiers."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'sea': '#1F8FB8', 'shallow': '#62D0CF', 'sand': '#F0DBA0', 'sand2': '#DDBF80',
       'trunk': '#8A5E3A', 'leaf': '#2E9E4E', 'leaf2': '#4CBF63',
       'c1': '#F0643E', 'c2': '#F27BAA', 'c3': '#8E5BD1', 'c4': '#F5C242', 'c5': '#FF9E3D',
       'fish': '#FFD23F', 'fish2': '#2B3A67'}

BEACH = [(-0.88, -0.88), (0.88, -0.88), (0.88, -0.1), (0.55, 0.02), (0.15, -0.12), (-0.3, 0.0), (-0.65, -0.12), (-0.88, -0.05)]
LAGOON = [(-0.88, -0.88), (0.88, -0.88), (0.88, 0.14), (0.55, 0.26), (0.15, 0.1), (-0.3, 0.22), (-0.65, 0.1), (-0.88, 0.15)]


def staghorn(m, x, z, col, col2):
    for i in range(6):
        a = 2*math.pi*i/6+0.4
        dx, dz = math.cos(a), math.sin(a)
        base = (x+dx*0.04, 0.05, z+dz*0.04)
        tip = (x+dx*0.12, 0.34+0.07*(i % 3), z+dz*0.12)
        m.beam(base, tip, 0.075, col, w1=0.035)
        mid = (x+dx*0.08, 0.2, z+dz*0.08)
        side = (x+dx*0.2, 0.3+0.03*(i % 2), z+dz*0.2)
        m.beam(mid, side, 0.05, col2, w1=0.025)


def fan(m, x, z):
    pts = [(x+0.12, 0.05, z), (x+0.19, 0.18, z), (x+0.1, 0.31, z), (x, 0.36, z), (x-0.1, 0.31, z), (x-0.19, 0.18, z), (x-0.12, 0.05, z)]
    m.poly(pts, 'c3', (x, 0.2, z+1))
    m.poly(pts, 'c2', (x, 0.2, z-1))


def fish(m, x, y, z, col):
    blob(m, x, y, z, 0.08, 0.05, 0.035, col, n=6, lats=(-60, 0, 60))
    m.poly([(x-0.07, y, z), (x-0.15, y+0.05, z), (x-0.15, y-0.05, z)], 'fish2', (x, y, z+1))
    m.poly([(x-0.07, y, z), (x-0.15, y+0.05, z), (x-0.15, y-0.05, z)], 'fish2', (x, y, z-1))


def build():
    m = Mesh(PAL)
    plate(m, 'sea', 0.05)
    prism_xz(m, LAGOON, 0.05, 0.062, 'shallow', 'shallow')
    prism_xz(m, BEACH, 0.05, 0.11, 'sand2', 'sand')
    # palmiers sur la plage
    palm(m, -0.55, -0.45, 1.05, 0.12, 'trunk', 'leaf', 'leaf2', y0=0.1, fronds=7, flen=0.34)
    palm(m, 0.05, -0.5, 1.3, -0.1, 'trunk', 'leaf', 'leaf2', y0=0.1, fronds=7, flen=0.38)
    palm(m, 0.5, -0.3, 0.95, 0.1, 'trunk', 'leaf', 'leaf2', y0=0.1, fronds=7, flen=0.32)
    # récif : tête de corail cerveau, staghorn, corail table, éventail, poissons
    blob(m, -0.42, 0.06, 0.48, 0.22, 0.17, 0.2, 'c1', n=8, lats=(0, 30, 62), rot=0.2)
    blob(m, -0.46, 0.2, 0.46, 0.09, 0.05, 0.08, 'c5', n=6, lats=(0, 50), rot=0.4)
    staghorn(m, 0.38, 0.42, 'c2', 'c5')
    cyl(m, 0.0, 0.62, 0.05, 0.18, 0.045, 'c3', n=5, caps=(False, False))
    cyl(m, 0.0, 0.62, 0.18, 0.23, 0.22, 'c4', n=8)
    fan(m, -0.08, 0.28)
    fish(m, -0.05, 0.42, 0.72, 'fish')
    fish(m, 0.55, 0.3, 0.7, 'c5')
    return m
