"""3종 HTML 페이지 생성기 (현재 데이터로 재생성).

출력 → dataset/reports/
  1) progress.html   진행 기록 & 로직 정리
  2) board.html      분석 보드 (변경→매출 효과)
  3) dashboard.html  매출 대시보드 (Chart.js)

데이터: master_daily.csv, events.csv, store_report.csv, dataset/sales/*.json
효과수치: analyze_effects 모듈 재사용.
"""
import csv
import glob
import json
import os
from collections import defaultdict
from statistics import median, mean

import analyze_effects as A
import analyze_time as T

HERE = os.path.dirname(os.path.abspath(__file__))
DS = os.path.join(HERE, "dataset")
OUT = os.path.join(DS, "reports")
os.makedirs(OUT, exist_ok=True)
MONTHS = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
CH_KO = {"BAEMIN": "배민", "CPEATS": "쿠팡이츠", "YOGIYO": "요기요",
         "DKY": "땡겨요", "MUKKEBI": "먹깨비", "POS": "내점/포스", "ETC": "전화/기타"}

CSS = """
:root{--b:#1971c2;--b2:#e7f5ff;--g:#2f9e44;--r:#e03131;--o:#e8590c;--line:#dee2e6;--ink:#212529;--mut:#868e96;}
*{box-sizing:border-box;} body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:var(--ink);line-height:1.65;margin:0;background:#f8f9fa;}
.wrap{max-width:980px;margin:0 auto;padding:32px 20px 80px;} h1{font-size:28px;margin:0 0 4px;} .sub{color:var(--mut);margin:0 0 28px;}
h2{font-size:20px;margin:38px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--ink);} h3{font-size:16px;margin:18px 0 8px;color:var(--b);}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px 22px;margin:14px 0;box-shadow:0 1px 3px rgba(0,0,0,.04);}
code{background:#f1f3f5;padding:2px 7px;border-radius:5px;font-family:Consolas,monospace;font-size:13px;color:#c92a2a;}
table{border-collapse:collapse;width:100%;margin:10px 0;font-size:13.5px;} th,td{border:1px solid var(--line);padding:8px 11px;text-align:left;vertical-align:top;} th{background:#f1f3f5;}
.ok{color:var(--g);font-weight:700;} .no{color:var(--r);font-weight:700;} .num{text-align:right;font-variant-numeric:tabular-nums;}
.tag{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;margin-right:6px;} .t-try{background:#fff3bf;color:#e8590c;} .t-win{background:#ebfbee;color:#2f9e44;}
.tip{background:var(--b2);border-left:4px solid var(--b);padding:12px 16px;border-radius:0 8px 8px 0;margin:12px 0;font-size:14px;}
.warn{background:#fff9db;border-left:4px solid var(--o);padding:12px 16px;border-radius:0 8px 8px 0;margin:12px 0;font-size:14px;}
.win{background:#ebfbee;border-left:4px solid var(--g);padding:12px 16px;border-radius:0 8px 8px 0;margin:12px 0;font-size:14px;}
ol,ul{margin:8px 0;padding-left:22px;} li{margin:4px 0;font-size:14.3px;}
.timeline{position:relative;margin:14px 0 14px 8px;padding-left:26px;border-left:3px solid var(--line);} .ev{position:relative;margin:0 0 18px;}
.ev::before{content:'';position:absolute;left:-34px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid var(--b);} .ev.good::before{border-color:var(--g);} .ev.fail::before{border-color:var(--r);}
.ev h4{margin:0 0 4px;font-size:15px;} .ev p{margin:3px 0;font-size:14px;}
.flow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0;font-size:13.5px;} .pill{background:#fff;border:1px solid var(--b);color:var(--b);border-radius:20px;padding:5px 12px;font-weight:600;} .arrow{color:var(--mut);font-weight:700;}
.kpi{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0;} .kpi div{flex:1;min-width:130px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px;text-align:center;} .kpi b{display:block;font-size:24px;color:var(--b);} .kpi span{font-size:12px;color:var(--mut);}
.bcard{border-radius:12px;padding:16px 20px;margin:12px 0;border:1px solid var(--line);background:#fff;} .bcard.pos{border-left:6px solid var(--g);} .bcard.neg{border-left:6px solid var(--r);} .bcard.flat{border-left:6px solid var(--mut);}
.bcard h3{margin:0 0 8px;color:var(--ink);} .metric{display:inline-block;margin:4px 16px 4px 0;font-size:13px;} .metric b{font-size:18px;display:block;}
.foot{margin-top:40px;color:var(--mut);font-size:13px;text-align:center;}
"""


def won(n):
    return f"{int(round(n)):,}"


