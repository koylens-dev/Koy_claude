#!/usr/bin/env python3
"""Build a 10-slide Bible study Instagram carousel for a Design canvas.

Usage:
    python3 build_carousel.py content.json <canvas-folder>/project

Writes Main.dc.html, S02.dc.html ... S10.dc.html and canvas.json into the
output folder. See references/carousel.md for the content JSON schema.
"""
import html
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

W, H, PAD = 1080, 1350, 96
FONT_LINK = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
             'family=DM+Sans:wght@400;500;700&amp;family=DM+Serif+Display:ital@0;1&amp;display=swap">')
SERIF = "'DM Serif Display', Georgia, serif"
SANS = "'DM Sans', 'Helvetica Neue', sans-serif"
ARROW = ('<span style="display: flex; align-items: center; gap: 14px;">Swipe <svg width="44" height="24" '
         'viewBox="0 0 44 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
         'stroke-linejoin="round"><path d="M2 12h38M30 3l10 9-10 9"></path></svg></span>')
SAVE_SHARE = ('<span style="display: flex; align-items: center; gap: 20px;">'
              '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
              'stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"></path></svg>'
              '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
              'stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"></path></svg>'
              '</span>')
ACC = "{{accent}}"

# Abide brand colour combinations: main (bg) / secondary (fg, pattern) / accent.
COMBOS = {
    "vine":      {"bg": "#1B2A1F", "fg": "#EFEEE3", "muted": "#AEBBA9", "body": "#D3DCCF", "panel": "#243628", "accent": "#B7D68F", "pattern": "239,238,227"},
    "cream":     {"bg": "#EFEEE3", "fg": "#1B2A1F", "muted": "#505C4F", "body": "#33402F", "panel": "#E2E3D3", "accent": "#3F5F2A", "pattern": "27,42,31"},
    "leaf":      {"bg": "#3F5F2A", "fg": "#EFEEE3", "muted": "#C9D4C0", "body": "#E3E8DA", "panel": "#4A6B33", "accent": "#B7D68F", "pattern": "239,238,227"},
    "parchment": {"bg": "#DFE3D0", "fg": "#1B2A1F", "muted": "#4A5546", "body": "#2F3B2C", "panel": "#D2D7C0", "accent": "#5B3A6E", "pattern": "27,42,31"},
    "fruit":     {"bg": "#5B3A6E", "fg": "#EFEEE3", "muted": "#CDBFD6", "body": "#E4DCEA", "panel": "#66457A", "accent": "#B7D68F", "pattern": "239,238,227"},
    "growth":    {"bg": "#B7D68F", "fg": "#1B2A1F", "muted": "#3A4A32", "body": "#25331F", "panel": "#A9CB7E", "accent": "#5B3A6E", "pattern": "27,42,31"},
    "water":     {"bg": "#2F4B5E", "fg": "#EFEEE3", "muted": "#B9C7CF", "body": "#DCE4E7", "panel": "#385669", "accent": "#B7D68F", "pattern": "239,238,227"},
    "harvest":   {"bg": "#C8A15A", "fg": "#1B2A1F", "muted": "#3E3620", "body": "#2A2616", "panel": "#BD964F", "accent": "#5B3A6E", "pattern": "27,42,31"},
    "vine_gold": {"bg": "#1B2A1F", "fg": "#EFEEE3", "muted": "#AEBBA9", "body": "#D3DCCF", "panel": "#243628", "accent": "#C8A15A", "pattern": "239,238,227"},
    "water_gold":{"bg": "#2F4B5E", "fg": "#EFEEE3", "muted": "#B9C7CF", "body": "#DCE4E7", "panel": "#385669", "accent": "#C8A15A", "pattern": "239,238,227"},
}
# Abide brand mark: a vine stem with two leaves and a tendril (120x120 viewBox)
ABIDE_MARK = ('<path d="M60 108C60 86 60 64 60 36"></path>'
              '<path d="M60 70C42 68 30 54 32 36C50 36 62 50 60 70Z"></path>'
              '<path d="M60 52C76 50 88 38 88 22C72 22 60 34 60 52Z"></path>'
              '<path d="M60 90c14 0 22-8 20-18c-2-6-10-6-12 0" opacity="0.6"></path>')


