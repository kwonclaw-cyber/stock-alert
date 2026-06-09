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
ROOT_PAGE = "https://self.baemin.com/"
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


def attach_response_saver(ctx, net_dir: Path):
    """사용자가 직접 조회한 화면의 변경이력 응답을 그대로 저장(안전장치).

    자동 fetch 가 막혀도, 사용자가 탭에서 '조회'한 만큼은 이걸로 건진다.
    """
    net_dir.mkdir(parents=True, exist_ok=True)
    counter = {"n": 0}

    def on_resp(resp):
        try:
            url = resp.url
            if "self-api.baemin.com" not in url:
                return
            if not any(k in url for k in (
                "modify-history", "promotions/history",
                "operating-ad-campaign", "possible-history-type")):
                return
            body = resp.text()
            if not body:
                return
            counter["n"] += 1
            name = slug(url.split("?")[0].split("/")[-1] or "resp")[:50]
            fp = net_dir / f"live_{counter['n']:03d}__{name}.json"
            meta = {"url": url, "status": resp.status, "captured_at": datetime.now().isoformat()}
            fp.write_text("// " + json.dumps(meta, ensure_ascii=False) + "\n" + body,
                          encoding="utf-8")
        except Exception:
            pass

    ctx.on("response", on_resp)


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


class StoreState:
    """응답 저장기가 '현재 매장의 network 폴더'를 알도록 공유하는 상태."""
    def __init__(self):
        self.net_dir = None
        self.counter = 0


def attach_dynamic_saver(ctx, state: StoreState):
    """사용자가 조회한 변경이력 응답을 현재 매장 폴더에 그대로 저장(안전장치)."""
    def on_resp(resp):
        try:
            if state.net_dir is None:
                return
            url = resp.url
            if "self-api.baemin.com" not in url:
                return
            if not any(k in url for k in (
                "modify-history", "promotions/history",
                "operating-ad-campaign", "possible-history-type")):
                return
            body = resp.text()
            if not body:
                return
            state.counter += 1
            state.net_dir.mkdir(parents=True, exist_ok=True)
            name = slug(url.split("?")[0].split("/")[-1] or "resp")[:50]
            fp = state.net_dir / f"live_{state.counter:03d}__{name}.json"
            meta = {"url": url, "status": resp.status, "captured_at": datetime.now().isoformat()}
            fp.write_text("// " + json.dumps(meta, ensure_ascii=False) + "\n" + body,
                          encoding="utf-8")
        except Exception:
            pass

    ctx.on("response", on_resp)


def open_browser(p):
    """로그인을 기억하는 persistent 브라우저. 실제 Chrome 우선, 없으면 기본 chromium."""
    profile = OUT_ROOT / "_browser_profile"
    profile.mkdir(parents=True, exist_ok=True)
    last = None
    for ch in ("chrome", "msedge", None):
        try:
            ctx = p.chromium.launch_persistent_context(
                str(profile),
                channel=ch,
                headless=False,
                no_viewport=True,
                args=["--start-maximized"],
            )
            print(f"  브라우저: {ch or '기본 chromium'} (로그인 기억됨)")
            return ctx
        except Exception as e:
            last = e
            print(f"  ({ch or 'chromium'} 실행 불가: {str(e)[:70]})")
    raise RuntimeError(f"브라우저 실행 실패: {last}")


def _find_live_page(ctx):
    """로그인된 self.baemin.com 페이지(로그인 페이지 제외) 중 가장 최근 것."""
    live = None
    for pg in ctx.pages:
        try:
            u = pg.url or ""
            if (not pg.is_closed() and u.startswith("https://self.baemin.com")
                    and "login" not in u):
                live = pg
        except Exception:
            continue
    return live