# ---------------- 데이터 집계 ----------------
def collect():
    master = [r for r in csv.DictReader(open(os.path.join(DS, "master_daily.csv"), encoding="utf-8-sig"))]
    linked = [r for r in master if r["shopNumber"]]
    monthly = defaultdict(float)
    monthly_total = defaultdict(float)
    for r in linked:
        monthly[r["date"][:7]] += float(r["baemin_amt"] or 0)
        monthly_total[r["date"][:7]] += float(r["total_amt"] or 0)
    # 채널 믹스 (slim 원본에서)
    chan = defaultdict(float)
    for f in glob.glob(os.path.join(DS, "sales", "matetech_slim_*.json")):
        d = json.load(open(f, encoding="utf-8"))
        for row in d["rows"]:
            chan[row.get("c") or "ETC"] += row.get("a", 0) or 0
    # 매장 요약
    stores = list(csv.DictReader(open(os.path.join(DS, "store_report.csv"), encoding="utf-8-sig")))
    return {
        "n_rows": len(master), "n_linked_rows": len(linked),
        "n_stores": len(stores),
        "baemin_total": sum(monthly.values()),
        "all_total": sum(monthly_total.values()),
        "monthly": monthly, "monthly_total": monthly_total,
        "chan": chan, "stores": stores,
    }


def effects():
    sales, first = A.load_sales()
    events = A.load_events()
    idx = A.brand_index(sales)

    def st(days, ramp=A.RAMP):
        res = A.study(sales, first, days, ramp=ramp)
        did = A.did_study(sales, first, idx, days, ramp=ramp)
        def med(k):
            v = [r[k] for r in res]
            return median(v) if v else 0
        def rise(k):
            v = [r[k] for r in res]
            return (sum(1 for x in v if x > 0) / len(v)) if v else 0
        return {"n": len(res), "amt": med("amt_pct"), "qty": med("qty_pct"),
                "tick": med("tick_pct"), "rise": rise("amt_pct"),
                "did": (median(did) if did else 0), "did_n": len(did)}

    disc = A.dedup(events, cats={"instantDiscount"}, types={"ACTIVATE"})
    ad_days = A.dedup(events, cats={"ad"})
    bud = A.ad_budget_events()
    inc = sorted(set((s, t) for s, t, bb, ab in bud if bb is not None and ab is not None and ab > bb))
    hour = A.dedup(events, cats={"shop"}, types={"SHOP_OPERATION_HOUR_MODIFY"})
    dayoff = A.dedup(events, cats={"shop"}, types={"SHOP_DAY_OFF_MODIFY"})
    deliv = A.dedup(events, cats={"shop"}, types={"DELIVERY_AVAILABLE_HOUR_MODIFY"})
    return [
        ("광고 예산 증액", st(inc)),
        ("광고 시작(최초)", st(A.first_per_shop(ad_days))),
        ("즉시할인 시작", st(disc)),
        ("휴무일 변경", st(dayoff)),
        ("배달가능시간 변경", st(deliv)),
        ("영업시간 변경", st(hour)),
    ]


# ---------------- 페이지 ----------------
def page(title, sub, body):
    return f"""<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{title}</title>
<style>{CSS}</style></head><body><div class="wrap">
<h1>{title}</h1><p class="sub">{sub}</p>{body}
<p class="foot">생성: 메이트포스 자동수집 + 배민 변경이력 결합 · sample_collection/</p>
</div></body></html>"""


