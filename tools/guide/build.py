#!/usr/bin/env python3
# Builds the How-to-play guide (the Field Manual) from template.html and assets.json (images, as data URLs, keyed
# by the %%name%% placeholders in the template). Writes how-to-play.html at the repo root, and with a second argument
# also the bare page for publishing as an artifact. Run: python3 tools/guide/build.py [artifact-out.html]
import json, os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(here, 'template.html')).read()
assets = json.load(open(os.path.join(here, 'assets.json')))
missing = sorted(set(re.findall(r'%%(\w+)%%', tpl)) - set(assets))
if missing: sys.exit('missing assets: ' + ', '.join(missing))
page = re.sub(r'%%(\w+)%%', lambda m: assets[m.group(1)], tpl)
if len(sys.argv) > 1: open(sys.argv[1], 'w').write(page)
head, body = page.split('</style>', 1)
head = head.replace('<style>', '<style>\n:root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }', 1)
full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head + '</style>\n\n</head>\n<body>' + body.rstrip() + '\n</body>\n</html>\n')
open(os.path.join(here, '..', '..', 'how-to-play.html'), 'w').write(full)
print('ok', len(page), len(full))
