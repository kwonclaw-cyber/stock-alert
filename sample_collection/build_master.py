"""매출(메이트포스 slim) + 변경이력(배민) → 분석용 마스터 테이블 생성.

출력:
  dataset/master_daily.csv : shopNumber | mate_code | store | date
                             | baemin_amt | baemin_qty | total_amt | total_qty
  dataset/events.csv       : shopNumber | store | date | category | type | detail

매핑: store_map.csv(매장코드 ↔ shopNumber, matched/matched_fuzzy)로 두 소스를 연결.
배민 매출 = slim 행 중 channelCd(c)=='BAEMIN' (배달의민족+배민배달).
"""
import csv
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DS = os.path.join(HERE, "dataset")


def load_store_map():
    """mate_code -> (shopNumber, name)  (연결된 것만)."""
    m = {}
    path = os.path.join(DS, "store_map.csv")
    for r in csv.DictReader(open(path, encoding="utf-8-sig")):
        if r["status"] in ("matched", "matched_fuzzy") and r["mate_code"] and r["shopNumber"]:
            m[r["mate_code"]] = (r["shopNumber"], r["baemin_name"])
    return m


def build_sales(smap):
    """slim 매출 → (shopNumber,date) 일별 집계."""
    daily = {}  # (shop, date) -> dict
    for f in sorted(glob.glob(os.path.join(DS, "sales", "matetech_slim_*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        names = d.get("stores", {})
        for row in d["rows"]:
            code = str(row["s"])
            shop, _ = smap.get(code, ("", ""))
            date = row["d"]
            date = f"{date[:4]}-{date[4:6]}-{date[6:8]}"
            amt, qty = row.get("a", 0) or 0, row.get("q", 0) or 0
            key = (shop, code, date)
            rec = daily.setdefault(key, {
                "shopNumber": shop, "mate_code": code,
                "store": names.get(code, ""), "date": date,
                "baemin_amt": 0, "baemin_qty": 0, "total_amt": 0, "total_qty": 0,
            })
            rec["total_amt"] += amt
            rec["total_qty"] += qty
            if row.get("c") == "BAEMIN":
                rec["baemin_amt"] += amt
                rec["baemin_qty"] += qty
    return daily


def build_events():
    rows = []
    DATEKEY = {"shop": "createdAt", "ad": "createdAt",
               "instantDiscount": "modifiedAt", "promotion": "modifiedAt"}
    for f in glob.glob(os.path.join(DS, "stores", "*.json")):
        d = json.load(open(f, encoding="utf-8"))
        shop = str(d.get("shopNumber", ""))
        name = d.get("shopName", "")
        for cat in ("shop", "ad", "instantDiscount", "promotion"):
            for ev in d.get(cat, []) or []:
                ts = ev.get(DATEKEY[cat]) or ""
                if not ts:
                    continue
                date = ts[:10]
                if cat == "ad":
                    typ = ev.get("historyType", "")
                    detail = ev.get("adKindTitle", "")
                elif cat == "instantDiscount":
                    typ = ev.get("type", "")
                    detail = ev.get("name", "")
                elif cat == "shop":
                    typ = ev.get("changedItem", "")
                    detail = ""
                else:
                    typ = ev.get("type", "")
                    detail = ev.get("name", "")
                rows.append({"shopNumber": shop, "store": name, "date": date,
                             "category": cat, "type": typ, "detail": detail})
    return rows


def main():
    smap = load_store_map()
    daily = build_sales(smap)
    events = build_events()

    mp = os.path.join(DS, "master_daily.csv")
    with open(mp, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["shopNumber", "mate_code", "store", "date",
                                          "baemin_amt", "baemin_qty", "total_amt", "total_qty"])
        w.writeheader()
        for k in sorted(daily):
            w.writerow(daily[k])

    ep = os.path.join(DS, "events.csv")
    with open(ep, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["shopNumber", "store", "date", "category", "type", "detail"])
        w.writeheader()
        for r in sorted(events, key=lambda x: (x["shopNumber"], x["date"])):
            w.writerow(r)

    shops = set(k[0] for k in daily if k[0])
    print(f"매출 마스터: {len(daily)}행 (매장코드 {len(set(k[1] for k in daily))}개, "
          f"배민연결 {len(shops)}개) → {mp}")
    print(f"변경이벤트: {len(events)}건 → {ep}")
    from collections import Counter
    c = Counter(e["category"] for e in events)
    print("  이벤트 분류:", dict(c))


if __name__ == "__main__":
    main()