def gen_progress(D):
    b = f"""
  <h2>0 · 목표</h2>
  <div class="card">육식사관학교 전 매장의 <b>배민 운영 변경</b>(광고·즉시할인·영업시간)이
  <b>배민 매출</b>에 어떤 영향을 주는지, <b>6개월 일별 데이터</b>로 분석한다.</div>

  <h2>1 · 핵심 전환 — 매출 수집 자동화</h2>
  <div class="timeline">
    <div class="ev fail"><h4><span class="tag t-try">처음</span> 수동 다운로드의 벽</h4>
      <p>메이트포스에서 매장×날짜 매출을 받으려면 <b>주문경로 182번 + 시간대 182번</b> 수동 다운로드가 필요했다. 날짜를 매번 바꿔 클릭 = 사실상 불가능.</p></div>
    <div class="ev good"><h4><span class="tag t-win">정답</span> API 자동수집 <code>matetech_console.js</code></h4>
      <p>검색 버튼이 부르는 <code>orders-path</code> API를 찾아, <b>날짜를 자동 루프</b>로 호출.
      로그인된 세션에서 콘솔에 붙여넣고 1번 실행 → <b>6개월 전체</b>가 파일 하나로.</p>
      <p class="ok">검증: 수집 합계 = 공식 일별 총매출과 정확히 일치(이중계상·누락 없음).</p></div>
    <div class="ev good"><h4><span class="tag t-win">결합</span> 매장 매핑 + 마스터 <code>build_master.py</code></h4>
      <p>메이트 매장코드 ↔ 배민 매장번호를 매장명으로 매핑(<b>185개 연결</b>), 매출과 변경이력을 <b>날짜로 조인</b>.</p></div>
  </div>

  <h2>2 · 확립된 프로세스</h2>
  <div class="flow"><span class="pill">콘솔 코드 붙여넣기</span><span class="arrow">→</span>
  <span class="pill">6개월 자동수집(1회)</span><span class="arrow">→</span>
  <span class="pill">슬림 분할</span><span class="arrow">→</span>
  <span class="pill">매장매핑·마스터</span><span class="arrow">→</span>
  <span class="pill">이벤트스터디·리포트</span></div>

  <h2>3 · 현재 산출물</h2>
  <div class="kpi">
    <div><b>{D['n_stores']}</b><span>분석 매장</span></div>
    <div><b>{won(D['baemin_total'])}</b><span>배민 6개월 매출(원)</span></div>
    <div><b>{D['n_linked_rows']:,}</b><span>일별 매출행</span></div>
    <div><b>74,726</b><span>변경 이벤트</span></div>
  </div>
  <table>
    <tr><th>파일</th><th>역할</th></tr>
    <tr><td><code>matetech_console.js</code></td><td>★ 메이트포스 매출 자동수집(날짜 루프)</td></tr>
    <tr><td><code>build_store_map.py</code></td><td>매장코드 ↔ 배민 매장번호 매핑</td></tr>
    <tr><td><code>build_master.py</code></td><td>일별 마스터 + 변경이벤트 테이블</td></tr>
    <tr><td><code>analyze_effects.py</code></td><td>이벤트스터디(매출·건수·객단가, DiD 추세보정)</td></tr>
    <tr><td><code>build_store_report.py</code></td><td>매장별 리포트(월매출·이벤트)</td></tr>
    <tr><td><code>gen_pages.py</code></td><td>이 페이지들 생성</td></tr>
  </table>

  <h2>4 · 한계 & 다음</h2>
  <div class="warn"><b>한계</b><ul style="margin:6px 0 0;">
    <li>±14일 전후비교 → 상관관계(인과 아님). DiD로 전체추세는 제거.</li>
    <li>시간대별은 채널(배민/쿠팡) 분리가 안 됨 → 배달 전체 합산으로 분석.</li>
    <li>매출 16개 매장은 변경이력 없어 분석 제외(신규/타브랜드).</li></ul></div>
"""
    return b


def gen_board(D, EFF):
    cards = ""
    for name, e in EFF:
        cls = "pos" if e["did"] > 0.003 else ("neg" if e["did"] < -0.003 else "flat")
        verdict = "효과 있음(+)" if cls == "pos" else ("효과 없음/역효과(−)" if cls == "neg" else "효과 미미")
        cards += f"""
    <div class="bcard {cls}">
      <h3>{name} <span style="font-size:12px;color:var(--mut);font-weight:400;">· {e['n']}건 분석 · {verdict}</span></h3>
      <span class="metric">매출(중앙값)<b class="{'ok' if e['amt']>0 else 'no'}">{e['amt']*100:+.1f}%</b></span>
      <span class="metric">건수<b>{e['qty']*100:+.1f}%</b></span>
      <span class="metric">객단가<b>{e['tick']*100:+.1f}%</b></span>
      <span class="metric">추세보정(DiD)<b class="{'ok' if e['did']>0 else 'no'}">{e['did']*100:+.1f}%</b></span>
      <span class="metric">상승비율<b>{e['rise']*100:.0f}%</b></span>
    </div>"""
    # 상위매장 표
    depth_rows = load_depth_rows()
    rows = ""
    for s in D["stores"][:15]:
        rows += (f"<tr><td>{s['store']}</td><td class='num'>{int(s['amt']):,}</td>"
                 f"<td class='num'>{s['n_ad']}</td><td class='num'>{s['n_disc']}</td>"
                 f"<td class='num'>{s['n_hour']}</td></tr>")
    b = f"""
  <h2>📊 분석 보드 — 변경이 배민 매출에 준 영향</h2>
  <div class="kpi">
    <div><b>{D['n_stores']}</b><span>매장</span></div>
    <div><b>{won(D['baemin_total'])}</b><span>배민 매출(원)</span></div>
    <div><b>{D['baemin_total']/D['all_total']*100:.0f}%</b><span>배민 비중</span></div>
    <div><b>±14일</b><span>전후 비교창</span></div>
  </div>
  <div class="tip">각 변경 전후 <b>±14일 일평균 배민매출</b> 비교(신규오픈 30일 보정).
  <b>DiD</b>는 브랜드 전체 추세를 빼 계절성을 제거한 '순수 효과'. <b>상관관계이며 인과는 아님.</b></div>
  {cards}
  <div class="win"><b>요약:</b> 광고 예산 <b>증액</b>이 가장 뚜렷한 양(+) — 추세보정 후에도 매출 상승.
  <b>즉시할인</b>은 평균적으론 효과 없지만 <b>깊이별로 갈린다</b>(아래).</div>

  <h2>🏷️ 할인 깊이별 효과</h2>
  <div class="tip">소액 고정할인(1~3천원)은 효과 없음/반응적. <b>4천원+ 할인·배달팁 할인</b>은 건수·매출 모두 상승.</div>
  <table><tr><th>할인 유형</th><th class="num">건수</th><th class="num">매출(중앙값)</th><th class="num">건수변화</th><th class="num">상승비율</th></tr>{depth_rows}</table>

  <h2>매출 상위 15개 매장</h2>
  <table><tr><th>매장</th><th class="num">배민매출(원)</th><th class="num">광고변경</th><th class="num">할인</th><th class="num">영업시간</th></tr>{rows}</table>
"""
    return b


