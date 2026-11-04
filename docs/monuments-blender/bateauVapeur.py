"""La Nouvelle-Orléans : bateau à aubes (type Natchez), étages blancs, roue rouge à l'arrière, deux hautes cheminées noires,
sur le Mississippi. Posé de trois quarts : proue vers l'avant droit."""
import math
from lib_france_usa import *

PAL = {'water': '#6E8B85', 'rip': '#86A39B', 'hull': '#34353B', 'red': '#B52A2E', 'red2': '#8C1E22', 'white': '#F2EFE7',
       'white2': '#DAD6CA', 'glass': '#3F4F57', 'black': '#26272B', 'rail': '#E8E4D8', 'deck': '#B79D78', 'gold': '#D6A93C'}

WX, WY, R_OUT, R_IN = -0.50, 0.38, 0.37, 0.31      # roue : centre x, y, rayons
ZW = 0.185                                            # demi-largeur de la roue

def ring_xy(cx, cy, z, r, n, off=0.0):
    return [(cx+r*math.cos(off+TAU*i/n), cy+r*math.sin(off+TAU*i/n), z) for i in range(n)]

def wheel(m, N=16):
    th = 0.035
    for (za, zb, out) in ((-ZW, -ZW+th, -1), (ZW-th, ZW, 1)):
        ro_a, ro_b = ring_xy(WX, WY, za, R_OUT, N), ring_xy(WX, WY, zb, R_OUT, N)
        ri_a, ri_b = ring_xy(WX, WY, za, R_IN, N), ring_xy(WX, WY, zb, R_IN, N)
        for i in range(N):
            j = (i+1) % N
            col = 'red' if i % 2 == 0 else 'red2'
            m.poly([ro_a[i], ro_a[j], ro_b[j], ro_b[i]], col, (WX, WY, (za+zb)/2))
            ang = TAU*(i+0.5)/N
            far = (WX+10*math.cos(ang), WY+10*math.sin(ang), (za+zb)/2)
            m.poly([ri_a[i], ri_a[j], ri_b[j], ri_b[i]], 'red2', far)
            zf = zb if out > 0 else za
            m.poly([ro_a[i] if out < 0 else ro_b[i], ro_a[j] if out < 0 else ro_b[j],
                    ri_a[j] if out < 0 else ri_b[j], ri_a[i] if out < 0 else ri_b[i]], col, (WX, WY, zf-out*10))
        # rayons plaqués sur la face extérieure
        zf = (zb+0.002) if out > 0 else (za-0.002)
        for k in range(8):
            a = TAU*k/8+0.2
            u = (math.cos(a), math.sin(a)); t = (-u[1], u[0])
            r0, r1, w = 0.05, R_IN, 0.012
            p = [(WX+u[0]*r0+t[0]*w, WY+u[1]*r0+t[1]*w, zf), (WX+u[0]*r1+t[0]*w, WY+u[1]*r1+t[1]*w, zf),
                 (WX+u[0]*r1-t[0]*w, WY+u[1]*r1-t[1]*w, zf), (WX+u[0]*r0-t[0]*w, WY+u[1]*r0-t[1]*w, zf)]
            m.poly(p, 'red2', (WX, WY, zf-out*10))
    # pales entre les deux jantes
    P = 12
    for k in range(P):
        a = TAU*(k+0.5)/P
        u = (math.cos(a), math.sin(a)); t = (-u[1], u[0])
        r0, r1, w = R_IN+0.005, R_OUT-0.002, 0.007
        pts = []
        for (r, s, z) in ((r0, -1, -ZW+th), (r1, -1, -ZW+th), (r1, 1, -ZW+th), (r0, 1, -ZW+th),
                          (r0, -1, ZW-th), (r1, -1, ZW-th), (r1, 1, ZW-th), (r0, 1, ZW-th)):
            pts.append((WX+u[0]*r+t[0]*w*s, WY+u[1]*r+t[1]*w*s, z))
        c = (WX+u[0]*(r0+r1)/2, WY+u[1]*(r0+r1)/2, 0)
        for f in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (3, 2, 6, 7), (1, 2, 6, 5), (0, 3, 7, 4)):
            m.poly([pts[i] for i in f], 'red', c)
    m.box(WX-0.04, WX+0.04, WY-0.04, WY+0.04, -ZW, ZW, 'black')

