"""Build the studio page and the desktop pet page for one character.

    python3 build.py                      # the polar bear (default)
    python3 build.py my-character         # characters/my-character/character.svg.html

Outputs (paths are relative to this folder; set in characters/<name>/build.json, or the defaults below):
    studio page  -> ../bear-onesie-studio/index.html
    desktop pet  -> ../bear-pet-app/pet.html
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[1] if len(sys.argv) > 1 else "polar-bear"
cdir = os.path.join(HERE, "characters", name)
cfg = {"studio": "../bear-onesie-studio/index.html", "pet": "../bear-pet-app/pet.html"}
if os.path.exists(os.path.join(cdir, "build.json")):
    cfg.update(json.load(open(os.path.join(cdir, "build.json"))))

src = lambda f: open(os.path.join(HERE, "src", f), encoding="utf-8").read()
character = open(os.path.join(cdir, "character.svg.html"), encoding="utf-8").read().rstrip("\n")
engine = src("engine.js") + src("input.js")

for template, ui, key in [("studio.html", "ui-studio.js", "studio"), ("desk.html", "ui-desk.js", "pet")]:
    if not cfg.get(key):
        continue
    page = src(template)
    assert page.count("@@CHARACTER@@") == 1 and page.count("@@SCRIPT@@") == 1, template
    page = page.replace("@@CHARACTER@@", character).replace("@@SCRIPT@@", engine + src(ui))
    out = os.path.normpath(os.path.join(HERE, cfg[key]))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(page)
    print(out, len(page))
