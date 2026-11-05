"""Aides géométriques pour les monuments de Chine, d'Inde, de Thaïlande et de Turquie d'Escales.
S'appuie uniquement sur lib.py (non modifié). Même repère : Y vers le haut, avant = +Z, empreinte dans [-0.88, 0.88], base à y = 0.
Les fonctions reçoivent le maillage `m` et ajoutent des faces ; l'orientation est donnée par un point de référence (voir Mesh.poly)."""
import math
from lib import Mesh, add, sub, mul, cross, norm, lerp, centroid, length, dot

# ---------- transformations ----------
def xform(m, fn, start=0):
    m.faces[start:] = [([fn(p) for p in pts], col) for pts, col in m.faces[start:]]

def rot_y(deg, cx=0.0, cz=0.0):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    def f(p):
        x, z = p[0]-cx, p[2]-cz
        return (cx + x*c + z*s, p[1], cz - x*s + z*c)
    return f

def move(dx=0.0, dy=0.0, dz=0.0):
    return lambda p: (p[0]+dx, p[1]+dy, p[2]+dz)

def copy_rot(m, start, degs, cx=0.0, cz=0.0):
    """Recopie les faces ajoutées depuis `start`, tournées autour de l'axe vertical (cx, cz) : une face construite devant sert sur les 4 côtés."""
    src = m.faces[start:]
    for d in degs:
        f = rot_y(d, cx, cz)
        m.faces += [([f(p) for p in pts], col) for pts, col in src]

def sides4(m, start, cx=0.0, cz=0.0):
    copy_rot(m, start, (90, 180, 270), cx, cz)

def recenter(m):
    pts = [p for f, _ in m.faces for p in f]
    mnx = min(p[0] for p in pts); mxx = max(p[0] for p in pts)
    mnz = min(p[2] for p in pts); mxz = max(p[2] for p in pts)
    mny = min(p[1] for p in pts)
    xform(m, move(-(mnx+mxx)/2, -mny, -(mnz+mxz)/2))

# ---------- révolution ----------
def ring(cx, cz, y, r, n, rot=0.0, rz=None):
    rz = r if rz is None else rz
    return [(cx + r*math.sin(rot+2*math.pi*i/n), y, cz + rz*math.cos(rot+2*math.pi*i/n)) for i in range(n)]

def lathe(m, profile, n, cols, cx=0.0, cz=0.0, rot=0.0, cap_top=False, cap_bot=False, rz_k=1.0):
    """profile : [(r, y), ...] de bas en haut. cols : une couleur ou une liste (une par segment)."""
    if isinstance(cols, str):
        cols = [cols]*(len(profile)-1)
    rings = [ring(cx, cz, y, r, n, rot, r*rz_k) for r, y in profile]
    for k in range(len(rings)-1):
        ym = (profile[k][1]+profile[k+1][1])/2
        dr = profile[k+1][0]-profile[k][0]
        dy = profile[k+1][1]-profile[k][1]
        if abs(dr) > abs(dy):
            ref = (cx, ym+1, cz) if dr > 0 else (cx, ym-1, cz)
        else:
            ref = (cx, ym, cz)
        m.band(rings[k], rings[k+1], cols[k], ref)
    if cap_top and profile[-1][0] > 1e-6:
        m.poly(rings[-1], cols[-1], (cx, profile[-1][1]-1, cz))
    if cap_bot and profile[0][0] > 1e-6:
        m.poly(rings[0], cols[0], (cx, profile[0][1]+1, cz))

def cyl(m, cx, cz, y0, y1, r0, col, r1=None, n=8, caps=(True, True), rot=0.0):
    r1 = r0 if r1 is None else r1
    lathe(m, [(r0, y0), (r1, y1)], n, col, cx, cz, rot, cap_top=caps[1], cap_bot=caps[0])

def sphere(m, cx, cy, cz, r, col, n=10, rows=5, ry=None):
    ry = r if ry is None else ry
    prof = []
    for k in range(rows+1):
        a = math.radians(-90+180*k/rows)
        prof.append((r*math.cos(a), cy+ry*math.sin(a)))
    prof[0] = (0, prof[0][1]); prof[-1] = (0, prof[-1][1])
    lathe(m, prof, n, col, cx, cz)

