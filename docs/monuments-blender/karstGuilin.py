"""Guilin (Chine) : pitons karstiques verts au bord de la rivière Li, radeau de bambou et son pêcheur au chapeau conique."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'grass': '#86B85C', 'bank': '#D8C48E', 'water': '#3AA8BA', 'water2': '#2F8EA6', 'foam': '#E4F4F2', 'rock': '#A9B0A2', 'rock_d': '#868F85',
       'green': '#4F9C4C', 'green_d': '#367A3E', 'green_l': '#6DB556', 'bamboo': '#E8C973', 'bamboo_d': '#B9924C', 'hat': '#E0B96A',
       'skin': '#E7B88C', 'shirt': '#D8473D', 'trunk': '#7A5A3C'}

def piton(m, cx, cz, h, r, rot=0.0, n=7):
    cols = ['green_d', 'rock', 'rock_d', 'rock', 'green', 'green_l']
    prof = [(r, 0.07), (r*0.94, h*0.2), (r*0.9, h*0.5), (r*0.78, h*0.74), (r*0.5, h*0.9), (r*0.22, h*0.97), (0, h)]
    lathe(m, prof, n, cols, cx, cz, rot)

def tree(m, x, z, y0, h=0.2):
    cyl(m, x, z, y0, y0+h*0.5, 0.018, 'trunk', n=4)
    blob(m, x, y0+h*0.75, z, h*0.45, h*0.4, h*0.45, 'green_l', n=6, lats=(-60, 10, 60))

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.08, -0.88, 0.0, 'grass', skip=('bot',))
    m.box(-0.88, 0.88, 0.0, 0.055, 0.0, 0.1, 'bank', skip=('bot', 'nz'))
    m.box(-0.88, 0.88, 0.0, 0.035, 0.1, 0.88, 'water', skip=('bot', 'nz'))
    for (x0, z0, w) in ((-0.7, 0.2, 0.45), (0.1, 0.35, 0.5), (-0.2, 0.8, 0.5)):
        m.box(x0, x0+w, 0.035, 0.04, z0, z0+0.03, 'foam', skip=('bot',))
    # pitons
    piton(m, -0.38, -0.5, 2.1, 0.3, 0.2)
    piton(m, 0.18, -0.74, 2.45, 0.27, 0.5)
    piton(m, 0.52, -0.38, 1.5, 0.26, 0.1)
    piton(m, 0.78, 0.02, 0.95, 0.17, 0.3, n=6)
    piton(m, -0.78, -0.12, 1.2, 0.18, 0.6, n=6)
    for (x, z) in ((-0.02, -0.2), (0.3, -0.1), (-0.58, 0.04), (0.64, -0.62)):
        tree(m, x, z, 0.08)
    # radeau de bambou et son pêcheur
    def raft(cx, cz, L, w, rot_=0.0, man=True):
        s = len(m.faces)
        for k in range(5):
            z = cz+(k-2)*w
            m.box(cx-L/2, cx+L/2, 0.04, 0.075, z-w*0.4, z+w*0.4, 'bamboo' if k % 2 == 0 else 'bamboo_d', skip=('bot',))
            m.box(cx+L/2, cx+L/2+0.05, 0.05, 0.085, z-w*0.4, z+w*0.4, 'bamboo', skip=('bot',))
        m.box(cx-L*0.38, cx-L*0.34, 0.075, 0.1, cz-2*w, cz+2*w, 'bamboo_d', skip=('bot',))
        if man:
            x0 = cx+0.05
            cyl(m, x0, cz, 0.075, 0.2, 0.05, 'shirt', 0.04, n=6)
            sphere(m, x0, 0.235, cz, 0.04, 'skin', n=6, rows=3)
            cone(m, x0, cz, 0.245, 0.31, 0.095, 'hat', n=8)
            m.beam((x0+0.04, 0.17, cz+0.02), (x0+0.32, 0.02, cz+0.1), 0.02, 'bamboo_d', caps=True)
        if rot_:
            f = rot_y(rot_, cx, cz)
            xform(m, f, s)
    raft(-0.05, 0.5, 0.5, 0.055, 12)
    raft(-0.55, 0.78, 0.36, 0.045, -10, man=False)
    return m
