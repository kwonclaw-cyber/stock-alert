"""표본매장 운영설정 화면 저장 스크립트 (방법 B).

배민 사장님광장 / 쿠팡이츠 스토어에서 표본매장의 운영설정 페이지를
- HTML (page.content)
- 전체 스크린샷 (.png)
- JSON 네트워크 응답 (값이 들어있는 API 응답)
세 가지로 통째로 저장한다. 긁는(파싱) 로직이 없어서 사이트 구조가 바뀌어도
거의 깨지지 않는다. 저장된 캡처 파일을 Claude에게 올리면 그때 정밀 파싱한다.

매장별 개별계정이므로 매장마다:
  1) 로그인 (2FA 포함, 사람이 직접)
  2) 캡처할 페이지로 이동
  3) 터미널에서 Enter → 라벨 입력 → 현재 화면 저장
  4) 매장 끝나면 'next' → 새 브라우저 세션으로 다음 매장
  5) 전부 끝나면 'quit'

사용법:
    pip install playwright
    playwright install chromium
    python capture.py
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright


# 플랫폼별 로그인 시작 URL
PLATFORM_URLS = {
    "baemin": "https://ceo.baemin.com/",
    "coupang": "https://store.coupangeats.com/",
}

# 수집 대상 항목 (라벨 추천값). 캡처 시 번호로 빠르게 고를 수 있다.
SUGGESTED_LABELS = [
    "광고설정",
    "할인쿠폰",
    "운영시간",
    "최소주문금액_배달비",
    "메뉴가격",
    "가게정보",
]

OUT_ROOT = Path(__file__).parent / "captures"


def slug(text: str) -> str:
    """파일/폴더명으로 쓸 수 있게 정리."""
    text = (text or "").strip()
    text = re.sub(r"[^\w가-힣._-]+", "_", text)
    return text.strip("_") or "unnamed"


def ask(prompt: str) -> str:
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print("\n중단합니다.")
        sys.exit(0)


def attach_network_logger(page, store_dir: Path):
    """JSON 응답을 store_dir/network/ 에 저장 (정확한 수치 파싱용)."""
    netdir = store_dir / "network"
    counter = {"n": 0}

    def on_response(resp):
        try:
            ct = (resp.headers or {}).get("content-type", "")
            if "application/json" not in ct:
                return
            url = resp.url
            # 정적/광고/추적성 응답은 건너뜀
            if any(x in url for x in ("google", "facebook", "doubleclick", "analytics", "sentry")):
                return
            body = resp.text()
            if not body or len(body) < 2:
                return
            counter["n"] += 1
            netdir.mkdir(parents=True, exist_ok=True)
            name = slug(url.split("?")[0].split("/")[-1] or "resp")[:60]
            fpath = netdir / f"{counter['n']:03d}__{name}.json"
            meta = {"url": url, "status": resp.status, "captured_at": datetime.now().isoformat()}
            fpath.write_text(
                "// " + json.dumps(meta, ensure_ascii=False) + "\n" + body,
                encoding="utf-8",
            )
        except Exception:
            # 네트워크 로깅 실패는 조용히 무시 (본 캡처에 영향 없도록)
            pass

    page.on("response", on_response)


def save_capture(page, store_dir: Path, label: str, manifest: list):
    """현재 페이지의 HTML + 스크린샷 저장 + manifest 기록."""
    ts = datetime.now().strftime("%H%M%S")
    base = f"{slug(label)}__{ts}"
    html_path = store_dir / f"{base}.html"
    png_path = store_dir / f"{base}.png"

    try:
        html = page.content()
        html_path.write_text(html, encoding="utf-8")
    except Exception as e:
        print(f"    ! HTML 저장 실패: {e}")
        html_path = None

    try:
        page.screenshot(path=str(png_path), full_page=True)
    except Exception as e:
        print(f"    ! 스크린샷 저장 실패(전체) → 보이는 영역만 시도: {e}")
        try:
            page.screenshot(path=str(png_path))
        except Exception as e2:
            print(f"    ! 스크린샷 저장 완전 실패: {e2}")
            png_path = None

    entry = {
        "label": label,
        "url": page.url,
        "title": (page.title() if page else ""),
        "html": html_path.name if html_path else None,
        "screenshot": png_path.name if png_path else None,
        "captured_at": datetime.now().isoformat(),
    }
    manifest.append(entry)
    (store_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"    ✓ 저장됨: {label}  ({page.url})")


def pick_label() -> str:
    print("\n  라벨 선택 (번호 입력) 또는 직접 입력:")
    for i, lab in enumerate(SUGGESTED_LABELS, 1):
        print(f"    {i}) {lab}")
    raw = ask("  라벨> ")
    if raw.isdigit() and 1 <= int(raw) <= len(SUGGESTED_LABELS):
        return SUGGESTED_LABELS[int(raw) - 1]
    return raw or "기타"


def capture_one_store(browser, run_dir: Path):
    """매장 1곳: 새 세션 → 로그인 대기 → 페이지별 캡처 루프."""
    brand = ask("\n브랜드명 (예: 브랜드A): ")
    store = ask("매장명 (예: 강남점): ")
    print("\n플랫폼 선택:")
    print("  1) 배민 사장님광장")
    print("  2) 쿠팡이츠 스토어")
    print("  3) 직접 URL 입력")
    sel = ask("플랫폼> ")
    if sel == "1":
        platform, start_url = "baemin", PLATFORM_URLS["baemin"]
    elif sel == "2":
        platform, start_url = "coupang", PLATFORM_URLS["coupang"]
    else:
        platform = "custom"
        start_url = ask("시작 URL> ") or "about:blank"

    store_dir = run_dir / slug(brand) / f"{slug(store)}__{platform}"
    store_dir.mkdir(parents=True, exist_ok=True)

    # 매장별 개별계정 → 매장마다 깨끗한 세션
    ctx = browser.new_context(
        accept_downloads=True,
        viewport={"width": 1440, "height": 900},
    )
    page = ctx.new_page()
    attach_network_logger(page, store_dir)
    page.goto(start_url)

    manifest = []
    print(f"\n=== [{brand} / {store}] ({platform}) ===")
    print("브라우저에서 직접 로그인하세요 (2FA 포함).")
    print("캡처할 페이지로 이동한 뒤 아래 명령을 사용합니다:")
    print("  Enter / c : 현재 화면 캡처")
    print("  next      : 이 매장 끝, 다음 매장으로")
    print("  quit      : 전체 종료")

    while True:
        cmd = ask("\n[명령] Enter=캡처 / next / quit > ").lower()
        if cmd in ("quit", "q"):
            ctx.close()
            return False  # 더 진행 안 함
        if cmd in ("next", "n"):
            ctx.close()
            print(f"  → {store} 캡처 {len(manifest)}건 저장 완료: {store_dir}")
            return True  # 다음 매장
        # 캡처
        label = pick_label()
        save_capture(page, store_dir, label, manifest)


def main():
    run_dir = OUT_ROOT / datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir.mkdir(parents=True, exist_ok=True)
    print("표본매장 운영설정 캡처 시작")
    print(f"저장 위치: {run_dir}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        more = True
        while more:
            more = capture_one_store(browser, run_dir)
        browser.close()

    print("\n완료! 아래 폴더를 통째로 압축해서 Claude에게 올려주세요:")
    print(f"  {run_dir}")
    print("(HTML / 스크린샷 / network JSON 이 매장별로 정리되어 있습니다.)")


if __name__ == "__main__":
    main()