def onion(m, cx, cz, y0, r, h, n, col, tip=0.0):
    """Dôme à bulbe (Taj Mahal) : renflé, puis effilé en pointe."""
    prof = [(r*0.78, y0), (r*1.0, y0+h*0.18), (r*0.98, y0+h*0.38), (r*0.7, y0+h*0.62), (r*0.36, y0+h*0.82), (r*0.1, y0+h*0.94), (0, y0+h)]
    lathe(m, prof, n, col, cx, cz)

def dome(m, cx, cz, y0, r, h, n, col, rows=3):
    prof = []
    for k in range(rows+1):
        a = math.radians(90*k/rows)
        prof.append((r*math.cos(a), y0+h*math.sin(a)))
    prof[-1] = (0, prof[-1][1])
    lathe(m, prof, n, col, cx, cz)

def cone(m, cx, cz, y0, y1, r, col, n=8, rot=0.0, cap_bot=True):
    lathe(m, [(r, y0), (0, y1)], n, col, cx, cz, rot, cap_bot=cap_bot)

def fluted(m, cx, cz, y0, y1, r0, r1, teeth, col1, col2, depth=0.14):
    """Fût cannelé : section en étoile (rayons alternés), deux couleurs en alternance."""
    def rg(y, r):
        pts = []
        for i in range(2*teeth):
            rr = r if i % 2 == 0 else r*(1-depth)
            a = 2*math.pi*i/(2*teeth)
            pts.append((cx+rr*math.sin(a), y, cz+rr*math.cos(a)))
        return pts
    a, b = rg(y0, r0), rg(y1, r1)
    ref = (cx, (y0+y1)/2, cz)
    n = len(a)
    for i in range(n):
        j = (i+1) % n
        m.poly([a[i], a[j], b[j], b[i]], col1 if i % 2 == 0 else col2, ref)
    m.poly(b, col1, (cx, y0, cz))

# ---------- prismes, pyramides, toits ----------
def prism(m, poly_xz, y0, y1, col_side, col_top=None, bottom=False):
    n = len(poly_xz)
    cx = sum(p[0] for p in poly_xz)/n; cz = sum(p[1] for p in poly_xz)/n
    ref = (cx, (y0+y1)/2, cz)
    for i in range(n):
        j = (i+1) % n
        a, b = poly_xz[i], poly_xz[j]
        m.poly([(a[0], y0, a[1]), (b[0], y0, b[1]), (b[0], y1, b[1]), (a[0], y1, a[1])], col_side, ref)
    if col_top:
        m.poly([(p[0], y1, p[1]) for p in poly_xz], col_top, ref)
    if bottom:
        m.poly([(p[0], y0, p[1]) for p in poly_xz], col_side, ref)

def octagon(cx, cz, r, cut=0.4):
    """Carré de demi-côté r aux angles coupés (cut = part du côté coupée à chaque angle)."""
    c = r*cut*2
    pts = [(-r+c, -r), (r-c, -r), (r, -r+c), (r, r-c), (r-c, r), (-r+c, r), (-r, r-c), (-r, -r+c)]
    return [(cx+x, cz+z) for x, z in pts]

def tbox(m, cx, cz, y0, y1, hw0, hd0, hw1, hd1, col, bottom=False, top=True):
    """Bloc à murs inclinés (tronc de pyramide à base rectangulaire)."""
    a = [(cx-hw0, y0, cz-hd0), (cx+hw0, y0, cz-hd0), (cx+hw0, y0, cz+hd0), (cx-hw0, y0, cz+hd0)]
    b = [(cx-hw1, y1, cz-hd1), (cx+hw1, y1, cz-hd1), (cx+hw1, y1, cz+hd1), (cx-hw1, y1, cz+hd1)]
    ref = (cx, (y0+y1)/2, cz)
    m.band(a, b, col, ref)
    if bottom:
        m.poly(a, col, ref)
    if top and hw1 > 1e-6:
        m.poly(b, col, ref)

