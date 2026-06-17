"""이벤트 스터디 v2: 배민 변경(광고/즉시할인/영업시간) 전후 효과.

각 이벤트일 t: PRE=[t-14,t-1], POST=[t+1,t+14]의 일평균.
  - amt(배민매출), qty(건수), ticket(객단가=amt/qty) 세 지표 모두 비교.
  - 신규오픈 램프업 보정: 매장 첫 매출일로부터 RAMP일 이내 이벤트 제외.
주의: 상관관계(인과 아님). 교란요인(중복이벤트·추세) 잔존.
"""
import csv
import json
import glob
import os
from collections import defaultdict
from datetime import date, timedelta
from statistics import median, mean

HERE = os.path.dirname(os.path.abspath(__file__))
DS = os.path.join(HERE, "dataset")
WIN, MINOBS, RAMP = 14, 7, 30


def d(s):
    return date(int(s[:4]), int(s[5:7]), int(s[8:10]))


def load_sales():
    sales = defaultdict(dict)  # shop -> {date: (amt, qty)}
    for r in csv.DictReader(open(os.path.join(DS, "master_daily.csv"), encoding="utf-8-sig")):
        if r["shopNumber"]:
            sales[r["shopNumber"]][d(r["date"])] = (float(r["baemin_amt"] or 0), float(r["baemin_qty"] or 0))
    first = {sh: min(s) for sh, s in sales.items() if s}
    return sales, first


def load_events():
    return [r for r in csv.DictReader(open(os.path.join(DS, "events.csv"), encoding="utf-8-sig"))
            if r["shopNumber"]]


def wmean(series, t, lo, hi):
    pts = [series[t + timedelta(days=k)] for k in range(lo, hi + 1) if (t + timedelta(days=k)) in series]
    if not pts:
        return None
    a = mean(p[0] for p in pts)
    q = mean(p[1] for p in pts)
    return a, q, len(pts)


def study(sales, first, event_days, ramp=0):
    out = []
    for shop, t in event_days:
        s = sales.get(shop)
        if not s:
            continue
        if ramp and (t - first[shop]).days < ramp:
            continue
        pre = wmean(s, t, -WIN, -1)
        post = wmean(s, t, 1, WIN)
        if not pre or not post or pre[2] < MINOBS or post[2] < MINOBS or pre[0] <= 0:
            continue
        tick_pre = pre[0] / pre[1] if pre[1] else 0
        tick_post = post[0] / post[1] if post[1] else 0
        out.append({"shop": shop, "date": t.isoformat(),
                    "amt_pre": pre[0], "amt_post": post[0], "amt_pct": (post[0] - pre[0]) / pre[0],
                    "qty_pre": pre[1], "qty_post": post[1],
                    "qty_pct": (post[1] - pre[1]) / pre[1] if pre[1] else 0,
                    "tick_pre": tick_pre, "tick_post": tick_post,
                    "tick_pct": (tick_post - tick_pre) / tick_pre if tick_pre else 0})
    return out


def summ(label, res):
    if not res:
        print(f"\n[{label}]  분석가능 0건")
        return
    def line(key, nm):
        v = [r[key] for r in res]
        pos = sum(1 for x in v if x > 0)
        print(f"    {nm:6} 중앙값 {median(v)*100:+5.1f}%  평균 {mean(v)*100:+5.1f}%  상승 {pos/len(v)*100:3.0f}%")
    print(f"\n[{label}]  분석가능 {len(res)}건")
    line("amt_pct", "매출")
    line("qty_pct", "건수")
    line("tick_pct", "객단가")


def dedup(events, cats=None, types=None):
    keep = set()
    for e in events:
        if cats and e["category"] not in cats:
            continue
        if types and e["type"] not in types:
            continue
        keep.add((e["shopNumber"], d(e["date"])))
    return sorted(keep)


def first_per_shop(days):
    seen = {}
    for sh, t in sorted(days):
        seen.setdefault(sh, t)
    return sorted(seen.items())


# ---------- 광고 예산 타임라인(ROI 정밀화) ----------
def ad_budget_events():
    """store JSON에서 광고 예산 변경일 추출 → (shop, date, before_budget, after_budget)."""
    out = []
    for f in glob.glob(os.path.join(DS, "stores", "*.json")):
        dj = json.load(open(f, encoding="utf-8"))
        shop = str(dj.get("shopNumber", ""))
        for ev in dj.get("ad", []) or []:
            if ev.get("historyType") != "CPC_BUDGET":
                continue
            def bud(v):
                try:
                    return json.loads(v).get("cpc", {}).get("monthlyBudget")
                except Exception:
                    return None
            bb, ab = bud(ev.get("beforeValue")), bud(ev.get("afterValue"))
            ts = ev.get("createdAt") or ""
            if ts:
                out.append((shop, d(ts[:10]), bb, ab))
    return out


def main():
    sales, first = load_sales()
    events = load_events()

    print("=" * 60)
    print("■ 즉시할인 — 매출/건수/객단가 (할인은 객단가↓ 건수↑ 가설 검증)")
    disc = dedup(events, cats={"instantDiscount"}, types={"ACTIVATE"})
    summ("즉시할인 시작 ACTIVATE (램프보정)", study(sales, first, disc, ramp=RAMP))

    print("\n" + "=" * 60)
    print("■ 광고 ROI 정밀화 (신규오픈 30일 보정)")
    ad_days = dedup(events, cats={"ad"})
    summ("광고 시작(최초, 램프보정)", study(sales, first, first_per_shop(ad_days), ramp=RAMP))
    summ("광고 변경 전체(램프보정)", study(sales, first, ad_days, ramp=RAMP))

    # 예산 증가 vs 감소 구분
    bud = ad_budget_events()
    inc = sorted(set((s, t) for s, t, bb, ab in bud if bb is not None and ab is not None and ab > bb))
    dec = sorted(set((s, t) for s, t, bb, ab in bud if bb is not None and ab is not None and ab < bb))
    summ("광고 예산 '증액'일 (램프보정)", study(sales, first, inc, ramp=RAMP))
    summ("광고 예산 '감액'일 (램프보정)", study(sales, first, dec, ramp=RAMP))

    print("\n" + "=" * 60)
    print("■ 영업시간/운영 변경 효과")
    hour = dedup(events, cats={"shop"}, types={"SHOP_OPERATION_HOUR_MODIFY"})
    summ("영업시간 변경 (램프보정)", study(sales, first, hour, ramp=RAMP))
    dayoff = dedup(events, cats={"shop"}, types={"SHOP_DAY_OFF_MODIFY"})
    summ("휴무일 변경 (램프보정)", study(sales, first, dayoff, ramp=RAMP))
    deliv = dedup(events, cats={"shop"}, types={"DELIVERY_AVAILABLE_HOUR_MODIFY"})
    summ("배달가능시간 변경 (램프보정)", study(sales, first, deliv, ramp=RAMP))

    print(f"\n* 윈도우 ±{WIN}일, 최소관측 {MINOBS}일, 램프보정 {RAMP}일. 상관관계.")


if __name__ == "__main__":
    main()