def brand_mark(size=40, width=6):
    return (f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 120 120" fill="none" stroke="{ACC}" '
            f'stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round">{ABIDE_MARK}</svg>')


def esc(t):
    return html.escape(str(t), quote=False)


def cube_background(rgb, height=H):
    """Soft isometric cubes in a diagonal band, upper-left to lower-right."""
    s = 90.0
    w = s * math.sqrt(3)
    out = []
    stretch = height / H
    for j in range(-1, int(height / (1.5 * s)) + 2):
        cy = j * 1.5 * s
        for i in range(-1, 9):
            cx = i * w + (j % 2) * w / 2
            d = abs(0.9 * stretch * cx - cy + 380 * stretch) / math.hypot(0.9 * stretch, 1)
            fade = math.exp(-(d / 270) ** 2) * (0.55 + 0.45 * min(1, max(0, cx / W)))
            h = ((i * 73856093) ^ (j * 19349663)) & 0xFFFF
            if fade < 0.12 or h % 7 == 0:
                continue
            k = fade * (0.6 + 0.4 * ((h >> 3) % 100) / 100)
            T, UR, LR = (cx, cy - s), (cx + w / 2, cy - s / 2), (cx + w / 2, cy + s / 2)
            B, LL, UL, C = (cx, cy + s), (cx - w / 2, cy + s / 2), (cx - w / 2, cy - s / 2), (cx, cy)
            for poly, a in (((T, UR, C, UL), 0.075), ((UL, C, B, LL), 0.045), ((C, UR, LR, B), 0.018)):
                dd = "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in poly) + "Z"
                out.append(f'<path d="{dd}" fill="rgba({rgb},{a * k:.3f})"></path>')
    return (f'<svg aria-hidden="true" width="{W}" height="{height}" viewBox="0 0 {W} {height}" '
            f'style="position: absolute; left: 0; top: 0;">' + "".join(out) + "</svg>")


def page(title, n, t, series, ref, content, last=False, brand="Abide", handle=None):
    right = SAVE_SHARE if last else ARROW
    foot_left = f"{esc(ref)} · {esc(handle)}" if (last and handle) else esc(ref)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONT_LINK}
