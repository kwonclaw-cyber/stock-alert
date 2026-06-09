"""배민 변경이력 자동수집기.

사용자는 '로그인'만 하면 된다. 그 다음 스크립트가 self-api.baemin.com 의
변경이력 API들을 직접 호출해 최근 6개월치를 전부(모든 페이지) 받아온다.
- 가게(운영시간/주문안내/주문금액·배달팁 등): /v1/modify-history/shop
- 즉시할인:                                   /v1/modify-history/instant-discount
- 광고(노출 ON/OFF, 입찰·예산):              /v1/modify-history/ad-campaign
- 메뉴할인:                                   /v1/menu-sys/.../promotions/history

받은 응답은 network/ 폴더(캡처와 동일 형식)에 저장하고,
parse_baemin.py 로 한 장의 표(CSV/XLSX)까지 자동 생성한다.

흐름:
  python baemin_history.py
  → 브라우저에서 로그인
  → (인증/매장ID 수집을 위해) '가게·즉시할인·광고·메뉴할인' 탭을 한 번씩 눌러 '조회'
  → 터미널에서 Enter
  → 자동수집 + 표 생성
  → 다음 매장은 'next', 끝은 'quit'
"""

import json
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

import parse_baemin  # 같은 폴더

API = "https://self-api.baemin.com"
HISTORY_PAGE = "https://self.baemin.com/history/change/shop"
OUT_ROOT = Path(__file__).parent / "auto_captures"

# 광고 변경이력 타입(캠페인마다 가능한 타입이 달라서 알려진 것 모두 시도)
AD_HISTORY_TYPES = ["LISTING_INVENTORY_DISPLAY_PAUSE", "CPC_BUDGET"]

# 헤더 복사 시 제외(요청 라이브러리가 알아서 채우는 것들)
DROP_HEADERS = {"host", "content-length", "accept-encoding", "connection",
                "cookie", "content-type"}


def slug(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"[^\w가-힣._-]+", "_", text)
    return text.strip("_") or "unnamed"


def ask(prompt: str) -> str:
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print("\n중단합니다.")
        sys.exit(0)


class Sniffer:
    """로그인 후 오가는 self-api 트래픽에서 인증 헤더와 매장/업주 ID를 수집.

    request/response 이벤트 + 새 탭(page)까지 모두 청취해 놓치지 않게 한다.
    """

    def __init__(self):
        self.headers = None
        self.auth = None          # Authorization 토큰(있으면)
        self.shop_numbers = set()
        self.shop_owners = set()
        self.seen = 0
        self.sample_urls = []

    def _scan_url(self, url):
        if "self-api.baemin.com" not in url:
            return
        self.seen += 1
        if len(self.sample_urls) < 10:
            self.sample_urls.append(url)
        for m in re.findall(r"shopNumber=(\d+)", url):
            self.shop_numbers.add(m)
        for m in re.findall(r"shopOwnerNo=(\d+)", url):
            self.shop_owners.add(m)
        for m in re.findall(r"/shop-owners/(\d+)/", url):
            self.shop_owners.add(m)

    def _grab_headers(self, request):
        try:
            if request is None or "self-api.baemin.com" not in request.url:
                return
            h = request.all_headers()
            clean = {k: v for k, v in h.items()
                     if k.lower() not in DROP_HEADERS and not k.startswith(":")}
            if h.get("authorization"):
                self.headers = clean          # 인증 헤더 있는 게 최우선
                self.auth = h.get("authorization")
            elif self.headers is None:
                self.headers = clean
        except Exception:
            pass

    def on_request(self, request):
        try:
            self._scan_url(request.url)
            self._grab_headers(request)
        except Exception:
            pass

    def on_response(self, response):
        try:
            self._scan_url(response.url)
            self._grab_headers(response.request)
        except Exception:
            pass

    def attach(self, ctx):
        ctx.on("request", self.on_request)
        ctx.on("response", self.on_response)
        # 로그인 시 새로 열리는 탭에도 직접 리스너를 건다
        def _on_page(page):
            page.on("request", self.on_request)
            page.on("response", self.on_response)
        ctx.on("page", _on_page)


def date_range_6m():
    end = date.today()
    start = end - timedelta(days=183)
    return start.isoformat(), end.isoformat()