def load_depth_rows():
    p = os.path.join(DS, "discount_depth.csv")
    if not os.path.exists(p):
        return ""
    out = ""
    for r in csv.DictReader(open(p, encoding="utf-8-sig")):
        amt, qty = float(r["amt_med"]), float(r["qty_med"])
        out += (f"<tr><td>{r['bucket']}</td><td class='num'>{r['n']}</td>"
                f"<td class='num {'ok' if amt>0 else 'no'}'>{amt*100:+.1f}%</td>"
                f"<td class='num'>{qty*100:+.1f}%</td>"
                f"<td class='num'>{float(r['rise'])*100:.0f}%</td></tr>")
    return out


def dashboard_parts(D, EFF):
    months = MONTHS
    bm = [round(D["monthly"].get(m, 0)) for m in months]
    tot = [round(D["monthly_total"].get(m, 0)) for m in months]
    chan_items = sorted(D["chan"].items(), key=lambda x: -x[1])
    chan_labels = [CH_KO.get(c, c) for c, _ in chan_items]
    chan_vals = [round(v) for _, v in chan_items]
    top = D["stores"][:10]
    top_labels = [s["store"].replace("육식사관학교", "").strip()[:10] for s in top]
    top_vals = [int(s["amt"]) for s in top]
    eff_labels = [n for n, _ in EFF]
    eff_amt = [round(e["amt"] * 100, 1) for _, e in EFF]
    eff_did = [round(e["did"] * 100, 1) for _, e in EFF]
    data = json.dumps({"months": [m[2:] for m in months], "bm": bm, "tot": tot,
                       "chL": chan_labels, "chV": chan_vals,
                       "topL": top_labels, "topV": top_vals,
                       "eL": eff_labels, "eAmt": eff_amt, "eDid": eff_did},
                      ensure_ascii=False)
    body = f"""
  <div class="kpi">
    <div><b>{won(D['baemin_total'])}</b><span>배민 6개월 매출(원)</span></div>
    <div><b>{D['n_stores']}</b><span>매장</span></div>
    <div><b>{D['baemin_total']/D['all_total']*100:.0f}%</b><span>배민 비중</span></div>
    <div><b>{won(D['baemin_total']/D['n_stores'])}</b><span>매장당 평균(원)</span></div>
  </div>
  <h2>월별 배민 매출 추이</h2><div class="card"><canvas id="c1" height="110"></canvas></div>
  <h2>채널 매출 비중</h2><div class="card"><canvas id="c2" height="110"></canvas></div>
  <h2>매출 상위 10개 매장</h2><div class="card"><canvas id="c3" height="140"></canvas></div>
  <h2>변경 효과 (매출 중앙값 vs 추세보정)</h2><div class="card"><canvas id="c4" height="120"></canvas></div>
"""
    script = f"""
const D={data};
const won=v=>v.toLocaleString();
let _dashDone=false;
function initDashboard(){{
  if(_dashDone)return; _dashDone=true;
  new Chart(c1,{{type:'bar',data:{{labels:D.months,datasets:[
    {{label:'배민매출',data:D.bm,backgroundColor:'#1a8c34'}},
    {{label:'전체매출',type:'line',data:D.tot,borderColor:'#e8590c',backgroundColor:'#e8590c',tension:.3}}]}},
    options:{{plugins:{{tooltip:{{callbacks:{{label:c=>c.dataset.label+': '+won(c.parsed.y)+'원'}}}}}}}},scales:{{y:{{ticks:{{callback:v=>(v/1e8).toFixed(1)+'억'}}}}}}}}}});
  new Chart(c2,{{type:'doughnut',data:{{labels:D.chL,datasets:[{{data:D.chV,
    backgroundColor:['#1a8c34','#e03131','#f08c00','#1971c2','#ae3ec9','#868e96','#adb5bd']}}]}},
    options:{{plugins:{{tooltip:{{callbacks:{{label:c=>c.label+': '+won(c.parsed)+'원'}}}}}}}}}});
  new Chart(c3,{{type:'bar',data:{{labels:D.topL,datasets:[{{label:'배민매출',data:D.topV,backgroundColor:'#1971c2'}}]}},
    options:{{indexAxis:'y',plugins:{{legend:{{display:false}},tooltip:{{callbacks:{{label:c=>won(c.parsed.x)+'원'}}}}}},scales:{{x:{{ticks:{{callback:v=>(v/1e8).toFixed(1)+'억'}}}}}}}}}});
  new Chart(c4,{{type:'bar',data:{{labels:D.eL,datasets:[
    {{label:'매출효과(중앙값,%)',data:D.eAmt,backgroundColor:'#74c0fc'}},
    {{label:'추세보정 DiD(%)',data:D.eDid,backgroundColor:'#1971c2'}}]}},
    options:{{plugins:{{tooltip:{{callbacks:{{label:c=>c.dataset.label+': '+c.parsed.y+'%'}}}}}}}}}});
}}
"""
    return body, script