<style>body{{margin:0;background:{t['bg']}}}</style>
</helmet>
<div style="width: {W}px; height: {H}px; box-sizing: border-box; padding: {PAD}px; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; background: {t['bg']}; color: {t['fg']}; font-family: {SANS};">
{cube_background(t['pattern'])}
<div style="position: relative; display: flex; justify-content: space-between; align-items: center; font-size: 24px; letter-spacing: 0.18em; text-transform: uppercase; color: {t['muted']};"><span style="display: flex; align-items: center; gap: 14px;">{brand_mark()}<span>{esc(brand)}</span></span><span>{esc(series)} · {n:02d}/10</span></div>
{content}
<div style="position: relative; display: flex; justify-content: space-between; align-items: center; font-size: 26px; color: {t['muted']};"><span>{foot_left}</span>{right}</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"accent":{{"editor":"color","default":"{t['accent']}"}},"$preview":{{"width":{W},"height":{H}}}}}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{ accent: this.props.accent ?? '{t['accent']}' }};
  }}
}}
</script>
</body>
</html>
'''


def headline(tag, text, accent, size, lh=1.08):
    acc = f' <span style="font-style: italic; color: {ACC};">{esc(accent)}</span>' if accent else ""
    return (f'<{tag} style="margin: 0; font-family: {SERIF}; font-weight: 400; font-size: {size}px; '
            f'line-height: {lh};">{esc(text)}{acc}</{tag}>')


def rule():
    return f'<div style="width: 140px; height: 3px; background: {ACC};"></div>'


def col(gap, inner):
    return f'<div style="position: relative; display: flex; flex-direction: column; gap: {gap}px;">\n{inner}\n</div>'


def cover(sl, t, icon):
    parts = []
    if icon:
        paths = "".join(f'<path d="{p}"></path>' for p in icon)
        parts.append(f'<svg width="220" height="170" viewBox="0 0 220 170" fill="none" stroke="{ACC}" '
                     f'stroke-width="3" stroke-linecap="round" stroke-linejoin="round">{paths}</svg>')
    parts.append(headline("h1", sl["headline"], sl.get("accent"), sl.get("size", 120), 1.02))
    if sl.get("sub"):
        parts.append(f'<p style="margin: 0; font-size: 36px; line-height: 1.45; color: {t["body"]}; '
                     f'max-width: 820px;">{esc(sl["sub"])}</p>')
    return col(44, "\n".join(parts))


def passage(sl, t):
    text = sl["text"]
    size = sl.get("size") or (70 if len(text) <= 220 else 56 if len(text) <= 380 else 44)
    parts = []
    if len(text) <= 380:
        parts.append(f'<div style="font-family: {SERIF}; font-size: 200px; line-height: 0.6; color: {ACC};">“</div>')
    parts.append(f'<p style="margin: 0; font-family: {SERIF}; font-size: {size}px; line-height: 1.25;">{esc(text)}</p>')
    parts.append(f'<div style="font-size: 30px; font-weight: 700; letter-spacing: 0.08em; color: {ACC};">'
                 f'{esc(sl["ref"]).upper()}</div>')
    return col(36, "\n".join(parts))


def insight(sl, t):
    parts = [
        f'<div style="font-size: 28px; letter-spacing: 0.14em; text-transform: uppercase; color: {ACC};">{esc(sl["kicker"])}</div>',
        headline("h2", sl["headline"], sl.get("accent"), sl.get("size", 92)),
        f'<p style="margin: 0; font-size: 34px; line-height: 1.45; color: {t["body"]};">{esc(sl["reflection"])}</p>',
        (f'<div style="display: flex; flex-direction: column; gap: 14px; padding: 36px 40px; background: {t["panel"]}; border-radius: 20px;">'
         f'<div style="font-size: 22px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: {ACC};">Practise this</div>'
         f'<div style="font-size: 32px; line-height: 1.4;">{esc(sl["practice"])}</div></div>'),
    ]
    return col(44, "\n".join(parts))


def quote(sl, t):
    parts = [
        f'<div style="font-size: 28px; letter-spacing: 0.14em; text-transform: uppercase; color: {ACC};">{esc(sl.get("kicker", "In her words"))}</div>',
        f'<div style="font-family: {SERIF}; font-size: 200px; line-height: 0.6; color: {ACC};">“</div>',
        f'<p style="margin: 0; font-family: {SERIF}; font-size: {sl.get("size", 80)}px; line-height: 1.12;">{esc(sl["quote"])}</p>',
        (f'<div style="font-size: 30px; font-weight: 700; letter-spacing: 0.06em; color: {ACC};">'
         f'{esc(sl.get("author", "Ellen G. White")).upper()}, <span style="font-style: italic; font-weight: 500; letter-spacing: 0;">'
         f'{esc(sl["book"])}</span>{", " + esc(sl["page"]) if sl.get("page") else ""}</div>'),
    ]
    if sl.get("reflection"):
        parts += [rule(), f'<p style="margin: 0; font-size: 36px; line-height: 1.45; color: {t["body"]};">{esc(sl["reflection"])}</p>']
    return col(40, "\n".join(parts))


def close(sl, t):
    parts = [headline("h2", sl["headline"], sl.get("accent"), sl.get("size", 132), 1.02), rule()]
    if sl.get("sub"):
        parts.append(f'<p style="margin: 0; font-size: 38px; line-height: 1.45; color: {t["body"]}; max-width: 860px;">{esc(sl["sub"])}</p>')
    return col(56, "\n".join(parts))


def post_page(title, h, t, brand, right_label, ref, handle, content, pad_y=PAD):
    foot = f"{esc(ref)} · {esc(handle)}" if handle else esc(ref)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONT_LINK}
<style>body{{margin:0;background:{t['bg']}}}</style>
</helmet>
<div style="width: {W}px; height: {h}px; box-sizing: border-box; padding: {pad_y}px {PAD}px; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; background: {t['bg']}; color: {t['fg']}; font-family: {SANS};">
{cube_background(t['pattern'], h)}
<div style="position: relative; display: flex; justify-content: space-between; align-items: center; font-size: 24px; letter-spacing: 0.18em; text-transform: uppercase; color: {t['muted']};"><span style="display: flex; align-items: center; gap: 14px;">{brand_mark()}<span>{esc(brand)}</span></span><span>{esc(right_label)}</span></div>
{content}
<div style="position: relative; display: flex; justify-content: space-between; align-items: center; font-size: 26px; color: {t['muted']};"><span>{foot}</span><span>Stay close. Live deep.</span></div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"accent":{{"editor":"color","default":"{t['accent']}"}},"$preview":{{"width":{W},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{ accent: this.props.accent ?? '{t['accent']}' }};
  }}
}}
</script>
</body>
</html>
'''