class Fetcher:
    """로그인된 '페이지 안에서' fetch 를 실행해 데이터를 가져온다.

    바깥(요청 라이브러리)에서 흉내내면 배민이 403으로 막는다. 페이지 내부에서
    fetch(credentials:'include') 하면 쿠키·Origin·Referer 가 그대로 따라가고,
    캡처한 Authorization 토큰까지 얹어 인증을 통과한다.
    """

    JS_FETCH = """
    async ({url, auth}) => {
        const headers = {'Accept': 'application/json'};
        if (auth) headers['Authorization'] = auth;
        try {
            const r = await fetch(url, {headers, credentials: 'include'});
            const body = await r.text();
            return {status: r.status, body: body};
        } catch (e) {
            return {status: -1, body: String(e)};
        }
    }
    """

    def __init__(self, page, auth, net_dir: Path):
        self.page = page
        self.auth = auth
        self.net_dir = net_dir
        self.net_dir.mkdir(parents=True, exist_ok=True)
        self.n = 0

    def get(self, url, save_name=None):
        """페이지 내부 fetch → JSON 반환. 응답은 network 폴더에 저장."""
        res = None
        for attempt in range(2):
            try:
                res = self.page.evaluate(self.JS_FETCH, {"url": url, "auth": self.auth})
                break
            except Exception as e:
                if attempt == 0 and "context was destroyed" in str(e):
                    # 페이지가 막 이동 중이었으면 잠시 안정시킨 뒤 재시도
                    try:
                        self.page.wait_for_load_state("networkidle", timeout=8000)
                    except Exception:
                        pass
                    continue
                print(f"    ! 요청 실패: {e}  ({url[:90]})")
                return None
        if res is None:
            return None
        status = res.get("status")
        body = res.get("body") or ""
        if save_name:
            self.n += 1
            meta = {"url": url, "status": status, "captured_at": datetime.now().isoformat()}
            fp = self.net_dir / f"{self.n:03d}__{slug(save_name)}.json"
            fp.write_text("// " + json.dumps(meta, ensure_ascii=False) + "\n" + body,
                          encoding="utf-8")
        if not isinstance(status, int) or status < 200 or status >= 300:
            print(f"    ! 상태 {status}: {url[:90]}")
            return None
        try:
            return json.loads(body)
        except Exception:
            return None

    def paginate_cursor(self, base_url, save_name, cursor_param="cursorId"):
        """nextCursorId/hasNext 방식 페이지네이션. 모든 content 수집."""
        total = 0
        url = base_url
        for _ in range(500):  # 안전 상한
            data = self.get(url, save_name)
            if not isinstance(data, dict):
                break
            content = data.get("content") or []
            total += len(content)
            if not data.get("hasNext"):
                break
            nxt = data.get("nextCursorId")
            if nxt in (None, "", 0):
                break
            sep = "&" if "?" in base_url else "?"
            url = f"{base_url}{sep}{cursor_param}={nxt}"
            time.sleep(0.2)
        return total

    def paginate_page(self, base_url, save_name):
        """page/size 방식(메뉴할인). last==true 또는 빈 페이지까지."""
        total = 0
        for p in range(0, 500):
            sep = "&" if "?" in base_url else "?"
            url = f"{base_url}{sep}page={p}"
            data = self.get(url, save_name)
            if not isinstance(data, dict):
                break
            d = data.get("data", data)
            content = d.get("content") or []
            total += len(content)
            if d.get("last", True) or not content:
                break
            time.sleep(0.2)
        return total


def crawl_shop(fetcher, sn, s, e):
    base = f"{API}/v1/modify-history/shop?shopNumber={sn}&modifiedStartDate={s}&modifiedEndDate={e}&size=100"
    n = fetcher.paginate_cursor(base, f"shop_{sn}")
    print(f"    · 가게 변경이력: {n}건")


def crawl_instant_discount(fetcher, sn, s, e):
    base = f"{API}/v1/modify-history/instant-discount?shopNumber={sn}&status=ALL&modifiedStartDate={s}&modifiedEndDate={e}&size=100"
    n = fetcher.paginate_cursor(base, f"instant-discount_{sn}")
    print(f"    · 즉시할인 변경이력: {n}건")


def crawl_ads(fetcher, sn, s, e):
    camps = fetcher.get(
        f"{API}/v2/ad-center/ad-campaigns/operating-ad-campaign/by-shop-number?shopNumber={sn}",
        f"ad-campaigns_list_{sn}",
    )
    if not isinstance(camps, list):
        print("    · 광고: 캠페인 목록 없음")
        return
    total = 0
    for c in camps:
        cid = c.get("id")
        if not cid:
            continue
        types = set(AD_HISTORY_TYPES)
        poss = fetcher.get(
            f"{API}/v1/ad-listing/listing-inventory/shops/{sn}/ad-campaigns/{cid}/possible-history-type-with-label",
            None,
        )
        if isinstance(poss, list):
            for t in poss:
                if t.get("key"):
                    types.add(t["key"])
        for ht in types:
            base = (f"{API}/v1/modify-history/ad-campaign?shopNumber={sn}"
                    f"&adCampaignId={cid}&historyType={ht}"
                    f"&modifiedStartDate={s}&modifiedEndDate={e}&size=100")
            total += fetcher.paginate_cursor(base, f"ad-campaign_{sn}_{cid}_{ht}")
    print(f"    · 광고 변경이력: {total}건 ({len(camps)}개 캠페인)")


def crawl_menu_promotion(fetcher, owner, s, e):
    base = (f"{API}/v1/menu-sys/promotion/v1/shop-owners/{owner}/promotions/history"
            f"?fromDate={s}&toDate={e}&size=100")
    n = fetcher.paginate_page(base, f"promotion_{owner}")
    print(f"    · 메뉴할인 변경이력: {n}건")


