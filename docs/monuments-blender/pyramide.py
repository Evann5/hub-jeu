"""Mexico : pyramide à degrés, escalier central sur les quatre faces, temple au sommet."""
import math
from lib import Mesh, lerp
from lib_mexique_italie import *

PAL = {'s1': '#D8C092', 's2': '#A58C62', 'ledge': '#E4D4AE', 'step': '#E9DCB8', 'riser': '#8E7A58', 'rail': '#A7916B',
       'door': '#3A2C22', 'temple': '#DCCB9F', 'trim': '#C0A97C', 'comb': '#CBB78A', 'grass': '#7FA35A', 'grass2': '#6C9150',
       'bush': '#4E8A4A', 'bush2': '#3F773F', 'eye': '#C8452F', 'paving': '#D9CDAA'}
NT = 6
H0 = 0.76          # demi-côté de la première marche
TH = 0.19          # hauteur d'un étage
INS = 0.045        # fruit du talus
SET = 0.09        # retrait d'un étage à l'autre
Y0 = 0.04


def ringsq(h, y):
    return [(-h, y, -h), (h, y, -h), (h, y, h), (-h, y, h)]


def build():
    m = Mesh(PAL)
    # pelouse + dalle
    m.box(-0.89, 0.89, 0, Y0, -0.89, 0.89, 'grass', skip=('bot',))
    m.box(-0.83, 0.83, Y0, Y0+0.006, -0.83, 0.83, 'paving', skip=('bot',))
    # étages
    for t in range(NT):
        h = H0-SET*t
        ya = Y0+TH*t
        yb = ya+TH
        col = 's1' if t % 2 == 0 else 's2'
        m.band(ringsq(h, ya), ringsq(h-INS, yb), col, (0, (ya+yb)/2, 0))
        if t < NT-1:
            m.band(ringsq(h-INS, yb), ringsq(H0-SET*(t+1), yb), 'ledge', (0, yb-1, 0))
    ytop = Y0+TH*NT
    ht = H0-SET*(NT-1)-INS
    m.poly(ringsq(ht, ytop), 'ledge', (0, ytop-1, 0))
    # escaliers (quatre faces)
    NS = 4*NT
    ht_top = H0-SET*(NT-1)-INS
    SL = (H0+0.015-ht_top)/(ytop-Y0)
    slope_z = lambda y: H0+0.015-SL*(y-Y0)       # z du bord avant du degré à la hauteur y
    for k in range(4):
        a = k*math.pi/2
        nrm = (math.sin(a), math.cos(a)); u = (math.cos(a), -math.sin(a))
        F = Fr((0, 0), u, nrm)
        P = F.P
        hw = 0.15
        for j in range(NS):
            ya = Y0+(ytop-Y0)*j/NS
            yb = Y0+(ytop-Y0)*(j+1)/NS
            za = slope_z(ya+ (yb-ya)*0.0)
            zb = za-SL*(yb-ya)
            # contremarche (sombre) puis marche (claire)
            m.poly([P(-hw, ya, za), P(hw, ya, za), P(hw, yb, za), P(-hw, yb, za)], 'riser', P(0, ya, za-3))
            m.poly([P(-hw, yb, za), P(hw, yb, za), P(hw, yb, zb), P(-hw, yb, zb)], 'step', P(0, yb-1, zb))
        # rampes
        for sg in ((-1, 1) if k == 0 else ()):
            sx = sg*0.185
            a0 = P(sx, Y0+0.045, slope_z(Y0)+0.02)
            b0 = P(sx, ytop+0.04, slope_z(ytop)-0.0)
            m.beam(a0, b0, 0.045, 'rail', caps=True)
            # tête de serpent au pied
            hx0, hx1 = sx-0.04, sx+0.04
            obox(m, F, hx0, hx1, Y0, Y0+0.09, H0+0.0, H0+0.12, 'rail', top='ledge')
            deco_rect(m, F, sx-0.028, sx-0.008, Y0+0.045, Y0+0.07, H0+0.122, 'eye')
            deco_rect(m, F, sx+0.008, sx+0.028, Y0+0.045, Y0+0.07, H0+0.122, 'eye')
    # temple
    th = 0.30
    ht2 = 0.19
    obox(m, ID, -ht2, ht2, ytop, ytop+th, -ht2, ht2, 'temple', top='temple')
    for k in range(4):
        a = k*math.pi/2
        nrm = (math.sin(a), math.cos(a)); u = (math.cos(a), -math.sin(a))
        F = Fr((0, 0), u, nrm)
        deco_rect(m, F, -0.06, 0.06, ytop, ytop+0.17, ht2+0.003, 'door')
        deco_rect(m, F, -0.085, 0.085, ytop+0.17, ytop+0.2, ht2+0.003, 'trim')
        deco_rect(m, F, -ht2, ht2, ytop+0.23, ytop+0.25, ht2+0.003, 'trim')
    obox(m, ID, -0.23, 0.23, ytop+th, ytop+th+0.04, -0.23, 0.23, 'trim', top='ledge')
    obox(m, ID, -0.12, 0.12, ytop+th+0.04, ytop+th+0.13, -0.05, 0.05, 'comb', top='trim')
    # buissons aux angles
    for sx in (-1, 1):
        for sz in (-1, 1):
            blob(m, sx*0.82, Y0+0.05, sz*0.82, 0.09, 0.07, 0.09, 'bush', 0, lambda pts: 'bush2' if pts[0][1] < Y0+0.05 else 'bush')
    return m
