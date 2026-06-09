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
    """로그인 후 오가는 self-api 요청에서 인증 헤더와 매장/업주 ID를 수집."""

    def __init__(self):
        self.headers = None
        self.shop_numbers = set()
        self.shop_owners = set()

    def on_request(self, request):
        url = request.url
        if "self-api.baemin.com" not in url:
            return
        if request.method == "OPTIONS":
            return
        try:
            h = request.all_headers()
            if h.get("authorization") or h.get("Authorization"):
                self.headers = {k: v for k, v in h.items()
                                if k.lower() not in DROP_HEADERS and not k.startswith(":")}
            elif self.headers is None:
                self.headers = {k: v for k, v in h.items()
                                if k.lower() not in DROP_HEADERS and not k.startswith(":")}
        except Exception:
            pass
        for m in re.findall(r"shopNumber=(\d+)", url):
            self.shop_numbers.add(m)
        for m in re.findall(r"shopOwnerNo=(\d+)", url):
            self.shop_owners.add(m)
        for m in re.findall(r"/shop-owners/(\d+)/", url):
            self.shop_owners.add(m)


def date_range_6m():
    end = date.today()
    start = end - timedelta(days=183)
    return start.isoformat(), end.isoformat()


class Fetcher:
    def __init__(self, api_request, headers, net_dir: Path):
        self.api = api_request
        self.headers = headers or {}
        self.net_dir = net_dir
        self.net_dir.mkdir(parents=True, exist_ok=True)
        self.n = 0

    def get(self, url, save_name=None):
        """GET → JSON 반환. 응답은 network 폴더에 캡처와 동일 형식으로 저장."""
        try:
            resp = self.api.get(url, headers=self.headers, timeout=30000)
        except Exception as e:
            print(f"    ! 요청 실패: {e}  ({url[:90]})")
            return None
        body = ""
        try:
            body = resp.text()
        except Exception:
            pass
        if save_name:
            self.n += 1
            meta = {"url": url, "status": resp.status, "captured_at": datetime.now().isoformat()}
            fp = self.net_dir / f"{self.n:03d}__{slug(save_name)}.json"
            fp.write_text("// " + json.dumps(meta, ensure_ascii=False) + "\n" + body,
                          encoding="utf-8")
        if not resp.ok:
            print(f"    ! 상태 {resp.status}: {url[:90]}")
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
    ctx.on("request", sniffer.on_request)
    page = ctx.new_page()
    try:
        page.goto(HISTORY_PAGE)
    except Exception as e:
        print(f"  (페이지 이동 경고): {e}")

    print(f"\n=== [{brand} / {store}] 배민 ===")
    print("1) 브라우저에서 로그인하세요 (2FA 포함).")
    print("2) 변경이력 화면에서 '가게 / 즉시할인 / 광고·서비스 / 메뉴 할인' 탭을")
    print("   한 번씩 눌러 '조회'까지 해주세요. (인증정보와 매장ID를 수집합니다)")
    print("3) 그 다음 아래에서 Enter 를 누르면 6개월치를 자동수집합니다.")

    while True:
        cmd = ask("\n[명령] Enter=수집시작 / next=다음매장 / quit=종료 > ").lower()
        if cmd in ("quit", "q"):
            ctx.close()
            return False
        if cmd in ("next", "n"):
            ctx.close()
            return True

        if not sniffer.shop_numbers:
            print("  ! 아직 매장ID를 못 잡았습니다. 변경이력 탭에서 '조회'를 한 번 더 눌러주세요.")
            continue
        if sniffer.headers is None:
            print("  ! 인증정보를 못 잡았습니다. 탭에서 '조회'를 한 번 더 눌러주세요.")
            continue

        s, e = date_range_6m()
        fetcher = Fetcher(ctx.request, sniffer.headers, net_dir)
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
