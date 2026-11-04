"""Naples : le Vésuve (cône + crête du Somma), son panache, le village et la baie."""
import math
from lib import Mesh
from lib_mexique_italie import *

PAL = {'land': '#98AD66', 'earth': '#8B7355', 'beach': '#E4D3A2', 'shallow': '#62B5D8', 'sea': '#2F86C2',
       'g1': '#6F9C50', 'g1b': '#628F47', 'g2': '#8A7C50', 'g2b': '#796B46', 'g3': '#7C6650', 'g3b': '#6B5845', 'g4': '#625449', 'g4b': '#544840',
       'g5': '#8A7F72', 'g5b': '#766C61', 'ash': '#3F3835', 'lava': '#E8582A',
       'p0': '#4F4945', 'p1': '#6E6862', 'p2': '#928D87', 'p3': '#B9B5B0', 'p4': '#D8D5D1', 'p5': '#ECEAE7',
       'h1': '#F0DDB0', 'h2': '#E8B15C', 'h3': '#E58C80', 'h4': '#F4EBD6', 'h5': '#D9A15A', 'h6': '#CDD9B5',
       'tile': '#C4623F', 'tile2': '#B0502F', 'glass': '#3B312D', 'wood': '#8C6A47', 'trunk': '#6A4A34', 'pine': '#3E7B3F', 'pine2': '#336A38',
       'boat': '#F4F0E6', 'boat2': '#C9372E', 'sail': '#FFFFFF'}
MX, MZ = 0.05, -0.27


def noise(i, k, s=0):
    return math.sin(i*12.9898+k*78.233+s*37.719)*0.5+0.5


def cone_mount(m, cx, cz, rs, ys, n, rz_k, pal_off, amp=0.06, rim_tilt=0.0, seed=0):
    rings = []
    for k, (r, y) in enumerate(zip(rs, ys)):
        ring = []
        for i in range(n):
            a = 2*math.pi*i/n
            f = 1+amp*(noise(i, k, seed)-0.5)*2*(1 if 0 < k < len(rs)-1 else 0.3)
            yy = y
            if k == len(rs)-1:
                yy += rim_tilt*math.cos(a-0.8)
            ring.append((cx+r*f*math.cos(a), yy, cz+r*f*math.sin(a)*rz_k))
        rings.append(ring)
    names = ['g1', 'g2', 'g3', 'g4', 'g5']
    for k in range(len(rings)-1):
        for i in range(n):
            j = (i+1) % n
            base = names[min(k+pal_off, 4)]
            c = base+('b' if (i*3+k*2) % 3 == 0 else '')
            m.poly([rings[k][i], rings[k][j], rings[k+1][j], rings[k+1][i]], c, (cx, (rings[k][i][1]+rings[k+1][i][1])/2, cz))
    return rings


