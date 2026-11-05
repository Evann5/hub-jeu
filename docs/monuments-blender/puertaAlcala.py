"""Madrid : la Puerta de Alcalá, porte monumentale néoclassique à cinq passages, sur une place."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'ground': '#CFC3A6', 'road': '#4A4D55', 'line': '#F2EFE6', 'stone': '#E9E2CF', 'stone2': '#D3CAB1', 'stone3': '#BDB39A',
    'dark': '#2E2A28', 'win': '#4A5568', 'leaf': '#4E8F3A', 'trunk': '#6A4528', 'grass': '#7FA95A', 'gold': '#D9A93A',
}
Y0 = 0.04

def tree(m, x, z, s=1.0):
    lathe(m, [(0.02*s, Y0), (0.02*s, 0.15*s)], 4, 'trunk', x, z)
    ball(m, x, 0.15*s+0.09*s, z, 0.09*s, 'leaf', 6)

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.88, 0.88, 'ground', skip=('bot',))
    m.box(-0.88, 0.88, Y0, Y0+0.012, -0.82, -0.28, 'grass', skip=('bot',))
    m.box(-0.88, 0.88, Y0, Y0+0.012, 0.28, 0.82, 'grass', skip=('bot',))
    m.box(-0.88, 0.88, Y0, Y0+0.01, -0.22, 0.22, 'road', skip=('bot',))
    for k in range(6):
        m.box(-0.8+k*0.3, -0.6+k*0.3, Y0+0.01, Y0+0.015, -0.01, 0.01, 'line', skip=('bot',))
    # corps : socle, piliers, entablement
    body = B(-0.72, 0.72, Y0+0.04, 0.78, -0.17, 0.17)
    m.box(-0.75, 0.75, Y0, Y0+0.04, -0.2, 0.2, 'stone3', skip=('bot',))
    box(m, body, 'stone')
    for face in ('pz', 'nz'):
        # passages : un grand au centre, deux moyens, deux petits rectangulaires aux extrémités
        decal(m, body, face, round_arch(0.0, Y0+0.04, 0.42, 0.14, 6), 'dark', 0.004)
        for u in (-0.35, 0.35):
            decal(m, body, face, round_arch(u, Y0+0.04, 0.34, 0.1, 5), 'dark', 0.004)
        for u in (-0.6, 0.6):
            decal(m, body, face, rect(u-0.065, u+0.065, Y0+0.04, 0.4), 'dark', 0.004)
        # pilastres entre les passages
        for u in (-0.5, -0.2, 0.2, 0.5):
            decal(m, body, face, rect(u-0.015, u+0.015, 0.45, 0.72), 'stone2', 0.004)
        for u in (-0.6, -0.35, 0.35, 0.6):
            decal(m, body, face, rect(u-0.04, u+0.04, 0.5, 0.64), 'stone2', 0.004)
            decal(m, body, face, rect(u-0.03, u+0.03, 0.52, 0.62), 'win', 0.007)
    # corniche
    m.box(-0.76, 0.76, 0.78, 0.84, -0.21, 0.21, 'stone2', skip=('bot',))
    # attique central et fronton
    m.box(-0.3, 0.3, 0.84, 1.08, -0.15, 0.15, 'stone', skip=('bot',))
    att = B(-0.3, 0.3, 0.84, 1.08, -0.15, 0.15)
    for face in ('pz', 'nz'):
        decal(m, att, face, rect(-0.08, 0.08, 0.9, 1.0), 'stone2', 0.004)
    m.box(-0.34, 0.34, 1.08, 1.12, -0.19, 0.19, 'stone2', skip=('bot',))
    gable(m, -0.34, 0.34, -0.19, 0.19, 1.12, 0.14, 'stone', 'z', 'stone2')
    # balustrade et petits trophées sur les ailes
    for sd in (-1, 1):
        m.box(sd*0.34 if sd > 0 else -0.72, 0.72 if sd > 0 else -0.34, 0.84, 0.92, -0.15, 0.15, 'stone2', skip=('bot',))
        for k in range(4):
            x = sd*(0.42+k*0.09)
            m.box(x-0.02, x+0.02, 0.92, 1.0, -0.02, 0.02, 'stone3', skip=('bot',))
    for (x, z) in ((-0.62, 0.5), (0.62, 0.5), (-0.62, -0.5), (0.62, -0.5), (-0.25, 0.6), (0.25, -0.6)):
        tree(m, x, z)
    return m
