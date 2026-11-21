"""Извлекает объекты из PDF-экспортов Figma (через pdftocairo -svg) в отдельные SVG-фрагменты."""
import json, sys, math
from svgelements import SVG, Shape, Path, Color, Matrix

def load(src):
    svg = SVG.parse(src)
    out = []
    for e in svg.elements():
        if not isinstance(e, Shape) or e.fill is None or e.fill.value is None:
            continue
        bb = e.bbox()
        if not bb:
            continue
        if (bb[2] - bb[0]) > svg.width * 0.8 or (bb[3] - bb[1]) > svg.height * 0.5:
            continue  # фон страницы Figma
        p = Path(e)
        p.reify()
        d = p.d()
        if not d:
            continue
        op = e.fill.opacity
        out.append({"bb": bb, "d": d, "fill": Color(e.fill).hex[:7], "op": op,
                    "rule": e.values.get("fill-rule", "nonzero")})
    return out

def cluster(items, m=8):
    n = len(items); par = list(range(n))
    def f(a):
        while par[a] != a:
            par[a] = par[par[a]]; a = par[a]
        return a
    order = sorted(range(n), key=lambda i: items[i]["bb"][0])
    for ii, i in enumerate(order):
        a = items[i]["bb"]
        for j in order[ii + 1:]:
            b = items[j]["bb"]
            if b[0] > a[2] + m: break
            if b[1] <= a[3] + m and a[1] <= b[3] + m:
                par[f(i)] = f(j)
    groups = {}
    for i in range(n):
        groups.setdefault(f(i), []).append(items[i])
    return list(groups.values())

def bbox(g):
    return (min(i["bb"][0] for i in g), min(i["bb"][1] for i in g),
            max(i["bb"][2] for i in g), max(i["bb"][3] for i in g))

def to_svg(g):
    x0, y0, x1, y1 = bbox(g)
    pad = 1
    w, h = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    m = Matrix(f"translate({-x0 + pad},{-y0 + pad})")
    parts = []
    for i in g:
        p = Path(i["d"]) * m
        p.reify()
        attrs = f'fill="{i["fill"]}"'
        if i["op"] is not None and i["op"] < 0.999:
            attrs += f' fill-opacity="{i["op"]:.3f}"'
        if i["rule"] == "evenodd":
            attrs += ' fill-rule="evenodd"'
        parts.append(f'<path {attrs} d="{p.d()}"/>')
    return round(w, 2), round(h, 2), "".join(parts)

import re
def rnd(d):
    return re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group()):.2f}".rstrip("0").rstrip("."), d)

REFS = {
    "L": {"main": (3400, 7000), "bg": (7400, 11000), "off": 4024, "split_book_lamp": 4380,
          "pos": {"book": (392, 3467), "phone": (2039, 3719), "puzzle": (3100, 3828), "coin": (4005, 3946),
                  "headphones": (470, 4803), "lamp": (1800, 4440), "flowers": (3036, 4713), "wallet": (3868, 5095),
                  "folder": (365, 5920), "pen": (1796, 6128)}},
    "S": {"main": (2000, 4600), "bg": (5100, 7400), "off": 3102, "split_book_lamp": None,
          "pos": {"book": (268, 2060), "phone": (1294, 2253), "puzzle": (1925, 2284), "coin": (2498, 2340),
                  "lamp": (1192, 2818), "headphones": (375, 2936), "flowers": (1919, 2949), "wallet": (2400, 3188),
                  "folder": (261, 3741), "pen": (1298, 3858)}},
}

def extract(size, src, outdir):
    cfg = REFS[size]
    items = load(src)
    res = {}
    for variant in ("main", "bg"):
        lo, hi = cfg[variant]
        off = 0 if variant == "main" else cfg["off"]
        sec = [i for i in items if lo <= (i["bb"][1] + i["bb"][3]) / 2 <= hi]
        groups = [g for g in cluster(sec) if (bbox(g)[2] - bbox(g)[0]) > 5 and (bbox(g)[3] - bbox(g)[1]) > 5]
        # книга и лампа в L пересекаются по габаритам — делим по горизонтали
        if cfg["split_book_lamp"]:
            thr = cfg["split_book_lamp"] + off
            new = []
            for g in groups:
                x0, y0, x1, y1 = bbox(g)
                if y0 < thr < y1 and (x1 - x0) > 1500:
                    new.append([i for i in g if (i["bb"][1] + i["bb"][3]) / 2 < thr])
                    new.append([i for i in g if (i["bb"][1] + i["bb"][3]) / 2 >= thr])
                else:
                    new.append(g)
            groups = new
        used = set()
        for g in groups:
            x0, y0, _, _ = bbox(g)
            name = min(cfg["pos"], key=lambda k: (cfg["pos"][k][0] - x0) ** 2 + (cfg["pos"][k][1] + off - y0) ** 2)
            assert name not in used, (size, variant, name)
            used.add(name)
            w, h, body = to_svg(g)
            res[f"{name}-{variant}-{size}"] = {"w": w, "h": h, "paths": len(g),
                                              "colors": sorted({i['fill'] for i in g})}
            with open(f"{outdir}/{name}-{variant}-{size}.svg", "w") as fh:
                fh.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{rnd(body)}</svg>')
        assert len(used) == 10, (size, variant, used)
    return res

if __name__ == "__main__":
    import os
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    allres = {}
    for size, src in (("L", sys.argv[2]), ("S", sys.argv[3])):
        allres.update(extract(size, src, outdir))
    for k, v in sorted(allres.items()):
        print(k, v["w"], v["h"], v["paths"], v["colors"])