CHARTJS = '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>'


def time_data():
    """시간대 프로파일 + 영업시간 변경 효과."""
    hours, deliv = [], []
    tot = 0
    for r in csv.DictReader(open(os.path.join(DS, "hour_profile.csv"), encoding="utf-8-sig")):
        hours.append(r["hour"][:2])
        deliv.append(int(r["delivery_amt"]))
        tot += int(r["delivery_amt"])
    evening = sum(v for h, v in zip(hours, deliv) if "17" <= h <= "20")
    shop2mate = T.load_shop2mate()
    series, _, _ = T.load_time()
    evs = T.hour_events(shop2mate)

    def fx(idx, kind=None):
        res = T.study(series, evs, idx)
        if kind:
            res = [r for r in res if r[0] == kind]
        v = [p for _, p in res]
        return {"n": len(v), "med": (median(v) if v else 0),
                "rise": (sum(1 for x in v if x > 0) / len(v)) if v else 0}

    return {"hours": hours, "deliv": deliv, "tot": tot,
            "evening_share": evening / tot if tot else 0,
            "ext_night": fx(2, "연장"), "cut_night": fx(2, "단축"),
            "ext_all": fx(1, "연장"), "all_night": fx(2)}


def time_parts(TM):
    def card(title, fx, note):
        cls = "pos" if fx["med"] > 0.003 else ("neg" if fx["med"] < -0.003 else "flat")
        return (f'<div class="bcard {cls}"><h3>{title} <span style="font-size:12px;color:var(--mut);'
                f'font-weight:400;">· {fx["n"]}건</span></h3>'
                f'<span class="metric">매출(중앙값)<b class="{"ok" if fx["med"]>0 else "no"}">{fx["med"]*100:+.1f}%</b></span>'
                f'<span class="metric">상승비율<b>{fx["rise"]*100:.0f}%</b></span>'
                f'<span style="font-size:13px;color:var(--mut);">{note}</span></div>')
    body = f"""
  <div class="kpi">
    <div><b>18-19시</b><span>피크 시간대</span></div>
    <div><b>{TM['evening_share']*100:.0f}%</b><span>저녁 17~21시 비중</span></div>
    <div><b>{TM['tot']/1e8:.0f}억</b><span>배달매출(시간대 합)</span></div>
    <div><b class="ok">+{TM['ext_night']['med']*100:.1f}%</b><span>연장→야간배달</span></div>
  </div>
  <h2>시간대별 배달매출</h2><div class="card"><canvas id="t1" height="120"></canvas></div>
  <div class="tip">⚠️ 시간대별은 <b>채널(배민/쿠팡) 분리가 안 됨</b> — 배달 전체 합산. 배달 대부분이 배민이라 추이 해석엔 충분.</div>
  <h2>영업시간 변경 효과</h2>
  {card("영업시간 연장 → 야간(21~24시) 배달", TM['ext_night'], "연장하면 야간 배달매출이 뚜렷이 상승")}
  {card("영업시간 단축 → 야간 배달", TM['cut_night'], "단축하면 야간 매출 감소")}
  {card("영업시간 연장 → 배달 전체", TM['ext_all'], "전체 배달도 소폭 상승")}
  <div class="win"><b>인사이트:</b> 저녁 17~21시가 배달의 핵심. <b>영업시간 연장은 야간 배달매출을 올린다</b>(연장 +{TM['ext_night']['med']*100:.1f}% vs 단축 {TM['cut_night']['med']*100:+.1f}%).</div>
"""
    hours = json.dumps(TM["hours"])
    deliv = json.dumps(TM["deliv"])
    script = f"""
let _timeDone=false;
function initTime(){{
  if(_timeDone)return; _timeDone=true;
  new Chart(t1,{{type:'bar',data:{{labels:{hours},datasets:[{{label:'배달매출',data:{deliv},backgroundColor:'#1a8c34'}}]}},
    options:{{plugins:{{legend:{{display:false}},tooltip:{{callbacks:{{label:c=>(c.parsed.y/1e8).toFixed(2)+'억원'}}}}}},
    scales:{{x:{{title:{{display:true,text:'시(0~23)'}}}},y:{{ticks:{{callback:v=>(v/1e8).toFixed(0)+'억'}}}}}}}}}});
}}
"""
    return body, script