def eave_ring(cx, cz, y, hw, hd, lift=0.0, flare=0.0):
    pts = []
    for (sx, sz) in [(-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0)]:
        if sx and sz:
            pts.append((cx+sx*(hw+flare), y+lift, cz+sz*(hd+flare)))
        else:
            pts.append((cx+sx*hw, y, cz+sz*hd))
    return pts

def roof(m, cx, cz, y, hw, hd, h, col, top=(0.0, 0.0), lift=0.0, flare=0.0, cap=False, col_top=None):
    """Toit en croupe à quatre coins relevés (style chinois ou thaï)."""
    lo = eave_ring(cx, cz, y, hw, hd, lift, flare)
    hi = eave_ring(cx, cz, y+h, top[0], top[1])
    m.band(lo, hi, col, (cx, y-0.02, cz))
    if cap and top[0] > 1e-6 and top[1] > 1e-6:
        m.poly(hi, col_top or col, (cx, y, cz))
    return hi

def gable(m, x0, x1, z0, z1, y0, h, col, end_col=None, ridge='x', over=0.0):
    """Toit à deux pans. ridge='x' : faîtage le long de x."""
    end_col = end_col or col
    if ridge == 'x':
        P = lambda u, y, v: (u, y, v)
        u0, u1, v0, v1 = x0, x1, z0, z1
    else:
        P = lambda u, y, v: (v, y, u)
        u0, u1, v0, v1 = z0, z1, x0, x1
    vc = (v0+v1)/2; uc = (u0+u1)/2
    ref = P(uc, y0, vc)
    m.poly([P(u0-over, y0, v1), P(u1+over, y0, v1), P(u1+over, y0+h, vc), P(u0-over, y0+h, vc)], col, ref)
    m.poly([P(u0-over, y0, v0), P(u1+over, y0, v0), P(u1+over, y0+h, vc), P(u0-over, y0+h, vc)], col, ref)
    m.poly([P(u0, y0, v0), P(u0, y0, v1), P(u0, y0+h, vc)], end_col, P(uc, y0+h*0.3, vc))
    m.poly([P(u1, y0, v0), P(u1, y0, v1), P(u1, y0+h, vc)], end_col, P(uc, y0+h*0.3, vc))

def hip(m, x0, x1, z0, z1, y0, h, col, top=(0.0, 0.0)):
    """Toit à quatre pans, faîte réduit à une arête ou une pointe."""
    cx, cz = (x0+x1)/2, (z0+z1)/2
    tx, tz = top
    a = [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)]
    b = [(cx-tx, y0+h, cz-tz), (cx+tx, y0+h, cz-tz), (cx+tx, y0+h, cz+tz), (cx-tx, y0+h, cz+tz)]
    m.band(a, b, col, (cx, y0-0.05, cz))
    if tx > 1e-6 and tz > 1e-6:
        m.poly(b, col, (cx, y0, cz))

def sphere_cols(m, cx, cy, cz, r, cols, n=12, rows=6, ry=None, y_stretch=None):
    """Sphère dont les fuseaux (méridiens) alternent les couleurs : ballon."""
    ry = r if ry is None else ry
    rings = []
    for k in range(rows+1):
        a = math.radians(-90+180*k/rows)
        rr = r*math.cos(a) if 0 < k < rows else 0.0
        rings.append([(cx+rr*math.sin(2*math.pi*i/n), cy+ry*math.sin(a), cz+rr*math.cos(2*math.pi*i/n)) for i in range(n)])
    for k in range(rows):
        for i in range(n):
            j = (i+1) % n
            m.poly([rings[k][i], rings[k][j], rings[k+1][j], rings[k+1][i]], cols[i % len(cols)], (cx, cy, cz))

def blob(m, cx, cy, cz, rx, ry, rz, col, n=7, lats=(-70, -30, 30, 70), rot=0.0, caps=True):
    rings = []
    for la in lats:
        a = math.radians(la); r = math.cos(a)
        rings.append([(cx+rx*r*math.cos(rot+2*math.pi*i/n), cy+ry*math.sin(a), cz+rz*r*math.sin(rot+2*math.pi*i/n)) for i in range(n)])
    ref = (cx, cy, cz)
    for k in range(len(rings)-1):
        m.band(rings[k], rings[k+1], col, ref)
    if caps:
        m.poly(rings[0], col, ref); m.poly(rings[-1], col, ref)

