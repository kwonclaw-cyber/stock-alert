#!/usr/bin/env python3
"""pnl 단일 파일 빌드.

index.html 의 외부 <script src="vendor/html2canvas.min.js"> 를 실제 내용으로
인라인하여, 인터넷 없이 더블클릭만으로 동작하는 자체완결형 '손익계산서.html' 을 생성한다.

사용법:  python3 build_single.py
"""
import re
import pathlib

ROOT = pathlib.Path(__file__).parent
html = (ROOT / "index.html").read_text(encoding="utf-8")

SRCS = ["vendor/html2canvas.min.js"]
for src in SRCS:
    content = (ROOT / src).read_text(encoding="utf-8").replace("</script>", "<\\/script>")
    tag = re.compile(r'<script src="' + re.escape(src) + r'"></script>')
    if not tag.search(html):
        raise SystemExit(f"script 태그를 찾지 못함: {src}")
    repl = f"<script>/* inlined: {src} */\n{content}\n</script>"
    html = tag.sub(lambda m: repl, html, count=1)

out = ROOT / "손익계산서.html"
out.write_text(html, encoding="utf-8")
print(f"생성 완료: {out}  ({len(html):,} chars)")