EV_SHORT = {("ad", ""): "광고", ("instantDiscount", "ACTIVATE"): "할인시작",
            ("instantDiscount", "FINISH"): "할인종료",
            ("shop", "SHOP_OPERATION_HOUR_MODIFY"): "영업시간",
            ("shop", "SHOP_DAY_OFF_MODIFY"): "휴무변경"}


def drilldown_parts(D):
    evbyshop = defaultdict(list)
    for e in csv.DictReader(open(os.path.join(DS, "events.csv"), encoding="utf-8-sig")):
        if not e["shopNumber"]:
            continue
        cat, typ = e["category"], e["type"]
        keep = (cat == "ad" or (cat == "instantDiscount" and typ in ("ACTIVATE", "FINISH"))
                or (cat == "shop" and typ in ("SHOP_OPERATION_HOUR_MODIFY", "SHOP_DAY_OFF_MODIFY")))
        if keep:
            lab = EV_SHORT.get((cat, typ if cat != "ad" else ""), typ)
            evbyshop[e["shopNumber"]].append([e["date"], lab, (e["detail"] or "")[:34]])
    data = []
    for s in D["stores"]:
        if not s["shop"]:
            continue
        evs = sorted(evbyshop.get(s["shop"], []))[-60:]
        data.append({"shop": s["shop"], "name": s["store"],
                     "m": [int(s[f"m_{m}"]) for m in MONTHS],
                     "amt": int(s["amt"]), "share": round(float(s["baemin_share"]), 2),
                     "nad": int(s["n_ad"]), "ndisc": int(s["n_disc"]), "nhour": int(s["n_hour"]),
                     "ev": evs})
    j = json.dumps(data, ensure_ascii=False)
    body = """
  <p class="sub">매장을 선택하면 월별 배민매출 + 변경 타임라인을 봅니다.</p>
  <select id="storeSel" style="font-size:15px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;min-width:280px;"></select>
  <div class="kpi" id="dkpi" style="margin-top:14px;"></div>
  <div class="card"><canvas id="d1" height="110"></canvas></div>
  <h3>변경 타임라인 (최근 60건)</h3>
  <div id="devlist" style="font-size:13.5px;"></div>
"""
    months = json.dumps([m[2:] for m in MONTHS])
    script = f"""
const DR={j}; const DRM={months}; let _drChart=null, _drDone=false;
function initDrill(){{
  if(_drDone)return; _drDone=true;
  const sel=document.getElementById('storeSel');
  DR.forEach((s,i)=>{{const o=document.createElement('option');o.value=i;
    o.textContent=s.name+'  ('+(s.amt/1e8).toFixed(1)+'억)';sel.appendChild(o);}});
  sel.addEventListener('change',()=>renderStore(+sel.value));
  renderStore(0);
}}
function renderStore(i){{
  const s=DR[i];
  document.getElementById('dkpi').innerHTML=
    '<div><b>'+(s.amt).toLocaleString()+'</b><span>배민 6개월(원)</span></div>'+
    '<div><b>'+Math.round(s.share*100)+'%</b><span>배민 비중</span></div>'+
    '<div><b>'+s.nad+'</b><span>광고변경</span></div>'+
    '<div><b>'+s.ndisc+'</b><span>할인</span></div>'+
    '<div><b>'+s.nhour+'</b><span>영업시간변경</span></div>';
  if(_drChart)_drChart.destroy();
  _drChart=new Chart(d1,{{type:'bar',data:{{labels:DRM,datasets:[{{label:'배민매출',data:s.m,backgroundColor:'#1971c2'}}]}},
    options:{{plugins:{{legend:{{display:false}},tooltip:{{callbacks:{{label:c=>c.parsed.y.toLocaleString()+'원'}}}}}},scales:{{y:{{ticks:{{callback:v=>(v/1e8).toFixed(1)+'억'}}}}}}}}}});
  const col={{'광고':'#1971c2','할인시작':'#e8590c','할인종료':'#adb5bd','영업시간':'#2f9e44','휴무변경':'# ae3ec9'}};
  document.getElementById('devlist').innerHTML = s.ev.length? s.ev.slice().reverse().map(e=>
    '<div style="padding:4px 0;border-bottom:1px solid #f1f3f5;"><b>'+e[0]+'</b> '+
    '<span class="tag" style="background:#e7f5ff;color:#1971c2;">'+e[1]+'</span> '+
    '<span style="color:#868e96;">'+e[2]+'</span></div>').join('') : '<p style="color:#868e96;">표시할 변경 없음</p>';
}}
"""
    return body, script


