"""배민 변경이력 묶음(매장별 JSON 여러 개) → 매장별 표준 데이터 + manifest.

콘솔 스니펫(__save)이 만든 `baemin_변경이력_*.json`(top-level shop/ad/
instantDiscount/promotion 배열)을 모은 폴더를 받아:

  - 같은 shopNumber로 흩어진 파일(카테고리별 분할·중복)을 **하나로 병합**
  - event id 기준 **중복 제거**
  - 매장별 표준 JSON(stores/<shopNo>_<매장명>.json)
  - 전체 목록 manifest.csv / manifest.json

광고이력이 199건 이상이면 배민 페이지 한도로 **잘렸을 가능성**이 있어
manifest에 ad_truncated=True 로 표시한다.

사용:
    python normalize_history.py <변경이력_폴더> [출력폴더]
    출력폴더 생략 시: ./dataset
"""

import csv
import glob
import json
import os
import re
import sys
from collections import defaultdict

AD_CAP = 199  # 배민 광고이력 페이지 한도(이 이상이면 잘렸을 수 있음)


def _dt(s):
    return (str(s) if s else "").replace("T", " ")[:19]


def _shop_key(r):
    return ("shop", r.get("id"))


def _disc_key(r):
    return ("disc", r.get("id"))


def _ad_key(r):
    # 광고는 id가 null인 경우가 많아 시간+값으로 식별
    return ("ad", r.get("adCampaignId"), r.get("historyType"),
            r.get("createdAt"), r.get("beforeValue"), r.get("afterValue"))


def _promo_key(r):
    return ("promo", r.get("id") or json.dumps(r, ensure_ascii=False)[:80])


KEYFN = {
    "shop": _shop_key,
    "instantDiscount": _disc_key,
    "ad": _ad_key,
    "promotion": _promo_key,
}
# 각 event 종류별 시간 필드(기간 산출용)
TIMEFN = {
    "shop": lambda r: r.get("modified") or r.get("createdAt"),
    "instantDiscount": lambda r: r.get("modifiedAt"),
    "ad": lambda r: r.get("createdAt"),
    "promotion": lambda r: r.get("modifiedAt") or r.get("createdAt"),
}


def _safe(name):
    name = re.sub(r"\s+", "_", (name or "").strip())
    return re.sub(r"[^0-9A-Za-z가-힣_\-]", "", name) or "매장"


def normalize(in_dir, out_dir):
    files = sorted(glob.glob(os.path.join(in_dir, "*.json")))
    if not files:
        print(f"변경이력 JSON이 없습니다: {in_dir}")
        sys.exit(1)

    # shopNumber 별로 병합
    stores = defaultdict(lambda: {
        "shopNumber": None, "names": [], "files": 0,
        "events": {k: [] for k in KEYFN}, "_seen": {k: set() for k in KEYFN},
    })

    for path in files:
        try:
            d = json.load(open(path, encoding="utf-8"))
        except Exception as e:
            print(f"  ! 읽기 실패 {os.path.basename(path)}: {e}")
            continue
        sn = str(d.get("shopNumber") or "")
        st = stores[sn]
        st["shopNumber"] = sn
        st["files"] += 1
        nm = (d.get("shopName") or "").strip()
        if nm and nm not in st["names"]:
            st["names"].append(nm)
        for k, keyfn in KEYFN.items():
            for r in d.get(k, []) or []:
                rid = keyfn(r)
                if rid in st["_seen"][k]:
                    continue
                st["_seen"][k].add(rid)
                st["events"][k].append(r)

    os.makedirs(os.path.join(out_dir, "stores"), exist_ok=True)
    manifest = []

    for sn, st in sorted(stores.items()):
        ev = st["events"]
        for k in ev:
            ev[k].sort(key=lambda r: _dt(TIMEFN[k](r)))
        # 대표 매장명: 가장 자주/먼저 나온 이름
        names = st["names"]
        primary = names[0] if names else f"매장_{sn}"
        # 전체 기간
        dts = []
        for k in ev:
            for r in ev[k]:
                t = _dt(TIMEFN[k](r))
                if t.startswith("2"):
                    dts.append(t)
        lo = min(dts)[:10] if dts else ""
        hi = max(dts)[:10] if dts else ""
        n_ad = len(ev["ad"])
        rec = {
            "shopNumber": sn,
            "shopName": primary,
            "brands": names,                 # 카테고리별 다른 이름이면 여러 개
            "sourceFiles": st["files"],
            "counts": {k: len(ev[k]) for k in ev},
            "dateFrom": lo, "dateTo": hi,
            "ad_truncated": n_ad >= AD_CAP,  # 광고이력 잘림 의심
            "shop": ev["shop"],
            "instantDiscount": ev["instantDiscount"],
            "ad": ev["ad"],
            "promotion": ev["promotion"],
        }
        fn = f"{sn}_{_safe(primary)}.json"
        json.dump(rec, open(os.path.join(out_dir, "stores", fn), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        manifest.append({
            "shopNumber": sn, "shopName": primary,
            "brands": " | ".join(names),
            "sourceFiles": st["files"],
            "shop": rec["counts"]["shop"],
            "instantDiscount": rec["counts"]["instantDiscount"],
            "ad": rec["counts"]["ad"],
            "promotion": rec["counts"]["promotion"],
            "dateFrom": lo, "dateTo": hi,
            "ad_truncated": rec["ad_truncated"],
            "file": f"stores/{fn}",
        })

    # manifest 저장(csv + json)
    cols = ["shopNumber", "shopName", "brands", "sourceFiles", "shop",
            "instantDiscount", "ad", "promotion", "dateFrom", "dateTo",
            "ad_truncated", "file"]
    with open(os.path.join(out_dir, "manifest.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(manifest)
    json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    # 요약 출력
    n = len(manifest)
    multi = [m for m in manifest if m["sourceFiles"] > 1]
    trunc = [m for m in manifest if m["ad_truncated"]]
    tot = {k: sum(m[k] for m in manifest) for k in ("shop", "instantDiscount", "ad", "promotion")}
    print(f"\n매장 {n}개 정리 완료 → {out_dir}/stores/")
    print(f"  병합된 매장(파일 2개+): {len(multi)}개  {[m['shopName'] for m in multi]}")
    print(f"  광고이력 잘림 의심: {len(trunc)}개")
    print(f"  총 이벤트  운영(shop)={tot['shop']}  즉시할인={tot['instantDiscount']}  "
          f"광고={tot['ad']}  메뉴할인={tot['promotion']}")


def main():
    in_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.getcwd(), "dataset")
    normalize(in_dir, out_dir)


if __name__ == "__main__":
    main()
