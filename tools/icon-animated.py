#!/usr/bin/env python3
# The app icon (icons/icon.svg: navy sky, coral planet, cream ring and T) as an animated inline SVG for the menu
# and the loading screen: markings drift across the planet under fixed sunlight (it turns), the stars twinkle and
# the satellite runs round the ring, behind the planet on the far side. Prints the <svg> with every id prefixed
# (two copies can share a page). The motion is CSS (classes ai-spin, ai-tw in style.css) plus one SMIL path.
# usage: python3 tools/icon-animated.py PREFIX CLASS
import sys
P, CLS = sys.argv[1], sys.argv[2]
BG, PL, SH, AC = '#14213d', '#ff6b4a', '#e04a2c', '#f1e4d3'
T = 'M330 330 H694 L674 416 H570 V728 L512 780 L454 728 V416 H350 Z'
INL = 'M478 434 V710 L512 742 L546 710 V434 Z'
dots = [(150, 170, 5), (260, 110, 3), (820, 150, 4), (900, 300, 3), (870, 860, 5), (190, 880, 3), (700, 90, 3), (80, 420, 3), (950, 620, 3)]
def star4(x, y, r): return f'M{x} {y - r} Q{x} {y} {x + r} {y} Q{x} {y} {x} {y + r} Q{x} {y} {x - r} {y} Q{x} {y} {x} {y - r} Z'
stars = ''.join(f'<circle class="ai-tw" style="animation-delay:{(i * 0.83) % 3.1:.2f}s" cx="{x}" cy="{y}" r="{r}" fill="{AC}" opacity="0.8"/>' for i, (x, y, r) in enumerate(dots))
stars += ''.join(f'<path class="ai-tw ai-tw-big" style="animation-delay:{d}s" d="{star4(x, y, r)}" fill="{AC}"/>' for (x, y, r, d) in [(210, 250, 18, 0.4), (830, 220, 14, 1.7), (860, 760, 10, 2.6)])
# Markings on the planet: darker plains and pale dust, laid out over 600 units and repeated, so a 600-unit drift
# loops without a seam. (Ellipses, flatter towards the poles.)
marks = [(60, 400, 70, 34, SH, 0.55), (230, 470, 90, 40, '#d84426', 0.5), (420, 380, 60, 26, SH, 0.5), (520, 560, 110, 46, '#d84426', 0.45),
         (130, 620, 80, 36, SH, 0.5), (330, 690, 70, 28, SH, 0.45), (470, 300, 50, 18, '#ff8f6e', 0.6), (290, 560, 40, 16, '#ff8f6e', 0.55),
         (40, 520, 36, 14, '#ff8f6e', 0.5), (560, 760, 60, 22, SH, 0.4)]
one = ''.join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c}" opacity="{o}"/>' for (x, y, rx, ry, c, o) in marks)
surface = f'<g class="ai-spin"><g transform="translate(212 0)">{one}<g transform="translate(600 0)">{one}</g><g transform="translate(-600 0)">{one}</g></g></g>'
orbit = 'M72 560 A440 104 0 0 1 952 560 A440 104 0 0 1 72 560'
def bead(vis):  # one copy for the far half (drawn behind the planet), one for the near half
    return (f'<circle r="26" fill="{AC}"><animateMotion dur="18s" repeatCount="indefinite" path="{orbit}"/>'
            f'<animate attributeName="opacity" dur="18s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;0.5" values="{vis}"/></circle>')
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" class="{CLS}" aria-hidden="true" focusable="false"><defs>
<clipPath id="{P}pclip"><circle cx="512" cy="540" r="300"/></clipPath>
<mask id="{P}gap"><rect width="1024" height="1024" fill="#fff"/><path d="{T}" fill="#000" stroke="#000" stroke-width="44" stroke-linejoin="round" transform="translate(0 30)"/></mask>
<mask id="{P}behind"><rect width="1024" height="1024" fill="#fff"/><circle cx="512" cy="540" r="322" fill="#000"/></mask></defs>
<rect width="1024" height="1024" fill="{BG}"/>{stars}
<g mask="url(#{P}behind)"><g transform="rotate(-14 512 560)"><path d="M72 560 A440 104 0 0 1 952 560" fill="none" stroke="{AC}" stroke-width="18" mask="url(#{P}gap)"/>{bead("1;0")}</g></g>
<circle cx="512" cy="540" r="300" fill="{PL}"/>
<g clip-path="url(#{P}pclip)">{surface}<path d="M0 0 H1024 V1024 H0 Z M402 430 m-330 0 a330 330 0 1 0 660 0 a330 330 0 1 0 -660 0 Z" fill="{SH}" fill-rule="evenodd" opacity="0.92"/></g>
<g transform="rotate(-14 512 560)"><path d="M72 560 A440 104 0 0 0 952 560" fill="none" stroke="{AC}" stroke-width="18" mask="url(#{P}gap)"/>{bead("0;1")}</g>
<path d="{T}" fill="{BG}" transform="translate(0 30)"/><path d="{INL}" fill="{AC}" transform="translate(0 30)"/></svg>'''
print(svg.replace('\n', ''))
