import math
from lib import Mesh, lerp, centroid

PAL = {'trav': '#E9D6AC', 'recess': '#7B6046', 'brick': '#C4764C', 'sand': '#DEC08A'}
N = 28
A, B = 0.86, 0.78                     # demi-axes de l'ellipse à r = 1
YB = [0.06, 0.37, 0.67, 0.95, 1.30]   # sols des trois étages d'arcades, de l'attique, sommet
CH = [0.035, 0.035, 0.035, 0.04]      # hauteur des corniches
# Nombre d'étages debout, baie par baie (0 = devant, puis vers la droite) : le côté effondré est à l'avant droit.
L_OUT = [0, 0, 0, 0, 0, 0, 1, 2, 3, 4] + [4]*14 + [4, 4, 3, 2]
L_IN = {27: 2, 0: 2, 1: 2, 2: 1, 3: 2, 4: 1, 5: 2, 6: 2, 7: 2}   # le mur intérieur, visible côté ruine

def E(r, i, y=0.0):
    a = 2*math.pi*(i % N)/N
    return (A*r*math.sin(a), y, B*r*math.cos(a))

def Q(r, i, s, y):
    a, b = E(r, i), E(r, i+1)
    return (a[0]+(b[0]-a[0])*s, y, a[2]+(b[2]-a[2])*s)