def weekly_posts(c, pal, brand, handle):
    """Wednesday quote post, Friday challenge + prayer posts, and an announcement story."""
    wk, ref, series = c["weekly"], c["reference"], c["series"]
    L, D = pal["light"], pal["dark"]
    pick = lambda item, default: COMBOS[item["combo"]] if item.get("combo") else default
    files = {}
    q = wk["quote"]
    files["W_Quote.dc.html"] = ("Wednesday — Daily word", H, post_page(
        "Daily word", H, pick(q, L), brand, "Daily word", ref, handle, col(48, "\n".join([
            headline("h2", q["headline"], q.get("accent"), q.get("size", 124), 1.04), rule(),
            f'<div style="font-size: 30px; font-weight: 700; letter-spacing: 0.08em; color: {ACC};">{esc(q.get("ref", ref)).upper()}</div>']))))
    ch = wk["challenge"]
    CT = pick(ch, D)
    rows = "".join(
        f'<div style="display: flex; gap: 28px; align-items: baseline; padding: 22px 0; border-top: 1.5px solid {CT["panel"]};">'
        f'<div style="flex-shrink: 0; width: 150px; font-size: 24px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: {ACC};">{esc(it["day"])}</div>'
        f'<div style="font-size: 32px; line-height: 1.4;">{esc(it["text"])}</div></div>' for it in ch["items"])
    files["W_Challenge.dc.html"] = ("Friday — Weekly challenge", H, post_page(
        "Weekly challenge", H, CT, brand, "Weekly challenge", ref, handle, col(36, "\n".join([
            f'<div style="font-size: 28px; letter-spacing: 0.14em; text-transform: uppercase; color: {ACC};">This week, practise it</div>',
            headline("h2", ch["headline"], ch.get("accent"), ch.get("size", 88)),
            f'<div style="display: flex; flex-direction: column;">{rows}</div>']))))
    pr = wk["prayer"]
    files["W_Prayer.dc.html"] = ("Friday — Prayer", H, post_page(
        "Prayer", H, pick(pr, L), brand, "A prayer for this week", ref, handle, col(40, "\n".join([
            f'<div style="font-size: 28px; letter-spacing: 0.14em; text-transform: uppercase; color: {ACC};">Let’s pray</div>',
            f'<p style="margin: 0; font-family: {SERIF}; font-style: italic; font-size: {pr.get("size", 60)}px; line-height: 1.25;">{esc(pr["text"])}</p>',
            rule(), f'<div style="font-family: {SERIF}; font-size: 48px; color: {ACC};">Amen.</div>']))))
    st = wk.get("story", {})
    D = pick(st, D)
    handle_line = f'<div style="font-size: 26px; color: {D["muted"]};">{esc(handle)}</div>' if handle else ""
    files["W_Story.dc.html"] = ("Story — New post", 1920, post_page(
        "New post story", 1920, D, brand, "New message", ref, None, "\n".join([
            col(48, "\n".join([
                f'<div style="font-size: 30px; letter-spacing: 0.16em; text-transform: uppercase; color: {ACC};">{esc(st.get("kicker", "Short sermon"))}</div>',
                headline("h2", st.get("headline", series), st.get("accent"), st.get("size", 150), 1.0),
                f'<p style="margin: 0; font-size: 40px; line-height: 1.45; color: {D["body"]};">{esc(st.get("sub", "A new study on " + ref + "."))}</p>'])),
            f'<div style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 18px;">'
            f'<div style="padding: 26px 56px; border-radius: 999px; background: {ACC}; color: {D["bg"]}; font-size: 34px; font-weight: 700;">Read the new post</div>{handle_line}</div>']),
        pad_y=140))
    return files


