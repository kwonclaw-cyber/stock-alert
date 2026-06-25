"""시간대별 분석:
  1) 브랜드 시간대별 배달매출 프로파일(피크타임)  → dataset/hour_profile.csv
  2) 영업시간 변경(연장/단축) 효과 — 야간(21~24시) 배달매출 전후 비교

시간대 데이터는 매장코드(msStrId) 기준, 변경이력은 shopNumber 기준 →
store_map으로 연결. 시간대별은 채널분리 없음(da=배달 전체 합산).
"""
import csv
import glob
import json
import os
import re
from collections import defaultdict
from datetime import date, timedelta
from statistics import median, mean

HERE = os.path.dirname(os.path.abspath(__file__))
DS = os.path.join(HERE, "dataset")
WIN, MINOBS, RAMP = 14, 7, 30
NIGHT = {"21-22", "22-23", "23-24"}


def dt(s):
    return date(int(s[:4]), int(s[5:7]), int(s[8:10])) if "-" in s else date(int(s[:4]), int(s[4:6]), int(s[6:8]))


def load_shop2mate():
    m = {}
    for r in csv.DictReader(open(os.path.join(DS, "store_map.csv"), encoding="utf-8-sig")):
        if r["status"] in ("matched", "matched_fuzzy", "manual") and r["shopNumber"] and r["mate_code"]:
            m[r["shopNumber"]] = r["mate_code"]
    return m


def load_time():
    """series[mate][date] = {tot, deliv, night};  prof[hour] = deliv 합."""
    series = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0, 0.0]))  # tot, deliv, night
    prof = defaultdict(float)
    prof_tot = defaultdict(float)
    for f in sorted(glob.glob(os.path.join(DS, "time", "matetech_time_slim_*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        for r in d["rows"]:
            day = dt(r["d"])
            rec = series[r["s"]][day]
            rec[0] += r.get("a", 0) or 0
            rec[1] += r.get("da", 0) or 0
            if r["t"] in NIGHT:
                rec[2] += r.get("da", 0) or 0
            prof[r["t"]] += r.get("da", 0) or 0
            prof_tot[r["t"]] += r.get("a", 0) or 0
    return series, prof, prof_tot


def parse_close(state):
    """영업종료시각(주간 최대, 분 단위; 자정 이후는 +24h)."""
    if not state:
        return None
    mx = None
    for m in re.finditer(r"~\s*(\d{1,2}):(\d{2})", state):
        h, mi = int(m.group(1)), int(m.group(2))
        val = h * 60 + mi
        if val < 6 * 60:          # 02:00 같은 새벽 종료 → 익일
            val += 24 * 60
        mx = val if mx is None else max(mx, val)
    return mx


def hour_events(shop2mate):
    """영업시간 변경: (mate, date, kind)  kind∈{연장,단축,기타}."""
    evs = []
    for f in glob.glob(os.path.join(DS, "stores", "*.json")):
        dj = json.load(open(f, encoding="utf-8"))
        shop = str(dj.get("shopNumber", ""))
        mate = shop2mate.get(shop)
        if not mate:
            continue
        for ev in dj.get("shop", []) or []:
            if ev.get("changedItem") != "SHOP_OPERATION_HOUR_MODIFY":
                continue
            ts = ev.get("createdAt") or ""
            if not ts:
                continue
            bc, ac = parse_close(ev.get("beforeState")), parse_close(ev.get("afterState"))
            kind = "기타"
            if bc is not None and ac is not None:
                if ac - bc >= 15:
                    kind = "연장"
                elif bc - ac >= 15:
                    kind = "단축"
            evs.append((mate, dt(ts[:10]), kind))
    return evs


def wmean(series, t, lo, hi, idx):
    pts = [series[t + timedelta(days=k)][idx] for k in range(lo, hi + 1) if (t + timedelta(days=k)) in series]
    return (mean(pts), len(pts)) if pts else (None, 0)


def study(series, event_days, idx):
    """idx: 1=배달전체, 2=야간배달. 반환 pct 리스트 + 첫매출일 램프보정."""
    first = {m: min(s) for m, s in series.items() if s}
    out = []
    for mate, t, kind in event_days:
        s = series.get(mate)
        if not s or (t - first[mate]).days < RAMP:
            continue
        pre, npre = wmean(s, t, -WIN, -1, idx)
        post, npost = wmean(s, t, 1, WIN, idx)
        if pre is None or post is None or npre < MINOBS or npost < MINOBS or pre <= 0:
            continue
        out.append((kind, (post - pre) / pre))
    return out


def summ(label, res):
    if not res:
        print(f"  [{label}] 0건"); return
    v = [p for _, p in res]
    pos = sum(1 for x in v if x > 0)
    print(f"  [{label}] {len(res)}건  중앙값 {median(v)*100:+.1f}%  평균 {mean(v)*100:+.1f}%  상승 {pos/len(v)*100:.0f}%")


def main():
    shop2mate = load_shop2mate()
    series, prof, prof_tot = load_time()

    # 1) 시간대 프로파일
    hours = sorted(prof)
    out = os.path.join(DS, "hour_profile.csv")
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(["hour", "delivery_amt", "total_amt"])
        for h in hours:
            w.writerow([h, round(prof[h]), round(prof_tot[h])])
    tot = sum(prof.values())
    print("■ 시간대별 배달매출 프로파일(피크) →", out)
    top = sorted(prof.items(), key=lambda x: -x[1])[:6]
    for h, v in top:
        print(f"    {h}시  {v/1e8:5.1f}억  ({v/tot*100:4.1f}%)")

    # 2) 영업시간 변경 효과
    evs = hour_events(shop2mate)
    print(f"\n■ 영업시간 변경 효과 (변경 {len(evs)}건, 램프보정)")
    for idx, nm in ((1, "배달 전체"), (2, "야간(21~24시) 배달")):
        res = study(series, evs, idx)
        print(f"  ── {nm}")
        summ("전체", res)
        summ("연장", [r for r in res if r[0] == "연장"])
        summ("단축", [r for r in res if r[0] == "단축"])
    print(f"\n* 윈도우 ±{WIN}일, 램프보정 {RAMP}일. da=배달 전체(배민+쿠팡 등 합산).")


if __name__ == "__main__":
    main()
