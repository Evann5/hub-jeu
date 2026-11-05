"""Touba : la grande mosquée, salle de prière à dômes verts et cinq minarets, dont un très haut au centre."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'plaza': '#E6D5AC', 'plaza2': '#D4BE8E', 'cream': '#F4EBD2', 'cream2': '#FFFAEA', 'ochre': '#C9803E', 'ochre2': '#A9672E',
       'green': '#1F9A5E', 'greend': '#166F45', 'greenl': '#45C08A', 'gold': '#E5B23B', 'dark': '#2D5F4C', 'lawn': '#6FAE55'}
Y0 = 0.06


def minaret(m, x, z, h, r, n=8):
    cyl(m, x, z, Y0, h, r, 'cream', r1=r*0.8, n=n, rot=math.pi/n)
    for k, yb in enumerate((h*0.33, h*0.66)):
        cyl(m, x, z, yb, yb+0.05, r*0.92, 'ochre', n=n, rot=math.pi/n, col_top='ochre2')
    cyl(m, x, z, h, h+0.05, r*1.3, 'ochre', r1=r*1.3, n=n, rot=math.pi/n, col_top='ochre2')       # balcon
    cyl(m, x, z, h+0.05, h+0.2, r*0.75, 'green', n=n, rot=math.pi/n)
    cyl(m, x, z, h+0.2, h+0.2+r*2.4, r*0.95, 'greenl', r1=0.0, n=n, rot=math.pi/n)
    ball(m, x, h+0.2+r*2.4+0.015, z, 0.03, 'gold', n=6)


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, Y0, -0.88, 0.88, 'plaza', skip=('bot',))
    m.box(-0.5, 0.5, Y0, Y0+0.01, 0.56, 0.88, 'plaza2', skip=('bot',))
    # salle de prière
    sbox(m, -0.58, 0.58, Y0, 0.46, -0.12, 0.52, 'cream', 'cream2')
    for u in (-0.42, -0.21, 0.0, 0.21, 0.42):
        decal(m, 'pz', u-0.055, u+0.055, Y0+0.0, Y0+0.22, 0.523, 'dark')
        decal(m, 'pz', u-0.075, u-0.055, Y0, Y0+0.3, 0.523, 'ochre')
        decal(m, 'pz', u+0.055, u+0.075, Y0, Y0+0.3, 0.523, 'ochre')
    decal(m, 'pz', -0.58, 0.58, 0.34, 0.4, 0.523, 'ochre')
    # grand dôme central et dômes latéraux
    cyl(m, 0, 0.2, 0.46, 0.58, 0.3, 'cream2', n=10)
    dome(m, 0, 0.2, 0.58, 0.3, 'green', n=10, ry=0.3, colfn=lambda k, i: 'green' if i % 2 == 0 else 'greenl')
    ball(m, 0, 0.93, 0.2, 0.03, 'gold', n=6)
    for sx in (-0.4, 0.4):
        cyl(m, sx, 0.2, 0.46, 0.52, 0.16, 'cream2', n=8)
        dome(m, sx, 0.2, 0.52, 0.16, 'green', n=8, ry=0.17, colfn=lambda k, i: 'green' if i % 2 == 0 else 'greenl')
        ball(m, sx, 0.7, 0.2, 0.02, 'gold', n=6)
    # quatre minarets d'angle
    for sx in (-0.66, 0.66):
        for sz in (-0.1, 0.5):
            minaret(m, sx, sz, 1.25, 0.075)
    # le grand minaret du fond, très haut
    minaret(m, 0, -0.45, 2.55, 0.17)
    return m
