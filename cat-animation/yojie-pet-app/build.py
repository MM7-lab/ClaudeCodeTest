"""Builds pet.html from pet.src.html, with her two pictures embedded (a file:// page may not hand them to WebGL)."""
import base64, os
HERE = os.path.dirname(os.path.abspath(__file__))
uri = lambda f: "data:image/webp;base64," + base64.b64encode(open(os.path.join(HERE, "art", f), "rb").read()).decode()
page = open(os.path.join(HERE, "pet.src.html"), encoding="utf-8").read()
page = page.replace("@@BASE@@", uri("yojie_base.webp")).replace("@@GLANCE@@", uri("yojie_glance.webp"))
open(os.path.join(HERE, "pet.html"), "w", encoding="utf-8").write(page)
print("pet.html", len(page))