def sag(a, b, drop, n):
    pts = []
    for i in range(n+1):
        t = i/n
        p = lerp(a, b, t)
        pts.append((p[0], p[1]-drop*4*t*(1-t), p[2]))
    return pts

def tube(m, pts, w, col, sides=3):
    for i in range(len(pts)-1):
        m.beam(pts[i], pts[i+1], w, col, sides=sides, caps=True)

# ---------- plaquettes collées sur une façade (face avant = +Z) ----------
def front(m, z, pts_xy, col, d=1):
    """Polygone plat à la profondeur z, normale vers +Z (d=1) ou -Z (d=-1)."""
    cx = sum(p[0] for p in pts_xy)/len(pts_xy); cy = sum(p[1] for p in pts_xy)/len(pts_xy)
    m.poly([(x, y, z) for x, y in pts_xy], col, (cx, cy, z-d))

def rect(x0, x1, y0, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

def arch2d(cx, y0, spring, apex, hw, k=4, pointed=False):
    """Contour d'une baie à arc : [(x, y), ...] de la base gauche à la base droite."""
    pts = [(cx-hw, y0)]
    for i in range(k+1):
        t = -1+2*i/k
        if pointed:
            y = spring+(apex-spring)*(1-abs(t)**1.6)
        else:
            y = spring+(apex-spring)*math.sqrt(max(0.0, 1-t*t))
        pts.append((cx+hw*t, y))
    pts.append((cx+hw, y0))
    return pts

def window(m, z, cx, y0, y1, hw, col_recess, col_frame=None, arched=True, d=1, pointed=False):
    """Fenêtre : cadre clair (facultatif) puis fond sombre, collés devant la façade en z."""
    if col_frame:
        f = hw+0.012
        front(m, z+0.003*d, arch2d(cx, y0-0.01, y1-hw-0.01, y1+0.012, f, 3, pointed) if arched else rect(cx-f, cx+f, y0-0.012, y1+0.012), col_frame, d)
    front(m, z+0.006*d, arch2d(cx, y0, y1-hw, y1, hw, 3, pointed) if arched else rect(cx-hw, cx+hw, y0, y1), col_recess, d)

# ---------- mur percé d'une grande arche (porte, iwan) ----------
def arch_block(m, x0, x1, y0, y1, z0, z1, hw, spring, apex, col, col_in, k=6, pointed=False, skip=('bot',)):
    """Bloc traversé par une arche selon z : faces avant et arrière percées, intérieur du tunnel, côtés, dessus."""
    cx, cz = (x0+x1)/2, (z0+z1)/2
    ctr = (cx, (y0+y1)/2, cz)
    arch = arch2d(cx, y0, spring, apex, hw, k, pointed)[1:-1]   # points sur l'arc, du ressaut gauche au ressaut droit
    for z, d in ((z1, 1), (z0, -1)):
        m.poly([(x0, y0, z), (cx-hw, y0, z), (cx-hw, y1, z), (x0, y1, z)], col, ctr)
        m.poly([(cx+hw, y0, z), (x1, y0, z), (x1, y1, z), (cx+hw, y1, z)], col, ctr)
        for i in range(len(arch)-1):
            a, b = arch[i], arch[i+1]
            m.poly([(a[0], a[1], z), (b[0], b[1], z), (b[0], y1, z), (a[0], y1, z)], col, ctr)
    # dessous de l'arche (le tunnel) : vers l'axe du passage
    axis = (cx, spring, cz)
    for i in range(len(arch)-1):
        a, b = arch[i], arch[i+1]
        pts = [(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)]
        c = centroid(pts)
        m.poly(pts, col_in, sub(mul(c, 2), axis))
    # pieds droits du tunnel
    for sx in (-1, 1):
        x = cx+sx*hw
        pts = [(x, y0, z0), (x, y0, z1), (x, spring, z1), (x, spring, z0)]
        m.poly(pts, col_in, sub(mul(centroid(pts), 2), (cx, (y0+spring)/2, cz)))
    # côtés et dessus
    for k_, pts in {
        'nx': [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)],
        'px': [(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)],
        'top': [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)],
    }.items():
        m.poly(pts, col, ctr)

