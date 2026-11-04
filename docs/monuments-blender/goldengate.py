import math
from lib import Mesh, square_ring

PAL = {'orange': '#D44A2A', 'road': '#3E4452', 'conc': '#CDC6B6', 'water': '#2F9DB6'}

ZT = 0.62            # position des tours
DECK_Y = 0.70        # dessus du tablier
LEG_X = 0.25

def build():
    m = Mesh(PAL)
    OR, RO, CO, WA = 'orange', 'road', 'conc', 'water'
    ZE = 1.00
    THETA = math.radians(34)
    # ---------- eau ----------
    m.box(-0.9, 0.9, 0.0, 0.045, -1.12, 1.12, WA, skip=('bot',))
    n0 = len(m.faces)
    # ---------- côtes : deux promontoires ----------
    for s in (1, -1):
        z0, z1 = sorted([s*0.80, s*ZE])
        m.box(-0.40, 0.40, 0.045, 0.26, z0, z1, CO, skip=('bot',))
        z0b, z1b = sorted([s*0.88, s*ZE])
        m.box(-0.30, 0.30, 0.26, DECK_Y-0.02, z0b, z1b, CO, skip=('bot',))
        # route sur le promontoire
        z0c, z1c = sorted([s*0.84, s*ZE])
        m.box(-0.17, 0.17, DECK_Y-0.02, DECK_Y, z0c, z1c, RO, skip=('bot',))
        # massifs d'ancrage des câbles
        for x in (-LEG_X, LEG_X):
            za, zb = sorted([s*0.88, s*0.98])
            m.box(x-0.06, x+0.06, DECK_Y-0.02, DECK_Y+0.14, za, zb, CO, skip=('bot',))
    # ---------- tablier ----------
    zd = 0.88
    m.box(-0.19, 0.19, DECK_Y-0.10, DECK_Y-0.02, -zd, zd, OR, skip=())
    m.box(-0.17, 0.17, DECK_Y-0.02, DECK_Y, -zd, zd, RO, skip=('bot',))
    for x in (-0.18, 0.18):
        m.box(x-0.012, x+0.012, DECK_Y, DECK_Y+0.045, -zd, zd, OR, skip=('bot',))
    # nervures du tablier (la poutre-treillis vue de côté)
    for k in range(-8, 9):
        z = k*0.1
        for sx in (-1, 1):
            m.box(sx*0.19-(0.004 if sx > 0 else 0)-(0.012 if sx < 0 else 0), sx*0.19+(0.012 if sx > 0 else 0)+(0.004 if sx < 0 else 0), DECK_Y-0.10, DECK_Y-0.02, z-0.012, z+0.012, OR, skip=('bot', 'nx' if sx > 0 else 'px'))

    # ---------- tours ----------
    steps = [0.30, 0.66, 1.00, 1.32, 1.62, 1.88, 2.10, 2.28, 2.40]
    for s in (1, -1):
        zc = s*ZT
        # pile de béton
        rb = [(-0.50, 0.045, -0.21), (0.50, 0.045, -0.21), (0.50, 0.045, 0.21), (-0.50, 0.045, 0.21)]
        rt = [(-0.42, 0.30, -0.15), (0.42, 0.30, -0.15), (0.42, 0.30, 0.15), (-0.42, 0.30, 0.15)]
        rb = [(x, y, z+zc) for x, y, z in rb]; rt = [(x, y, z+zc) for x, y, z in rt]
        m.loft([rb, rt], CO, caps=(False, True), ref_fn=lambda k, zc=zc: (0, 0.1, zc))
        for lx in (-LEG_X, LEG_X):
            for k in range(len(steps)-1):
                y0, y1 = steps[k], steps[k+1]
                w = 0.168-0.008*k     # largeur en x
                d = 0.132-0.0065*k    # profondeur en z
                m.box(lx-w/2, lx+w/2, y0, y1, zc-d/2, zc+d/2, OR, skip=('bot',))
                # redan : petit épaulement en bas de chaque marche
                if 0 < k < len(steps)-2:
                    w2, d2 = w+0.014, d+0.014
                    m.box(lx-w2/2, lx+w2/2, y0, y0+0.03, zc-d2/2, zc+d2/2, OR, skip=('bot',))
            # chapeau de selle des câbles
            m.box(lx-0.07, lx+0.07, 2.40, 2.45, zc-0.055, zc+0.055, OR, skip=('bot',))
            m.box(lx-0.045, lx+0.045, 2.45, 2.50, zc-0.04, zc+0.04, OR, skip=('bot',))
        # entretoises (le portique) : leurs hauteurs
        inner = LEG_X-0.07
        for (yc, h) in [(0.42, 0.075), (1.10, 0.09), (1.52, 0.08), (1.86, 0.075), (2.10, 0.07), (2.30, 0.07)]:
            m.box(-inner, inner, yc-h/2, yc+h/2, zc-0.05, zc+0.05, OR)
        # croisillons entre entretoises
        pairs = [(1.10, 1.52), (1.52, 1.86), (1.86, 2.10)]
        for (ya, yb) in pairs:
            ya += 0.04; yb -= 0.04
            a, b = (-inner, ya, zc), (inner, yb, zc)
            c, d = (inner, ya, zc), (-inner, yb, zc)
            m.beam(a, b, 0.032, OR, up=(0, 0, 1), caps=True)
            m.beam(c, d, 0.032, OR, up=(0, 0, 1), caps=True)
    # ---------- câbles ----------
    ytop = 2.44
    ymid = DECK_Y+0.10
    yend = DECK_Y+0.16
    def cab(z):
        a = abs(z)
        if a <= ZT:
            return ymid+(ytop-ymid)*(a/ZT)**2
        k = (ytop-yend)/(ZE-0.12-ZT)**2
        return yend+k*(ZE-0.12-a)**2
    zs = []
    n_main, n_side = 14, 5
    for i in range(-n_main, n_main+1):
        zs.append(ZT*i/n_main)
    for j in range(1, n_side+1):
        zz = ZT+(ZE-0.12-ZT)*j/n_side
        zs += [zz, -zz]
    zs = sorted(set(round(z, 5) for z in zs))
    for sx in (-LEG_X, LEG_X):
        rings = [square_ring((sx, cab(z), z), 0.04) for z in zs]
        # anneaux horizontaux orientés selon z : sections carrées dans le plan xy
        rings = [[(sx-0.02, cab(z)-0.02, z), (sx+0.02, cab(z)-0.02, z), (sx+0.02, cab(z)+0.02, z), (sx-0.02, cab(z)+0.02, z)] for z in zs]
        m.loft(rings, OR, caps=(True, True))
        # suspentes
        for z in zs:
            if abs(abs(z)-ZT) < 0.045:
                continue
            m.beam((sx, cab(z)-0.01, z), (sx, DECK_Y+0.04, z), 0.016, OR, sides=3)
    # la maquette est posée en diagonale : vue de trois quarts depuis n'importe quelle face
    c, s_ = math.cos(THETA), math.sin(THETA)
    m.faces[n0:] = [([(x*c+z*s_, y, -x*s_+z*c) for (x, y, z) in pts], col) for pts, col in m.faces[n0:]]
    return m