def collect_one(ctx, sniffer, state, run_dir: Path):
    brand = ask("\n브랜드명 (예: 브랜드A): ")
    store = ask("매장명 (예: 강남점): ")
    store_dir = run_dir / slug(brand) / slug(store)
    net_dir = store_dir / "network"
    net_dir.mkdir(parents=True, exist_ok=True)
    state.net_dir = net_dir

    print(f"\n=== [{brand} / {store}] 배민 ===")
    print("1) 열린 창에서 로그인하세요(처음 한 번만. 다음 매장부터는 기억됩니다).")
    print("2) 로그인 후 왼쪽 메뉴 '변경이력'으로 들어가세요.")
    print("3) '가게' 탭에서 파란 '조회'를 한 번 누르세요. (즉시할인·광고는 자동)")
    print("4) 그 다음 아래에서 Enter.")

    while True:
        cmd = ask("\n[명령] Enter=수집시작 / next=다음매장 / quit=종료 > ").lower()
        if cmd in ("quit", "q"):
            return False
        if cmd in ("next", "n"):
            return True

        print("  (열린 페이지 목록)")
        for pg in ctx.pages:
            try:
                print("    ·", (pg.url or "")[:90])
            except Exception:
                pass

        live = _find_live_page(ctx)
        if live is None:
            print("  ! 로그인된 self.baemin.com 화면을 못 찾았습니다.")
            print("    → 이 창에서 로그인을 끝내고 '변경이력' 화면을 띄운 뒤 다시 Enter 하세요.")
            continue

        try:
            live.bring_to_front()
            live.goto(HISTORY_PAGE, wait_until="domcontentloaded")
            live.wait_for_load_state("networkidle", timeout=15000)
        except Exception as ex:
            print(f"    (페이지 확정 경고): {ex}")
        cur = live.url or ""
        print(f"  수집에 사용할 페이지: {cur[:90]}")
        if "login" in cur or "biz-member" in cur:
            print("  ! 아직 로그인 화면입니다. 로그인을 완료한 뒤 다시 Enter 하세요.")
            continue

        # 매장번호: 자동으로 잡힌 게 있으면 추천, 없으면 직접 입력
        suggested = sorted(sniffer.shop_numbers)
        hint = f" (자동감지: {', '.join(suggested)})" if suggested else ""
        raw = ask(f"  이 매장의 매장번호 8자리를 입력하세요{hint}\n  (화면 가게 드롭다운에 보이는 숫자, 여러 개면 콤마로): ")
        nums = [n for n in re.split(r"[^\d]+", raw) if n]
        if not nums:
            nums = suggested
        if not nums:
            print("  매장번호가 필요합니다. 가게 드롭다운의 숫자를 입력하세요.")
            continue

        s, e = date_range_6m()
        fetcher = Fetcher(live, sniffer.auth, net_dir)
        print(f"\n  수집 시작: 매장번호 {nums}, 기간 {s} ~ {e}")
        for sn in nums:
            print(f"  [매장번호 {sn}]")
            crawl_shop(fetcher, sn, s, e)
            crawl_instant_discount(fetcher, sn, s, e)
            crawl_ads(fetcher, sn, s, e)
        for owner in sorted(sniffer.shop_owners):
            print(f"  [업주번호 {owner}]")
            crawl_menu_promotion(fetcher, owner, s, e)

        rows = parse_baemin.parse_records(str(net_dir))
        out_base = str(store_dir / f"{slug(brand)}_{slug(store)}_변경이력")
        parse_baemin.write_outputs(rows, out_base)
        print(f"\n  ✓ 완료: {store_dir}")
        print("    (network/ 원본 + 변경이력 표 CSV/XLSX 저장됨)")
        return True


def main():
    run_dir = OUT_ROOT / datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir.mkdir(parents=True, exist_ok=True)
    print("배민 변경이력 자동수집 시작")
    print(f"저장 위치: {run_dir}")
    with sync_playwright() as p:
        ctx = open_browser(p)
        sniffer = Sniffer()
        sniffer.attach(ctx)
        state = StoreState()
        attach_dynamic_saver(ctx, state)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.on("request", sniffer.on_request)
        page.on("response", sniffer.on_response)
        try:
            page.goto(ROOT_PAGE)
        except Exception as e:
            print(f"  (첫 페이지 이동 경고): {e}")
        print("\n열린 창에서 배민에 로그인하세요. (한 번 로그인하면 다음 매장부터 기억됩니다)")

        more = True
        while more:
            more = collect_one(ctx, sniffer, state, run_dir)
        try:
            ctx.close()
        except Exception:
            pass
    print(f"\n전체 완료! 폴더를 압축해서 올려주세요:\n  {run_dir}")


if __name__ == "__main__":
    main()
