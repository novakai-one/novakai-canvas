#!/usr/bin/env python3
"""Generates reading-target-diagram.svg — the readability target for Novakai Canvas maps.

Same content as the `novakai-canvas-diagram-engine` map, hand-laid-out with the
readability rules the app diagnosis called for: screen-sized type, high-contrast
wires, distinct shapes per node kind, crow's-foot cardinality, one highlighted flow.
v2: fixed card pitch, orthogonal wires routed through gutters (no box crossings).
"""
import html

W, H = 1840, 1240
parts = []
def add(s): parts.append(s)
def esc(t): return html.escape(str(t), quote=True)

PAGE, PANEL, PANEL_ST = '#0f1115', '#151920', '#262c36'
SECTION, INK, MUTED, FAINT = '#d9b36c', '#eef1f6', '#a9b2c0', '#7e8794'
GOLD, GOLD_INK = '#e3b45c', '#17130a'

WIRE_KINDS = {
    'owns':       ('#8b95a3', ''),
    'references': ('#86b89a', ''),
    'assigns':    ('#89a3c0', '8 5'),
    'queries':    ('#97a0b8', '10 4 3 4'),
    'executes':   ('#b39ddb', ''),
    'mentions':   ('#d3b078', '8 5'),
    'missing':    ('#cf8f83', '2 5'),
}
FONT  = "Inter, 'Segoe UI', sans-serif"
MONO  = "'JetBrains Mono', SFMono-Regular, Consolas, monospace"
SERIF = "Georgia, serif"

def rect(x, y, w, h, fill, stroke=None, sw=1.2, rx=8, dash=None):
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" rx="{rx}"'
    if stroke: s += f' stroke="{stroke}" stroke-width="{sw}"'
    if dash: s += f' stroke-dasharray="{dash}"'
    return s + '/>'

def text(x, y, t, size=12, fill=INK, weight=400, family=FONT, anchor='start',
         spacing=None, style=None, halo=False, rotate=None):
    s = f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" fill="{fill}"'
    if weight != 400: s += f' font-weight="{weight}"'
    if anchor != 'start': s += f' text-anchor="{anchor}"'
    if spacing: s += f' letter-spacing="{spacing}"'
    if style: s += f' font-style="{style}"'
    if halo: s += f' stroke="{PAGE}" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round"'
    if rotate is not None: s += f' transform="rotate({rotate} {x} {y})"'
    return s + f'>{esc(t)}</text>'

def line(x1, y1, x2, y2, stroke, sw=2.2, dash=None):
    s = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round"'
    if dash: s += f' stroke-dasharray="{dash}"'
    return s + '/>'

import math
def _unit(dx, dy):
    l = math.hypot(dx, dy) or 1
    return dx / l, dy / l

def crows_foot(px, py, ax, ay, card, color, sw=2.2):
    """Cardinality glyph at (px,py); axis points back along the wire."""
    nx, ny = -ay, ax
    out = []
    def at(d, o=0.0): return (px + ax * d + nx * o, py + ay * d + ny * o)
    def bar(d):
        (x1, y1), (x2, y2) = at(d, -6), at(d, 6)
        out.append(line(x1, y1, x2, y2, color, sw))
    def many():
        jx, jy = at(13)
        for o in (-7, 0, 7):
            x2, y2 = at(4, o)
            out.append(line(jx, jy, x2, y2, color, sw))
    def circle(d):
        cx, cy = at(d)
        out.append(f'<circle cx="{cx}" cy="{cy}" r="3.6" fill="{PAGE}" stroke="{color}" stroke-width="{sw}"/>')
    if card == 'one': bar(5); bar(12)
    elif card == 'zero-or-one': bar(5); circle(13)
    elif card == 'one-or-many': many(); bar(20)
    elif card == 'zero-or-many': many(); circle(20)
    return ''.join(out)

