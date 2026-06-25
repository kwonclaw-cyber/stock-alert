"""할인 깊이별 효과: 즉시할인 ACTIVATE를 할인유형/금액으로 분류해 전후 매출·건수 비교.

분류(이름 파싱):
  원할인 1000/2000/3000/4000+   ·  %할인  ·  배달팁  ·  배민클럽/프로모션  ·  기타
출력: dataset/discount_depth.csv (bucket | n | amt_med | qty_med | tick_med | rise)
"""
import csv
import glob
import json
import os
import re
from collections import defaultdict
from datetime import date
from statistics import median

import analyze_effects as A

DS = A.DS


def classify(name):
    n = (name or "").replace(",", "")
    if "배달팁" in n:
        return "배달팁"
    if "배민클럽" in n or "프로모션" in n:
        return "배민클럽/프로모션"
    mp = re.search(r"(\d+)\s*%", n)
    if mp:
        return "%할인"
    mw = re.search(r"(\d+)\s*원", n)
    if mw:
        w = int(mw.group(1))
        if w <= 1000:
            return "1000원"
        if w <= 2000:
            return "2000원"
        if w <= 3000:
            return "3000원"
        return "4000원+"
    return "기타"


def depth_events():
    """bucket -> [(shopNumber, date)]"""
    out = defaultdict(set)
    for f in glob.glob(os.path.join(DS, "stores", "*.json")):
        d = json.load(open(f, encoding="utf-8"))
        shop = str(d.get("shopNumber", ""))
        for ev in d.get("instantDiscount", []) or []:
            if ev.get("type") != "ACTIVATE":
                continue
            ts = ev.get("modifiedAt") or ""
            if not ts:
                continue
            b = classify(ev.get("name"))
            out[b].add((shop, date(int(ts[:4]), int(ts[5:7]), int(ts[8:10]))))
    return {k: sorted(v) for k, v in out.items()}


def main():
    sales, first = A.load_sales()
    buckets = depth_events()
    order = ["1000원", "2000원", "3000원", "4000원+", "%할인", "배달팁", "배민클럽/프로모션", "기타"]
    rows = []
    print("■ 할인 깊이별 효과 (ACTIVATE, 램프보정 ±14일)")
    print(f"  {'유형':16} {'건수':>5} {'매출':>8} {'건수변화':>8} {'객단가':>8} {'상승':>5}")
    for b in order:
        days = buckets.get(b, [])
        res = A.study(sales, first, days, ramp=A.RAMP)
        if not res:
            continue
        amt = median(r["amt_pct"] for r in res)
        qty = median(r["qty_pct"] for r in res)
        tick = median(r["tick_pct"] for r in res)
        rise = sum(1 for r in res if r["amt_pct"] > 0) / len(res)
        rows.append([b, len(res), round(amt, 4), round(qty, 4), round(tick, 4), round(rise, 3)])
        print(f"  {b:16} {len(res):>5} {amt*100:>+7.1f}% {qty*100:>+7.1f}% {tick*100:>+7.1f}% {rise*100:>4.0f}%")

    with open(os.path.join(DS, "discount_depth.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["bucket", "n", "amt_med", "qty_med", "tick_med", "rise"])
        w.writerows(rows)
    print("\n→ dataset/discount_depth.csv")


if __name__ == "__main__":
    main()
