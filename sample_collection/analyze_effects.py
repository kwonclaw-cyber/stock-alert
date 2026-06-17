"""이벤트 스터디: 배민 변경(광고/즉시할인) 전후의 일평균 배민매출 비교.

방법(서술적·상관관계):
  각 이벤트일 t에 대해
    PRE  = [t-14, t-1] 의 일평균 배민매출
    POST = [t+1, t+14] 의 일평균 배민매출
  양쪽 모두 관측일 >= MINOBS 인 경우만 사용.
  pct = (POST-PRE)/PRE.  매장·이벤트별로 모아 분포를 본다.

주의: 신규오픈 램프업·중복이벤트 등 교란요인 존재 → 인과 아님(연관).
"""
import csv
import os
from collections import defaultdict
from datetime import date, timedelta
from statistics import median, mean

HERE = os.path.dirname(os.path.abspath(__file__))
DS = os.path.join(HERE, "dataset")
WIN = 14
MINOBS = 7


def d(s):
    return date(int(s[:4]), int(s[5:7]), int(s[8:10]))


def load_sales():
    sales = defaultdict(dict)  # shop -> {date: baemin_amt}
    for r in csv.DictReader(open(os.path.join(DS, "master_daily.csv"), encoding="utf-8-sig")):
        if r["shopNumber"]:
            sales[r["shopNumber"]][d(r["date"])] = float(r["baemin_amt"] or 0)
    return sales


def load_events():
    evs = []
    for r in csv.DictReader(open(os.path.join(DS, "events.csv"), encoding="utf-8-sig")):
        if r["shopNumber"]:
            evs.append(r)
    return evs


def window_mean(series, t, lo, hi):
    """series: {date:amt}; [t+lo, t+hi] 관측 평균과 관측일수."""
    vals = [series[t + timedelta(days=k)] for k in range(lo, hi + 1)
            if (t + timedelta(days=k)) in series]
    return (mean(vals), len(vals)) if vals else (None, 0)


def study(sales, event_days):
    """event_days: list of (shop, date). 반환: 결과행 리스트."""
    out = []
    for shop, t in event_days:
        s = sales.get(shop)
        if not s:
            continue
        pre, npre = window_mean(s, t, -WIN, -1)
        post, npost = window_mean(s, t, 1, WIN)
        if pre is None or post is None or npre < MINOBS or npost < MINOBS or pre <= 0:
            continue
        out.append({"shop": shop, "date": t.isoformat(),
                    "pre": pre, "post": post, "pct": (post - pre) / pre})
    return out


def summarize(label, res):
    if not res:
        print(f"\n[{label}] 분석가능 이벤트 0건")
        return
    pcts = [r["pct"] for r in res]
    pos = sum(1 for p in pcts if p > 0)
    tot_pre = sum(r["pre"] for r in res)
    tot_post = sum(r["post"] for r in res)
    print(f"\n[{label}]  분석가능 {len(res)}건")
    print(f"  전후 일평균 배민매출 변화 중앙값: {median(pcts)*100:+.1f}%")
    print(f"  평균: {mean(pcts)*100:+.1f}%   상승비율: {pos}/{len(res)} ({pos/len(res)*100:.0f}%)")
    print(f"  합산 일평균(PRE→POST): {tot_pre:,.0f} → {tot_post:,.0f}  "
          f"({(tot_post-tot_pre)/tot_pre*100:+.1f}%)")


def dedup(events, cats=None, types=None, names_contains=None):
    """(shop,date) 단위로 중복 제거한 이벤트일 목록."""
    keep = set()
    for e in events:
        if cats and e["category"] not in cats:
            continue
        if types and e["type"] not in types:
            continue
        if names_contains and names_contains not in (e["detail"] or ""):
            continue
        keep.add((e["shopNumber"], d(e["date"])))
    return sorted(keep)


def first_per_shop(event_days):
    """매장별 '최초' 이벤트일만."""
    seen = {}
    for shop, t in sorted(event_days):
        if shop not in seen:
            seen[shop] = t
    return sorted(seen.items())


def main():
    sales = load_sales()
    events = load_events()

    # 1) 광고 최초 시작 (우리가게클릭 CPC를 처음 켠 날)
    ad_days = dedup(events, cats={"ad"})
    ad_start = first_per_shop(ad_days)
    r_adstart = study(sales, ad_start)
    summarize("광고 최초 시작 (우리가게클릭 CPC)", r_adstart)

    # 2) 광고 예산/입찰 변경일 전체 (매장-일 단위)
    r_adall = study(sales, ad_days)
    summarize("광고 변경일 전체 (예산/입찰 조정)", r_adall)

    # 3) 즉시할인 ACTIVATE (할인 시작)
    disc_days = dedup(events, cats={"instantDiscount"}, types={"ACTIVATE"})
    r_disc = study(sales, disc_days)
    summarize("즉시할인 시작 (ACTIVATE)", r_disc)

    # 4) 즉시할인 최초 시작
    r_disc1 = study(sales, first_per_shop(disc_days))
    summarize("즉시할인 최초 시작", r_disc1)

    # 결과 저장(광고시작/할인시작)
    with open(os.path.join(DS, "effect_ad_start.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["shop", "date", "pre", "post", "pct"])
        w.writeheader(); w.writerows(r_adstart)
    with open(os.path.join(DS, "effect_discount_start.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["shop", "date", "pre", "post", "pct"])
        w.writeheader(); w.writerows(r_disc)

    print(f"\n* 윈도우 ±{WIN}일, 최소관측 {MINOBS}일. 상관관계(인과 아님).")


if __name__ == "__main__":
    main()
