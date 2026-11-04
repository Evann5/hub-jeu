"""Chicago : la Willis Tower (neuf tubes décalés, deux antennes) et deux voisines plus basses. Hauteur 4,2."""
from lib_france_usa import *

PAL = {'glass': '#323640', 'rib': '#5A6170', 'belt': '#1A1B21', 'top': '#444855', 'ant': '#F1F0EC', 'plaza': '#8F8E90',
       'ltone': '#DCD1B6', 'ldark': '#8E846F', 'lroof': '#7C8B7A', 'gold': '#D8B24A',
       'bglass': '#5F86A0', 'brib': '#E3E8EC', 'bcap': '#9EA9B1', 'bdark': '#3E5667'}

FL = 0.0326          # unité par étage
Y0 = 0.04
S = 0.19             # côté d'un tube
# grille (x, z) -> étages : nord (arrière) = -z ; vue de face depuis le sud
GRID = {(-1, -1): 50, (0, -1): 90, (1, -1): 66,
        (-1, 0): 108, (0, 0): 108, (1, 0): 90,
        (-1, 1): 66, (0, 1): 90, (1, 1): 50}
BELTS = [(28.5, 31.0), (63.5, 66.0), (87.5, 90.0)]    # étages techniques (en étages)

def yb(fl): return Y0+fl*FL

def segs(ya, yb_):
    """Découpe [ya, yb_] selon les ceintures : liste (y0, y1, ceinture?)."""
    cuts = []
    for (a, b) in BELTS:
        a, b = yb(a), yb(b)
        if b > ya and a < yb_:
            cuts.append((max(a, ya), min(b, yb_)))
    out, cur = [], ya
    for a, b in cuts:
        if a > cur: out.append((cur, a, False))
        out.append((a, b, True)); cur = b
    if cur < yb_: out.append((cur, yb_, False))
    return out

def build():
    m = XM(PAL)
    m.box(-0.89, 0.89, 0.0, Y0, -0.62, 0.62, 'plaza', skip=('bot',))
    fcs = pattern(2, 0.30, 'rib', 'glass')
    with m.frame(0, 0, 0, -0.05):
        for (i, j), fl in GRID.items():
            h = yb(fl)
            cx, cz = i*S, j*S
            x0, x1, z0, z1 = cx-S/2, cx+S/2, cz-S/2, cz+S/2
            ref = (cx, h/2, cz)
            # (A, B, voisin, face avant ?)
            sides = [((x0, z1), (x1, z1), (i, j+1), True), ((x1, z1), (x1, z0), (i+1, j), True),
                     ((x1, z0), (x0, z0), (i, j-1), False), ((x0, z0), (x0, z1), (i-1, j), True)]
            for A, B, nb, fancy in sides:
                hn = yb(GRID[nb]) if nb in GRID else Y0
                if hn >= h-1e-6:
                    continue
                for (a, b, belt) in segs(hn, h):
                    if belt:
                        hbands(m, A, B, a, b, ['belt'], ref)
                    elif fancy:
                        strips(m, A, B, a, b, fcs, ref)
                    else:
                        hbands(m, A, B, a, b, ['glass'], ref)
            m.poly([(x0, h, z0), (x1, h, z0), (x1, h, z1), (x0, h, z1)], 'top', (cx, h-1, cz))
        # deux antennes sur les tubes de 108 étages
        for (i, j) in ((-1, 0), (0, 0)):
            h = yb(108)
            cx, cz = i*S, j*S
            m.box(cx-0.05, cx+0.05, h, h+0.045, cz-0.05, cz+0.05, 'top', skip=('bot',))
            lathe(m, cx, cz, [(0.034, h+0.045), (0.026, h+0.30, 'ant'), (0.026, h+0.30), (0.014, h+0.46, 'ant'), (0.008, 4.2-0.0)], 6, 'ant')
    # voisine de gauche : tour calcaire à pyramide (style Board of Trade)
    with m.frame(0, -0.68, 0, 0.18):
        tower(m, 0, 0, 0.36, 0.36, Y0, 1.15, pattern(4, 0.45, 'ltone', 'ldark'), pattern(4, 0.45, 'ltone', 'ldark'), top_col='ltone')
        tower(m, 0, 0, 0.26, 0.26, 1.15, 1.55, pattern(3, 0.45, 'ltone', 'ldark'), pattern(3, 0.45, 'ltone', 'ldark'), top_col='ltone')
        frustum(m, (-0.14, 0.14, -0.14, 0.14), (-0.03, 0.03, -0.03, 0.03), 1.55, 1.93, 'lroof', top=False)
        m.box(-0.012, 0.012, 1.93, 2.02, -0.012, 0.012, 'gold', skip=('bot',))
    # voisine de droite : tour de verre claire à retraits
    with m.frame(0, 0.68, 0, 0.18):
        tower(m, 0, 0, 0.34, 0.34, Y0, 2.0, pattern(5, 0.22, 'brib', 'bglass'), pattern(5, 0.22, 'brib', 'bglass'), top_col='bcap')
        tower(m, 0, 0, 0.26, 0.26, 2.0, 2.45, pattern(4, 0.22, 'brib', 'bglass'), pattern(4, 0.22, 'brib', 'bglass'), top_col='bcap')
        m.box(-0.07, 0.07, 2.45, 2.55, -0.07, 0.07, 'bdark', skip=('bot',))
    return m