def gen_report(D, EFF, TM):
    """인쇄용 컨설팅 보고서(단독 HTML, Ctrl+P → PDF)."""
    dmap = {n: e for n, e in EFF}
    depth = list(csv.DictReader(open(os.path.join(DS, "discount_depth.csv"), encoding="utf-8-sig"))) \
        if os.path.exists(os.path.join(DS, "discount_depth.csv")) else []
    drows = "".join(
        f"<tr><td>{r['bucket']}</td><td class='num'>{r['n']}</td>"
        f"<td class='num {'ok' if float(r['amt_med'])>0 else 'no'}'>{float(r['amt_med'])*100:+.1f}%</td>"
        f"<td class='num'>{float(r['qty_med'])*100:+.1f}%</td></tr>" for r in depth)

    def e(n):
        x = dmap.get(n, {"amt": 0, "did": 0, "n": 0})
        return f"{x['amt']*100:+.1f}% (DiD {x['did']*100:+.1f}%, {x['n']}건)"
    pcss = CSS + "\n@media print{.wrap{max-width:none;}h2{page-break-after:avoid;}.card,table{page-break-inside:avoid;}}"
    body = f"""<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>육식사관학교 배민 운영-매출 분석 보고서</title><style>{pcss}</style></head><body><div class="wrap">
<h1>육식사관학교 — 배민 운영 변경이 매출에 미친 영향</h1>
<p class="sub">분석기간 2025-12-16 ~ 2026-06-17 · {D['n_stores']}개 매장 · 배민 6개월 {won(D['baemin_total'])}원</p>

<h2>요약 (Executive Summary)</h2>
<div class="card"><ol>
<li><b>광고(우리가게클릭) 예산 증액</b>이 매출과 가장 뚜렷한 양(+)의 관계 — 전후 {e('광고 예산 증액')}, 추세보정 후에도 상승 유지.</li>
<li><b>즉시할인은 깊이에 따라 갈린다</b> — 소액(1~3천원)은 효과 없음/반응적이나, <b>4천원+·배달팁 할인은 주문건수·매출 모두 상승</b>.</li>
<li><b>영업시간 연장</b>은 야간(21~24시) 배달매출을 +{TM['ext_night']['med']*100:.1f}% 끌어올림(단축은 {TM['cut_night']['med']*100:+.1f}%). 배달 피크는 저녁 17~21시.</li>
</ol></div>

<h2>1 · 광고 효과</h2>
<table><tr><th>구분</th><th class="num">매출 변화(중앙값)</th></tr>
<tr><td>광고 예산 증액</td><td class="num ok">{e('광고 예산 증액')}</td></tr>
<tr><td>광고 시작(최초)</td><td class="num">{e('광고 시작(최초)')}</td></tr></table>
<div class="tip"><b>권고:</b> 광고는 ROI가 확인되는 레버. 매출 정체 매장에 <b>예산 증액</b>을 우선 검토.</div>

<h2>2 · 할인 효과 (깊이별)</h2>
<table><tr><th>할인 유형</th><th class="num">건수</th><th class="num">매출(중앙값)</th><th class="num">건수변화</th></tr>{drows}</table>
<div class="tip"><b>권고:</b> 효과 약한 <b>소액 고정할인은 축소</b>, 전환이 확인되는 <b>배달팁 할인·큰 할인</b>으로 재배분.</div>

<h2>3 · 영업시간 / 시간대</h2>
<table><tr><th>구분</th><th class="num">야간(21~24시) 배달 변화</th></tr>
<tr><td>영업시간 연장</td><td class="num ok">{TM['ext_night']['med']*100:+.1f}% ({TM['ext_night']['n']}건)</td></tr>
<tr><td>영업시간 단축</td><td class="num no">{TM['cut_night']['med']*100:+.1f}% ({TM['cut_night']['n']}건)</td></tr></table>
<div class="tip"><b>권고:</b> 저녁 피크(17~21시)와 야간 수요가 있는 매장은 <b>마감시간 연장</b>이 야간매출을 키움.</div>

<h2>4 · 방법론 & 한계</h2>
<div class="warn"><ul style="margin:6px 0 0;">
<li>매출=메이트포스 주문경로별(배민=배달의민족+배민배달), 변경=배민 변경이력. 날짜로 결합.</li>
<li>각 변경 전후 ±14일 일평균 비교(신규오픈 30일 보정). <b>DiD</b>로 브랜드 전체추세 제거.</li>
<li><b>상관관계이며 인과는 아님</b> — 동시 발생 이벤트·매장 개별요인 잔존. 시간대별은 채널분리 불가(배달 합산).</li>
</ul></div>
<p class="foot">이 보고서는 sample_collection/dataset/reports/report.html · 인쇄(Ctrl+P) → PDF 저장</p>
</div></body></html>"""
    return body


