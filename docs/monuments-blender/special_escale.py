"""Escale : un avion de ligne blanc et rouge posé sur un bout de piste (marquage : bords, axe pointillé, seuil)."""
import math
from lib import Mesh
from lib_special import *

PAL = {'wht': '#F3F1EA', 'wht2': '#DDDFE2', 'red': '#C5292D', 'red2': '#A31F25', 'glass': '#26394C', 'dark': '#2B2C31', 'grey': '#8E939B',
       'rwy': '#5C5F68', 'rwy2': '#666973', 'line': '#EEEAD9'}

YAW = -14.0
SCALE = 0.86


def build():
    m = Mesh(PAL)
    # ---------- piste (avant la rotation : s'étend le long de X) ----------
    RX0, RX1, RZ = -0.88, 0.84, 0.43
    m.box(RX0, RX1, 0, 0.02, -RZ, RZ, 'rwy', skip=('bot',))
    for k in range(7):
        x0 = -0.5+0.25*k
        quad_xz(m, x0, x0+0.14, -0.018, 0.018, 0.022, 'line')
    quad_xz(m, RX0+0.03, RX1-0.03, RZ-0.07, RZ-0.045, 0.022, 'line')
    quad_xz(m, RX0+0.03, RX1-0.03, -RZ+0.045, -RZ+0.07, 0.022, 'line')
    for k in range(6):
        z0 = -0.30+0.105*k
        quad_xz(m, RX0+0.06, RX0+0.2, z0, z0+0.055, 0.022, 'line')
    # ---------- fuselage (le long de X, nez vers +X) ----------
    CY = 0.37
    # (x, rayon, hauteur de l'axe)
    secs = [(-0.84, 0.012, 0.50), (-0.74, 0.04, 0.455), (-0.56, 0.085, 0.405), (-0.36, 0.118, 0.375), (0.42, 0.122, CY),
            (0.58, 0.112, CY-0.003), (0.7, 0.088, CY-0.012), (0.79, 0.056, CY-0.022), (0.84, 0.022, CY-0.03)]
    N = 12
    def ring(x, r, cy):
        return [(x, cy+r*math.sin(2*math.pi*i/N), r*math.cos(2*math.pi*i/N)) for i in range(N)]
    rings = [ring(*s) for s in secs]
    def fcol(i, k):
        ang = (2*i+1)*180/N          # centre de la face i en degrés (0 = côté +Z, 90 = dessus)
        if k in (5, 6) and 60 < ang < 120:
            return 'glass'           # verrière du cockpit
        if abs(ang-345) < 1 or abs(ang-195) < 1:
            return 'red'             # filet rouge
        if 210 < ang < 330:
            return 'wht2'            # ventre
        return 'wht'
    for k in range(len(rings)-1):
        c = (0.5*(secs[k][0]+secs[k+1][0]), 0.5*(secs[k][2]+secs[k+1][2]), 0)
        for i in range(N):
            j = (i+1) % N
            m.poly([rings[k][i], rings[k][j], rings[k+1][j], rings[k+1][i]], fcol(i, k), c)
    m.poly(rings[0], 'red', (0, CY, 0))
    # hublots (deux côtés), posés dans le plan de la face
    for ang in (15, 165):
        ar = math.radians(ang)
        ap = 0.122*math.cos(math.radians(15))
        ny, nz = math.sin(ar), math.cos(ar)
        ty, tz = math.cos(ar), -math.sin(ar)
        for k in range(14):
            x = -0.32+0.06*k
            pts = []
            for (dx, dt) in ((-0.016, -0.017), (0.016, -0.017), (0.016, 0.017), (-0.016, 0.017)):
                pts.append((x+dx, CY+ap*ny+dt*ty+0.003*ny, ap*nz+dt*tz+0.003*nz))
            m.poly(pts, 'glass', (x, CY, 0))
    # ---------- ailes ----------
    for sd in (1, -1):
        top = [(0.14, 0.325, sd*0.1), (-0.26, 0.325, sd*0.1), (-0.43, 0.40, sd*0.72), (-0.33, 0.40, sd*0.72)]
        bot = [(p[0], p[1]-(0.03 if abs(p[2]) < 0.2 else 0.014), p[2]) for p in top]
        prism3(m, bot, top, 'wht', 'wht2', 'wht')
        # sous-face grise visible de loin : déjà wht2 ; winglet rouge
        z = sd*0.72
        slab(m, [(-0.43, 0.40), (-0.33, 0.40), (-0.355, 0.5), (-0.4, 0.5)], 'xy', z-0.01, z+0.01, 'red')
        # nacelle
        ex, ey, ez = 0.0, 0.245, sd*0.3
        tube(m, (ex-0.2, ey, ez), (ex+0.08, ey, ez), 0.066, 0.07, 10, 'wht', (False, False))
        tube(m, (ex+0.08, ey, ez), (ex+0.13, ey, ez), 0.07, 0.075, 10, 'red', (False, True), capcol='dark')
        tube(m, (ex-0.2, ey, ez), (ex-0.26, ey, ez), 0.066, 0.025, 10, 'grey', (False, True))
        m.box(ex-0.12, ex+0.0, ey+0.06, 0.332, ez-0.012, ez+0.012, 'wht2', skip=('bot', 'top'))
    # ---------- empennage ----------
    slab(m, [(-0.44, 0.45), (-0.79, 0.46), (-0.86, 0.93), (-0.72, 0.93)], 'xy', -0.022, 0.022, 'red')
    for sd in (1, -1):
        top = [(-0.66, 0.47, sd*0.045), (-0.82, 0.47, sd*0.045), (-0.87, 0.5, sd*0.31), (-0.8, 0.5, sd*0.31)]
        bot = [(p[0], p[1]-0.016, p[2]) for p in top]
        prism3(m, bot, top, 'wht', 'wht2', 'wht')
    # ---------- train d'atterrissage ----------
    for (gx, gz, w) in ((-0.06, 0.15, 1), (-0.06, -0.15, 1), (0.58, 0.0, 0.8)):
        rod(m, (gx, 0.30 if abs(gz) > 0.1 else 0.26, gz), (gx, 0.06, gz), 0.014, 'grey', 4)
        wz = 0.03 if w == 1 else 0.022
        tube_a = (gx, 0.05, gz-wz); tube_b = (gx, 0.05, gz+wz)
        tube(m, tube_a, tube_b, 0.05, 0.05, 8, 'dark', (True, True), capcol='grey')
    xform(m, rot_y(YAW))      # nez vers l'avant-droite
    return m
