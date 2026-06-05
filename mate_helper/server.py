#!/usr/bin/env python3
"""메이트포스 매출 수집 도우미 (로컬 실행용).

월마감 페이지의 "메이트포스에서 가져오기" 버튼이 이 프로그램(localhost:8765)을 호출하면,
메이트포스에 로그인해 지정한 월의 매출 엑셀을 받아 브라우저로 돌려줍니다.
자격증명은 이 폴더의 .env 에만 보관되며 외부로 나가지 않습니다.

flow/selectors 는 저장소의 sales_report.py(이미 검증됨)와 동일합니다.

사용:
  1) pip install -r requirements.txt   &&   playwright install chromium
  2) .env.example 을 .env 로 복사하고 메이트포스 계정 입력
  3) python server.py    (창을 켜둔 채로 사용)
  4) 월마감 페이지에서 월 선택 → "메이트포스에서 가져오기"
"""
import os, base64, calendar, json, tempfile, urllib.parse
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

def _load_env():
    """.env 직접 파싱 (python-dotenv 없어도 동작, 인코딩 자동)."""
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.isfile(p):
        return
    text = None
    for enc in ("utf-8-sig", "utf-8", "cp949"):
        try:
            text = open(p, encoding=enc).read(); break
        except Exception:
            continue
    if text is None:
        return
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip(); v = v.strip().strip('"').strip("'")
        if k:
            os.environ[k] = v
_load_env()

from playwright.sync_api import sync_playwright

PORT = int(os.environ.get("MATE_HELPER_PORT", "8765"))
LOGIN_URL = "https://www.matetech.co.kr/login"
CHANNEL_URL = "https://www.matetech.co.kr/service/saa0060/sales/analysis/order-path"
STORE_URL = "https://www.matetech.co.kr/service/saa0010/sales/analysis/term"


def load_accounts():
    """환경변수에서 계정 목록 로드 (sales_report.py 와 동일 규칙)."""
    accounts = []
    u = os.environ.get("MATETECH_USERNAME", "").strip()
    p = os.environ.get("MATETECH_PASSWORD", "").strip()
    if u and p:
        accounts.append({"username": u, "password": p,
                         "brand": os.environ.get("MATETECH_BRAND", "").strip() or "브랜드 1"})
    i = 2
    while True:
        u = os.environ.get(f"MATETECH_USERNAME_{i}", "").strip()
        p = os.environ.get(f"MATETECH_PASSWORD_{i}", "").strip()
        if not (u and p):
            break
        accounts.append({"username": u, "password": p,
                         "brand": os.environ.get(f"MATETECH_BRAND_{i}", "").strip() or f"브랜드 {i}"})
        i += 1
    return accounts


def month_range(ym):
    """'2026-05' 또는 '202605' → (date(2026,5,1), date(2026,5,31))"""
    ym = ym.replace("-", "").strip()
    y, m = int(ym[:4]), int(ym[4:6])
    last = calendar.monthrange(y, m)[1]
    return date(y, m, 1), date(y, m, last)


def _query_and_download(page, start: date, end: date) -> bytes:
    start_str, end_str = start.strftime("%Y%m%d"), end.strftime("%Y%m%d")
    page.evaluate(
        """({start, end}) => {
            const inputs = document.querySelectorAll('input.hasDatepicker');
            if (inputs.length < 2) throw new Error('datepicker input not found: ' + inputs.length);
            inputs.forEach(i => i.removeAttribute('readonly'));
            inputs[0].value = start; inputs[1].value = end;
            ['input','change','blur'].forEach(ev => inputs.forEach(i => i.dispatchEvent(new Event(ev,{bubbles:true}))));
            if (window.jQuery) window.jQuery(inputs).trigger('change').trigger('blur');
        }""",
        {"start": start_str, "end": end_str},
    )
    page.wait_for_timeout(500)
    page.get_by_role("button", name="검색", exact=True).click()
    try:
        page.wait_for_load_state("networkidle", timeout=60000)
    except Exception:
        pass
    page.wait_for_timeout(2000)
    # 월간 전매장은 파일 생성이 오래 걸림 → 내비게이션 대기 끄고(no_wait_after) 다운로드 자체를 길게 대기
    with page.expect_download(timeout=300000) as dl_info:
        page.get_by_role("button", name="엑셀 다운로드", exact=True).click(no_wait_after=True, timeout=60000)
    download = dl_info.value
    tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
    download.save_as(tmp.name)
    with open(tmp.name, "rb") as f:
        data = f.read()
    try:
        os.unlink(tmp.name)
    except Exception:
        pass
    return data


