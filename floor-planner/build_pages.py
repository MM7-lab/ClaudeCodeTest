"""Build docs/index.html (the GitHub Pages copy) from floor-planner/index.html."""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
page = (root / 'floor-planner' / 'index.html').read_text(encoding='utf-8')
head = ('<!doctype html>\n<html lang="zh-HK">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Cpath d=%22M2 6l5-4 4 4-2 2v6H2z%22 fill=%22%231D5BC9%22/%3E%3C/svg%3E">\n'
        '</head>\n<body>\n')
(root / 'docs' / 'index.html').write_text(head + page + '\n</body>\n</html>\n', encoding='utf-8')
print('wrote docs/index.html')
