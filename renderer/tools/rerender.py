"""Re-render files listed in jobs.txt and, optionally, check them against the shipped files.

usage: python3 tools/rerender.py [options] [REGEX ...]
  REGEX            only the files whose path matches one of these (re.search), e.g. 'buildings/smelter' 'tod/night/units/truck'
  --out DIR        working folder (default out/rerender): raw/<time>/ renders, fin/<time>/ finished files, art/ the rebuilt art
  --shipped DIR    compare every rebuilt file with the shipped one found under DIR (any layout: matched by path, then by name)
  --list           print the selected lines and stop
  --force          re-render even if a raw render is already in the working folder
  --chunk N        jobs per browser launch (default 10)

Run it from the package folder. Exit code 1 if any compared file differs."""
import sys, os, re, shlex, shutil, subprocess, json, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
opt = {'out': os.path.join(ROOT, 'out', 'rerender'), 'shipped': None, 'chunk': '10'}
flags, pats = set(), []
i = 0
while i < len(args):
    a = args[i]
    if a in ('--out', '--shipped', '--chunk'): opt[a[2:]] = args[i + 1]; i += 2
    elif a in ('--list', '--force'): flags.add(a[2:]); i += 1
    else: pats.append(a); i += 1
OUT = os.path.abspath(opt['out']); ART = os.path.join(OUT, 'art'); TW = os.path.join(OUT, 'terrain-work')
CHUNK = int(opt['chunk'])

# ---------------------------------------------------------------- read jobs.txt
E = []
for line in open(os.path.join(ROOT, 'jobs.txt')):
    if line.startswith('#') or not line.strip(): continue
    f, ren, jobs, fin = line.rstrip('\n').split('\t')
    m = re.match(r'art/tod/(morning|evening|night)/', f)
    E.append({'file': f, 'ren': ren, 'jobs': [] if jobs == '-' else jobs.split(' '), 'steps': fin.split(' | '), 'tod': m.group(1) if m else 'day'})
if pats:
    ALL_E, E = E, [e for e in E if any(re.search(p, e['file']) for p in pats)]
    # pull in what the selected files need: the wall post (arm shadows) and the day robot sprites (headlights)
    need = set()
    for e in E:
        for s in e['steps']:
            m = re.search(r'--post (\S+)', s)
            if m: need.add((e['tod'], f'walls/{m.group(1)}.png'))
            if 'headlights.py' in s: need |= {('day', f'art/units/{r}@0-f0.png') for r in ('worker', 'hauler', 'agribot', 'paver', 'warbot')}
    have = {id(e) for e in E}
    E += [e for e in ALL_E if id(e) not in have and any(e['tod'] == t and e['file'].endswith(x) for t, x in need)]
if not E: sys.exit('nothing matches')
if 'list' in flags:
    for e in E: print(e['file'], e['ren'], ' '.join(e['jobs']), ' | '.join(e['steps']), sep='\t')
    sys.exit(0)

def outname(e, j): return j.split(':')[1] if e['ren'] == 'walls' else j.split(':')[3]
def is_compose(s): return s.split()[0] in ('compose.py', 'compose_any.py', 'compose2.py', 'walls/compose_walls.py')
def raw(t): return os.path.join(OUT, 'raw', t)
def fin(t): return os.path.join(OUT, 'fin', t)
def sub(s, t): return s.replace('{raw}', raw(t)).replace('{fin}', fin(t)).replace('{art}', ART).replace('{tod}', t)
LOG = None
def run(cmd, cwd=ROOT):
    print('  $', ' '.join(cmd)[:220], flush=True)
    r = subprocess.run(cmd, cwd=cwd, stdout=LOG, stderr=subprocess.STDOUT)
    if r.returncode: print(f'  ! exit {r.returncode} (see {LOG.name})', flush=True)
def py(step, t, cwd=ROOT):
    w = shlex.split(sub(step, t))
    if w[0] == 'cp': os.makedirs(os.path.dirname(w[2]), exist_ok=True); shutil.copy(w[1], w[2]); return
    if os.path.exists(os.path.join(ROOT, w[0])): w[0] = os.path.join(ROOT, w[0])
    run([sys.executable] + w, cwd)

os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, 'rerender.log'), 'a')
t0 = time.time()
TODS = [t for t in ('day', 'morning', 'evening', 'night') if any(e['tod'] == t for e in E)]

# ---------------------------------------------------------------- 1. render
for t in TODS:
    os.makedirs(raw(t), exist_ok=True); os.makedirs(fin(t), exist_ok=True)
    for ren, runner in (('main', 'run.js'), ('walls', 'walls/run.js')):
        todo = {}
        for e in E:
            if e['tod'] != t or e['ren'] != ren: continue
            for j in e['jobs']:
                n = outname(e, j)
                if n in todo and todo[n] != j: sys.exit(f'two different jobs write {n}: {todo[n]} / {j}')
                todo[n] = j
        todo = [j for n, j in todo.items() if 'force' in flags or not os.path.exists(os.path.join(raw(t), f'{n}.beauty.png'))]
        if todo: print(f'[{t}] rendering {len(todo)} jobs with {runner}', flush=True)
        for k in range(0, len(todo), CHUNK):
            run(['node', runner, raw(t)] + todo[k:k + CHUNK])

# ---------------------------------------------------------------- 2. compose
for t in TODS:
    groups = {}
    for e in E:
        if e['tod'] == t and e['steps'] and is_compose(e['steps'][0]):
            for j in e['jobs']: groups.setdefault(e['steps'][0], []).append(outname(e, j))
    for step, names in groups.items():
        w = step.split(); names = list(dict.fromkeys(names))
        print(f'[{t}] {w[0]} {len(names)} renders', flush=True)
        for k in range(0, len(names), 24):
            run([sys.executable, w[0], raw(t)] + names[k:k + 24] + w[1:])

