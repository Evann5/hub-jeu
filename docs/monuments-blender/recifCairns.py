"""Cairns : un récif de corail coloré en eaux turquoise, un îlot à palmier et un bateau d'excursion."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'sea': '#1FA7C4', 'shelf': '#7FE0D4', 'sand': '#EAD9A4', 'orange': '#F08A3A', 'pink': '#F06A9A', 'purple': '#8A5CC4',
    'yellow': '#F2C94C', 'green': '#5DBB63', 'red': '#E24B4B', 'white': '#F4F1EA', 'hullred': '#C6322C', 'wood': '#B88A55',
    'blue': '#2E6FB5', 'trunk': '#8A5E32', 'leaf': '#3E9A4A', 'dark': '#2E2A28', 'foam': '#E8F6F6',
}
G = 0.1   # dessus du plateau de récif

def ring_poly(radii, sx, sz, cx=0.0, cz=0.0, rot=0.0):
    n = len(radii)
    return [(cx+radii[i]*sx*math.sin(rot+2*math.pi*i/n), cz+radii[i]*sz*math.cos(rot+2*math.pi*i/n)) for i in range(n)]

def stag(m, x, z, h, col, col2=None):
    m.beam((x, G, z), (x, G+h, z), 0.05, col, w1=0.02, sides=3, caps=True)
    for i in range(5):
        a = 2*math.pi*i/5+0.4
        y0 = G+h*(0.25+0.1*(i % 2))
        m.beam((x, y0, z), (x+0.14*math.cos(a), y0+h*0.55, z+0.14*math.sin(a)), 0.035, col2 or col, w1=0.012, sides=3, caps=True)

def table(m, x, z, r, col, col2):
    lathe(m, [(0.03, G), (0.035, G+0.1), (r, G+0.14), (r*0.92, G+0.18), (0.0, G+0.18)], 8, [col2, col2, col, col], x, z)

def dome(m, x, z, r, col, col2):
    lathe(m, [(r, G), (r*0.95, G+r*0.3), (r*0.7, G+r*0.75), (0.0, G+r)], 7, [col, col2, col], x, z)

def fan(m, x, z, w, h, col, rot=0.0):
    c, s = math.cos(rot), math.sin(rot)
    pts = [(x-w*c, G, z+w*s), (x+w*c, G, z-w*s), (x+w*0.7*c, G+h*0.8, z-w*0.7*s), (x, G+h, z), (x-w*0.7*c, G+h*0.8, z+w*0.7*s)]
    m.poly(pts, col, (x+s, G, z+c)); m.poly(pts, col, (x-s, G, z-c))

def palm2(m, x, z, h, lean, y0, fronds=6, flen=0.28):
    """Palmier : tronc et palmes en lames à deux faces."""
    top = (x+lean, y0+h, z)
    m.beam((x, y0, z), top, 0.045, 'trunk', w1=0.03, sides=3, up=(0, 0, 1), caps=True)
    for i in range(fronds):
        a = 2*math.pi*i/fronds+0.3
        dx, dz = math.cos(a), math.sin(a)
        px, pz = -dz, dx
        mid = (top[0]+dx*flen*0.55, top[1]+0.07, top[2]+dz*flen*0.55)
        tip = (top[0]+dx*flen, top[1]-0.06, top[2]+dz*flen)
        pts = [top, (mid[0]+px*0.055, mid[1], mid[2]+pz*0.055), tip, (mid[0]-px*0.055, mid[1], mid[2]-pz*0.055)]
        m.poly(pts, 'leaf', (top[0], top[1]-0.5, top[2]))
        m.poly(pts, 'leaf', (top[0], top[1]+0.5, top[2]))

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.04, -0.88, 0.88, 'sea', skip=('bot',))
    start = len(m.faces)
    R = [0.9, 1.0, 0.85, 0.95, 1.0, 0.8, 0.92, 1.0, 0.86, 0.94]
    face2d(m, ring_poly(R, 0.66, 0.55, 0.0, -0.1), lambda u, v: (u, 0.045, v), 'foam', (0, 0, 0))
    prism_xz(m, ring_poly(R, 0.62, 0.5, 0.0, -0.1), 0.04, 0.07, 'shelf', 'shelf')
    prism_xz(m, ring_poly(R, 0.5, 0.4, 0.0, -0.1, 0.3), 0.07, G, 'shelf', 'sand')
    # coraux
    table(m, -0.05, -0.05, 0.24, 'purple', 'pink')
    stag(m, -0.4, -0.15, 0.32, 'orange', 'yellow')
    stag(m, 0.28, -0.32, 0.36, 'pink', 'purple')
    stag(m, 0.4, 0.05, 0.26, 'orange')
    dome(m, 0.25, 0.1, 0.17, 'yellow', 'orange')
    dome(m, -0.35, -0.38, 0.15, 'pink', 'red')
    dome(m, -0.28, 0.12, 0.13, 'green', 'yellow')
    table(m, 0.05, -0.38, 0.17, 'green', 'yellow')
    fan(m, -0.5, 0.02, 0.1, 0.28, 'red', 0.4)
    fan(m, 0.12, 0.2, 0.09, 0.24, 'purple', -0.3)
    # îlot et palmier
    face2d(m, ring_poly([1.0, 0.9, 1.0, 0.92, 1.0, 0.88], 0.17, 0.17, -0.56, -0.56), lambda u, v: (u, 0.07, v), 'foam', (0, 0, 0))
    prism_xz(m, ring_poly([1.0, 0.9, 1.0, 0.92, 1.0, 0.88], 0.14, 0.14, -0.56, -0.56), 0.04, 0.11, 'sand', 'sand')
    palm2(m, -0.56, -0.56, 0.5, 0.06, 0.11)
    # bateau d'excursion
    bx, bz = 0.3, 0.5
    hull = [(bx-0.3, bz-0.08), (bx+0.18, bz-0.09), (bx+0.32, bz), (bx+0.18, bz+0.09), (bx-0.3, bz+0.08)]
    prism_xz(m, hull, 0.04, 0.09, 'hullred', 'hullred')
    hull2 = [(bx-0.31, bz-0.085), (bx+0.18, bz-0.095), (bx+0.33, bz), (bx+0.18, bz+0.095), (bx-0.31, bz+0.085)]
    prism_xz(m, hull2, 0.09, 0.15, 'white', 'wood')
    m.box(bx-0.2, bx+0.05, 0.15, 0.27, bz-0.06, bz+0.06, 'white', skip=('bot',))
    m.box(bx-0.22, bx+0.07, 0.27, 0.295, bz-0.08, bz+0.08, 'blue', skip=('bot',))
    m.box(bx+0.05, bx+0.052, 0.19, 0.25, bz-0.05, bz+0.05, 'dark')
    m.beam((bx+0.12, 0.15, bz), (bx+0.12, 0.42, bz), 0.02, 'white', w1=0.012)
    m.poly([(bx+0.12, 0.4, bz), (bx+0.12, 0.28, bz), (bx+0.28, 0.17, bz)], 'yellow', (bx, 0.3, bz+1))
    m.poly([(bx+0.12, 0.4, bz), (bx+0.12, 0.28, bz), (bx+0.28, 0.17, bz)], 'yellow', (bx, 0.3, bz-1))
    # agrandit le récif et ses coraux (les rendre lisibles à 30 px), sans toucher à la dalle de mer
    S, SY = 1.2, 1.55
    xform(m, lambda p: (p[0]*S, 0.04+(p[1]-0.04)*SY, p[2]*S), start)
    return m