def build():
    m = Mesh(PAL)
    # socle
    m.box(-0.9, 0.9, 0, 0.06, -0.9, 0.9, 'earth', skip=('bot', 'top'))
    m.poly([(-0.9, 0.06, 0.9), (0.9, 0.06, 0.9), (0.9, 0.06, -0.9), (-0.9, 0.06, -0.9)], 'land', (0, -1, 0))
    sea = [(-0.18, 0.9), (0.9, 0.9), (0.9, 0.12), (0.62, 0.3), (0.28, 0.54)]
    cxs = sum(p[0] for p in sea)/5; czs = sum(p[1] for p in sea)/5
    cl = lambda v: max(-0.9, min(0.9, v))
    def grow(k):
        return [(cl(cxs+(x-cxs)*k), cl(czs+(z-czs)*k)) for (x, z) in sea]
    poly_floor(m, grow(1.22), 0.063, 'beach')
    poly_floor(m, grow(1.1), 0.067, 'shallow')
    poly_floor(m, sea, 0.071, 'sea')
    # Somma (crête basse, à gauche et derrière)
    cone_mount(m, -0.4, -0.5, [0.46, 0.38, 0.29, 0.19, 0.12], [0.06, 0.3, 0.52, 0.72, 0.78], 14, 0.9, 0, 0.05, 0.04, 3)
    # Vésuve
    n = 18
    rs = [0.76, 0.63, 0.5, 0.39, 0.29, 0.22]
    ys = [0.06, 0.26, 0.52, 0.78, 0.98, 1.08]
    rings = cone_mount(m, MX, MZ, rs, ys, n, 0.76, 0, 0.06, 0.05, 0)
    top = rings[-1]
    inner = [(MX+(p[0]-MX)*0.72, p[1]-0.045, MZ+(p[2]-MZ)*0.72) for p in top]
    low = [(MX+(p[0]-MX)*0.4, 0.93, MZ+(p[2]-MZ)*0.4) for p in top]
    for i in range(n):
        j = (i+1) % n
        m.poly([top[i], inner[i], inner[j], top[j]], 'g5', (MX, 1.3, MZ))
        m.poly([inner[i], low[i], low[j], inner[j]], 'ash', (MX, 1.3, MZ))
    m.poly(low, 'lava', (MX, 0, MZ))
    # panache
    puffs = [(0.05, 1.2, -0.27, 0.12, 'p0'), (0.08, 1.38, -0.27, 0.16, 'p1'), (0.15, 1.6, -0.25, 0.2, 'p2'),
             (0.28, 1.83, -0.23, 0.23, 'p3'), (0.46, 2.03, -0.21, 0.22, 'p4'), (0.63, 2.18, -0.2, 0.17, 'p5'),
             (0.0, 1.5, -0.3, 0.1, 'p1'), (0.3, 1.62, -0.2, 0.09, 'p2')]
    for (x, y, z, r, c) in puffs:
        sub = 1 if r >= 0.16 else 0
        def colfn(pts, c=c, r=r, y=y):
            yy = sum(p[1] for p in pts)/3
            lvl = int(c[1])+(1 if yy > y+r*0.25 else 0)-(1 if yy < y-r*0.45 else 0)
            lvl = max(0, min(5, lvl))
            return 'p%d' % lvl
        blob(m, x, y, z, r*1.05, r*0.82, r*1.05, c, sub, colfn)
    # village
    def shore_x(z):
        if z > 0.54:
            return -0.18+(0.9-z)/0.36*0.46-0.06
        return 0.28+(0.54-z)/0.24*0.34-0.06
    k = 0
    HC = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
    for (zr, x0, dx) in ((0.50, -0.8, 0.145), (0.66, -0.82, 0.145), (0.81, -0.8, 0.14)):
        x = x0
        while x < shore_x(zr)-0.08:
            w = 0.085+0.03*noise(k, 1)
            d = 0.085
            h = 0.075+0.05*noise(k, 2)
            col = HC[(k*5+int(zr*10)) % 6]
            y0 = 0.06
            obox(m, ID, x, x+w, y0, y0+h, zr-d/2, zr+d/2, col, skip=('top',))
            if k % 3 == 0:
                gable(m, ID, x, x+w, zr-d/2, zr+d/2, y0+h, y0+h+0.04, 'tile', col, ridge='s', o=0.008)
            else:
                hip(m, ID, x, x+w, zr-d/2, zr+d/2, y0+h, y0+h+0.045, 'tile2', o=0.008, rl=0.03)
            window(m, ID, x+w/2, 0.012, y0+h*0.4, y0+h*0.78, zr+d/2, 'glass', 'h4') if w > 0.1 else deco_rect(m, ID, x+w/2-0.012, x+w/2+0.012, y0+h*0.4, y0+h*0.78, zr+d/2+0.003, 'glass')
            x += w+0.03+dx-0.1
            k += 1
    # campanile du village
    obox(m, ID, -0.52, -0.46, 0.06, 0.28, 0.58, 0.64, 'h1', skip=('top',))
    hip(m, ID, -0.52, -0.46, 0.58, 0.64, 0.28, 0.36, 'tile')
    # appontement et barques
    obox(m, ID, 0.44, 0.50, 0.071, 0.085, 0.44, 0.78, 'wood', skip=('bot',))
    for (bx, bz, ang, c) in ((0.66, 0.62, 0.3, 'boat2'), (0.38, 0.82, -0.5, 'boat')):
        Fb = rot_frame(bx, bz, math.degrees(ang))
        hull_pts = [Fb.P(s, 0, d) for (s, d) in [(-0.08, 0.0), (-0.05, 0.026), (0.05, 0.026), (0.085, 0.0), (0.05, -0.026), (-0.05, -0.026)]]
        hull_poly(m, [(p[0], p[2]) for p in hull_pts], 0.071, 0.098, c, 'wood')
        m.poly([Fb.P(-0.01, 0.098, 0), Fb.P(-0.01, 0.2, 0), Fb.P(0.05, 0.1, 0)], 'sail', Fb.P(0, 0.1, 3))
        m.poly([Fb.P(-0.01, 0.098, 0), Fb.P(-0.01, 0.2, 0), Fb.P(0.05, 0.1, 0)], 'sail', Fb.P(0, 0.1, -3))
    # pins parasols
    for (x, z) in ((-0.74, 0.3), (-0.12, 0.34), (0.62, -0.05), (-0.88+0.1, 0.05)):
        y0 = 0.06
        m.box(x-0.012, x+0.012, y0, y0+0.12, z-0.012, z+0.012, 'trunk', skip=('bot', 'top'))
        blob(m, x, y0+0.15, z, 0.085, 0.04, 0.085, 'pine', 0, lambda pts: 'pine2' if pts[0][0] > x else 'pine')
    return m