def _check_store_split(page):
    try:
        page.evaluate(
            """() => {
                const els = document.querySelectorAll('label, span, div');
                for (const el of els) {
                    const txt = (el.textContent || '').trim();
                    if (txt.startsWith('매장별 분리 (일자기준)')) {
                        const cb = el.querySelector('input[type=checkbox]')
                                || (el.parentElement && el.parentElement.querySelector('input[type=checkbox]'));
                        if (cb && !cb.checked) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); }
                        return;
                    }
                }
            }"""
        )
    except Exception as e:
        print("  매장별 분리 체크 실패(계속):", e)


def fetch(month, typ):
    start, end = month_range(month)
    accounts = load_accounts()
    if not accounts:
        raise RuntimeError(".env 에 MATETECH_USERNAME/PASSWORD 가 없습니다.")
    files = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for acc in accounts:
            ctx = browser.new_context(accept_downloads=True)
            page = ctx.new_page()
            print(f"[{acc['brand']}] 로그인…")
            page.goto(LOGIN_URL)
            page.fill("#member-id", acc["username"])
            page.fill("#member-pw", acc["password"])
            page.click("#member-btn")
            page.wait_for_load_state("networkidle")
            if typ == "channel":
                page.goto(CHANNEL_URL); page.wait_for_load_state("networkidle")
            else:
                page.goto(STORE_URL); page.wait_for_load_state("networkidle")
                page.wait_for_timeout(1000); _check_store_split(page); page.wait_for_timeout(300)
            print(f"[{acc['brand']}] {start}~{end} 다운로드…")
            data = _query_and_download(page, start, end)
            files.append({"brand": acc["brand"], "name": f"{acc['brand']}_{typ}_{month}.xlsx",
                          "b64": base64.b64encode(data).decode("ascii")})
            ctx.close()
        browser.close()
    return files


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/ping":
            self.send_response(200); self._cors()
            self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "accounts": len(load_accounts())}).encode())
            return
        if u.path == "/fetch":
            q = urllib.parse.parse_qs(u.query)
            month = (q.get("month", [""])[0]).strip()
            typ = (q.get("type", ["store"])[0]).strip()
            try:
                if not month:
                    raise ValueError("month 파라미터가 필요합니다 (예: 2026-05)")
                files = fetch(month, typ)
                body = json.dumps({"ok": True, "month": month, "type": typ, "files": files}).encode()
                self.send_response(200)
            except Exception as e:
                body = json.dumps({"ok": False, "error": str(e)}).encode()
                self.send_response(500)
            self._cors()
            self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(body)
            return
        # 정적 파일 서빙(같은 출처로 페이지를 열면 CORS 문제 없음)
        rel = urllib.parse.unquote(u.path).lstrip("/") or "index.html"   # 한글 파일명 디코드
        safe = os.path.normpath(rel).lstrip(os.sep)
        fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), safe)
        if os.path.isfile(fp) and (fp.endswith(".html") or fp.endswith(".js") or fp.endswith(".css")):
            ctype = "text/html; charset=utf-8" if fp.endswith(".html") else ("application/javascript" if fp.endswith(".js") else "text/css")
            with open(fp, "rb") as f:
                body = f.read()
            self.send_response(200); self._cors()
            self.send_header("Content-Type", ctype); self.end_headers(); self.wfile.write(body)
            return
        self.send_response(404); self._cors(); self.end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    accs = load_accounts()
    print(f"메이트포스 수집 도우미 실행 — http://localhost:{PORT}")
    print(f"계정 {len(accs)}개 로드: {', '.join(a['brand'] for a in accs) or '없음(.env 확인)'}")
    print("이 창을 켜둔 채로 월마감 페이지에서 '메이트포스에서 가져오기'를 누르세요. (종료: Ctrl+C)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
