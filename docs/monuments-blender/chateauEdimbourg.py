"""Édimbourg : le château gris sur son rocher volcanique, tours, grande salle et batterie ronde."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'grass': '#7FA95A', 'rock1': '#5F5A55', 'rock2': '#756F67', 'rock3': '#8C8479', 'stone': '#A8A7A5', 'stone2': '#C2C0BB',
    'slate': '#5E6672', 'win': '#3F4A5C', 'dark': '#2E2A28', 'leaf': '#4E8F3A', 'trunk': '#6A4528', 'gold': '#D9A93A', 'cream': '#E6E1D3',
}

def ring_poly(radii, scale, cx=0.0, cz=0.0, rot=0.0):
    n = len(radii)
    return [(cx+radii[i]*scale*math.sin(rot+2*math.pi*i/n), cz+radii[i]*scale*math.cos(rot+2*math.pi*i/n)) for i in range(n)]

def merlons(m, x0, x1, z0, z1, y, col, s=0.04):
    nx = max(int((x1-x0)/(2*s)), 1)
    for k in range(nx+1):
        x = x0+(x1-x0-s)*k/nx
        for z in (z0, z1-s):
            m.box(x, x+s, y, y+s, z, z+s, col, skip=('bot',))
    nz = max(int((z1-z0)/(2*s)), 1)
    for k in range(1, nz):
        z = z0+(z1-z0-s)*k/nz
        for x in (x0, x1-s):
            m.box(x, x+s, y, y+s, z, z+s, col, skip=('bot',))

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.04, -0.88, 0.88, 'grass', skip=('bot',))
    R = [0.92, 0.84, 0.9, 0.82, 0.94, 0.84, 0.9, 0.8, 0.92, 0.85]
    prism_xz(m, ring_poly(R, 0.9), 0.04, 0.2, 'rock1', 'rock2')
    prism_xz(m, ring_poly(R, 0.8, 0.0, 0.0, 0.2), 0.2, 0.38, 'rock2', 'rock3')
    prism_xz(m, ring_poly(R, 0.68, 0.0, 0.0, 0.4), 0.38, 0.55, 'rock3', 'rock2')
    Y = 0.55
    # arbres au pied
    for (x, z) in ((-0.78, 0.5), (0.8, 0.45), (0.7, -0.6), (-0.7, -0.62)):
        lathe(m, [(0.02, 0.04), (0.02, 0.12)], 4, 'trunk', x, z)
        ball(m, x, 0.2, z, 0.09, 'leaf', 6)
    # grande salle
    hall = B(-0.3, 0.2, Y, Y+0.26, -0.05, 0.22)
    box(m, hall, 'stone')
    gable(m, -0.32, 0.22, -0.07, 0.24, Y+0.26, 0.15, 'slate', 'x', 'stone')
    for k in range(4):
        u = -0.18+k*0.12
        decal(m, hall, 'pz', pointed_arch(u, Y+0.08, Y+0.17, 0.022, 3), 'win', 0.004)
    # palais, à droite
    pal = B(0.15, 0.52, Y, Y+0.4, -0.3, 0.05)
    box(m, pal, 'stone2')
    hip(m, 0.13, 0.54, -0.32, 0.07, Y+0.4, 0.2, 'slate', 0.1)
    for k in range(3):
        decal(m, pal, 'pz', rect(-0.1+k*0.1-0.02, -0.1+k*0.1+0.02, Y+0.12, Y+0.26), 'win', 0.004)
    # tour carrée à gauche (grande, avec toit pointu)
    tw = B(-0.58, -0.32, Y, Y+0.78, -0.3, -0.04)
    box(m, tw, 'stone')
    m.box(-0.61, -0.29, Y+0.78, Y+0.82, -0.33, -0.01, 'stone2', skip=('bot',))
    hip(m, -0.59, -0.31, -0.31, -0.05, Y+0.82, 0.3, 'slate')
    m.beam((-0.45, Y+1.1, -0.17), (-0.45, Y+1.26, -0.17), 0.02, 'gold', w1=0.01)
    decal(m, tw, 'pz', rect(-0.025, 0.025, Y+0.3, Y+0.5), 'win', 0.004)
    decal(m, tw, 'pz', rect(-0.025, 0.025, Y+0.58, Y+0.7), 'win', 0.004)
    # batterie ronde de devant
    lathe(m, [(0.24, Y), (0.24, Y+0.3), (0.27, Y+0.3), (0.27, Y+0.34)], 10, ['stone', 'stone2', 'stone2'], 0.22, 0.34, 0.0, cap_top=True)
    for i in range(10):
        a = 2*math.pi*(i+0.5)/10
        if i % 2 == 0:
            x = 0.22+0.255*math.sin(a); z = 0.34+0.255*math.cos(a)
            m.box(x-0.03, x+0.03, Y+0.34, Y+0.4, z-0.03, z+0.03, 'stone2', skip=('bot',))
    # remparts de devant
    rp = B(-0.55, -0.02, Y, Y+0.2, 0.2, 0.3)
    box(m, rp, 'stone')
    merlons(m, -0.55, -0.02, 0.2, 0.3, Y+0.2, 'stone2', 0.04)
    decal(m, rp, 'pz', round_arch(-0.28, Y, Y+0.09, 0.05, 4), 'dark', 0.004)
    return m