def ortho(points, kind='owns', label=None, scard=None, tcard=None,
          flow=False, label_at=None, label_rotate=None):
    """Orthogonal polyline wire with crow's feet and one haloed label."""
    color, dash = WIRE_KINDS[kind]
    width = 3.0 if flow else 2.2
    if flow: color, dash = GOLD, ''
    pts = ' '.join(f'{x},{y}' for x, y in points)
    s = f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"'
    if dash: s += f' stroke-dasharray="{dash}"'
    s += '/>'
    (x1, y1), (x2, y2) = points[0], points[-1]
    if scard:
        ax, ay = _unit(x1 - points[1][0], y1 - points[1][1])
        s += crows_foot(x1, y1, ax, ay, scard, color, width)
    if tcard:
        ax, ay = _unit(x2 - points[-2][0], y2 - points[-2][1])
        s += crows_foot(x2, y2, ax, ay, tcard, color, width)
    if label:
        lx, ly = label_at or points[len(points) // 2]
        s += text(lx, ly, label, size=11, fill=GOLD if flow else '#c8d0dc',
                  anchor='middle', halo=True, rotate=label_rotate)
    return s

def edge(p1, p2, kind='owns', label=None, flow=False, bend=0.45,
         label_dx=0, label_dy=-10, scard=None, tcard=None):
    """Smooth cubic wire (top strip pipeline)."""
    color, dash = WIRE_KINDS[kind]
    width = 3.0 if flow else 2.2
    if flow: color, dash = GOLD, ''
    (x1, y1), (x2, y2) = p1, p2
    dx, dy = x2 - x1, y2 - y1
    horiz = abs(dx) > abs(dy)
    c1 = (x1 + dx * bend, y1) if horiz else (x1, y1 + dy * bend)
    c2 = (x2 - dx * bend, y2) if horiz else (x2, y2 - dy * bend)
    s = f'<path d="M {x1} {y1} C {c1[0]} {c1[1]}, {c2[0]} {c2[1]}, {x2} {y2}" fill="none" stroke="{color}" stroke-width="{width}"'
    if dash: s += f' stroke-dasharray="{dash}"'
    s += '/>'
    if scard:
        ax, ay = _unit(x1 - c1[0], y1 - c1[1]); s += crows_foot(x1, y1, ax, ay, scard, color, width)
    if tcard:
        ax, ay = _unit(x2 - c2[0], y2 - c2[1]); s += crows_foot(x2, y2, ax, ay, tcard, color, width)
    if label:
        t, mt = 0.5, 0.5
        lx = mt**3*x1 + 3*mt*mt*t*c1[0] + 3*mt*t*t*c2[0] + t**3*x2
        ly = mt**3*y1 + 3*mt*mt*t*c1[1] + 3*mt*t*t*c2[1] + t**3*y2
        s += text(lx + label_dx, ly + label_dy, label, size=11,
                  fill=GOLD if flow else '#c8d0dc', anchor='middle', halo=True)
    return s

def flow_badge(x, y, n):
    return (f'<circle cx="{x}" cy="{y}" r="9" fill="{GOLD}" stroke="{PAGE}" stroke-width="2"/>'
            + text(x, y + 4, n, size=11, fill=GOLD_INK, weight=700, anchor='middle'))

def section(x, y, w, h, label, align='left'):
    s = rect(x, y, w, h, PANEL, PANEL_ST, 1.2, 10)
    if align == 'right':
        s += text(x + w - 16, y + 26, label, size=12, fill=SECTION, weight=700, spacing='0.12em', anchor='end')
    else:
        s += text(x + 16, y + 26, label, size=12, fill=SECTION, weight=700, spacing='0.12em')
    return s

def module_card(x, y, w, title, desc, methods, h=128):
    s = rect(x, y, w, h, '#1c2431', '#3a4d68', 1.4, 9)
    s += f'<path d="M{x+1},{y+9} a8,8 0 0 1 8,-8 h{w-18} a8,8 0 0 1 8,8 v27 h-{w-2} z" fill="#28394f"/>'
    s += text(x + 13, y + 24, title, size=14, weight=700)
    s += text(x + w - 12, y + 24, 'MODULE', size=8.5, fill='#8fa5c2', anchor='end', spacing='0.1em', weight=700)
    cy = y + 52
    if desc:
        s += text(x + 13, cy, desc, size=10.5, fill=MUTED); cy += 20
    for m in methods:
        s += text(x + 13, cy, m, size=11, fill='#c6d2e4', family=MONO); cy += 19
    return s

def cylinder(x, y, w, h, title, sub):
    rx = w / 2
    s = (f'<path d="M{x},{y+10} a{rx},10 0 0 1 {w},0 v{h-20} a{rx},10 0 0 1 -{w},0 z" '
         f'fill="#241f18" stroke="#7a6742" stroke-width="1.4"/>')
    s += f'<ellipse cx="{x+rx}" cy="{y+10}" rx="{rx}" ry="10" fill="#2e2719" stroke="#7a6742" stroke-width="1.4"/>'
    s += text(x + rx, y + 38, title, size=11.5, fill='#e5d6b8', weight=600, anchor='middle', family=MONO)
    s += text(x + rx, y + 56, sub, size=9.5, fill='#b89b62', anchor='middle')
    s += text(x + rx, y + h - 6, 'RESOURCE', size=8, fill='#8d7c55', anchor='middle', spacing='0.1em', weight=700)
    return s

def entity(x, y, w, title, rows, palette='blue'):
    headers = {'blue': '#2f4d77', 'sage': '#35594a', 'violet': '#4d3f6b'}
    h = 46 + 22 + len(rows) * 24 + 8
    s = rect(x, y, w, h, '#1a2027', '#323c49', 1.4, 8)
    s += f'<path d="M{x+1},{y+8} a7,7 0 0 1 7,-7 h{w-16} a7,7 0 0 1 7,7 v38 h-{w-2} z" fill="{headers[palette]}"/>'
    s += text(x + w/2, y + 22, title, size=14, weight=700, anchor='middle')
    s += text(x + w/2, y + 38, '«entity»', size=9, fill='#c3cede', anchor='middle', style='italic')
    ty, fx, kx, kcol = y + 46, x + 12, x + w * 0.34, x + w * 0.80
    s += text(fx, ty + 14, 'TYPE', size=8, fill=FAINT, weight=700, spacing='0.08em')
    s += text(kx, ty + 14, 'FIELD', size=8, fill=FAINT, weight=700, spacing='0.08em')
    s += text(kcol, ty + 14, 'KEYS', size=8, fill=FAINT, weight=700, spacing='0.08em')
    s += line(x + 1, ty + 20, x + w - 1, ty + 20, '#323c49', 1)
    for i, (ftype, fname, keys) in enumerate(rows):
        ry = ty + 22 + i * 24
        if i % 2 == 0:
            s += rect(x + 1, ry, w - 2, 23, '#1f2630', rx=0)
        s += line(x + w*0.32, ry, x + w*0.32, ry + 23, '#2a333f', 1)
        s += line(x + w*0.78, ry, x + w*0.78, ry + 23, '#2a333f', 1)
        s += text(fx, ry + 16, ftype, size=10, fill='#93a7c4', family=MONO)
        s += text(kx, ry + 16, fname, size=11, fill='#e4eaf2')
        if keys:
            s += text(kcol, ry + 16, keys, size=9, fill=GOLD, family=MONO, weight=600)
    return s, h

def ooux(x, y, w, title, rows):
    h = 46 + len(rows) * 28 + 12
    s = rect(x, y, w, h, '#221d2b', '#4c4258', 1.4, 9)
    s += f'<path d="M{x+1},{y+9} a8,8 0 0 1 8,-8 h{w-18} a8,8 0 0 1 8,8 v37 h-{w-2} z" fill="#4d3f6b"/>'
    s += text(x + w/2, y + 23, title, size=14, weight=700, anchor='middle')
    s += text(x + w/2, y + 39, '«object»', size=9, fill='#d4c8ea', anchor='middle', style='italic')
    for i, row in enumerate(rows):
        ry = y + 52 + i * 28
        if row[0] == 'cta':
            _, name, role = row
            s += rect(x + 10, ry, w - 20, 23, '#4a3554', rx=4)
            s += text(x + 20, ry + 16, f'ƒ  {name}()', size=11, fill='#e6d9f7')
            s += text(x + w - 20, ry + 16, f'@{role}', size=9, fill='#b7a6cc', anchor='end', style='italic')
        else:
            _, name, vtype, role, traits = row
            s += rect(x + 10, ry, w - 20, 23, '#2d2440' if role == 'core' else '#342c49', rx=4)
            s += text(x + 20, ry + 16, f'{name} : {vtype}', size=11, fill='#ddd6ea')
            s += text(x + w - 20, ry + 16, traits or role, size=9, fill='#b7a6cc', anchor='end', style='italic')
    return s, h

def note(x, y, w, lines):
    h = 20 + len(lines) * 20 + 12
    s = rect(x, y, w, h, 'none', '#3a4150', 1.2, 8, dash='5 4')
    for i, ln in enumerate(lines):
        s += text(x + 14, y + 26 + i * 20, ln, size=11.5, fill=MUTED, family=SERIF, style='italic')
    return s

def tree(x, y, w, title, rows):
    h = 40 + len(rows) * 24 + 10
    s = rect(x, y, w, h, '#1a2027', '#2c3442', 1.4, 8)
    s += text(x + 13, y + 24, title, size=13, weight=700)
    s += text(x + w - 12, y + 24, 'TREE', size=8.5, fill=FAINT, anchor='end', spacing='0.1em', weight=700)
    for i, (depth, label, tone) in enumerate(rows):
        ry = y + 52 + i * 24
        tx = x + 16 + depth * 22
        if depth:
            s += line(tx - 14, ry - 6, tx - 14, ry + 2, '#39424f', 1.4)
            s += line(tx - 14, ry + 2, tx - 4, ry + 2, '#39424f', 1.4)
        s += text(tx, ry + 4, label, size=11, fill=tone)
    return s, h

# ================================================================ frame
add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(rect(0, 0, W, H, PAGE, rx=0))
add(text(40, 52, 'Novakai Canvas — diagram engine', size=21, weight=700))
add(text(40, 74, 'Reading target: same map, rendered so a human can actually read it · 27 nodes · 4 sections · 27 wires · 1 flow',
        size=12, fill=MUTED))

# ================================================================ top strip
add(section(32, 96, 580, 216, 'AUTHORING · tools/canvas-cli'))
add(module_card(52, 138, 168, 'canvas CLI', 'the only write path', ['apply(DslText)', 'snapshot(MapId)']))
add(module_card(240, 138, 168, 'DSL parser', 'dsl-parse/*', ['parse(DslText)', '→ ScopeAst']))
add(module_card(428, 138, 168, 'Compiler', 'compile/*', ['compile(ScopeAst)', '→ DiagramRecord']))

add(section(652, 96, 280, 216, 'STORAGE · public/data'))
add(cylinder(697, 132, 190, 76, 'diagrams/<slug>.json', 'one DiagramRecord per map'))
add(cylinder(697, 222, 190, 76, 'library.json', 'index + cross-map links'))

add(section(972, 96, 596, 216, 'RUNTIME · src'))
add(module_card(992, 138, 132, 'Canvas library', None, ['load(MapId)', 'save(Record)']))
add(module_card(1136, 138, 132, 'Geometry', None, ['layoutScopes()', 'planWireRoutes()']))
add(module_card(1280, 138, 132, 'Projection', None, ['projectNodes()', 'projectWires()']))
add(module_card(1424, 138, 132, 'React Flow', None, ['render(nodes,', 'edges)']))

ooux_svg, ooux_h = ooux(1608, 96, 200, 'Map', [
    ('attr', 'name', 'string', 'core', 'core'),
    ('attr', 'status', 'enum', 'core', 'filterable'),
    ('attr', 'revision', 'number', 'metadata', 'sortable'),
    ('cta', 'applyDSL', 'agent'),
    ('cta', 'snapshot', 'human'),
    ('cta', 'archive', 'owner'),
])
add(ooux_svg)

# pipeline wires — the flow (gold, numbered)
add(edge((220, 202), (240, 202), kind='executes', flow=True))
add(edge((408, 202), (428, 202), kind='executes', flow=True))
add(edge((596, 202), (697, 168), kind='owns', flow=True, label='writes', label_dy=-14))
add(edge((887, 168), (992, 190), kind='queries', flow=True, label='loads', label_dy=-14))
add(edge((1124, 202), (1136, 202), kind='executes', flow=True))
add(edge((1268, 202), (1280, 202), kind='executes', flow=True))
add(edge((1412, 202), (1424, 202), kind='executes', flow=True))
add(edge((887, 258), (992, 234), kind='queries', label='reads index', label_dy=20))
for (bx, by, n) in [(230, 186, 1), (418, 186, 2), (648, 174, 3), (940, 164, 4),
                    (1130, 186, 5), (1274, 186, 6), (1418, 186, 7)]:
    add(flow_badge(bx, by, n))
add(text(1120, 332, 'FLOW · from DSL line to pixels', size=10, fill=GOLD, weight=700, spacing='0.06em'))

# ================================================================ record model
add(section(32, 352, 1776, 848, 'RECORD MODEL · src/domain/records.ts', align='right'))

EW = 330
col = [60, 420, 780, 1140]
row = [400, 630, 836, 1018]
B = {}
def put_entity(name, cx, ry, title, rows, palette='blue'):
    svg, h = entity(col[cx], row[ry], EW, title, rows, palette)
    add(svg)
    B[name] = (col[cx], row[ry], EW, h)

put_entity('DIAGRAM_RECORD', 0, 0, 'DIAGRAM_RECORD', [
    ('DiagramId', 'id', 'PK'), ('string', 'name', None), ('3', 'schemaVersion', 'UK'),
    ('enum', 'orientation', None), ('int', 'revision', None)])
put_entity('CANVAS_NODE', 1, 0, 'CANVAS_NODE', [
    ('NodeId', 'id', 'PK'), ('NodeKind', 'kind', None), ('NodeId', 'parentId', 'FK'),
    ('InterfaceId[]', 'interfaceIds', 'FK'), ('DiagramId', 'expandsTo', 'FK')])
put_entity('CANVAS_WIRE', 2, 0, 'CANVAS_WIRE', [
    ('WireId', 'id', 'PK'), ('WireKind', 'kind', None),
    ('Endpoint', 'source', 'FK'), ('Endpoint', 'target', 'FK')])
put_entity('ENDPOINT', 3, 0, 'ENDPOINT', [
    ('NodeId', 'nodeId', 'FK'), ('PortAnchor', 'anchor', None), ('Cardinality', 'cardinality', None)])
put_entity('FLOW', 0, 1, 'FLOW', [
    ('FlowId', 'id', 'PK'), ('string', 'name', None)])
put_entity('FLOW_STEP', 1, 1, 'FLOW_STEP', [
    ('WireId', 'ref', 'PK · FK'), ('int', 'ordinal', 'PK')])
put_entity('INTERFACE', 2, 1, 'INTERFACE', [
    ('InterfaceId', 'id', 'PK'), ('NodeId', 'ownerId', 'FK'),
    ('Type[]', 'accepts', None), ('Type[]', 'returns', None)])
put_entity('TYPE_OBJECT', 3, 1, 'TYPE_OBJECT', [
    ('TypeId', 'id', 'PK'), ('string', 'name', None), ('string[]', 'fields', None)])
put_entity('CANVAS_LAYOUT', 0, 2, 'CANVAS_LAYOUT', [
    ('LayoutId', 'id', 'PK'), ('enum', 'strategy', None)])
put_entity('NODE_PLACEMENT', 1, 2, 'NODE_PLACEMENT', [
    ('NodeId', 'nodeId', 'PK · FK'), ('Point', 'position', None), ('bool', 'pinned', None)])
put_entity('WIRE_ROUTE_HINT', 2, 2, 'WIRE_ROUTE_HINT', [
    ('WireId', 'wireId', 'PK · FK'), ('Point[]', 'waypoints', None)])
put_entity('CANVAS_VIEW', 3, 2, 'CANVAS_VIEW', [
    ('ViewId', 'id', 'PK'), ('LayoutId', 'layoutId', 'FK'), ('FlowId', 'flowId', 'FK')])
put_entity('LIBRARY_INDEX', 0, 3, 'LIBRARY_INDEX', [
    ('int', 'revision', None), ('Link[]', 'links', None)])
put_entity('CROSS_LINK', 1, 3, 'CROSS_DIAGRAM_LINK', [
    ('LinkId', 'id', 'PK'), ('NodeRef', 'source', 'FK'), ('NodeRef', 'target', 'FK')])

def port(name, side, frac=0.5):
    x, y, w, h = B[name]
    return {'l': (x, y + h * frac), 'r': (x + w, y + h * frac),
            't': (x + w * frac, y), 'b': (x + w * frac, y + h)}[side]

# --- relationship wires (orthogonal, gutter-routed, crow's feet)
dr, cn, cw, ep = 'DIAGRAM_RECORD', 'CANVAS_NODE', 'CANVAS_WIRE', 'ENDPOINT'
fl, fs, itf, to = 'FLOW', 'FLOW_STEP', 'INTERFACE', 'TYPE_OBJECT'
cl, np_, wrh, cv = 'CANVAS_LAYOUT', 'NODE_PLACEMENT', 'WIRE_ROUTE_HINT', 'CANVAS_VIEW'
li, cdl = 'LIBRARY_INDEX', 'CROSS_LINK'

add(ortho([port(dr,'r',0.30), port(cn,'l',0.30)], label='contains', scard='one', tcard='zero-or-many', label_at=(405, 447)))
add(ortho([port(cn,'r',0.235), port(cw,'l',0.27)], label='source', scard='zero-or-many', tcard='one', label_at=(765, 436)))
add(ortho([port(cn,'r',0.714), port(cw,'l',0.81)], label='target', scard='zero-or-many', tcard='one', label_at=(765, 552)))
add(ortho([port(cw,'r',0.57), port(ep,'l',0.66)], label='anchors', scard='zero-or-many', tcard='one', label_at=(1125, 488)))
add(ortho([port(dr,'b',0.25), port(fl,'t',0.25)], label='declares', scard='one', tcard='zero-or-many', label_at=(160, 621)))
add(ortho([port(fl,'r',0.5), port(fs,'l',0.5)], label='orders', scard='one', tcard='one-or-many', label_at=(405, 680)))
add(ortho([port(fs,'t',0.82), (690, 607), (895, 607), port(cw,'b',0.35)], label='references', scard='zero-or-many', tcard='one', label_at=(792, 599)))
add(ortho([port(cn,'b',0.7), (651, 619), (879, 619), port(itf,'t',0.3)], label='exposes', scard='one', tcard='zero-or-many', label_at=(940, 615)))
add(ortho([port(itf,'r',0.47), port(to,'l',0.55)], label='accepts / returns', scard='zero-or-many', tcard='zero-or-many', label_at=(1125, 701)))
add(ortho([port(dr,'b',0.75), (307, 613), (397, 613), (397, 873), port(cl,'r',0.3)], label='arranges', scard='one', tcard='one-or-many', label_at=(389, 770), label_rotate=-90))
add(ortho([port(cl,'r',0.46), port(np_,'l',0.386)], label='places', scard='one', tcard='zero-or-many', label_at=(405, 883)))
add(ortho([port(np_,'r',0.46), port(wrh,'l',0.55)], label='routes', scard='one', tcard='zero-or-many', label_at=(712, 894)))
add(ortho([port(wrh,'r',0.55), port(cv,'l',0.46)], kind='references', label='hints', scard='zero-or-many', tcard='one', label_at=(1125, 894)))
add(ortho([port(np_,'t',0.25), (502, 828), (406, 828), (406, 601), (502, 601), port(cn,'b',0.25)], label='geometry for', scard='one', tcard='one', label_at=(414, 800), label_rotate=-90))
add(ortho([port(cv,'b',0.3), (1239, 1001), (307, 1001), port(cl,'b',0.75)], label='uses', scard='zero-or-many', tcard='one', label_at=(770, 993)))
add(ortho([port(cv,'t',0.4), (1272, 819), (374, 819), port(fl,'b',0.95)], kind='references', label='emphasises', scard='zero-or-many', tcard='zero-or-one', label_at=(820, 811)))
add(ortho([port(li,'l',0.5), (46, 1080), (46, 498), port(dr,'l',0.5)], label='indexes', scard='one', tcard='zero-or-many', label_at=(41, 800), label_rotate=-90))
add(ortho([port(li,'r',0.55), port(cdl,'l',0.46)], label='owns', scard='one', tcard='zero-or-many', label_at=(405, 1076)))
add(ortho([port(cdl,'r',0.5), (766, 1092), (766, 576), port(cn,'r',0.9)], kind='references', label='joins across maps', scard='zero-or-many', tcard='one', label_at=(774, 930), label_rotate=-90))
# self-loop: parent hierarchy on CANVAS_NODE
slx, sly = port(cn, 't', 0.42); slx2, _ = port(cn, 't', 0.60)
add(f'<path d="M {slx} {sly} C {slx} {sly-34}, {slx2} {sly-34}, {slx2} {sly}" fill="none" stroke="{WIRE_KINDS["owns"][0]}" stroke-width="2.2"/>')
add(crows_foot(slx, sly, 0, 1, 'zero-or-many', WIRE_KINDS['owns'][0]))
add(crows_foot(slx2, sly, 0, 1, 'zero-or-one', WIRE_KINDS['owns'][0]))
add(text((slx + slx2)/2, sly - 42, 'parent', size=11, fill='#c8d0dc', anchor='middle', halo=True))
# OOUX backed-by (dashed)
add(ortho([(1708, 96 + ooux_h), (1708, 336), (330, 336), port(dr,'t',0.82)], kind='mentions', label='backed by', label_at=(1000, 328)))

# ================================================================ right rail
RX = 1500
add(rect(RX, 396, 308, 340, '#161b23', '#2a313d', 1.2, 8))
add(text(RX + 14, 420, 'HOW TO READ THIS', size=10, fill=SECTION, weight=700, spacing='0.1em'))
ly = 446
for kind in WIRE_KINDS:
    c, d = WIRE_KINDS[kind]
    add(line(RX + 16, ly - 4, RX + 62, ly - 4, c, 2.4, dash=d or None))
    add(text(RX + 74, ly, kind, size=11, fill=INK))
    ly += 22
ly += 6
add(line(RX + 16, ly - 4, RX + 62, ly - 4, GOLD, 3))
add(flow_badge(RX + 40, ly - 4, 'n'))
add(text(RX + 74, ly, 'active flow step', size=11, fill=INK))
ly += 26
for card, lbl in [('one', '— exactly one'), ('zero-or-one', '— zero or one'),
                  ('one-or-many', '— one or many'), ('zero-or-many', '— zero or many')]:
    add(line(RX + 16, ly - 4, RX + 62, ly - 4, '#8b95a3', 2.2))
    add(crows_foot(RX + 58, ly - 4, -1, 0, card, '#8b95a3'))
    add(text(RX + 74, ly, lbl, size=11, fill=INK))
    ly += 22

add(note(RX, 756, 308, [
    'Geometry lives in layouts, never on',
    'semantic nodes — this arrangement is',
    'the target experience, not the storage.',
]))

tree_svg, _ = tree(RX, 876, 308, 'Containment', [
    (0, 'Map  (DiagramRecord)', INK),
    (1, 'zone  (group node)', MUTED),
    (2, 'module / entity / …', MUTED),
    (3, 'method · field · row', FAINT),
])
add(tree_svg)

add('</svg>')
with open('reading-target-diagram.svg', 'w') as f:
    f.write('\n'.join(parts))
print('wrote reading-target-diagram.svg')
