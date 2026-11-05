"""Mumbai (Inde) : la Porte de l'Inde, grande arche de basalte jaune à quatre tourelles, escalier vers la mer, bateaux."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'sea': '#3F86B0', 'foam': '#E4F1F3', 'quay': '#DAC9A0', 'stone': '#D9AE68', 'stone_d': '#B88E4E', 'stone_l': '#EBD198', 'dark': '#4A382A',
       'white': '#F4F4EE', 'blue': '#2F6FB0', 'red': '#C9552E'}

def boat(m, cx, cz, rot, L, col):
    s = len(m.faces)
    hull(m, [(-L/2, 0.03, 0.03, 0.075), (-L*0.25, 0.07, 0.025, 0.07), (L*0.2, 0.07, 0.025, 0.07), (L/2, 0.012, 0.05, 0.12)], 'white', col)
    m.box(-L*0.2, L*0.1, 0.07, 0.15, -0.045, 0.045, col, skip=('bot',))
    xform(m, lambda p: move(cx, 0, cz)(rot_y(rot)(p)), s)

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.03, 0.2, 0.88, 'sea', skip=('bot', 'nz'))
    for (x0, z0, w) in ((-0.8, 0.55, 0.4), (0.2, 0.82, 0.5), (-0.1, 0.4, 0.3)):
        m.box(x0, x0+w, 0.03, 0.035, z0, z0+0.03, 'foam', skip=('bot',))
    m.box(-0.88, 0.88, 0.0, 0.07, -0.88, 0.2, 'quay', skip=('bot',))
    # marches vers l'eau
    for s, (y1, z1) in enumerate(((0.07, 0.3), (0.055, 0.38), (0.04, 0.46))):
        m.box(-0.36, 0.36, 0.0, y1, 0.2, z1, 'stone_l', skip=('bot', 'nz'))
    # socle et masse principale percée de l'arche
    m.box(-0.55, 0.55, 0.07, 0.17, -0.35, 0.24, 'stone_d', skip=('bot',))
    arch_block(m, -0.5, 0.5, 0.17, 1.0, -0.3, 0.2, 0.2, 0.62, 0.9, 'stone', 'stone_d', k=6, pointed=True)
    m.box(-0.54, 0.54, 1.0, 1.09, -0.34, 0.24, 'stone_l', skip=('bot',))
    # niches, fenêtres et frise sur les deux grandes faces
    s0 = len(m.faces)
    z = 0.2+0.004
    for sx in (-1, 1):
        x = sx*0.36
        front(m, z, arch2d(x, 0.25, 0.62, 0.78, 0.075, 3, True), 'stone_l')
        front(m, z+0.004, arch2d(x, 0.27, 0.62, 0.74, 0.058, 3, True), 'dark')
        front(m, z, arch2d(x, 0.8, 0.84, 0.9, 0.04, 3), 'dark')
    for k in range(7):
        x = -0.42+0.14*k
        if abs(x) > 0.24:
            front(m, z, rect(x-0.03, x+0.03, 0.935, 0.975), 'stone_d')
    copy_rot(m, s0, [180], 0, -0.05)
    # tourelles d'angle et dôme central
    for sx in (-1, 1):
        for sz_ in (-1, 1):
            x, zz = sx*0.44, 0.17 if sz_ > 0 else -0.27
            cyl(m, x, zz, 1.09, 1.3, 0.075, 'stone', n=8)
            cyl(m, x, zz, 1.3, 1.33, 0.09, 'stone_l', n=8)
            dome(m, x, zz, 1.33, 0.085, 0.09, 8, 'stone_l', rows=2)
            cone(m, x, zz, 1.42, 1.5, 0.012, 'stone_d', n=4, cap_bot=False)
    cyl(m, 0, -0.05, 1.09, 1.21, 0.26, 'stone', n=8)
    cyl(m, 0, -0.05, 1.21, 1.24, 0.285, 'stone_l', n=8)
    dome(m, 0, -0.05, 1.24, 0.26, 0.2, 8, 'stone_l', rows=3)
    cone(m, 0, -0.05, 1.44, 1.56, 0.014, 'stone_d', n=4, cap_bot=False)
    boat(m, -0.5, 0.68, 12, 0.5, 'blue')
    boat(m, 0.42, 0.6, -18, 0.44, 'red')
    return m
