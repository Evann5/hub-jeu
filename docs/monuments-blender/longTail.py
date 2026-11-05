"""Phuket (Thaïlande) : bateau à longue queue (proue relevée, rubans, arbre de queue), piton calcaire dans la mer d'Andaman."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'sea': '#27A9BC', 'sea2': '#1F8FA8', 'foam': '#E4F6F4', 'rock': '#B5BBB2', 'rock_d': '#8E968D', 'green': '#4E9A4A', 'green_d': '#367A3E',
       'green_l': '#6DB556', 'wood': '#C98A44', 'wood_d': '#8A5A2B', 'canopy': '#F2C230', 'pink': '#E8498A', 'blue': '#3C8ED8', 'white': '#F6F2E6',
       'metal': '#6B7078', 'black': '#2A2A2E', 'sand': '#EAD7A4'}

def piton(m, cx, cz, h, r, rot=0.0, n=7):
    cols = ['sand', 'rock', 'rock_d', 'rock', 'green_d', 'green']
    prof = [(r*1.25, 0.05), (r, h*0.12), (r*0.95, h*0.4), (r*0.82, h*0.68), (r*0.55, h*0.88), (r*0.25, h*0.97), (0, h)]
    lathe(m, prof, n, cols, cx, cz, rot)

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.05, -0.88, 0.88, 'sea', skip=('bot',))
    for (x0, z0, w) in ((-0.8, 0.05, 0.4), (0.15, 0.82, 0.55), (0.3, -0.25, 0.4), (-0.3, 0.7, 0.35)):
        m.box(x0, x0+w, 0.05, 0.055, z0, z0+0.03, 'foam', skip=('bot',))
    piton(m, -0.42, -0.5, 1.75, 0.34, 0.3)
    piton(m, 0.56, -0.58, 0.85, 0.22, 0.1, n=6)
    # bateau (construit le long de x, puis tourné)
    s = len(m.faces)
    hull(m, [(-0.5, 0.05, 0.1, 0.2), (-0.28, 0.09, 0.07, 0.17), (0.0, 0.11, 0.06, 0.16), (0.28, 0.09, 0.08, 0.2), (0.43, 0.05, 0.13, 0.3), (0.54, 0.015, 0.22, 0.42)], 'wood', 'wood_d')
    for x in (-0.12, 0.22):
        for z in (-0.1, 0.1):
            m.box(x-0.012, x+0.012, 0.16, 0.56, z-0.012, z+0.012, 'wood_d', skip=('bot',))
    hip(m, -0.2, 0.3, -0.15, 0.15, 0.54, 0.07, 'canopy', top=(0.18, 0.04))
    m.box(-0.2, 0.3, 0.52, 0.55, -0.15, 0.15, 'pink', skip=('bot',))
    # moteur et long arbre d'hélice
    m.box(-0.56, -0.42, 0.17, 0.3, -0.05, 0.05, 'metal', skip=('bot',))
    m.beam((-0.5, 0.26, 0), (-0.98, 0.1, 0), 0.035, 'metal', caps=True)
    m.box(-1.0, -0.97, 0.03, 0.17, -0.012, 0.012, 'black', skip=('bot',))
    m.box(-1.0, -0.97, 0.09, 0.11, -0.07, 0.07, 'black', skip=('bot',))
    # rubans à la proue
    for k, c in enumerate(('pink', 'blue', 'white', 'canopy')):
        z = -0.045+0.03*k
        m.beam((0.54, 0.4, z), (0.5, 0.25, z), 0.026, c, caps=True)
    xform(m, lambda p: move(0.2, 0, 0.5)(rot_y(-14)((p[0]*1.15, p[1]*1.15, p[2]*1.15))), s)
    return m