def main(content_path, out_dir):
    c = json.loads(Path(content_path).read_text())
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    series, ref = c["series"], c["reference"]
    if "palette" in c:  # legacy: explicit dark/light token sets
        pal = c["palette"]
    else:
        pal = {"dark": COMBOS[c.get("combo", "vine")], "light": COMBOS[c.get("key_combo", "cream")]}
    slides = c["slides"]
    assert len(slides) == 10, "The carousel needs exactly 10 slides"
    names = ["Main.dc.html"] + [f"S{i:02d}.dc.html" for i in range(2, 11)]
    light_types = {"passage", "quote", "close"}
    titles = {}
    for n, (name, sl) in enumerate(zip(names, slides), start=1):
        typ = sl["type"]
        t = pal["light"] if sl.get("theme", "light" if typ in light_types else "dark") == "light" else pal["dark"]
        if sl.get("combo"):
            t = COMBOS[sl["combo"]]
        body = {"cover": lambda: cover(sl, t, c.get("cover_icon")), "passage": lambda: passage(sl, t),
                "insight": lambda: insight(sl, t), "quote": lambda: quote(sl, t), "close": lambda: close(sl, t)}[typ]()
        label = sl.get("label") or {"cover": "Cover", "passage": "The passage", "quote": "Ellen G. White",
                                    "close": "Closing"}.get(typ) or sl.get("kicker", "Insight").replace("On ", "").capitalize()
        titles[name] = f"{n:02d} {label}"
        (out / name).write_text(page(f"Slide {n} — {label}", n, t, series, ref, body, last=(n == 10),
                                     brand=c.get("brand", "Abide"), handle=c.get("handle")))

    weekly = {}
    if c.get("weekly"):
        weekly = weekly_posts(c, pal, c.get("brand", "Abide"), c.get("handle"))
        for name, (_, _, src) in weekly.items():
            (out / name).write_text(src)

    idx_path = out / "canvas.json"
    idx = json.loads(idx_path.read_text()) if idx_path.exists() else {
        "v": 3, "createdOnFiles": {"v": 1, "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
        "launch": {"view": "canvas"}, "pages": [], "notes": {}, "designSystems": []}
    idx.setdefault("title", c.get("title", f"{series} — {ref} Carousel"))
    boards = idx.setdefault("boards", {})
    for k, name in enumerate(names):
        row, colm = divmod(k, 5)
        boards[name] = {**boards.get(name, {}), "x": colm * (W + 80), "y": row * (H + 120), "w": W, "h": H,
                        "title": titles[name]}
    order = list(names)
    wy = 2 * (H + 120) + 300
    x = 0
    for name, (label, h, _) in weekly.items():
        boards[name] = {**boards.get(name, {}), "x": x, "y": wy, "w": W, "h": h, "title": label}
        order.append(name)
        x += W + 80
    if weekly:
        idx.setdefault("notes", {})["t2"] = {"x": 0, "y": wy - 300, "text": "Wednesday and Friday posts + story",
                                             "kind": "title1", "maxW": x - 80}
    idx["order"] = order
    idx.setdefault("notes", {})["t1"] = {"x": 0, "y": -300, "text": f"{series} — Instagram carousel (1080×1350)",
                                         "kind": "title1", "maxW": 5 * W + 4 * 80}
    idx_path.write_text(json.dumps(idx, ensure_ascii=False))
    print("Wrote", ", ".join(names + list(weekly)), "and canvas.json to", out)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