def posts(m, x0, x1, z, y0, y1, n):
    for k in range(n):
        x = x0+(x1-x0)*k/(n-1)
        m.box(x-0.008, x+0.008, y0, y1, z-0.008, z+0.008, 'rail', skip=('bot', 'top'))

def deck(m, x0, x1, hz, y0, y1, nwin, col_win='glass'):
    """Cabine : bandes verticales (fenêtres) sur les longs côtés, pleine aux bouts."""
    f = pattern(nwin, 0.42, 'white', col_win)
    tower(m, (x0+x1)/2, 0, x1-x0, 2*hz, y0, y1, pattern(3, 0.5, 'white', col_win), f, top_col='white2')

def build():
    m = XM(PAL)
    # fleuve
    m.box(-0.89, 0.89, 0.0, 0.07, -0.62, 0.62, 'water', skip=('bot',))
    for (x, z, w) in ((-0.55, 0.45, 0.30), (0.2, 0.5, 0.40), (0.55, -0.4, 0.30), (-0.2, -0.45, 0.25), (0.62, 0.2, 0.22), (-0.7, -0.2, 0.2)):
        flat_rect_y = 0.0715
        m.poly([(x-w/2, flat_rect_y, z-0.012), (x+w/2, flat_rect_y, z-0.012), (x+w/2, flat_rect_y, z+0.012), (x-w/2, flat_rect_y, z+0.012)], 'rip', (x, 0, z))
    with m.frame(-20, 0.03, 0, 0.0):
        # coque
        hull = [(-0.50, -0.25), (0.50, -0.25), (0.84, -0.08), (0.88, 0.0), (0.84, 0.08), (0.50, 0.25), (-0.50, 0.25)]
        extrude(m, hull, 0.04, 0.20, 'hull')
        extrude(m, [(x*1.0+(0.012 if x > 0 else -0.012)*0, z*1.0+(0.012 if z > 0 else -0.012)) for x, z in hull], 0.20, 0.23, 'white2')
        # pont principal, cabine, galerie
        deck(m, -0.04, 0.62, 0.19, 0.23, 0.43, 9)
        m.box(-0.10, 0.68, 0.43, 0.46, -0.27, 0.27, 'white', skip=('bot',))
        posts(m, -0.04, 0.64, 0.245, 0.23, 0.43, 8); posts(m, -0.04, 0.64, -0.245, 0.23, 0.43, 8)
        # deuxième étage
        deck(m, 0.02, 0.52, 0.15, 0.46, 0.64, 6)
        m.box(-0.03, 0.57, 0.64, 0.67, -0.22, 0.22, 'white', skip=('bot',))
        posts(m, 0.0, 0.54, 0.195, 0.46, 0.64, 6); posts(m, 0.0, 0.54, -0.195, 0.46, 0.64, 6)
        # texas et timonerie
        deck(m, 0.10, 0.42, 0.11, 0.67, 0.82, 4)
        m.box(0.06, 0.46, 0.82, 0.845, -0.15, 0.15, 'white', skip=('bot',))
        deck(m, 0.20, 0.36, 0.075, 0.845, 0.96, 3)
        gable(m, 0.18, 0.38, -0.095, 0.095, 0.96, 0.05, 'white2', axis='x', over=0.0)
        # cheminées
        for z in (-0.085, 0.085):
            lathe(m, 0.60, z, [(0.046, 0.46, 'black'), (0.040, 1.16), (0.050, 1.22), (0.062, 1.33), (0.062, 1.38), (0.04, 1.38), (0.0, 1.38)], 10, 'black')
        m.box(0.58, 0.62, 1.02, 1.05, -0.09, 0.09, 'black')
        # roue à aubes
        wheel(m)
    return m