# ---------- sol ----------
def slab(m, col, y1=0.06, x=0.88, z=0.88, x0=None, z0=None):
    m.box(-x if x0 is None else x0, x, 0.0, y1, -z if z0 is None else z0, z, col, skip=('bot',))

# ---------- coque de bateau ----------
def hull(m, stations, col, col_deck, cx=0.0, cy=0.0, cz=0.0, rot=0.0, col_in=None):
    """Coque : stations = [(x, demi-largeur, y_fond, y_pont), ...] de l'arrière vers l'avant (x = axe du bateau). rot en degrés autour de la verticale."""
    start = len(m.faces)
    rings = []
    for (x, hw, yb, yt) in stations:
        ym = yb+(yt-yb)*0.55
        rings.append([(x, yt, -hw), (x, ym, -hw*0.98), (x, yb, -hw*0.45), (x, yb, hw*0.45), (x, ym, hw*0.98), (x, yt, hw)])
    for k in range(len(rings)-1):
        a, b = rings[k], rings[k+1]
        ref = centroid(a+b)
        for i in range(5):
            m.poly([a[i], a[i+1], b[i+1], b[i]], col, ref)
        m.poly([a[5], a[0], b[0], b[5]], col_deck, ref)
    m.poly(rings[0], col, centroid(rings[1]))
    m.poly(rings[-1], col, centroid(rings[-2]))
    f = rot_y(rot)
    g = move(cx, cy, cz)
    xform(m, lambda p: g(f(p)), start)

# ---------- tour à gradins (prang) ----------
def prang(m, cx, cz, y0, hw, H, n_t, cols, lip='grey', niche='niche', spike='white', gold='gold', build=None, rubble=None):
    """Tour à gradins (prang thaï) : étages droits de plus en plus étroits, lèvre saillante, petites pointes aux angles, niches sur chaque face.
    build = nombre d'étages construits (une ruine s'arrête avant le sommet) ; rubble = couleur des blocs éboulés posés sur le dernier étage."""
    n_b = n_t if build is None else build
    th = H*0.82/n_t
    y = y0
    for i in range(n_b):
        t = i/n_t
        w = hw*(1-t)**0.75+0.02
        h = th*(1.15-0.45*t)
        m.box(cx-w, cx+w, y, y+h, cz-w, cz+w, cols[i % len(cols)], skip=('bot',))
        m.box(cx-w-0.016, cx+w+0.016, y+h-0.018, y+h, cz-w-0.016, cz+w+0.016, lip, skip=('bot',))
        if i < n_t-1 and i % 2 == 0 and w > 0.07:
            s1 = len(m.faces)
            front(m, cz+w+0.003, arch2d(cx, y+h*0.12, y+h*0.5, y+h*0.78, w*0.34, 3), niche)
            sides4(m, s1, cx, cz)
        if i < n_t-2 and n_b == n_t:
            for sx in (-1, 1):
                for sz in (-1, 1):
                    cone(m, cx+sx*(w+0.004), cz+sz*(w+0.004), y+h, y+h+hw*0.3, hw*0.075, spike, n=4, rot=math.pi/4)
        y += h
    if n_b == n_t:
        top_w = hw*(1-(n_t-1)/n_t)**0.75+0.02
        cone(m, cx, cz, y, y+H*0.17, top_w*0.8, spike, n=4, rot=math.pi/4)
        cyl(m, cx, cz, y+H*0.17, y+H*0.3, 0.012, gold, n=4, caps=(False, True))
        cyl(m, cx, cz, y+H*0.22, y+H*0.235, 0.04, gold, n=6)
    elif rubble:
        w = hw*(1-(n_b-1)/n_t)**0.75+0.02
        for (dx, dz, k, hh) in ((-0.5, -0.4, 0.45, 0.11), (0.45, 0.3, 0.4, 0.07), (0.0, 0.5, 0.35, 0.15), (-0.3, 0.45, 0.3, 0.05)):
            m.box(cx+dx*w-w*k*0.5, cx+dx*w+w*k*0.5, y, y+hh, cz+dz*w-w*k*0.5, cz+dz*w+w*k*0.5, rubble, skip=('bot',))
