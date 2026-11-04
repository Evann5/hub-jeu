"""Faro : un phare rayé rouge et blanc, sa maison de gardien, sur une falaise dorée au bord de la mer."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'sea': '#2B7FB0', 'foam': '#EAF3F4', 'rock1': '#B97F2B', 'rock2': '#CF9438', 'rock3': '#A56E26', 'top': '#E4C073',
    'red': '#C6322C', 'white': '#F4F1EA', 'glass': '#F2D26A', 'dark': '#2E2A28', 'roofr': '#B5402F', 'wall': '#F1ECE0',
    'gold': '#D9A93A', 'win': '#2D3E55',
}

def ring_poly(radii, scale, cx=0.0, cz=0.0, rot=0.0):
    n = len(radii)
    return [(cx+radii[i]*scale*math.sin(rot+2*math.pi*i/n), cz+radii[i]*scale*math.cos(rot+2*math.pi*i/n)) for i in range(n)]

def build():
    m = Mesh(PAL)
    # ---------- mer ----------
    m.box(-0.88, 0.88, 0.0, 0.04, -0.88, 0.88, 'sea', skip=('bot',))
    R = [0.66, 0.74, 0.62, 0.72, 0.84, 0.70, 0.60, 0.68, 0.78, 0.70, 0.60, 0.70]
    face2d(m, ring_poly(R, 1.05), lambda u, v: (u, 0.045, v), 'foam', (0, 0, 0))   # écume autour de la falaise
    prism_xz(m, ring_poly(R, 1.0), 0.04, 0.20, 'rock1', 'rock2')
    prism_xz(m, ring_poly(R, 0.86, 0.0, -0.02, 0.2), 0.20, 0.34, 'rock2', 'rock3')
    prism_xz(m, ring_poly(R, 0.72, 0.0, -0.04, 0.4), 0.34, 0.46, 'rock3', 'top')
    for (x, z, s, h) in ((-0.78, 0.5, 0.1, 0.08), (0.72, 0.56, 0.12, 0.1), (0.2, 0.74, 0.09, 0.07)):   # blocs au pied
        prism_xz(m, [(x-s, z-s*0.8), (x+s*0.7, z-s), (x+s, z+s*0.6), (x-s*0.6, z+s)], 0.04, 0.04+h, 'rock1', 'rock2')
    Y = 0.46
    # ---------- phare ----------
    TX, TZ = -0.16, -0.06
    n = 10
    r0, r1, Hh, bands = 0.185, 0.125, 1.2, 6
    prof = [(r0-(r0-r1)*k/bands, Y+Hh*k/bands) for k in range(bands+1)]
    lathe(m, [(r0+0.03, Y), (r0+0.03, Y+0.06), (r0, Y+0.06)], n, ['white', 'white'], TX, TZ)
    lathe(m, [(r0, Y+0.06)] + prof[1:], n, ['red' if k % 2 == 0 else 'white' for k in range(bands)], TX, TZ)
    yt = Y+Hh
    lathe(m, [(r1, yt), (0.2, yt+0.04), (0.2, yt+0.075)], n, ['dark', 'dark'], TX, TZ)          # balcon
    lathe(m, [(0.2, yt+0.075), (0.2, yt+0.12), (0.185, yt+0.12)], n, ['dark', 'dark'], TX, TZ)  # garde-corps
    lathe(m, [(0.2, yt+0.075), (0.1, yt+0.075)], n, ['dark'], TX, TZ)                          # plancher du balcon
    lathe(m, [(0.1, yt+0.075), (0.1, yt+0.25)], n, ['glass'], TX, TZ)                          # lanterne
    lathe(m, [(0.1, yt+0.25), (0.125, yt+0.255), (0.125, yt+0.285), (0.0, yt+0.38)], n, ['dark', 'dark', 'red'], TX, TZ)
    ball(m, TX, yt+0.42, TZ, 0.025, 'gold')
    # ---------- maison du gardien ----------
    hx0, hx1, hz0, hz1 = 0.08, 0.44, 0.0, 0.24
    h = B(hx0, hx1, Y, Y+0.15, hz0, hz1)
    box(m, h, 'wall')
    gable(m, hx0-0.02, hx1+0.02, hz0-0.03, hz1+0.03, Y+0.15, 0.09, 'roofr', 'x', 'wall')
    decal(m, h, 'pz', round_arch(0.0, Y, Y+0.06, 0.03, 3), 'win', 0.003)
    for uu in (-0.11, 0.11):
        decal(m, h, 'pz', rect(uu-0.025, uu+0.025, Y+0.07, Y+0.12), 'win', 0.003)
    m.box(-0.45, 0.0, Y, Y+0.04, 0.2, 0.24, 'wall', skip=('bot',))      # petit mur
    return m