# ---------------------------------------------------------------- 3. finishing steps that work on renders
def post_steps(e): return [s for s in (e['steps'][1:] if e['steps'][0] == 'none' or is_compose(e['steps'][0]) else e['steps'])]
done = set()
for t in TODS:
    for e in E:
        if e['tod'] != t: continue
        if any('{art}' in s for s in post_steps(e)): continue      # runs after the art folder is collected (step 5)
        for s in post_steps(e):
            key = sub(s, t)
            if key in done: continue
            done.add(key); print(f'[{t}] {s.split()[0]}', flush=True)
            if s.startswith('terrain/'):
                os.makedirs(TW, exist_ok=True); py(s, t, cwd=TW)
            else: py(s, t)

# ---------------------------------------------------------------- 4. collect
def dest(e): return os.path.join(OUT, e['file'])
def source(e):
    t, f = e['tod'], e['file']; b = os.path.basename(f)
    cands = [os.path.join(fin(t), b), os.path.join(fin(t), f), os.path.join(fin(t), 'nuke-blast', f.split('nuke-blast/', 1)[-1])]
    if any(s.startswith('terrain/') for s in e['steps']):
        cands += [os.path.join(TW, 'out', f), os.path.join(TW, 'out', 'canyon', b)]
    if e['jobs'] and len(e['jobs']) == 1:
        n = outname(e, e['jobs'][0]); m = re.search(r'-spark-f(\d)\.png$', b)
        cands.append(os.path.join(raw(t), f'{n}.spark-{m.group(1)}.png' if m else f'{n}.png'))
    if not post_steps(e): cands = cands[-1:]          # a plain render: only the composite counts
    return next((c for c in cands if os.path.exists(c)), None)
missing = []
def collect(es):
    for e in es:
        s = source(e)
        if s is None: missing.append(e['file']); continue
        os.makedirs(os.path.dirname(dest(e)), exist_ok=True); shutil.copy(s, dest(e))
collect(E)

# ---------------------------------------------------------------- 5. finishing steps that work on the rebuilt art folder
late = [e for e in E if any('{art}' in s for s in post_steps(e))]
for e in late:
    for s in post_steps(e):
        key = sub(s, e['tod'])
        if key not in done:
            done.add(key); print(f'[{e["tod"]}] {s.split()[0]}', flush=True); py(s, e['tod'])
for e in late:
    b = os.path.basename(e['file'])
    if os.path.exists(os.path.join(fin(e['tod']), b)):
        os.makedirs(os.path.dirname(dest(e)), exist_ok=True); shutil.copy(os.path.join(fin(e['tod']), b), dest(e))
missing = [m for m in missing if not os.path.exists(os.path.join(OUT, m))]
print(f'rebuilt {len(E) - len(missing)} of {len(E)} files in {time.time() - t0:.0f}s -> {OUT}')
for m in missing: print('  MISSING', m)

# ---------------------------------------------------------------- 6. compare with the shipped files
if opt['shipped']:
    import numpy as np
    from PIL import Image
    SH = os.path.abspath(opt['shipped'])
    index = {}
    for dp, _, fs in os.walk(SH):
        for fn in fs: index.setdefault(fn, []).append(os.path.relpath(os.path.join(dp, fn), SH))
    def find(e):
        f = e['file']
        for c in (f, f[4:] if f.startswith('art/') else f):
            if os.path.exists(os.path.join(SH, c)): return os.path.join(SH, c)
        c = index.get(os.path.basename(f), [])
        if e['tod'] != 'day': c = [p for p in c if f'/{e["tod"]}/' in '/' + p]
        elif not f.startswith('art/tod/'): c = [p for p in c if not re.search(r'(^|/)(morning|evening|night)(/|$)', p)]
        if not c: return None
        parts = f.split('/')
        c.sort(key=lambda p: -sum(1 for a, b in zip(reversed(p.split('/')), reversed(parts)) if a == b))
        return os.path.join(SH, c[0])
    rows, bad, same, nship = [], 0, 0, 0
    for e in E:
        mine = dest(e)
        if not os.path.exists(mine): continue
        s = find(e)
        if s is None: rows.append((e['file'], 'not shipped here', '', '')); continue
        nship += 1
        if mine.endswith('.json'):
            ok = json.load(open(mine)) == json.load(open(s)); rows.append((e['file'], 'same' if ok else 'DIFFERENT', '', s))
        else:
            a = np.asarray(Image.open(mine).convert('RGBA')).astype(np.int16); b = np.asarray(Image.open(s).convert('RGBA')).astype(np.int16)
            if a.shape != b.shape: ok = False; rows.append((e['file'], f'DIFFERENT size {a.shape[1]}x{a.shape[0]} vs {b.shape[1]}x{b.shape[0]}', '', s))
            else:
                d = np.abs(a - b).max(-1); ok = d.max() == 0
                rows.append((e['file'], 'identical' if ok else 'DIFFERENT', f'max {d.max()}, {int((d > 0).sum())} px', s))
        same += ok; bad += not ok
    with open(os.path.join(OUT, 'report.tsv'), 'w') as fp:
        for r in rows: fp.write('\t'.join(map(str, r)) + '\n')
    for r in rows:
        if r[1] not in ('identical', 'same'): print(f'  {r[1]:16s} {r[0]}  {r[2]}')
    print(f'compared {nship}: {same} identical, {bad} different, {len(rows) - nship} with no shipped copy found  (report: {OUT}/report.tsv)')
    sys.exit(1 if bad else 0)
