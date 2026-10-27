"""Build the studio page and the desktop pet page for one character.

    python3 build.py                      # the polar bear (default)
    python3 build.py my-character         # characters/my-character/character.svg.html (+ rig.js, if it has one)

Outputs (paths are relative to this folder; set in characters/<name>/build.json, or the defaults below):
    studio page  -> ../bear-onesie-studio/index.html
    desktop pet  -> ../bear-pet-app/pet.html
build.json may also have "replace": {"text in the built page": "new text"} for titles and labels (each must be found).
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
# a character's own rig.js (joints, poses, arms) runs after the engine and before the taps are wired up
rig_js = os.path.join(cdir, "rig.js")
engine = src("engine.js") + (open(rig_js, encoding="utf-8").read() if os.path.exists(rig_js) else "") + src("input.js")

for template, ui, key in [("studio.html", "ui-studio.js", "studio"), ("desk.html", "ui-desk.js", "pet")]:
    if not cfg.get(key):
        continue
    page = src(template)
    assert page.count("@@CHARACTER@@") == 1 and page.count("@@SCRIPT@@") == 1, template
    page = page.replace("@@CHARACTER@@", character).replace("@@SCRIPT@@", engine + src(ui))
    for old, new in cfg.get("replace", {}).items():
        if old in page:
            page = page.replace(old, new)
        elif not any(old in src(f) for f in ("studio.html", "desk.html", "engine.js", "input.js", "ui-studio.js", "ui-desk.js")):
            sys.exit(f"build.json replace: {old!r} is not in any page")
    out = os.path.normpath(os.path.join(HERE, cfg[key]))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(page)
    print(out, len(page))
