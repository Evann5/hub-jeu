"""Manaus : le théâtre Amazonas, façade rose, portique blanc, coupole couverte de tuiles vertes, jaunes et bleues, forêt autour."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'forest': '#2E8546', 'forest2': '#3C9C55', 'path': '#E6D6AA', 'wall': '#F0B9A2', 'wall2': '#E0967F', 'cream': '#FFF1D4', 'col': '#FFF8E8',
       'green': '#18A74A', 'yellow': '#FBD21F', 'blue': '#1D5FD3', 'gold': '#E5B13A', 'dark': '#3A2D2A', 'stair': '#EBE0C8',
       'tree': '#1F6B3B', 'tree2': '#2F9150', 'trunk': '#6B4A30', 'leaf': '#2FA05A', 'leaf2': '#1E8049'}
DOME = ['green', 'yellow', 'blue']


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'forest', skip=('bot',))
    sbox(m, -0.62, 0.62, 0.05, 0.07, -0.5, 0.88, 'path', 'path')
    # corps du théâtre
    sbox(m, -0.5, 0.5, 0.07, 0.5, -0.45, 0.3, 'wall', 'wall2')
    sbox(m, -0.53, 0.53, 0.5, 0.57, -0.48, 0.33, 'cream', 'cream')
    for u in (-0.36, -0.18, 0.0, 0.18, 0.36):
        decal(m, 'pz', u-0.04, u+0.04, 0.16, 0.4, 0.303, 'dark')
    # portique à six colonnes et fronton
    for i in range(6):
        cyl(m, -0.4+0.16*i, 0.4, 0.07, 0.5, 0.036, 'col', n=6)
    sbox(m, -0.46, 0.46, 0.5, 0.57, 0.28, 0.46, 'cream', 'cream')
    gable(m, -0.46, 0.46, 0.28, 0.46, 0.57, 0.11, 'wall', 'cream', ridge='z')
    sbox(m, -0.46, 0.46, 0.07, 0.1, 0.3, 0.5, 'stair', 'stair')
    sbox(m, -0.3, 0.3, 0.07, 0.085, 0.5, 0.62, 'stair', 'stair')
    # tambour, coupole à tuiles en écailles aux couleurs du pays, lanterne
    cyl(m, 0, -0.08, 0.57, 0.74, 0.27, 'cream', n=12)
    dome(m, 0, -0.08, 0.74, 0.27, 'green', n=12, ry=0.3, colfn=lambda k, i: DOME[(i+k) % 3])
    cyl(m, 0, -0.08, 1.03, 1.16, 0.06, 'cream', n=8)
    cyl(m, 0, -0.08, 1.16, 1.3, 0.06, 'gold', r1=0.0, n=8)
    # forêt autour
    for (x, z, h, r) in ((-0.72, -0.05, 0.62, 0.14), (0.72, -0.1, 0.7, 0.15), (-0.72, 0.5, 0.5, 0.13), (0.72, 0.52, 0.55, 0.13),
                         (-0.45, -0.7, 0.7, 0.15), (0.42, -0.72, 0.62, 0.14), (0.0, -0.72, 0.76, 0.15), (-0.72, -0.68, 0.55, 0.12), (0.72, -0.7, 0.5, 0.12)):
        tree(m, x, z, 0.05, h, 'trunk', 'tree', 'tree2', r)
    palm(m, -0.62, 0.64, 0.5, 'trunk', 'leaf', 'leaf2', y0=0.05, lean=0.04, fronds=6, flen=0.2)
    palm(m, 0.64, 0.66, 0.45, 'trunk', 'leaf', 'leaf2', y0=0.05, lean=-0.04, fronds=6, flen=0.2)
    return m
