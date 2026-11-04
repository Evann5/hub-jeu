"""Lisbonne : le tram 28 jaune qui monte une rue en pente, façades pastel, azulejos et toits de tuiles."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'yellow': '#F2C230', 'yellow2': '#D9A81E', 'cream': '#F1E6C8', 'glass': '#3C4F66', 'black': '#2A2826', 'red': '#B53A2D',
    'street': '#8D8A84', 'street2': '#A9A59C', 'rail': '#4C4A46', 'kerb': '#CFC8B8',
    'f1': '#E3A98A', 'f2': '#EBD9A8', 'f3': '#8CB4A8', 'f4': '#D9887A', 'f5': '#F0E8D8', 'tile': '#2F5FA8', 'tile2': '#F4F1EA',
    'roof': '#B8472F', 'roof2': '#9F3A26', 'win': '#2F3A48', 'frame': '#F6F2E8', 'iron': '#2E2C2A', 'lamp': '#F2D26A',
}
Y0 = 0.05
RISE = 0.12
FW = 0.44          # largeur d'une façade
ANG = math.degrees(math.atan2(RISE, FW))

def build():
    m = Mesh(PAL)
    X0 = -0.88
    NF = 4
    ZB = -0.35       # pied des façades (côté rue)
    # ---------- rue en pente ----------
    ytop = lambda x: Y0+(x-X0)/FW*RISE
    # trottoir arrière et rue
    p = [(X0, Y0, ZB), (-X0, ytop(-X0), ZB), (-X0, ytop(-X0), 0.3), (X0, Y0, 0.3)]
    m.poly(p, 'street', (0, 0, 0))
    # bordure devant
    m.poly([(X0, Y0, 0.3), (-X0, ytop(-X0), 0.3), (-X0, ytop(-X0)-0.05, 0.3), (X0, Y0-0.05, 0.3)], 'kerb', (0, 0, -1))
    # trottoir avant (pavé clair)
    m.poly([(X0, Y0, 0.3), (-X0, ytop(-X0), 0.3), (-X0, ytop(-X0), 0.62), (X0, Y0, 0.62)], 'street2', (0, 0, 0))
    m.poly([(X0, Y0, 0.62), (-X0, ytop(-X0), 0.62), (-X0, 0.0, 0.62), (X0, 0.0, 0.62)], 'kerb', (0, 0, -1))
    m.poly([(X0, 0.0, 0.62), (-X0, 0.0, 0.62), (-X0, 0.0, ZB), (X0, 0.0, ZB)], 'street', (0, 5, 0))
    m.poly([(-X0, 0.0, ZB), (-X0, ytop(-X0), ZB), (-X0, ytop(-X0), 0.62), (-X0, 0.0, 0.62)], 'street', (0, 0, 0))
    m.poly([(X0, 0.0, ZB), (X0, Y0, ZB), (X0, Y0, 0.62), (X0, 0.0, 0.62)], 'street', (5, 0, 0))
    # ---------- façades ----------
    cols = ['f1', 'f2', 'tile2', 'f4']
    HT = [0.86, 1.02, 0.9, 1.0]
    roofc = ['roof', 'roof2', 'roof', 'roof2']
    for i in range(NF):
        x0 = X0+FW*i; x1 = x0+FW
        base = ytop(x0)
        top = base+HT[i]
        zf = ZB-0.5
        # mur : un prisme dont le pied suit la pente (plancher à y = base)
        b = B(x0, x1, 0.0, top, zf, ZB)
        box(m, b, cols[i])
        m.box(x0-0.012, x1+0.012, top, top+0.03, zf-0.012, ZB+0.03, 'frame', skip=('bot',))
        gable(m, x0-0.012, x1+0.012, zf-0.02, ZB+0.04, top+0.03, 0.12, roofc[i], 'x', cols[i])
        # fenêtres à balcon
        for r in range(3):
            v = base+0.08+r*0.28
            if v+0.2 > top-0.04:
                continue
            for uu in (-0.1, 0.1):
                if i == 2 and r == 0:
                    continue
                decal(m, b, 'pz', rect(uu-0.035, uu+0.035, v, v+0.16), 'frame', 0.003)
                decal(m, b, 'pz', rect(uu-0.026, uu+0.026, v+0.01, v+0.15), 'win', 0.006)
                decal(m, b, 'pz', rect(uu-0.045, uu+0.045, v-0.004, v+0.012), 'iron', 0.006)
        # porte
        decal(m, b, 'pz', round_arch(0.0, base, base+0.1, 0.045, 4), 'frame', 0.003)
        decal(m, b, 'pz', round_arch(0.0, base, base+0.1, 0.036, 4), 'iron', 0.006)
    # azulejos : la façade 3 est couverte de carreaux bleus sur blanc
    xa = X0+FW*2
    bb = ytop(xa)
    b2 = B(xa, xa+FW, 0.0, bb+HT[2], ZB-0.5, ZB)
    nxn, nyn = 6, 7
    cw, ch = (FW-0.02)/nxn, 0.1
    for r in range(nyn):
        for c in range(nxn):
            if (r+c) % 2 == 0:
                u0 = -FW/2+0.01+c*cw
                v0 = bb+0.02+r*ch
                decal(m, b2, 'pz', rect(u0, u0+cw, v0, v0+ch), 'tile', 0.002)
    # ---------- rails ----------
    for zr in (-0.04, 0.12):
        m.poly([(X0, Y0+0.002, zr), (-X0, ytop(-X0)+0.002, zr), (-X0, ytop(-X0)+0.002, zr+0.02), (X0, Y0+0.002, zr+0.02)], 'rail', (0, 0, 0))
    # ---------- tram ----------
    n0 = len(m.faces)
    L, Wd, Hb = 0.96, 0.3, 0.27
    cx, cz = 0.0, 0.04
    yb = 0.05          # les roues touchent le rail
    t = B(cx-L/2, cx+L/2, yb+0.035, yb+0.035+Hb, cz-Wd/2, cz+Wd/2)
    box(m, t, 'yellow', skip=('bot',))
    m.box(t.x0-0.005, t.x1+0.005, yb+0.035, yb+0.075, t.z0-0.005, t.z1+0.005, 'yellow2', skip=('bot',))   # jupe
    m.box(t.x0+0.02, t.x1-0.02, t.y1, t.y1+0.025, t.z0+0.02, t.z1-0.02, 'cream', skip=('bot',))            # toit
    for k in range(6):
        u = -0.38+k*0.152
        decal(m, t, 'pz', rect(u-0.054, u+0.054, yb+0.16, yb+0.28), 'glass', 0.003)
        decal(m, t, 'nz', rect(u-0.054, u+0.054, yb+0.16, yb+0.28), 'glass', 0.003)
    decal(m, t, 'pz', rect(-0.48, 0.48, yb+0.12, yb+0.135), 'cream', 0.003)
    decal(m, t, 'px', rect(-0.11, 0.11, yb+0.16, yb+0.28), 'glass', 0.003)
    decal(m, t, 'nx', rect(-0.11, 0.11, yb+0.16, yb+0.28), 'glass', 0.003)
    decal(m, t, 'px', rect(-0.1, 0.1, yb+0.075, yb+0.12), 'cream', 0.003)
    # phares et pare-chocs
    m.box(t.x1, t.x1+0.015, yb+0.045, yb+0.09, -0.1+cz, 0.1+cz, 'black', skip=('bot', 'nx'))
    # bogies
    for xx in (-0.32, 0.32):
        m.box(xx-0.08, xx+0.08, yb, yb+0.04, cz-0.1, cz+0.1, 'black', skip=('bot',))
    # perche du trolley
    m.beam((-0.15, t.y1+0.02, cz), (-0.38, t.y1+0.1, cz), 0.012, 'iron')
    xform(m, rot_z(ANG, X0, Y0), n0)
    return m
