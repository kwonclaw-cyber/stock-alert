"""매장별 리포트: 매장 하나하나의 매출 추이 + 주요 변경 타임라인.

출력:
  dataset/store_report.csv          : 매장별 요약(월별 배민매출, 이벤트 수 등)
  dataset/reports/top_stores.md     : 매출 상위 매장 타임라인(월매출+주요변경)
"""
import csv
import os
from collections import defaultdict
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
DS = os.path.join(HERE, "dataset")
MONTHS = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]


def load_master():
    rows = list(csv.DictReader(open(os.path.join(DS, "master_daily.csv"), encoding="utf-8-sig")))
    return [r for r in rows if r["shopNumber"]]


def load_events():
    return [r for r in csv.DictReader(open(os.path.join(DS, "events.csv"), encoding="utf-8-sig"))
            if r["shopNumber"]]


def won(n):
    return f"{int(round(n)):,}"


def main():
    master = load_master()
    events = load_events()

    # 매장 집계
    info = {}  # shop -> dict
    monthly = defaultdict(lambda: defaultdict(float))  # shop -> month -> baemin amt
    for r in master:
        sh = r["shopNumber"]
        d = info.setdefault(sh, {"shop": sh, "store": r["store"], "mate_code": r["mate_code"],
                                 "amt": 0.0, "qty": 0.0, "total_amt": 0.0, "days": 0,
                                 "first": r["date"], "last": r["date"]})
        d["store"] = r["store"] or d["store"]
        amt = float(r["baemin_amt"] or 0)
        d["amt"] += amt
        d["qty"] += float(r["baemin_qty"] or 0)
        d["total_amt"] += float(r["total_amt"] or 0)
        d["days"] += 1
        d["first"] = min(d["first"], r["date"])
        d["last"] = max(d["last"], r["date"])
        monthly[sh][r["date"][:7]] += amt

    # 이벤트 집계
    ev_by_shop = defaultdict(list)
    for e in events:
        ev_by_shop[e["shopNumber"]].append(e)
    for sh, d in info.items():
        evs = ev_by_shop.get(sh, [])
        ad = [e for e in evs if e["category"] == "ad"]
        disc = [e for e in evs if e["category"] == "instantDiscount" and e["type"] == "ACTIVATE"]
        hour = [e for e in evs if e["type"] == "SHOP_OPERATION_HOUR_MODIFY"]
        d["n_ad"] = len(ad)
        d["first_ad"] = min((e["date"] for e in ad), default="")
        d["n_disc"] = len(disc)
        d["first_disc"] = min((e["date"] for e in disc), default="")
        d["n_hour"] = len(hour)
        d["baemin_share"] = d["amt"] / d["total_amt"] if d["total_amt"] else 0

    # CSV
    out = os.path.join(DS, "store_report.csv")
    cols = (["shop", "store", "mate_code", "first", "last", "days",
             "amt", "qty", "baemin_share", "n_ad", "first_ad", "n_disc", "first_disc", "n_hour"]
            + [f"m_{m}" for m in MONTHS])
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for sh, d in sorted(info.items(), key=lambda x: -x[1]["amt"]):
            w.writerow([d["shop"], d["store"], d["mate_code"], d["first"], d["last"], d["days"],
                        round(d["amt"]), round(d["qty"]), round(d["baemin_share"], 3),
                        d["n_ad"], d["first_ad"], d["n_disc"], d["first_disc"], d["n_hour"]]
                       + [round(monthly[sh].get(m, 0)) for m in MONTHS])

    # 상위 매장 타임라인 마크다운
    os.makedirs(os.path.join(DS, "reports"), exist_ok=True)
    md = os.path.join(DS, "reports", "top_stores.md")
    top = sorted(info.items(), key=lambda x: -x[1]["amt"])[:20]
    with open(md, "w", encoding="utf-8") as f:
        f.write("# 매출 상위 20개 매장 — 배민 월매출 + 주요 변경 타임라인\n\n")
        f.write("> 배민매출(BAEMIN=배달의민족+배민배달) 기준. 변경은 광고/할인/영업시간 주요 이벤트만.\n\n")
        for sh, d in top:
            f.write(f"## {d['store']}  (shop {sh})\n\n")
            f.write(f"- 기간 {d['first']}~{d['last']} ({d['days']}일), "
                    f"배민총매출 {won(d['amt'])}원, 배민비중 {d['baemin_share']*100:.0f}%\n")
            f.write(f"- 광고변경 {d['n_ad']}건(최초 {d['first_ad'] or '-'}), "
                    f"즉시할인 {d['n_disc']}건(최초 {d['first_disc'] or '-'}), "
                    f"영업시간변경 {d['n_hour']}건\n\n")
            f.write("| 월 | " + " | ".join(m[2:] for m in MONTHS) + " |\n")
            f.write("|" + "---|" * (len(MONTHS) + 1) + "\n")
            f.write("| 배민매출 | " + " | ".join(won(monthly[sh].get(m, 0)) for m in MONTHS) + " |\n\n")

    nshop = len(info)
    tot = sum(d["amt"] for d in info.values())
    print(f"매장 {nshop}개 → {out}")
    print(f"상위20 타임라인 → {md}")
    print(f"6개월 배민총매출 합계: {won(tot)}원")
    print("\n상위 10개 매장(배민매출):")
    for sh, d in sorted(info.items(), key=lambda x: -x[1]["amt"])[:10]:
        print(f"  {d['store'][:18]:20} {won(d['amt']):>14}원  광고{d['n_ad']:>3} 할인{d['n_disc']:>2} 영업시간{d['n_hour']:>2}")


if __name__ == "__main__":
    main()
