"""Aides géométriques communes aux 16 monuments Israël / Corées / RD Congo d'Escales.
S'appuie sur lib.py, lib_vietnam_japon.py et lib_maroc_portugal.py sans les modifier. Même repère : Y haut, avant = +Z, emprise ±0.88."""
import math
from lib import *
from lib_vietnam_japon import circle, cyl, tbox, roof, blob, spire, gable
from lib_maroc_portugal import prism_xz, face2d, lathe, ball, palm

H = 0.88   # demi-côté de la dalle


def plate(m, col, y1=0.04, x0=-H, x1=H, z0=-H, z1=H):
    """Dalle de la case (ou plan d'eau)."""
    m.box(x0, x1, 0.0, y1, z0, z1, col, skip=('bot',))


def noise(i, k, s=0):
    return math.sin(i*12.9898+k*78.233+s*37.719)*0.5+0.5


def wall_band(m, poly, y0, y1, col):
    """Mur sans dessus ni dessous le long d'un contour (x, z)."""
    cx = sum(p[0] for p in poly)/len(poly)
    cz = sum(p[1] for p in poly)/len(poly)
    a = [(p[0], y0, p[1]) for p in poly]
    b = [(p[0], y1, p[1]) for p in poly]
    m.band(a, b, col, (cx, (y0+y1)/2, cz))


def rrect(cx, cz, hw, hd, rs, n=4):
    """Rectangle à coins arrondis (rayons rs dans l'ordre +x+z, -x+z, -x-z, +x-z ; rayon < 0.05 = coin vif)."""
    out = []
    for k, (sx, sz) in enumerate([(1, 1), (-1, 1), (-1, -1), (1, -1)]):
        r = rs[k]
        if r < 0.05:
            out.append((cx+sx*hw, cz+sz*hd))
        else:
            ccx, ccz = cx+sx*(hw-r), cz+sz*(hd-r)
            for j in range(n+1):
                a = math.radians(90*k+90*j/n)
                out.append((ccx+r*math.cos(a), ccz+r*math.sin(a)))
    return out


def clampH(v):
    return max(-H, min(H, v))


def grow(poly, k):
    """Contour agrandi autour de son centre, borné à la dalle."""
    cx = sum(p[0] for p in poly)/len(poly)
    cz = sum(p[1] for p in poly)/len(poly)
    return [(clampH(cx+(x-cx)*k), clampH(cz+(z-cz)*k)) for (x, z) in poly]


def cone(m, cx, cz, rs, ys, n, colfn, amp=0.0, seed=0, rz=1.0):
    """Montagne / terril : anneaux de rayons rs aux hauteurs ys. colfn(k, i) donne la couleur de la facette."""
    rings = []
    for k, (r, y) in enumerate(zip(rs, ys)):
        edge = 1.0 if 0 < k < len(rs)-1 else 0.3
        ring = []
        for i in range(n):
            a = 2*math.pi*i/n
            f = 1+amp*(noise(i, k, seed)-0.5)*2*edge
            ring.append((cx+r*f*math.cos(a), y, cz+r*f*math.sin(a)*rz))
        rings.append(ring)
    for k in range(len(rings)-1):
        for i in range(n):
            j = (i+1) % n
            m.poly([rings[k][i], rings[k][j], rings[k+1][j], rings[k+1][i]], colfn(k, i), (cx, (ys[k]+ys[k+1])/2, cz))
    return rings


def crater_wall(m, ra, rb, col, cx, cz):
    """Paroi intérieure d'un cratère (normale vers l'axe)."""
    n = len(ra)
    for i in range(n):
        j = (i+1) % n
        pts = [ra[i], ra[j], rb[j], rb[i]]
        c = centroid(pts)
        d = norm((c[0]-cx, 0, c[2]-cz))
        m.poly(pts, col, (c[0]+d[0], c[1], c[2]+d[2]))


def lid(m, ra, rb, col, cx, cz):
    """Bord plat d'un cratère entre deux anneaux (normale vers le haut)."""
    n = len(ra)
    for i in range(n):
        j = (i+1) % n
        m.poly([ra[i], ra[j], rb[j], rb[i]], col, (cx, min(p[1] for p in ra+rb)-1, cz))


def house(m, x0, x1, z0, z1, y0, h, wall, roof_col, win='dark', pitched=False, rh=0.07):
    """Maison à toit plat (dalle un peu débordante) ou à deux pans, avec une fenêtre sur la face avant."""
    y1 = y0+h
    m.box(x0, x1, y0, y1, z0, z1, wall, skip=('bot', 'top'))
    if pitched:
        gable(m, x0-0.012, x1+0.012, z0-0.012, z1+0.012, y1, rh, roof_col, wall, 'x')
    else:
        m.box(x0-0.012, x1+0.012, y1, y1+0.022, z0-0.012, z1+0.012, roof_col, skip=('bot',))
    if win:
        xm = (x0+x1)/2
        w = min(0.026, (x1-x0)*0.16)
        m.poly([(xm-w, y0+h*0.35, z1+0.004), (xm+w, y0+h*0.35, z1+0.004), (xm+w, y0+h*0.75, z1+0.004), (xm-w, y0+h*0.75, z1+0.004)],
               win, (xm, y0+h*0.5, z1-1))


def parasol(m, x, z, y0, h, r, c1, c2, pole, n=6):
    m.beam((x, y0, z), (x, y0+h, z), 0.022, pole)
    ring = circle(x, z, y0+h, r, n)
    apex = (x, y0+h+0.075, z)
    for i in range(n):
        m.poly([ring[i], ring[(i+1) % n], apex], c1 if i % 2 else c2, (x, y0+h-1, z))


def cypress(m, x, z, y0, h, r, col, n=5):
    cyl(m, x, z, y0, y0+h, r, col, 0.0, n=n, caps=(False, False))


def crenels(m, x0, x1, z0, z1, y, col, step=0.12, w=0.06, h=0.07, axis='x'):
    """Créneaux le long d'un mur : cubes régulièrement espacés."""
    if axis == 'x':
        k = max(1, int((x1-x0)/step))
        for i in range(k+1):
            c = x0+(x1-x0)*i/k
            m.box(c-w/2, c+w/2, y, y+h, z0, z1, col, skip=('bot',))
    else:
        k = max(1, int((z1-z0)/step))
        for i in range(k+1):
            c = z0+(z1-z0)*i/k
            m.box(x0, x1, y, y+h, c-w/2, c+w/2, col, skip=('bot',))


def smoke(m, puffs, colors):
    """Panache : puffs = [(x, y, z, r)], colors = couleurs du plus sombre au plus clair."""
    for i, (x, y, z, r) in enumerate(puffs):
        c = colors[min(len(colors)-1, i*len(colors)//len(puffs))]
        blob(m, x, y, z, r*1.05, r*0.85, r*1.05, c, n=7)
