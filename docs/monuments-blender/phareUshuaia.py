"""Ushuaïa : petit phare rayé rouge et blanc sur un rocher, au pied de montagnes enneigées."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'sea': '#2B7FB0', 'foam': '#EAF3F4', 'rock1': '#6E7782', 'rock2': '#8A929C', 'top': '#A6AEB4', 'shore': '#8C8574',
    'grass': '#6E8B5A', 'mA': '#4F6079', 'mB': '#65779A', 'snow': '#F4F7FA', 'snow2': '#DCE6F0',
    'red': '#C6322C', 'white': '#F4F1EA', 'glass': '#F2D26A', 'dark': '#2E2A28', 'gold': '#D9A93A',
}

def peak(m, cx, cz, r, h, y0, rot=0.0, n=6):
    """Montagne : socle en facettes bleutées, calotte de neige."""
    yc = y0+h*0.5
    rc = r*0.5
    lathe(m, [(r, y0), (rc, yc)], n, 'mA', cx, cz, rot)
    for i in range(n):   # facettes alternées
        if i % 2:
            a0, a1 = rot+2*math.pi*i/n, rot+2*math.pi*(i+1)/n
            m.poly([(cx+r*math.sin(a0), y0+0.001, cz+r*math.cos(a0)), (cx+r*math.sin(a1), y0+0.001, cz+r*math.cos(a1)),
                    (cx+rc*math.sin(a1), yc+0.001, cz+rc*math.cos(a1)), (cx+rc*math.sin(a0), yc+0.001, cz+rc*math.cos(a0))], 'mB', (cx, yc, cz))
    for i in range(n):
        a0, a1 = rot+2*math.pi*i/n, rot+2*math.pi*(i+1)/n
        m.poly([(cx+rc*math.sin(a0), yc+0.002, cz+rc*math.cos(a0)), (cx+rc*math.sin(a1), yc+0.002, cz+rc*math.cos(a1)),
                (cx, y0+h, cz)], 'snow' if i % 2 == 0 else 'snow2', (cx, yc, cz))

def ring_poly(radii, scale, cx=0.0, cz=0.0, rot=0.0):
    n = len(radii)
    return [(cx+radii[i]*scale*math.sin(rot+2*math.pi*i/n), cz+radii[i]*scale*math.cos(rot+2*math.pi*i/n)) for i in range(n)]

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.04, -0.88, 0.88, 'sea', skip=('bot',))
    # rive du fond et montagnes
    m.box(-0.88, 0.88, 0.04, 0.12, -0.88, -0.45, 'shore', skip=('bot',))
    m.box(-0.88, 0.88, 0.12, 0.14, -0.88, -0.55, 'grass', skip=('bot',))
    peak(m, -0.5, -0.5, 0.38, 0.95, 0.14, 0.3)
    peak(m, 0.05, -0.5, 0.38, 1.3, 0.14, 0.0)
    peak(m, 0.55, -0.52, 0.33, 0.8, 0.14, 0.5)
    # rocher
    R = [0.66, 0.74, 0.62, 0.72, 0.84, 0.70, 0.60, 0.68, 0.78, 0.70]
    face2d(m, ring_poly(R, 0.55, 0.0, 0.3), lambda u, v: (u, 0.045, v), 'foam', (0, 0, 0))
    prism_xz(m, ring_poly(R, 0.5, 0.0, 0.3), 0.04, 0.2, 'rock1', 'rock2')
    prism_xz(m, ring_poly(R, 0.4, 0.0, 0.28, 0.2), 0.2, 0.34, 'rock2', 'top')
    # phare rayé
    TX, TZ, Y = 0.0, 0.28, 0.34
    n, r0, r1, bands, Hh = 8, 0.19, 0.12, 5, 1.2
    prof = [(r0-(r0-r1)*k/bands, Y+Hh*k/bands) for k in range(bands+1)]
    lathe(m, prof, n, ['red' if k % 2 == 0 else 'white' for k in range(bands)], TX, TZ)
    yt = Y+Hh
    lathe(m, [(r1, yt), (0.22, yt+0.04), (0.22, yt+0.08), (0.19, yt+0.08)], n, ['dark', 'dark', 'dark'], TX, TZ)
    lathe(m, [(0.19, yt+0.08), (0.11, yt+0.08)], n, ['dark'], TX, TZ)
    lathe(m, [(0.11, yt+0.08), (0.11, yt+0.26)], n, ['glass'], TX, TZ)
    lathe(m, [(0.11, yt+0.26), (0.15, yt+0.28), (0.15, yt+0.31), (0.0, yt+0.47)], n, ['dark', 'dark', 'red'], TX, TZ)
    ball(m, TX, yt+0.5, TZ, 0.03, 'gold')
    return m
