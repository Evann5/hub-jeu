import math
from lib import Mesh, square_ring, lerp

PAL = {'iron': '#7E5E48', 'gold': '#C79B5E', 'stone': '#BBB09C'}

def W(y):
    """Demi-largeur de l'arête extérieure de la tour à la hauteur y (courbe exponentielle de la vraie tour)."""
    return 0.80*math.exp(-y/1.5)+0.045

P1, P2, P3 = 0.86, 1.75, 4.15      # plateformes
BAND = 0.10                         # hauteur du bandeau doré

def build(params=None):
    m = Mesh(PAL)
    IR, GO, ST = 'iron', 'gold', 'stone'
    SX = [(1, 1), (1, -1), (-1, 1), (-1, -1)]

    def post(pt_fn, size_fn, ys, col=IR):
        rings = [square_ring(pt_fn(y), size_fn(y)) for y in ys]
        m.loft(rings, col)

    def lattice(face_pts, ys, t, xs=True, rungs=True):
        """face_pts(y) -> (A, B) : les deux poteaux d'une face. Croisillons en X et traverses."""
        for i in range(len(ys)-1):
            a0, b0 = face_pts(ys[i]); a1, b1 = face_pts(ys[i+1])
            if xs:
                m.beam(a0, b1, t, IR)
                m.beam(b0, a1, t, IR)
            if rungs and i > 0:
                m.beam(a0, b0, t*1.15, IR)

    # ---- étage 1 : quatre piliers sous la première plateforme ----
    p_half = lambda y: 0.165-(0.165-0.085)*(y/P1)
    sA = lambda y: 0.078-0.028*(y/P1)
    ysA = [i*P1/6 for i in range(7)]
    for (sx, sz) in SX:
        def corner(a, b, sx=sx, sz=sz):
            def f(y):
                p = p_half(y); c = W(y)-p
                return (sx*(c+a*p), y, sz*(c+b*p))
            return f
        cs = {(a, b): corner(a, b) for a in (1, -1) for b in (1, -1)}
        for key, f in cs.items():
            post(f, sA, ysA)
        # quatre faces du pilier
        for (A, B) in [((1, 1), (1, -1)), ((-1, 1), (-1, -1)), ((1, 1), (-1, 1)), ((1, -1), (-1, -1))]:
            lattice(lambda y, A=A, B=B: (cs[A](y), cs[B](y)), ysA, 0.026)
        # semelle de pierre
        p0 = p_half(0)
        c0 = W(0)-p0
        x0, x1 = sorted([sx*(c0-p0-0.04), sx*(c0+p0+0.04)])
        z0, z1 = sorted([sz*(c0-p0-0.04), sz*(c0+p0+0.04)])
        m.box(x0, x1, 0, 0.07, z0, z1, ST, skip=('bot',))

    # ---- les grandes arches sous la première plateforme ----
    rx, ry = 0.50, 0.60
    def arch_pt(t, ox, oy, depth, side, axis):
        x = ox*math.cos(t)
        y = oy*math.sin(t)
        zz = side*(W(y)-0.03+depth)
        return (x, y, zz) if axis == 'z' else (zz, y, x)
    for axis in ('z', 'x'):
        for side in (1, -1):
            T = [math.pi*i/14 for i in range(15)]
            rings = []
            for t in T:
                ring = [arch_pt(t, rx+0.045, ry+0.045, +0.028, side, axis),
                        arch_pt(t, rx+0.045, ry+0.045, -0.028, side, axis),
                        arch_pt(t, rx-0.035, ry-0.035, -0.028, side, axis),
                        arch_pt(t, rx-0.035, ry-0.035, +0.028, side, axis)]
                rings.append(ring)
            m.loft(rings, IR, closed=True)
            # montants entre l'arche et la plateforme
            for xo in (-0.40, -0.2, 0.0, 0.2, 0.40):
                yb = ry*math.sqrt(max(0.0, 1-(xo/rx)**2))+0.02
                zz = side*(W(0.5*(yb+P1))-0.03)
                a = (xo, yb, zz) if axis == 'z' else (zz, yb, xo)
                b = (xo, P1+0.01, zz) if axis == 'z' else (zz, P1+0.01, xo)
                m.beam(a, b, 0.03, IR)

    # ---- plateforme 1 ----
    def platform(P, hw, over=0.035, band=BAND, slab=0.035):
        m.box(-hw, hw, P, P+band, -hw, hw, GO)
        m.box(-hw-over, hw+over, P+band, P+band+slab, -hw-over, hw+over, ST, skip=('bot',))
        # garde-corps
        r = hw+over-0.012; yr = P+band+slab+0.022
        for (a, b) in [((-r, yr, -r), (r, yr, -r)), ((r, yr, -r), (r, yr, r)), ((r, yr, r), (-r, yr, r)), ((-r, yr, r), (-r, yr, -r))]:
            m.beam(a, b, 0.02, IR, caps=True)
    platform(P1, W(P1)+0.03)

    # ---- étage 2 : quatre arêtes entre la 1re et la 2e plateforme ----
    sB = lambda y: 0.075-0.02*((y-P1)/(P2-P1))
    yB0 = P1+BAND+0.035
    ysB = [yB0+(P2-yB0)*i/4 for i in range(5)]
    def corner_post(sx, sz, size):
        return lambda y: (sx*(W(y)-size(y)/2), y, sz*(W(y)-size(y)/2))
    def stage(ys, size, t, col_xs=True):
        cps = {s: corner_post(s[0], s[1], size) for s in SX}
        for s, f in cps.items():
            post(f, size, ys)
        for (A, B) in [((1, 1), (1, -1)), ((-1, 1), (-1, -1)), ((1, 1), (-1, 1)), ((1, -1), (-1, -1))]:
            lattice(lambda y, A=A, B=B: (cps[A](y), cps[B](y)), ys, t, col_xs)
    stage(ysB, sB, 0.026)
    platform(P2, W(P2)+0.03)

    # ---- étage 3 : le long fût effilé ----
    sC = lambda y: 0.052-0.02*((y-P2)/(P3-P2))
    yC0 = P2+BAND+0.035
    ysC = [yC0+(P3-yC0)*i/6 for i in range(7)]
    stage(ysC, sC, 0.024)
    platform(P3, W(P3)+0.03, over=0.03, band=0.09)

    # ---- sommet ----
    yT0 = P3+0.09+0.035
    sD = lambda y: 0.04-0.012*((y-yT0)/0.42)
    ysD = [yT0+0.42*i/3 for i in range(4)]
    stage(ysD, sD, 0.02)
    yL = ysD[-1]
    m.box(-0.07, 0.07, yL, yL+0.07, -0.07, 0.07, GO)
    # lanterne : petit toit en pyramide + mât
    top = (0, yL+0.17, 0)
    ring = [(-0.07, yL+0.07, -0.07), (0.07, yL+0.07, -0.07), (0.07, yL+0.07, 0.07), (-0.07, yL+0.07, 0.07)]
    for i in range(4):
        m.poly([ring[i], ring[(i+1) % 4], top], GO, (0, yL+0.05, 0))
    m.beam((0, yL+0.17, 0), (0, 5.0, 0), 0.028, IR, w1=0.010)
    return m
