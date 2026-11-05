"""Grenade : l'Alhambra, palais rouge à tours et remparts sur sa colline, la Sierra Nevada au fond."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'ground': '#8FA865', 'hill1': '#9C6B3E', 'hill2': '#B5803F', 'hill3': '#6E8B4E', 'wall': '#C0613A', 'wall2': '#A94F2F',
    'sand': '#E3A56E', 'roof': '#8E3B2B', 'win': '#3A3633', 'water': '#4FA3C7', 'cyp': '#2F6B3A', 'trunk': '#6A4528',
    'grass': '#8DB162', 'mA': '#6E7C96', 'snow': '#F4F7FA', 'cream': '#EFD9B0', 'green': '#5E9F7F',
}

def ring_poly(radii, scale, cx=0.0, cz=0.0, rot=0.0):
    n = len(radii)
    return [(cx+radii[i]*scale*math.sin(rot+2*math.pi*i/n), cz+radii[i]*scale*math.cos(rot+2*math.pi*i/n)) for i in range(n)]

def merlons(m, x0, x1, z0, z1, y, col, s=0.04):
    """Créneaux sur le pourtour d'un rectangle."""
    for k in range(int((x1-x0)/(2*s))+1):
        x = x0+k*2*s
        for z in (z0, z1-s):
            if x+s <= x1+1e-6:
                m.box(x, x+s, y, y+s, z, z+s, col, skip=('bot',))
    for k in range(1, int((z1-z0)/(2*s))):
        z = z0+k*2*s
        for x in (x0, x1-s):
            if z+s <= z1+1e-6:
                m.box(x, x+s, y, y+s, z, z+s, col, skip=('bot',))

def tower(m, cx, cz, h, y0, half, col='wall', roof=None):
    b = B(cx-half, cx+half, y0, y0+h, cz-half, cz+half)
    box(m, b, col)
    m.box(cx-half-0.015, cx+half+0.015, y0+h, y0+h+0.03, cz-half-0.015, cz+half+0.015, 'sand', skip=('bot',))
    if roof:
        hip(m, cx-half-0.02, cx+half+0.02, cz-half-0.02, cz+half+0.02, y0+h+0.03, half*1.3, roof)
    else:
        merlons(m, cx-half-0.015, cx+half+0.015, cz-half-0.015, cz+half+0.015, y0+h+0.03, 'sand', 0.032)
    decal(m, b, 'pz', rect(-0.015, 0.015, y0+h*0.45, y0+h*0.8), 'win', 0.004)
    return b

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.04, -0.88, 0.88, 'ground', skip=('bot',))
    # Sierra Nevada
    for (x, r, h, rot) in ((-0.55, 0.28, 1.1, 0.3), (0.05, 0.3, 1.45, 0.0), (0.6, 0.24, 0.95, 0.6)):
        yc = 0.04+h*0.55
        for i in range(6):
            a0, a1 = rot+2*math.pi*i/6, rot+2*math.pi*(i+1)/6
            rc = r*0.45
            m.poly([(x+r*math.sin(a0), 0.04, -0.6+r*math.cos(a0)), (x+r*math.sin(a1), 0.04, -0.6+r*math.cos(a1)),
                    (x+rc*math.sin(a1), yc, -0.6+rc*math.cos(a1)), (x+rc*math.sin(a0), yc, -0.6+rc*math.cos(a0))], 'mA', (x, yc, -0.6))
            m.poly([(x+rc*math.sin(a0), yc, -0.6+rc*math.cos(a0)), (x+rc*math.sin(a1), yc, -0.6+rc*math.cos(a1)), (x, 0.04+h, -0.6)], 'snow', (x, yc, -0.6))
    # colline : un seul talus continu (roche brune en bas, pente verte, plateau herbeux), sans anneau saillant
    R = [0.9, 0.84, 0.92, 0.86, 0.94, 0.85, 0.9, 0.82, 0.93, 0.87]
    def ring3(scale, y):
        return [(x, y, z) for (x, z) in ring_poly(R, scale, 0, -0.04)]
    hc = (0, 0.15, -0.04)
    m.band(ring3(0.94, 0.04), ring3(0.9, 0.11), 'hill1', hc)
    m.band(ring3(0.9, 0.11), ring3(0.78, 0.3), 'hill3', hc)
    face2d(m, ring_poly(R, 0.78, 0, -0.04), lambda u, v: (u, 0.3, v), 'grass', (0, 0.1, -0.04))
    Y = 0.3
    # rempart de devant et ses tours
    wf = B(-0.52, 0.52, Y, Y+0.3, 0.12, 0.3)
    box(m, wf, 'wall')
    m.box(-0.54, 0.54, Y+0.3, Y+0.33, 0.1, 0.32, 'sand', skip=('bot',))
    decal(m, wf, 'pz', round_arch(0.0, Y, Y+0.13, 0.07, 5), 'win', 0.004)
    for u in (-0.4, 0.4):
        decal(m, wf, 'pz', rect(u-0.015, u+0.015, Y+0.12, Y+0.24), 'win', 0.004)
    tower(m, -0.52, 0.21, 0.6, Y, 0.1)
    tower(m, 0.52, 0.21, 0.55, Y, 0.1)
    # palais central + patio
    pal = B(-0.32, 0.32, Y, Y+0.38, -0.4, 0.0)
    box(m, pal, 'wall2')
    hip(m, -0.35, 0.35, -0.43, 0.03, Y+0.38, 0.1, 'roof', 0.12)
    for u in (-0.22, -0.11, 0.0, 0.11, 0.22):
        decal(m, pal, 'pz', round_arch(u, Y+0.15, Y+0.26, 0.03, 3), 'cream', 0.004)
        decal(m, pal, 'pz', round_arch(u, Y+0.15, Y+0.26, 0.02, 3), 'win', 0.007)
    m.box(-0.2, 0.2, Y, Y+0.012, 0.02, 0.1, 'water', skip=('bot',))
    # alcazaba : grande tour à gauche et donjon à droite
    tower(m, -0.5, -0.3, 0.9, Y, 0.14)
    tower(m, 0.5, -0.3, 0.7, Y, 0.12, roof='green')
    tower(m, 0.0, -0.5, 0.55, Y, 0.1)
    # cyprès
    for (x, z, yb) in ((-0.22, 0.46, Y), (0.2, 0.46, Y), (-0.7, 0.5, 0.2), (0.72, 0.46, 0.2), (-0.35, 0.68, 0.1), (0.4, 0.68, 0.1)):
        lathe(m, [(0.0, yb), (0.05, yb+0.01), (0.055, yb+0.06), (0.04, yb+0.3), (0.0, yb+0.42)], 5, ['trunk', 'cyp', 'cyp', 'cyp'], x, z)
    return m
