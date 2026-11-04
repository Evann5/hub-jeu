"""Festival : un grand chapiteau rayé rouge et jaune, un petit chapiteau, des guirlandes de fanions et des ballons."""
import math
from lib import Mesh
from lib_special import *

PAL = {'red': '#CB3A31', 'yel': '#F0BD33', 'red2': '#B02E27', 'yel2': '#DCA826', 'door': '#3B2427', 'pole': '#8A7358', 'gold': '#E2B33C',
       'blue': '#2F6DB5', 'green': '#4E9E5B', 'pink': '#E56F92', 'teal': '#2AA3A0', 'orange': '#EE8A2B', 'string': '#E9E4D6', 'dark': '#3A3B44',
       'wht': '#F4F1E8', 'base': '#7C6A55'}

SCALE = 0.95
MX, MZ, MR = -0.1, -0.05, 0.78       # grand chapiteau
SX, SZ, SR = 0.86, 0.3, 0.38         # petit chapiteau


def tent(m, cx, cz, R, wall_h, roof, n, cA, cB, cA2, cB2, rot):
    cols = [cA, cB]
    # mur
    lathe(m, cx, cz, [(R, 0.0), (R, wall_h)], n, None, rot, lambda k, i: cols[i % 2])
    # toit : profil concave, rayé comme le mur
    prof = [(R*1.07, wall_h)]+roof
    lathe(m, cx, cz, prof, n, None, rot, lambda k, i: cols[i % 2])
    # festons sous le bord du toit
    for i in range(n):
        a0 = rot+2*math.pi*i/n; a1 = rot+2*math.pi*(i+1)/n
        am = (a0+a1)/2
        r = R*1.025
        p0 = (cx+r*math.cos(a0), wall_h, cz+r*math.sin(a0))
        p1 = (cx+r*math.cos(a1), wall_h, cz+r*math.sin(a1))
        pm = (cx+r*math.cos(am)*1.0, wall_h-0.12*R/0.78, cz+r*math.sin(am))
        m.poly([p0, p1, pm], (cB2 if i % 2 == 0 else cA2), (cx, wall_h-0.1, cz))


def banner_line(m, A, B, sag, npen, cols, h=0.1, w=0.07):
    """Guirlande de fanions entre deux points (A, B), avec une courbe de chaîne."""
    pts = []
    N = 12
    for k in range(N+1):
        t = k/N
        p = lerp(A, B, t)
        pts.append((p[0], p[1]-sag*4*t*(1-t), p[2]))
    for k in range(N):
        rod(m, pts[k], pts[k+1], 0.006, 'string', 3)
    for j in range(npen):
        t = (j+0.5)/npen*N
        k = int(t); f = t-k
        p = lerp(pts[k], pts[min(k+1, N)], f)
        d = norm(sub(pts[min(k+1, N)], pts[k]))
        dx = (d[0]*w/2, d[1]*w/2, d[2]*w/2)
        a = (p[0]-dx[0], p[1]-dx[1], p[2]-dx[2]); b = (p[0]+dx[0], p[1]+dx[1], p[2]+dx[2])
        tip = (p[0], p[1]-h, p[2])
        flat2(m, [a, b, tip], cols[j % len(cols)], (p[0], p[1], p[2]+3))


def build():
    m = Mesh(PAL)
    # ---------- grand chapiteau (16 pans, un pan centré face à +Z) ----------
    rot = math.pi/2 - math.pi*(2*7+1)/16 + 2*math.pi/16*0
    roof = [(0.74, 0.80), (0.55, 1.07), (0.34, 1.35), (0.15, 1.58), (0.0, 1.72)]
    tent(m, MX, MZ, MR, 0.62, roof, 16, 'red', 'yel', 'red2', 'yel2', rot)
    # entrée : rideau sombre + deux pans relevés
    ap = MR*math.cos(math.pi/16)
    zf = MZ+ap+0.004
    m.poly([(MX-0.17, 0.0, zf), (MX+0.17, 0.0, zf), (MX+0.17, 0.42, zf), (MX, 0.52, zf), (MX-0.17, 0.42, zf)], 'door', (MX, 0.2, zf-1))
    flat(m, [(MX-0.2, 0.0, zf+0.003), (MX-0.17, 0.0, zf+0.003), (MX-0.17, 0.42, zf+0.003), (MX, 0.52, zf+0.003)], 'red2', (MX, 0.3, zf+1))
    flat(m, [(MX+0.2, 0.0, zf+0.003), (MX+0.17, 0.0, zf+0.003), (MX+0.17, 0.42, zf+0.003), (MX, 0.52, zf+0.003)], 'red2', (MX, 0.3, zf+1))
    # mât, boule dorée et fanion du sommet
    cyl(m, MX, MZ, 0.018, 1.72, 2.2, 6, 'pole')
    blob(m, MX, 1.74, MZ, 0.05, 0.05, 0.05, 'gold', 0)
    P = lambda s, t: (MX+0.02+0.3*s, 2.2-0.16*t-(0.0), MZ)
    flat2(m, [(MX+0.02, 2.2, MZ), (MX+0.02, 2.04, MZ), (MX+0.34, 2.12, MZ)], 'red', (MX, 2.1, MZ+3))
    # ---------- petit chapiteau ----------
    rot2 = math.pi/2 - math.pi*(2*5+1)/12
    roof2 = [(0.33, 0.40), (0.2, 0.62), (0.08, 0.82), (0.0, 0.92)]
    tent(m, SX, SZ, SR, 0.34, roof2, 12, 'yel', 'red', 'yel2', 'red2', rot2)
    ap2 = SR*math.cos(math.pi/12)
    z2 = SZ+ap2+0.004
    m.poly([(SX-0.09, 0.0, z2), (SX+0.09, 0.0, z2), (SX+0.09, 0.2, z2), (SX, 0.27, z2), (SX-0.09, 0.2, z2)], 'door', (SX, 0.1, z2-1))
    cyl(m, SX, SZ, 0.012, 0.92, 1.28, 6, 'pole')
    flat2(m, [(SX+0.012, 1.28, SZ), (SX+0.012, 1.16, SZ), (SX+0.26, 1.22, SZ)], 'yel', (SX, 1.2, SZ+3))
    # ---------- guirlandes de fanions ----------
    top = (MX, 2.16, MZ)
    banner_line(m, top, (SX, 1.24, SZ), 0.18, 10, ['red', 'yel', 'blue', 'green', 'pink'])
    # mât avant gauche et guirlande
    qx, qz = -1.0, 0.55
    cyl(m, qx, qz, 0.02, 0, 1.15, 6, 'pole')
    cyl(m, qx, qz, 0.06, 0, 0.05, 8, 'base', cap='base')
    banner_line(m, top, (qx, 1.14, qz), 0.1, 8, ['yel', 'blue', 'red', 'green', 'pink'])
    # ---------- ballons attachés au mât avant ----------
    balls = [(-1.08, 1.45, 0.62, 'red'), (-0.93, 1.62, 0.5, 'blue'), (-1.02, 1.8, 0.4, 'yel'), (-0.8, 1.9, 0.62, 'pink'), (-0.9, 1.35, 0.78, 'teal'), (-1.13, 1.78, 0.7, 'green')]
    for (bx, by, bz, c) in balls:
        balloon(m, bx, by, bz, 0.12, 0.31, c, 8)
        rod(m, (bx, by-0.015, bz), (qx, 1.15, qz), 0.004, 'string', 3)
    return m