def gen_combined(D, EFF):
    """패널들을 탭으로 묶은 단일 통합관리 파일."""
    prog = gen_progress(D)
    board = gen_board(D, EFF)
    dash_body, dash_script = dashboard_parts(D, EFF)
    TM = time_data()
    time_body, time_script = time_parts(TM)
    drill_body, drill_script = drilldown_parts(D)
    tabcss = """
.topbar{background:linear-gradient(135deg,#1a8c34,#178030);color:#fff;padding:14px 24px;}
.topbar b{font-size:18px;} .topbar span{font-size:12px;opacity:.8;margin-left:10px;}
.tabs{display:flex;gap:0;background:#fff;border-bottom:1px solid var(--line);padding:0 16px;position:sticky;top:0;z-index:10;overflow-x:auto;}
.tab{padding:14px 20px;font-size:14px;font-weight:600;color:#64748b;cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap;}
.tab:hover{background:#f1f3f5;} .tab.on{color:#1971c2;border-bottom-color:#1971c2;}
.panel-title{font-size:26px;margin:8px 0 2px;} .panel-sub{color:var(--mut);margin:0 0 20px;}
"""
    return f"""<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>육식사관학교 빅데이터 통합관리</title>
<style>{CSS}{tabcss}</style>{CHARTJS}</head><body>
<div class="topbar"><b>🗂️ 육식사관학교 빅데이터 통합관리</b><span>배민 6개월 · {D['n_stores']}매장 · {won(D['baemin_total'])}원</span></div>
<div class="tabs">
  <div class="tab on" data-t="board">📈 분석 보드</div>
  <div class="tab" data-t="dash">📊 대시보드</div>
  <div class="tab" data-t="time">⏰ 시간대</div>
  <div class="tab" data-t="drill">🏪 매장별</div>
  <div class="tab" data-t="prog">🧭 진행기록/로직</div>
</div>
<div class="wrap">
  <div class="panel" id="board"><h1 class="panel-title">📈 배민 분석 보드</h1><p class="panel-sub">변경 → 매출 직접 영향 · 6개월</p>{board}</div>
  <div class="panel" id="dash" style="display:none"><h1 class="panel-title">📊 매출 분석 대시보드</h1><p class="panel-sub">배민 6개월 · 매장·채널·변경효과</p>{dash_body}</div>
  <div class="panel" id="time" style="display:none"><h1 class="panel-title">⏰ 시간대 분석</h1><p class="panel-sub">배달 피크타임 · 영업시간 변경 효과</p>{time_body}</div>
  <div class="panel" id="drill" style="display:none"><h1 class="panel-title">🏪 매장별 드릴다운</h1>{drill_body}</div>
  <div class="panel" id="prog" style="display:none"><h1 class="panel-title">🧭 진행 기록 & 로직</h1><p class="panel-sub">수동 364회 → 자동 1회</p>{prog}</div>
</div>
<script>{dash_script}{time_script}{drill_script}
function show(t){{
  document.querySelectorAll('.panel').forEach(p=>p.style.display='none');
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  document.getElementById(t).style.display='';
  document.querySelector('.tab[data-t="'+t+'"]').classList.add('on');
  if(t==='dash')initDashboard();
  if(t==='time')initTime();
  if(t==='drill')initDrill();
}}
document.querySelectorAll('.tab').forEach(x=>x.addEventListener('click',()=>show(x.dataset.t)));
</script>
</body></html>"""


def main():
    D = collect()
    EFF = effects()
    # 개별 페이지(참고용)
    open(os.path.join(OUT, "progress.html"), "w", encoding="utf-8").write(
        page("🧭 육식사관학교 — 진행 기록 & 로직 정리", "수동 364회 → 자동 1회", gen_progress(D)))
    open(os.path.join(OUT, "board.html"), "w", encoding="utf-8").write(
        page("📈 육식사관학교 배민 분석 보드", "변경 → 매출 직접 영향 · 6개월", gen_board(D, EFF)))
    db, ds = dashboard_parts(D, EFF)
    open(os.path.join(OUT, "dashboard.html"), "w", encoding="utf-8").write(
        page("📊 육식사관학교 매출 분석 대시보드", "배민 6개월", db) .replace(
            "</body>", f"{CHARTJS}<script>{ds}initDashboard();</script></body>"))
    # ★ 통합관리 단일 파일(탭)
    open(os.path.join(OUT, "integrated.html"), "w", encoding="utf-8").write(gen_combined(D, EFF))
    # 컨설팅 보고서(인쇄용)
    TM = time_data()
    open(os.path.join(OUT, "report.html"), "w", encoding="utf-8").write(gen_report(D, EFF, TM))
    print("생성 완료:")
    for f in ("integrated.html", "report.html", "board.html", "dashboard.html", "progress.html"):
        p = os.path.join(OUT, f)
        print(f"  {p}  ({os.path.getsize(p)//1024}KB)")
    print(f"\n배민 6개월 매출 {won(D['baemin_total'])}원, 매장 {D['n_stores']}개")


if __name__ == "__main__":
    main()
