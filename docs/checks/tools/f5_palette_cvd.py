"""F5 checker: own Machado 2009 (severity 1.0, linear RGB) + own CIEDE2000 (Sharma 2005) for the
hero identity palettes. Parses src/lib/viz/common/palettes.ts as text (no builder code executed)."""
import itertools, math, re, sys

src = open('src/lib/viz/common/palettes.ts').read()
MACHADO = {
    'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}
def s2l(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def l2s(c):
    c = min(1, max(0, c))
    return 255 * (12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055)
def hexrgb(h):
    h = h.lstrip('#'); return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
def sim(rgb, m):
    lin = [s2l(v) for v in rgb]
    out = [sum(m[r][k] * lin[k] for k in range(3)) for r in range(3)]
    return [l2s(v) for v in out]
def lab(rgb):
    r, g, b = [s2l(v) for v in rgb]
    X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
    Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
    Z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b
    Xn, Yn, Zn = 0.95047, 1.0, 1.08883
    f = lambda t: t ** (1 / 3) if t > (6 / 29) ** 3 else t / (3 * (6 / 29) ** 2) + 4 / 29
    fx, fy, fz = f(X / Xn), f(Y / Yn), f(Z / Zn)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)
def de2000(l1, l2):
    L1, a1, b1 = l1; L2, a2, b2 = l2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if C1p else 0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if C2p else 0
    dL = L2 - L1; dC = C2p - C1p
    if C1p * C2p == 0: dh = 0
    else:
        dh = h2p - h1p
        if dh > 180: dh -= 360
        elif dh < -180: dh += 360
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lb = (L1 + L2) / 2; Cbp = (C1p + C2p) / 2
    if C1p * C2p == 0: hb = h1p + h2p
    elif abs(h1p - h2p) <= 180: hb = (h1p + h2p) / 2
    elif h1p + h2p < 360: hb = (h1p + h2p + 360) / 2
    else: hb = (h1p + h2p - 360) / 2
    T = 1 - 0.17 * math.cos(math.radians(hb - 30)) + 0.24 * math.cos(math.radians(2 * hb)) + 0.32 * math.cos(math.radians(3 * hb + 6)) - 0.20 * math.cos(math.radians(4 * hb - 63))
    dth = 30 * math.exp(-(((hb - 275) / 25) ** 2))
    RC = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    SL = 1 + 0.015 * (Lb - 50) ** 2 / math.sqrt(20 + (Lb - 50) ** 2)
    SC = 1 + 0.045 * Cbp; SH = 1 + 0.015 * Cbp * T
    RT = -math.sin(math.radians(2 * dth)) * RC
    return math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))
# Sharma, Wu & Dalal (2005) Table 1 pairs 1, 7, 17, 25, 34
for p, q, e in [((50, 2.6772, -79.7751), (50, 0, -82.7485), 2.0425), ((50, 0, 0), (50, -1, 2), 2.3669),
                ((50, 2.5, 0), (73, 25, -18), 27.1492), ((60.2574, -34.0099, 36.2677), (60.4626, -34.1751, 39.4387), 1.2644),
                ((2.0776, 0.0795, -1.135), (0.9033, -0.0636, -0.5514), 0.9082)]:
    assert abs(de2000(p, q) - e) < 1e-4, (p, q, de2000(p, q), e)
def lum(rgb):
    r, g, b = [s2l(v) for v in rgb]; return 0.2126 * r + 0.7152 * g + 0.0722 * b
def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)
surface = dict(re.findall(r"(light|dark): '(#[0-9a-f]{6})'", re.search(r"SURFACE[^}]*}", src).group(0)))
names = re.findall(r"name: '(\w+)'", src)
blocks = re.split(r"name: '\w+'", src)[1:]
worst = 99
print(f"{'palette':8} {'theme':5} {'n':>2} {'normal':>7} {'protan':>7} {'deutan':>7} {'tritan':>7} {'minCR':>6}")
for name, blk in zip(names, blocks):
    for theme in ('light', 'dark'):
        ident = re.findall(r"'(#[0-9a-f]{6})'", re.search(theme + r": \{[^}]*?identity: \[([^\]]*)\]", blk, re.S).group(1))
        cols = [hexrgb(h) for h in ident]
        row = []
        for mode in ('normal', 'protan', 'deutan', 'tritan'):
            cs = cols if mode == 'normal' else [sim(c, MACHADO[mode]) for c in cols]
            labs = [lab(c) for c in cs]
            m = min(de2000(a, b) for a, b in itertools.combinations(labs, 2))
            row.append(m); worst = min(worst, m)
        cr = min(contrast(c, hexrgb(surface[theme])) for c in cols)
        print(f"{name:8} {theme:5} {len(cols):>2} " + ' '.join(f"{v:7.1f}" for v in row) + f" {cr:6.2f}")
print('worst min ΔE00 overall:', round(worst, 2))