def capture_one_store(browser, run_dir: Path):
    brand = ask("\n브랜드명 (예: 브랜드A): ")
    store = ask("매장명 (예: 강남점): ")
    store_dir = run_dir / slug(brand) / slug(store)
    net_dir = store_dir / "network"
    net_dir.mkdir(parents=True, exist_ok=True)

    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    sniffer = Sniffer()
    sniffer.attach(ctx)
    page = ctx.new_page()
    page.on("request", sniffer.on_request)
    page.on("response", sniffer.on_response)
    try:
        page.goto(HISTORY_PAGE)
    except Exception as e:
        print(f"  (페이지 이동 경고): {e}")

    print(f"\n=== [{brand} / {store}] 배민 ===")
    print("1) 브라우저에서 로그인하세요 (2FA 포함).")
    print("2) ★중요★ '가게' 탭을 누르고 파란 '조회' 버튼을 꼭 한 번 누르세요.")
    print("   (이때 인증 토큰과 매장번호가 잡힙니다. 이걸 안 누르면 403이 납니다.)")
    print("   → 즉시할인·광고는 스크립트가 알아서 가져오니 더 누를 필요 없습니다.")
    print("3) 그 다음 아래에서 Enter 를 누르면 6개월치를 자동수집합니다.")

    while True:
        cmd = ask("\n[명령] Enter=수집시작 / next=다음매장 / quit=종료 > ").lower()
        if cmd in ("quit", "q"):
            ctx.close()
            return False
        if cmd in ("next", "n"):
            ctx.close()
            return True

        # 매장번호 확보: 자동수집 실패 시 화면에 보이는 번호를 직접 입력받음
        if not sniffer.shop_numbers:
            print(f"  (진단) self-api 트래픽 {sniffer.seen}건 관측됨.")
            for u in sniffer.sample_urls:
                print("    ·", u[:110])
            print("  매장번호를 자동으로 못 잡았습니다.")
            manual = ask("  광고탭 첫 칸에 보이는 매장번호 8자리를 입력하세요 (예: 14323681): ")
            manual = re.sub(r"\D", "", manual)
            if not manual:
                print("  매장번호가 없으면 진행할 수 없어요. '가게' 탭에서 조회 후 다시 시도하세요.")
                continue
            sniffer.shop_numbers.add(manual)

        if sniffer.auth is None:
            print("  ! 인증 토큰(Authorization)을 아직 못 잡았습니다.")
            print("    → '가게' 탭을 누르고 파란 '조회'를 한 번 누른 뒤, 다시 Enter 하세요.")
            print("    (그래도 진행은 해보지만 403이 나면 위 방법으로 토큰을 잡아야 합니다.)")

        # 로그인된 self.baemin.com 페이지 안에서 fetch 실행 (쿠키·인증 그대로 사용)
        print("  (열린 페이지 목록)")
        for pg in ctx.pages:
            try:
                print("    ·", (pg.url or "")[:90])
            except Exception:
                pass

        # self.baemin.com 페이지를 고르고, 같은 출처를 보장하기 위해 변경이력 페이지로 확정
        live = None
        for pg in ctx.pages:
            try:
                if not pg.is_closed() and (pg.url or "").startswith("https://self.baemin.com"):
                    live = pg
            except Exception:
                continue
        live = live or page
        try:
            live.bring_to_front()
            live.goto(HISTORY_PAGE, wait_until="domcontentloaded")
            live.wait_for_load_state("networkidle", timeout=15000)
        except Exception as ex:
            print(f"    (페이지 확정 경고): {ex}")
        print(f"  수집에 사용할 페이지: {(live.url or '')[:90]}")

        s, e = date_range_6m()
        fetcher = Fetcher(live, sniffer.auth, net_dir)
        print(f"\n  수집 시작: 매장ID {sorted(sniffer.shop_numbers)}, 기간 {s} ~ {e}")
        for sn in sorted(sniffer.shop_numbers):
            print(f"  [매장번호 {sn}]")
            crawl_shop(fetcher, sn, s, e)
            crawl_instant_discount(fetcher, sn, s, e)
            crawl_ads(fetcher, sn, s, e)
        for owner in sorted(sniffer.shop_owners):
            print(f"  [업주번호 {owner}]")
            crawl_menu_promotion(fetcher, owner, s, e)

        # 표로 정리
        rows = parse_baemin.parse_records(str(net_dir))
        out_base = str(store_dir / f"{slug(brand)}_{slug(store)}_변경이력")
        parse_baemin.write_outputs(rows, out_base)
        print(f"\n  ✓ 완료: {store_dir}")
        print("    (network/ 원본 + 변경이력 표 CSV/XLSX 저장됨)")
        # 같은 매장에서 더 받을 일은 없으니 다음으로
        ctx.close()
        return True


def main():
    run_dir = OUT_ROOT / datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir.mkdir(parents=True, exist_ok=True)
    print("배민 변경이력 자동수집 시작")
    print(f"저장 위치: {run_dir}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        more = True
        while more:
            more = capture_one_store(browser, run_dir)
        browser.close()
    print(f"\n전체 완료! 폴더를 압축해서 올려주세요:\n  {run_dir}")


if __name__ == "__main__":
    main()
