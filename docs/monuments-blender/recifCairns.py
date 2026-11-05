"""Cairns : un récif de corail coloré en eaux turquoise, un îlot à palmier et un bateau d'excursion.
Passe 2 (05/11/2026) : moins chargé (cinq coraux en moins), les gros coraux restent lisibles.
Passe 3 (05/11/2026) : défaut de faces corrigé (environ 1500 pixels verts au contrôle) : les murs du récif et de l'îlot (contours creusés) étaient orientés
d'après le centre, donc à l'envers dans les creux ; ils le sont maintenant d'après leur propre contour. Palmes en deux triangles plans, sans quad gauche."""
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

def prism_loc(m, poly, y0, y1, col_side, col_top):
    """Prisme sur un contour (x, z) quelconque, creux compris : chaque mur est orienté vers l'extérieur d'après le sens du contour."""
    n = len(poly)
    area = sum(poly[i][0]*poly[(i+1) % n][1]-poly[(i+1) % n][0]*poly[i][1] for i in range(n))
    sg = 1 if area > 0 else -1
    for i in range(n):
        a, b = poly[i], poly[(i+1) % n]
        dx, dz = b[0]-a[0], b[1]-a[1]
        nx, nz = sg*dz, -sg*dx
        mx, mz = (a[0]+b[0])/2, (a[1]+b[1])/2
        m.poly([(a[0], y0, a[1]), (b[0], y0, b[1]), (b[0], y1, b[1]), (a[0], y1, a[1])], col_side, (mx-nx, (y0+y1)/2, mz-nz))
    cx = sum(p[0] for p in poly)/n; cz = sum(p[1] for p in poly)/n
    face2d(m, poly, lambda u, v: (u, y1, v), col_top, (cx, y1-1, cz))


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
    e = 0.004     # les deux faces écartées de 0,008 : plus de faces confondues qui scintillent
    m.poly([(p[0]-s*e, p[1], p[2]-c*e) for p in pts], col, (x+s, G, z+c))
    m.poly([(p[0]+s*e, p[1], p[2]+c*e) for p in pts], col, (x-s, G, z-c))

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
        ma, mb = (mid[0]+px*0.055, mid[1], mid[2]+pz*0.055), (mid[0]-px*0.055, mid[1], mid[2]-pz*0.055)
        ref = (top[0], top[1]-0.5, top[2])
        m.poly([top, ma, mb], 'leaf', ref)      # deux triangles plans plutôt qu'un quad gauche, face vers le haut
        m.poly([ma, tip, mb], 'leaf', ref)

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.04, -0.88, 0.88, 'sea', skip=('bot',))
    start = len(m.faces)
    R = [0.9, 1.0, 0.85, 0.95, 1.0, 0.8, 0.92, 1.0, 0.86, 0.94]
    face2d(m, ring_poly(R, 0.66, 0.55, 0.0, -0.1), lambda u, v: (u, 0.045, v), 'foam', (0, 0, 0))
    prism_loc(m, ring_poly(R, 0.62, 0.5, 0.0, -0.1), 0.04, 0.07, 'shelf', 'shelf')
    prism_loc(m, ring_poly(R, 0.5, 0.4, 0.0, -0.1, 0.3), 0.07, G, 'shelf', 'sand')
    # coraux
    table(m, -0.05, -0.05, 0.24, 'purple', 'pink')
    stag(m, -0.4, -0.15, 0.32, 'orange', 'yellow')
    stag(m, 0.28, -0.32, 0.36, 'pink', 'purple')
    dome(m, 0.25, 0.1, 0.17, 'yellow', 'orange')
    fan(m, -0.5, 0.02, 0.1, 0.28, 'red', 0.4)
    # îlot et palmier
    face2d(m, ring_poly([1.0, 0.9, 1.0, 0.92, 1.0, 0.88], 0.17, 0.17, -0.56, -0.56), lambda u, v: (u, 0.07, v), 'foam', (0, 0, 0))
    prism_loc(m, ring_poly([1.0, 0.9, 1.0, 0.92, 1.0, 0.88], 0.14, 0.14, -0.56, -0.56), 0.04, 0.11, 'sand', 'sand')
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
    m.poly([(bx+0.12, 0.4, bz-0.004), (bx+0.12, 0.28, bz-0.004), (bx+0.28, 0.17, bz-0.004)], 'yellow', (bx, 0.3, bz+1))
    m.poly([(bx+0.12, 0.4, bz+0.004), (bx+0.12, 0.28, bz+0.004), (bx+0.28, 0.17, bz+0.004)], 'yellow', (bx, 0.3, bz-1))
    # agrandit le récif et ses coraux (les rendre lisibles à 30 px), sans toucher à la dalle de mer
    S, SY = 1.2, 1.55
    xform(m, lambda p: (p[0]*S, 0.04+(p[1]-0.04)*SY, p[2]*S), start)
    return m