def build():
    m = Mesh(PAL)
    TR, RE, BR, SA = 'trav', 'recess', 'brick', 'sand'
    S0, S1 = 0.21, 0.79

    def ctr(y): return (0, y, 0)

    def arch_pts(i, r, y0, ytop):
        chord = math.dist(E(r, i), E(r, i+1))
        hw = (S1-S0)/2*chord
        ysp = ytop-hw
        sc = (S0+S1)/2
        pts = []
        for k in range(4):
            th = math.pi*(1-k/3)
            pts.append((sc+math.cos(th)*(S1-S0)/2, ysp+math.sin(th)*hw))
        return pts   # (s, y)

    def arcade(i, y0, y1, r_out, depth, ytop_gap=0.045):
        rb = r_out-depth
        ytop = y1-ytop_gap
        ap = arch_pts(i, r_out, y0, ytop)
        ysp = ap[0][1]
        # face avant
        m.poly([Q(r_out, i, 0, y0), Q(r_out, i, S0, y0), Q(r_out, i, S0, y1), Q(r_out, i, 0, y1)], TR, ctr(y0))
        m.poly([Q(r_out, i, S1, y0), Q(r_out, i, 1, y0), Q(r_out, i, 1, y1), Q(r_out, i, S1, y1)], TR, ctr(y0))
        for k in range(3):
            (s0, ya), (s1, yb) = ap[k], ap[k+1]
            m.poly([Q(r_out, i, s0, ya), Q(r_out, i, s1, yb), Q(r_out, i, s1, y1), Q(r_out, i, s0, y1)], TR, ctr(y0))
        # fond sombre de la baie
        plate = [Q(rb, i, S0, y0), Q(rb, i, S1, y0)] + [Q(rb, i, s, y) for (s, y) in reversed(ap)]
        m.poly(plate, RE, ctr(y0))
        # côtés et seuil
        mid = lerp(Q(r_out, i, 0.5, (y0+ysp)/2), Q(rb, i, 0.5, (y0+ysp)/2), 0.5)
        m.poly([Q(r_out, i, S0, y0), Q(rb, i, S0, y0), Q(rb, i, S0, ysp), Q(r_out, i, S0, ysp)], TR, mid)
        m.poly([Q(r_out, i, S1, y0), Q(rb, i, S1, y0), Q(rb, i, S1, ysp), Q(r_out, i, S1, ysp)], TR, mid)
        m.poly([Q(r_out, i, S0, y0), Q(r_out, i, S1, y0), Q(rb, i, S1, y0), Q(rb, i, S0, y0)], TR, (0, y0-1, 0))

    def block(i, r_in, r_out, y0, y1, col, faces):
        c = lerp(Q(r_in, i, 0.5, y0), Q(r_out, i, 0.5, y1), 0.5)
        P = {
            'out': [Q(r_out, i, 0, y0), Q(r_out, i, 1, y0), Q(r_out, i, 1, y1), Q(r_out, i, 0, y1)],
            'in': [Q(r_in, i, 0, y0), Q(r_in, i, 1, y0), Q(r_in, i, 1, y1), Q(r_in, i, 0, y1)],
            'top': [Q(r_in, i, 0, y1), Q(r_in, i, 1, y1), Q(r_out, i, 1, y1), Q(r_out, i, 0, y1)],
            'a': [Q(r_in, i, 0, y0), Q(r_out, i, 0, y0), Q(r_out, i, 0, y1), Q(r_in, i, 0, y1)],
            'b': [Q(r_in, i, 1, y0), Q(r_out, i, 1, y0), Q(r_out, i, 1, y1), Q(r_in, i, 1, y1)],
        }
        for f in faces:
            m.poly(P[f], BR if f in ('a', 'b') else col, c)

    def window(i, y0, y1, r_out, depth):
        rb = r_out-depth
        w0, w1 = 0.34, 0.66
        yw0, yw1 = y0+0.09, y1-0.09
        m.poly([Q(r_out, i, 0, y0), Q(r_out, i, w0, y0), Q(r_out, i, w0, y1), Q(r_out, i, 0, y1)], TR, ctr(y0))
        m.poly([Q(r_out, i, w1, y0), Q(r_out, i, 1, y0), Q(r_out, i, 1, y1), Q(r_out, i, w1, y1)], TR, ctr(y0))
        m.poly([Q(r_out, i, w0, y0), Q(r_out, i, w1, y0), Q(r_out, i, w1, yw0), Q(r_out, i, w0, yw0)], TR, ctr(y0))
        m.poly([Q(r_out, i, w0, yw1), Q(r_out, i, w1, yw1), Q(r_out, i, w1, y1), Q(r_out, i, w0, y1)], TR, ctr(y0))
        m.poly([Q(rb, i, w0, yw0), Q(rb, i, w1, yw0), Q(rb, i, w1, yw1), Q(rb, i, w0, yw1)], RE, ctr(y0))

    # ---------- socle et sol ----------
    for k in range(N):
        for (r, ya, yb_) in ((1.045, 0.0, 0.03), (1.0, 0.03, 0.06)):
            m.poly([E(r, k, ya), E(r, k+1, ya), E(r, k+1, yb_), E(r, k, yb_)], SA, ctr(0.02))
        m.poly([E(1.045, k, 0.03), E(1.045, k+1, 0.03), E(1.0, k+1, 0.03), E(1.0, k, 0.03)], SA, (0, -1, 0))
        m.poly([E(0, 0, 0.06), E(1.0, k, 0.06), E(1.0, k+1, 0.06)], SA, (0, 0, 0))
    # ---------- hypogée : l'arène à ciel ouvert, ses murs ----------
    zx, zz = 0.23, 0.12
    m.poly([(-zx, 0.064, -zz), (zx, 0.064, -zz), (zx, 0.064, zz), (-zx, 0.064, zz)], RE, (0, 0, 0))
    wall_h = 0.045
    for z in (-0.06, 0.0, 0.06):
        m.box(-zx+0.01, zx-0.01, 0.064, 0.064+wall_h, z-0.011, z+0.011, BR, skip=('bot',))
    for x in (-0.15, -0.05, 0.05, 0.15):
        m.box(x-0.011, x+0.011, 0.064, 0.064+wall_h, -zz+0.01, zz-0.01, BR, skip=('bot',))
    # ---------- gradins ----------
    R = [0.40, 0.50, 0.60, 0.70, 0.80, 0.90]
    Y = [0.15, 0.29, 0.43, 0.57, 0.69]
    for i in range(N):
        cz = math.cos(2*math.pi*(i+0.5)/N)
        L = L_OUT[i]
        top_ring = 4 if L >= 3 else 3   # anneau 4 = r 0.80-0.90 ; anneau 3 = r 0.70-0.80
        for k in range(0, top_ring+1):
            ra, rb_ = R[k], R[k+1]
            m.poly([E(ra, i, Y[k]), E(ra, i+1, Y[k]), E(rb_, i+1, Y[k]), E(rb_, i, Y[k])], BR, (0, 0, 0))
            if cz < 0.35:
                y_prev = 0.06 if k == 0 else Y[k-1]
                m.poly([E(ra, i, y_prev), E(ra, i+1, y_prev), E(ra, i+1, Y[k]), E(ra, i, Y[k])], TR, (9, y_prev, 9))
        if L == 0 and i not in L_IN:
            pass
    # ---------- mur extérieur ----------
    for i in range(N):
        L = L_OUT[i]
        if L == 0:
            continue
        r_o, r_i, dep, prot = 1.0, 0.9, 0.05, 0.03
        top_y = YB[min(L, 4)]
        for t in range(min(L, 3)):
            arcade(i, YB[t], YB[t+1]-CH[t], r_o, dep)
            block(i, r_i, r_o+prot, YB[t+1]-CH[t], YB[t+1], TR, ('out', 'top') if t < L-1 else ('out', 'top'))
        if L == 4:
            y0, y1 = YB[3], YB[4]-CH[3]
            if i % 2 == 0:
                window(i, y0, y1, r_o, dep)
            else:
                block(i, r_i, r_o, y0, y1, TR, ('out',))
            block(i, r_i, r_o+prot, y1, YB[4], TR, ('out', 'top'))
        # face intérieure + arches peintes pour l'étage 3
        yin = 0.55
        m.poly([Q(r_i, i, 0, yin), Q(r_i, i, 1, yin), Q(r_i, i, 1, top_y), Q(r_i, i, 0, top_y)], TR, (9, yin, 9))
        if L >= 3:
            ap = arch_pts(i, r_i, YB[2], YB[3]-CH[2]-0.045)
            poly = [Q(r_i-0.004, i, S0, YB[2]), Q(r_i-0.004, i, S1, YB[2])] + [Q(r_i-0.004, i, s, y) for (s, y) in reversed(ap)]
            m.poly(poly, RE, (9, YB[2], 9))
        # bouts à nu (la brique apparaît là où le mur s'arrête)
        for t in range(min(L, 4)):
            ya, yb2 = YB[t], YB[t+1]
            if L_OUT[(i-1) % N] <= t:
                block(i, r_i, r_o, ya, yb2, TR, ('a',))
            if L_OUT[(i+1) % N] <= t:
                block(i, r_i, r_o, ya, yb2, TR, ('b',))
    # ---------- mur intérieur (côté ruine) ----------
    for i, Lin in L_IN.items():
        r_o, r_i, dep, prot = 0.89, 0.80, 0.045, 0.025
        for t in range(Lin):
            arcade(i, YB[t], YB[t+1]-CH[t], r_o, dep)
            block(i, r_i, r_o+prot, YB[t+1]-CH[t], YB[t+1], TR, ('out', 'top'))
        top_y = YB[Lin]
        m.poly([Q(r_i, i, 0, 0.5), Q(r_i, i, 1, 0.5), Q(r_i, i, 1, top_y), Q(r_i, i, 0, top_y)], TR, (9, 0.5, 9))
        for t in range(Lin):
            ya, yb2 = YB[t], YB[t+1]
            if L_IN.get((i-1) % N, 0) <= t:
                block(i, r_i, r_o, ya, yb2, TR, ('a',))
            if L_IN.get((i+1) % N, 0) <= t:
                block(i, r_i, r_o, ya, yb2, TR, ('b',))
    return m
