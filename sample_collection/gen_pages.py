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


def unmatched_lists():
    mate, bae = [], []
    for r in csv.DictReader(open(os.path.join(DS, "store_map.csv"), encoding="utf-8-sig")):
        if r["status"] in ("mate_only", "ambiguous") and r["mate_code"]:
            mate.append((r["mate_code"], r["mate_name"]))
        if r["status"] == "baemin_only" and r["shopNumber"]:
            bae.append((r["shopNumber"], r["baemin_name"]))
    return mate, bae


def gen_match_widget():
    mate, bae = unmatched_lists()
    bae_dl = "".join(f'<option value="{nm} [{sh}]"></option>' for sh, nm in bae)
    rows = ""
    for code, nm in mate:
        rows += (f"<tr><td><b>{nm}</b><br><span style='color:var(--mut);font-size:12px;'>메이트 {code}</span></td>"
                 f"<td><input list='baeDL' placeholder='배민 매장 검색 / 매장명 입력' "
                 f"style='width:100%;padding:6px 9px;border:1px solid var(--line);border-radius:6px;'></td>"
                 f"<td><button class='btn' style='padding:6px 12px;font-size:13px;' "
                 f"onclick=\"addPair('{code}',this)\">매칭 추가</button></td></tr>")
    um_mate = json.dumps({c: n for c, n in mate}, ensure_ascii=False)
    widget = f"""
  <div class="card" id="matchCard">
    <h3>🔗 매장 수동 매칭 <span style="font-size:12px;color:var(--mut);font-weight:400;">· 자동연결 안 된 매장 (메이트 {len(mate)} · 배민 {len(bae)})</span></h3>
    <p style="font-size:13.5px;margin:2px 0 10px;">매출(메이트)엔 있으나 배민 변경이력과 자동연결이 안 된 매장입니다.
    오른쪽 칸에 <b>배민 매장을 검색해 고르거나 매장명을 입력</b>하고 ‘매칭 추가’를 누르세요.
    결과를 <b>CSV로 다운로드</b>해 보내주시면 영구 반영(<code>dataset/manual_map.csv</code>)합니다. (브라우저에 자동 저장됨)</p>
    <table style="font-size:13px;"><tr><th>메이트 매장(매출)</th><th>배민 매장 지정</th><th></th></tr>{rows}</table>
    <datalist id="baeDL">{bae_dl}</datalist>
    <div style="margin:12px 0 6px;display:flex;gap:8px;align-items:center;">
      <b>매칭 결과</b>
      <button class="btn" style="padding:6px 12px;font-size:13px;background:#2f9e44;" onclick="dlMatch()">⬇ CSV 다운로드</button>
      <button class="btn" style="padding:6px 12px;font-size:13px;background:#868e96;" onclick="clearMatch()">비우기</button>
    </div>
    <div id="matchOut"></div>
  </div>
"""
    return widget, "const UM_MATE=" + um_mate + ";\n" + MATCH_JS


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


# ---- 차트 JS (일반 문자열: 중괄호 escape 불필요) ----
MATCH_JS = r"""
let pairs=JSON.parse(localStorage.getItem('uksik_manualmap')||'[]');
function _msave(){localStorage.setItem('uksik_manualmap',JSON.stringify(pairs));renderPairs();}
function addPair(code,btn){
  const inp=btn.closest('tr').querySelector('input'); const v=(inp.value||'').trim(); if(!v)return;
  const m=v.match(/\[(\d+)\]/); const shop=m?m[1]:'';
  pairs=pairs.filter(p=>p.code!==code); pairs.push({code:code,name:UM_MATE[code]||code,shop:shop,target:v}); _msave();
}
function delPair(i){pairs.splice(i,1);_msave();}
function clearMatch(){if(confirm('매칭 결과를 모두 비울까요?')){pairs=[];_msave();}}
function renderPairs(){
  const el=document.getElementById('matchOut'); if(!el)return;
  el.innerHTML = pairs.length? '<table><tr><th>메이트코드</th><th>메이트 매장</th><th>지정한 배민 매장</th><th></th></tr>'+
    pairs.map((p,i)=>'<tr><td>'+p.code+'</td><td>'+p.name+'</td><td>'+p.target+'</td>'+
    '<td><span class="hidebtn" style="position:static;" onclick="delPair('+i+')">✕</span></td></tr>').join('')+'</table>'
    : '<p style="color:#868e96;font-size:13px;">아직 매칭한 항목이 없습니다.</p>';
}
function dlMatch(){
  if(!pairs.length){alert('매칭한 항목이 없습니다.');return;}
  const csv='mate_code,shopNumber,target\n'+pairs.map(p=>p.code+','+p.shop+',"'+(p.target||'').replace(/"/g,'')+'"').join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv'}));
  a.download='manual_map.csv';document.body.appendChild(a);a.click();a.remove();
}
function initMatch(){renderPairs();}
"""

HIDE_JS = r"""
function addHideButtons(){
  document.querySelectorAll('.card,.bcard').forEach(el=>{
    if(el.dataset.hb)return; el.dataset.hb='1';
    const b=document.createElement('span'); b.className='hidebtn'; b.textContent='✕'; b.title='이 카드 숨기기';
    b.onclick=()=>{el.style.display='none';};
    if(getComputedStyle(el).position==='static')el.style.position='relative';
    el.appendChild(b);
  });
}
function showAllCards(){document.querySelectorAll('.card,.bcard').forEach(el=>{el.style.display='';});}
"""

# ---- 차트 JS (일반 문자열: 중괄호 escape 불필요) ----
DASH_JS = r"""
let _dashDone=false;
function initDashboard(){
  if(_dashDone)return; _dashDone=true;
  const won=v=>v.toLocaleString();
  new Chart(c1,{type:'bar',data:{labels:DASH.months,datasets:[
    {label:'배민매출',data:DASH.bm,backgroundColor:'#1a8c34'},
    {label:'전체매출',type:'line',data:DASH.tot,borderColor:'#e8590c',backgroundColor:'#e8590c',tension:.3}]},
    options:{scales:{y:{ticks:{callback:v=>(v/1e8).toFixed(1)+'억'}}},plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+won(c.parsed.y)+'원'}}}}});
  const chTot=DASH.chV.reduce((a,b)=>a+b,0);
  new Chart(c2,{type:'doughnut',data:{labels:DASH.chL,datasets:[{data:DASH.chV,
    backgroundColor:['#1a8c34','#e03131','#f08c00','#1971c2','#ae3ec9','#868e96','#adb5bd']}]},
    plugins:[ChartDataLabels],
    options:{plugins:{
      datalabels:{color:'#fff',font:{weight:'bold',size:12},
        formatter:(v)=>{const p=v/chTot*100; return p>=4?p.toFixed(0)+'%':'';}},
      tooltip:{callbacks:{label:c=>c.label+': '+won(c.parsed)+'원 ('+(c.parsed/chTot*100).toFixed(1)+'%)'}},
      legend:{position:'right',labels:{generateLabels:ch=>ch.data.labels.map((l,i)=>({
        text:l+' '+(ch.data.datasets[0].data[i]/chTot*100).toFixed(1)+'%',
        fillStyle:ch.data.datasets[0].backgroundColor[i],index:i}))}}}}});
  new Chart(c3,{type:'bar',data:{labels:DASH.topL,datasets:[{label:'배민매출',data:DASH.topV,backgroundColor:'#1971c2'}]},
    options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>won(c.parsed.x)+'원'}}},scales:{x:{ticks:{callback:v=>(v/1e8).toFixed(1)+'억'}}}}});
  new Chart(c4,{type:'bar',data:{labels:DASH.eL,datasets:[
    {label:'매출효과(중앙값,%)',data:DASH.eAmt,backgroundColor:'#74c0fc'},
    {label:'추세보정 DiD(%)',data:DASH.eDid,backgroundColor:'#1971c2'}]},
    options:{plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+c.parsed.y+'%'}}}}});
}
"""

TIME_JS = r"""
let _timeDone=false;
function initTime(){
  if(_timeDone)return; _timeDone=true;
  new Chart(t1,{type:'bar',data:{labels:TD.hours,datasets:[{label:'배달매출',data:TD.deliv,backgroundColor:'#1a8c34'}]},
    options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>(c.parsed.y/1e8).toFixed(2)+'억원'}}},
    scales:{x:{title:{display:true,text:'시(0~23)'}},y:{ticks:{callback:v=>(v/1e8).toFixed(0)+'억'}}}}});
}
"""

DRILL_JS = r"""
let _drChart=null,_drDone=false;
function initDrill(){
  if(_drDone)return; _drDone=true;
  const sel=document.getElementById('storeSel');
  DR.forEach((s,i)=>{const o=document.createElement('option');o.value=i;
    o.textContent=s.name+'  ('+(s.amt/1e8).toFixed(1)+'억)';sel.appendChild(o);});
  sel.addEventListener('change',()=>renderStore(+sel.value));
  renderStore(0);
}
function renderStore(i){
  const s=DR[i];
  document.getElementById('dkpi').innerHTML=
    '<div><b>'+(s.amt).toLocaleString()+'</b><span>배민 6개월(원)</span></div>'+
    '<div><b>'+Math.round(s.share*100)+'%</b><span>배민 비중</span></div>'+
    '<div><b>'+s.nad+'</b><span>광고변경</span></div>'+
    '<div><b>'+s.ndisc+'</b><span>할인</span></div>'+
    '<div><b>'+s.nhour+'</b><span>영업시간변경</span></div>';
  if(_drChart)_drChart.destroy();
  _drChart=new Chart(d1,{type:'bar',data:{labels:DRM,datasets:[{label:'배민매출',data:s.m,backgroundColor:'#1971c2'}]},
    options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y.toLocaleString()+'원'}}},scales:{y:{ticks:{callback:v=>(v/1e8).toFixed(1)+'억'}}}}});
  document.getElementById('devlist').innerHTML = s.ev.length? s.ev.slice().reverse().map(e=>
    '<div style="padding:4px 0;border-bottom:1px solid #f1f3f5;"><b>'+e[0]+'</b> '+
    '<span class="tag" style="background:#e7f5ff;color:#1971c2;">'+e[1]+'</span> '+
    '<span style="color:#868e96;">'+e[2]+'</span></div>').join('') : '<p style="color:#868e96;">표시할 변경 없음</p>';
  if(window.addHideButtons)addHideButtons();
}
"""


COMPARE_JS = r"""
let _cmpChart=null,_cmpDone=false;
const wonF=v=>(v==null?'-':v.toLocaleString()+'원');
const hhmm=m=>{if(m==null)return'-';let h=Math.floor(m/60),mm=m%60;return String(h).padStart(2,'0')+':'+String(mm).padStart(2,'0');};
const cmpLab=s=>s.name+' ('+(s.amt/1e8).toFixed(1)+'억)';
let _cmpMap={};
function initCompare(){
  if(_cmpDone)return; _cmpDone=true;
  CF.forEach((s,i)=>{_cmpMap[cmpLab(s)]=i;});
  const a=document.getElementById('selA'), b=document.getElementById('selB');
  a.value=cmpLab(CF[0]); b.value=cmpLab(CF[Math.min(1,CF.length-1)]);
  a.addEventListener('change',renderCmp); b.addEventListener('change',renderCmp);
  a.addEventListener('input',renderCmp); b.addEventListener('input',renderCmp);
  renderCmp();
}
function pct(x){return (x>=0?'+':'')+(x*100).toFixed(0)+'%';}
function renderCmp(){
  const ia=_cmpMap[document.getElementById('selA').value], ib=_cmpMap[document.getElementById('selB').value];
  if(ia==null||ib==null)return;
  const A=CF[ia], B=CF[ib];
  // 차트: 월별 배민매출
  if(_cmpChart)_cmpChart.destroy();
  _cmpChart=new Chart(cmpChart,{type:'bar',data:{labels:CFM,datasets:[
    {label:'🟢 '+A.name,data:A.m,backgroundColor:'#2f9e44'},
    {label:'🔵 '+B.name,data:B.m,backgroundColor:'#1971c2'}]},
    options:{plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+c.parsed.y.toLocaleString()+'원'}}},scales:{y:{ticks:{callback:v=>(v/1e8).toFixed(1)+'억'}}}}});
  // 비교표
  const dm=s=>{const d=s.dmix||{};return '소액'+(d.small||0)+'·큰'+(d.big||0)+'·배달팁'+(d.tip||0);};
  const row=(label,va,vb)=>'<tr><td>'+label+'</td><td class="num">'+va+'</td><td class="num">'+vb+'</td></tr>';
  document.getElementById('cmpTable').innerHTML=
    '<table><tr><th>지표</th><th class="num">🟢 표본 '+A.name+'</th><th class="num">🔵 대상 '+B.name+'</th></tr>'+
    row('배민 6개월 매출',wonF(A.amt),wonF(B.amt))+
    row('일평균 배민매출',wonF(A.daily),wonF(B.daily))+
    row('배민 비중',Math.round(A.share*100)+'%',Math.round(B.share*100)+'%')+
    row('야간(21~24시) 배달비중',Math.round(A.night*100)+'%',Math.round(B.night*100)+'%')+
    row('광고 변경수 / 월예산',A.nad+' / '+wonF(A.budget),B.nad+' / '+wonF(B.budget))+
    row('즉시할인(유형)',A.ndisc+' ('+dm(A)+')',B.ndisc+' ('+dm(B)+')')+
    row('영업종료시각(최근)',hhmm(A.close),hhmm(B.close))+
    row('영업시간 변경수',A.nhour,B.nhour)+'</table>';
  // 컨설팅
  let out=[];
  const add=(cls,t)=>out.push('<div class="bcard '+cls+'"><h3>'+t.h+'</h3><p style="margin:0;font-size:14px;">'+t.b+'</p></div>');
  // 매출
  const r=B.daily/A.daily;
  if(r<0.9) add('neg',{h:'매출 격차',b:'대상 일평균 배민매출이 표본의 <b>'+Math.round(r*100)+'%</b> 수준('+wonF(B.daily)+' vs '+wonF(A.daily)+'). 아래 운영 차이를 개선 여지로 검토.'});
  else if(r>1.1) add('pos',{h:'매출 우위',b:'대상이 표본보다 일평균 매출이 높음('+Math.round(r*100)+'%). 표본을 역으로 벤치마크할 여지.'});
  else add('flat',{h:'매출 유사',b:'두 매장 일평균 배민매출이 비슷('+wonF(B.daily)+' vs '+wonF(A.daily)+').'});
  // 광고
  if((B.budget||0) < (A.budget||0)*0.8 || B.nad < A.nad)
    add('neg',{h:'광고 투자 부족 가능',b:'표본은 광고변경 '+A.nad+'건·월예산 '+wonF(A.budget)+', 대상은 '+B.nad+'건·'+wonF(B.budget)+'. 광고 예산 증액이 매출과 가장 뚜렷한 양(+) 신호였음 → <b>대상 광고 강화 검토</b>.'});
  else add('pos',{h:'광고 운영 양호',b:'대상 광고 투자가 표본과 대등하거나 그 이상.'});
  // 할인
  const aGood=(A.dmix.tip||0)+(A.dmix.big||0), bSmall=(B.dmix.small||0), bGood=(B.dmix.tip||0)+(B.dmix.big||0);
  if(aGood>0 && bGood===0 && bSmall>0)
    add('neg',{h:'할인 설계 차이',b:'표본은 <b>배달팁·4천원+ 할인</b>(효과 확인된 유형)을 쓰는데, 대상은 <b>소액 고정할인 위주</b>(효과 낮음). 대상 할인을 배달팁/큰할인 중심으로 재설계 권장.'});
  else add('flat',{h:'할인 운영',b:'표본 '+dm2(A)+' / 대상 '+dm2(B)+'.'});
  // 영업시간
  if(A.close!=null && B.close!=null && B.close < A.close-15)
    add('neg',{h:'마감시간 짧음',b:'대상 영업종료 <b>'+hhmm(B.close)+'</b> vs 표본 <b>'+hhmm(A.close)+'</b>. 영업시간 연장은 야간 배달매출을 올렸음('+'표본 야간비중 '+Math.round(A.night*100)+'%) → <b>마감 연장 검토</b>.'});
  else if(A.close!=null && B.close!=null && B.close > A.close+15)
    add('pos',{h:'마감시간 우위',b:'대상이 표본보다 늦게까지 영업('+hhmm(B.close)+' vs '+hhmm(A.close)+').'});
  document.getElementById('cmpAdvice').innerHTML=out.join('');
  if(window.addHideButtons)addHideButtons();
}
function dm2(s){const d=s.dmix||{};return '소액'+(d.small||0)+'·큰'+(d.big||0)+'·배달팁'+(d.tip||0);}
"""


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
  <div class="tip"><b>추세보정(DiD)이란?</b> 연한 막대(매출효과)는 변경 <b>전후 ±14일</b> 단순 비교라 계절·브랜드 전체 흐름이 섞여 있습니다.
  진한 막대(추세보정)는 <b>같은 기간 브랜드 전체 매출 변화를 빼서</b>(이중차분, Difference-in-Differences) “그 변경 <b>자체의 순수 효과</b>”만 남긴 값입니다.
  → 두 막대가 <b>비슷하면</b> 효과가 견고하고(예: 광고 증액), 추세보정만 <b>크게 작아지면</b> 변화의 상당 부분이 그 변경이 아니라 <b>전체 흐름</b> 때문이라는 뜻입니다(예: 즉시할인).</div>
"""
    script = "const DASH=" + data + ";\n" + DASH_JS
    return body, script


CHARTJS = ('<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>'
           '<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>')


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
    td = json.dumps({"hours": TM["hours"], "deliv": TM["deliv"]}, ensure_ascii=False)
    script = "const TD=" + td + ";\n" + TIME_JS
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
    script = "const DR=" + j + ";\nconst DRM=" + months + ";\n" + DRILL_JS
    return body, script


def report_inner(D, EFF, TM):
    """컨설팅 보고서 내부 콘텐츠(탭/단독 공용)."""
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
    inner = f"""
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
<p class="foot">메이트포스 매출 + 배민 변경이력 결합 분석 · 인쇄(Ctrl+P) → PDF 저장</p>
"""
    return inner


def gen_report(D, EFF, TM):
    """단독 인쇄용 보고서 HTML."""
    pcss = CSS + "\n@media print{.wrap{max-width:none;}h2{page-break-after:avoid;}.card,table{page-break-inside:avoid;}}"
    return (f"""<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>육식사관학교 배민 운영-매출 분석 보고서</title><style>{pcss}</style></head>
<body><div class="wrap">{report_inner(D, EFF, TM)}</div></body></html>""")


def store_features(D):
    """매장별 운영 특성(비교/컨설팅용)."""
    import analyze_discount as DISC
    shop2mate = T.load_shop2mate()
    series, _, _ = T.load_time()
    night_share = {}
    for mate, s in series.items():
        deliv = sum(v[1] for v in s.values())
        night = sum(v[2] for v in s.values())
        night_share[mate] = (night / deliv) if deliv else 0

    feat = {}  # shop -> {budget, close, dmix}
    for f in glob.glob(os.path.join(DS, "stores", "*.json")):
        d = json.load(open(f, encoding="utf-8"))
        shop = str(d.get("shopNumber", ""))
        budget, bts = None, ""
        for ev in d.get("ad", []) or []:
            if ev.get("historyType") != "CPC_BUDGET":
                continue
            try:
                b = json.loads(ev.get("afterValue") or "").get("cpc", {}).get("monthlyBudget")
            except Exception:
                b = None
            ts = ev.get("createdAt") or ""
            if b is not None and ts >= bts:
                budget, bts = b, ts
        close, cts = None, ""
        dmix = {"small": 0, "big": 0, "tip": 0, "pct": 0, "other": 0}
        for ev in d.get("shop", []) or []:
            if ev.get("changedItem") == "SHOP_OPERATION_HOUR_MODIFY":
                ts = ev.get("createdAt") or ""
                c = T.parse_close(ev.get("afterState"))
                if c is not None and ts >= cts:
                    close, cts = c, ts
        for ev in d.get("instantDiscount", []) or []:
            if ev.get("type") != "ACTIVATE":
                continue
            b = DISC.classify(ev.get("name"))
            key = ({"1000원": "small", "2000원": "small", "3000원": "small", "4000원+": "big",
                    "배달팁": "tip", "%할인": "pct"}).get(b, "other")
            dmix[key] += 1
        feat[shop] = {"budget": budget, "close": close, "dmix": dmix}

    out = []
    for s in D["stores"]:
        sh = s["shop"]
        if not sh:
            continue
        days = int(s["days"]) or 1
        fe = feat.get(sh, {"budget": None, "close": None, "dmix": {}})
        out.append({"shop": sh, "name": s["store"],
                    "amt": int(s["amt"]), "daily": round(int(s["amt"]) / days),
                    "share": round(float(s["baemin_share"]), 3),
                    "m": [int(s[f"m_{m}"]) for m in MONTHS],
                    "nad": int(s["n_ad"]), "ndisc": int(s["n_disc"]), "nhour": int(s["n_hour"]),
                    "budget": fe["budget"], "close": fe["close"],
                    "night": round(night_share.get(shop2mate.get(sh), 0), 3),
                    "dmix": fe["dmix"]})
    return out


def _perstore_uplift(sales, first, days):
    res = A.study(sales, first, days, ramp=A.RAMP)
    d = defaultdict(list)
    for r in res:
        d[r["shop"]].append(r["amt_pct"])
    return {k: mean(v) for k, v in d.items()}


def recommend_samples(D, topn=10):
    """할인·우가클광고·영업시간연장으로 매출상승 효과가 컸던 매장 추천."""
    import analyze_discount as DISC
    from datetime import date as _date
    sales, first = A.load_sales()
    bud = A.ad_budget_events()
    inc = sorted(set((s, t) for s, t, bb, ab in bud if bb is not None and ab is not None and ab > bb))
    ad_up = _perstore_uplift(sales, first, inc)
    bigtip = set()
    for f in glob.glob(os.path.join(DS, "stores", "*.json")):
        d = json.load(open(f, encoding="utf-8"))
        shop = str(d.get("shopNumber", ""))
        for ev in d.get("instantDiscount", []) or []:
            if ev.get("type") != "ACTIVATE":
                continue
            if DISC.classify(ev.get("name")) in ("4000원+", "배달팁"):
                ts = ev.get("modifiedAt") or ""
                if ts:
                    bigtip.add((shop, _date(int(ts[:4]), int(ts[5:7]), int(ts[8:10]))))
    disc_up = _perstore_uplift(sales, first, sorted(bigtip))
    # 영업시간 연장 → 야간배달 상승 (매장별)
    shop2mate = T.load_shop2mate()
    mate2shop = {m: s for s, m in shop2mate.items()}
    series, _, _ = T.load_time()
    firstT = {m: min(s) for m, s in series.items() if s}
    hour_up = defaultdict(list)
    for mate, t, kind in T.hour_events(shop2mate):
        if kind != "연장":
            continue
        s = series.get(mate)
        if not s or (t - firstT[mate]).days < A.RAMP:
            continue
        pre, post = T.wmean(s, t, -A.WIN, -1, 1), T.wmean(s, t, 1, A.WIN, 1)  # 배달 전체(안정적)
        if pre and post and pre[1] >= A.MINOBS and post[1] >= A.MINOBS and pre[0] > 0:
            sh = mate2shop.get(mate)
            if sh:
                hour_up[sh].append(min((post[0] - pre[0]) / pre[0], 1.0))  # 과도값 캡
    hour_up = {k: mean(v) for k, v in hour_up.items()}
    name = {s["shop"]: s["store"] for s in D["stores"]}
    amt = {s["shop"]: int(s["amt"]) for s in D["stores"]}
    cand = []
    for shop in set(ad_up) | set(disc_up) | set(hour_up):
        if amt.get(shop, 0) < 1e8:
            continue
        reasons = []
        if ad_up.get(shop, 0) >= 0.05:
            reasons.append(("우가클 광고", min(ad_up[shop], 1.0)))
        if disc_up.get(shop, 0) >= 0.05:
            reasons.append(("배달팁·큰할인", min(disc_up[shop], 1.0)))
        if hour_up.get(shop, 0) >= 0.05:
            reasons.append(("영업시간 연장", hour_up[shop]))
        if reasons:
            cand.append({"name": name.get(shop, shop), "amt": amt.get(shop, 0),
                         "reasons": reasons, "score": sum(u for _, u in reasons)})
    cand.sort(key=lambda x: -x["score"])
    return cand[:topn]


def compare_parts(D, feats):
    cf = json.dumps(feats, ensure_ascii=False)
    recos = recommend_samples(D)
    reco_rows = "".join(
        f"<tr><td>{c['name']}</td><td class='num'>{c['amt']/1e8:.1f}억</td>"
        f"<td>{' · '.join(f'{nm} +{u*100:.0f}%' for nm, u in c['reasons'])}</td></tr>"
        for c in recos)
    datalist = "".join(
        f'<option value="{s["name"]} ({s["amt"]/1e8:.1f}억)"></option>' for s in feats)
    body = f"""
  <p class="sub">표본매장(잘되는/기준)과 대상매장(진단 대상)을 골라 운영을 비교하고 컨설팅 코멘트를 받습니다. <b>칸에 매장명을 입력하면 검색</b>됩니다.</p>
  <div style="display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 14px;">
    <div><div style="font-size:12px;color:var(--mut);font-weight:700;">🟢 표본매장 (기준)</div>
      <input id="selA" list="storeDL" autocomplete="off" placeholder="매장명 검색…"
        style="font-size:15px;padding:8px 12px;border:2px solid #2f9e44;border-radius:8px;min-width:280px;"></div>
    <div><div style="font-size:12px;color:var(--mut);font-weight:700;">🔵 대상매장 (진단)</div>
      <input id="selB" list="storeDL" autocomplete="off" placeholder="매장명 검색…"
        style="font-size:15px;padding:8px 12px;border:2px solid #1971c2;border-radius:8px;min-width:280px;"></div>
  </div>
  <datalist id="storeDL">{datalist}</datalist>
  <div class="win" style="margin-bottom:6px;"><b>🟢 추천 표본매장</b> — 할인·우가클광고·영업시간 조정으로 <b>매출상승 효과가 컸던</b> 매장(전후 ±14일, 5%↑). 표본으로 골라 부진점과 비교해 보세요.</div>
  <table><tr><th>매장</th><th class="num">배민매출</th><th>효과 본 레버(상승폭)</th></tr>{reco_rows}</table>
  <div class="card" style="margin-top:16px;"><canvas id="cmpChart" height="110"></canvas></div>
  <div id="cmpTable"></div>
  <h2>🧠 비교 컨설팅</h2>
  <div id="cmpAdvice"></div>
"""
    months = json.dumps([m[2:] for m in MONTHS])
    script = "const CF=" + cf + ";\nconst CFM=" + months + ";\n" + COMPARE_JS
    return body, script


def _hhmm(m):
    if m is None:
        return "-"
    return f"{m//60:02d}:{m%60:02d}"


def _ftime(m):
    """사장님 친화 시각 표기. 1440=자정, 그 이후는 '새벽 X시'."""
    if m is None:
        return "-"
    if m == 1440:
        return "자정(24시)"
    if m > 1440:
        x = m - 1440
        return f"새벽 {x//60}시" + (f" {x%60}분" if x % 60 else "")
    h, mm = m // 60, m % 60
    return f"{h}시" + (f" {mm}분" if mm else "")


def _wman(v):
    """금액을 만원/억원으로."""
    v = round(v)
    if abs(v) >= 1e8:
        return f"{v/1e8:.1f}억원"
    return f"{round(v/1e4):,}만원"


def _pctile(vals, p):
    v = sorted(x for x in vals if x is not None)
    if not v:
        return None
    return v[min(len(v) - 1, int(p * len(v)))]


def prescribe_data(D, EFF, TM, feats):
    """매장별 처방: 현재→권장 설정 + 기대 매출증가액(원/월). 매출 기준(마진 별도)."""
    dmap = {n: e for n, e in EFF}
    ad_opt = dmap.get("광고 예산 증액", {}).get("amt", 0.0)   # 낙관(전후)
    ad_did = dmap.get("광고 예산 증액", {}).get("did", 0.0)   # 보수(추세보정)
    hour_med = TM.get("ext_all", {}).get("med", 0.0)          # 영업시간 연장(배달 전체)
    tip = big = 0.0
    dp = os.path.join(DS, "discount_depth.csv")
    if os.path.exists(dp):
        for r in csv.DictReader(open(dp, encoding="utf-8-sig")):
            if r["bucket"] == "배달팁":
                tip = float(r["amt_med"])
            if r["bucket"] == "4000원+":
                big = float(r["amt_med"])
    disc_med = max(tip, 0.0)  # 보수적으로 배달팁 기준

    # 피어 그룹: 배민매출 규모 3분위(대/중/소)
    order = sorted(feats, key=lambda s: -s["amt"])
    n = len(order) or 1
    def tier_of(i):
        return "대형" if i < n / 3 else ("중형" if i < 2 * n / 3 else "소형")
    groups = {"대형": [], "중형": [], "소형": []}
    for i, s in enumerate(order):
        groups[tier_of(i)].append(s)
    bench = {}
    for tk, arr in groups.items():
        bench[tk] = {
            "close_p75": _pctile([s["close"] for s in arr], 0.75),
            "budget_med": (median([s["budget"] for s in arr if s["budget"]])
                           if any(s["budget"] for s in arr) else None),
            "n": len(arr),
        }

    eff = {"hour": round(hour_med, 4), "ad": round(ad_opt, 4), "disc": round(disc_med, 4)}
    benchJS = {tk: {"close": (min(b["close_p75"], 1440) if b["close_p75"] else None),
                    "budget": round(b["budget_med"] or 0)} for tk, b in bench.items()}

    stores, default_total = [], 0.0
    for i, s in enumerate(order):
        tk = tier_of(i)
        b = benchJS[tk]
        months = sum(1 for x in s["m"] if x > 0) or 1
        monthly = s["amt"] / months
        good = (s["dmix"].get("tip", 0) + s["dmix"].get("big", 0))
        small = s["dmix"].get("small", 0)
        disc = "good" if good > 0 else ("small" if small > 0 else "none")
        stores.append({"name": s["name"], "tier": tk, "monthly": round(monthly),
                       "close": s["close"], "budget": round(s["budget"] or 0), "disc": disc})
        # 프리필 기준 기본 기대치(헤드라인용)
        t = 0.0
        if s["close"] is not None and b["close"] and 18 * 60 <= s["close"] < b["close"] - 15:
            t += monthly * hour_med
        if b["budget"] and (s["budget"] or 0) < b["budget"] * 0.8:
            t += monthly * ad_opt
        if disc != "good" and disc_med > 0:
            t += monthly * disc_med
        default_total += t
    return {"eff": eff, "bench": benchJS, "stores": stores}, default_total


PRESCRIBE_JS = r"""
let _prMap={}, _prDone=false;
const man=v=>{v=Math.round(v||0); if(Math.abs(v)>=1e8)return (v/1e8).toFixed(1)+'억원'; return Math.round(v/1e4).toLocaleString()+'만원';};
function prFtime(m){ if(m==null)return'-'; if(m===1440)return'자정(24시)';
  if(m>1440){const x=m-1440;return '새벽 '+Math.floor(x/60)+'시'+(x%60?' '+x%60+'분':'');}
  const h=Math.floor(m/60),mm=m%60; return h+'시'+(mm?' '+mm+'분':''); }
function initPrescribe(){
  if(_prDone)return; _prDone=true;
  // 마감시각 옵션(18:00~새벽2시)
  const cs=document.getElementById('prClose');
  for(let m=18*60;m<=1560;m+=30){const o=document.createElement('option');o.value=m;o.textContent=prFtime(m);cs.appendChild(o);}
  PRB.stores.forEach((s,i)=>{_prMap[s.name]=i;});
  const sel=document.getElementById('prSel');
  PRB.stores.slice().sort((a,b)=>b.monthly-a.monthly).forEach(s=>{const o=document.createElement('option');
    o.value=s.name;o.textContent=s.name;sel.appendChild(o);});
  sel.addEventListener('input',prefill); sel.addEventListener('change',prefill);
  ['prClose','prBudget','prDisc','prMonthly'].forEach(id=>{
    document.getElementById(id).addEventListener('input',renderPr);
    document.getElementById(id).addEventListener('change',renderPr);});
  sel.value=sel.options[0]? sel.options[0].value : '';
  prefill();
}
function prefill(){
  const i=_prMap[document.getElementById('prSel').value]; if(i==null)return;
  const s=PRB.stores[i];
  // 가장 가까운 마감 옵션
  const cs=document.getElementById('prClose');
  if(s.close!=null){let best=cs.options[0].value,bd=1e9;
    for(const o of cs.options){const d=Math.abs(o.value-s.close); if(d<bd){bd=d;best=o.value;}} cs.value=best;}
  else cs.value=1320;
  document.getElementById('prBudget').value = s.budget? Math.round(s.budget/1e4):'';
  document.getElementById('prDisc').value = s.disc;
  document.getElementById('prMonthly').value = Math.round(s.monthly/1e4);
  renderPr();
}
function renderPr(){
  const i=_prMap[document.getElementById('prSel').value]; if(i==null)return;
  const s=PRB.stores[i], b=PRB.bench[s.tier], e=PRB.eff;
  const closeMin=+document.getElementById('prClose').value;
  const budget=(+document.getElementById('prBudget').value||0)*1e4;
  const disc=document.getElementById('prDisc').value;
  const monthly=(+document.getElementById('prMonthly').value||0)*1e4;
  const recs=[];
  const tgt=b.close?Math.min(b.close,1440):null;
  if(tgt && closeMin>=18*60 && closeMin<tgt-15)
    recs.push({lever:'🕒 영업시간 늘리기',cur:prFtime(closeMin),tgt:prFtime(tgt),won:monthly*e.hour,
      why:'비슷한 규모 매장들은 보통 '+prFtime(tgt)+'까지 영업해요. 마감을 늘린 매장들은 배달매출이 평균 +'+(e.hour*100).toFixed(1)+'% 올랐습니다. 다만 야간 인건비가 늘 수 있어요.'});
  if(b.budget && budget<b.budget*0.8)
    recs.push({lever:'📣 가게 광고(우리가게클릭) 늘리기',cur:budget?('월 '+Math.round(budget/1e4)+'만원'):'거의 안 함',tgt:'월 '+Math.round(b.budget/1e4)+'만원',won:monthly*e.ad,
      why:'비슷한 매장들은 광고비로 월 '+Math.round(b.budget/1e4)+'만원쯤 써요. 광고를 늘린 매장은 매출이 평균 +'+(e.ad*100).toFixed(1)+'% 올랐습니다. 광고비가 추가로 들어가는 점은 함께 봐주세요.'});
  if(disc!=='good')
    recs.push({lever:'🏷️ 할인 바꾸기',cur:(disc==='small'?'소액 할인 위주':'할인 안 함'),tgt:'배달팁 할인 / 큰 금액 할인',won:monthly*e.disc,
      why:'적은 금액(1~3천원) 할인은 효과가 거의 없었어요. 배달팁 할인이나 큰 금액 할인으로 바꾼 매장은 매출이 평균 +'+(e.disc*100).toFixed(1)+'% 올랐습니다. 할인은 마진이 줄어드는 점은 함께 봐주세요.'});
  const total=recs.reduce((a,r)=>a+r.won,0);
  let h='<div class="kpi"><div><b>'+man(monthly)+'</b><span>입력한 한 달 배달매출</span></div>'+
    '<div><b class="ok">+'+man(total)+'</b><span>바꾸면 늘어날 매출(월, 예상)</span></div>'+
    '<div><b class="ok">+'+(monthly?Math.round(total/monthly*100):0)+'%</b><span>예상 상승률</span></div>'+
    '<div><b>'+s.tier+'</b><span>우리 매장 규모</span></div></div>';
  if(!recs.length) h+='<div class="bcard flat"><h3>지금도 잘 하고 있어요 👍</h3><p style="margin:0;font-size:14px;">입력한 설정이 비슷한 매장들과 비교해 양호합니다. 지금처럼 유지하세요.</p></div>';
  recs.forEach(r=>{
    h+='<div class="bcard pos"><h3>'+r.lever+'  <span style="font-size:13px;color:#2f9e44;font-weight:700;">월 매출 +'+man(r.won)+' 예상</span></h3>'+
      '<div style="font-size:15px;margin:8px 0;">지금 <b>'+r.cur+'</b> &nbsp;→&nbsp; 이렇게 <b class="ok">'+r.tgt+'</b></div>'+
      '<p style="margin:4px 0 0;font-size:14px;color:#495057;line-height:1.6;">'+r.why+'</p></div>';
  });
  document.getElementById('prCards').innerHTML=h;
  if(window.addHideButtons)addHideButtons();
}
"""


def prescribe_parts(D, EFF, TM, feats):
    data, default_total = prescribe_data(D, EFF, TM, feats)
    inp = "padding:8px 11px;font-size:15px;border:1px solid var(--line);border-radius:8px;"
    body = f"""
  <div class="win"><b>💊 우리 매장 매출 올리는 법</b> — 매장을 고른 뒤 <b>지금 실제 설정값을 입력</b>하면,
  <b>무엇을 바꾸면 매출이 얼마나 오를지</b> 바로 알려드려요. 비슷한 매장들의 6개월 실제 데이터가 근거입니다.</div>
  <div class="card">
    <div style="margin-bottom:10px;"><b>1) 매장 선택</b> &nbsp;
      <input id="prSel" list="prDL" autocomplete="off" placeholder="매장명 입력…" style="{inp}border:2px solid #1a8c34;min-width:260px;">
      <datalist id="prDL">{''.join(f'<option value="{s["name"]}"></option>' for s in data["stores"])}</datalist>
    </div>
    <div style="margin:6px 0 4px;"><b>2) 지금 우리 매장 실제 설정 입력</b> <span style="color:var(--mut);font-size:12px;">(과거값이 자동으로 채워지니, 현재와 다르면 고쳐주세요)</span></div>
    <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;">
      <label>영업 마감시각<br><select id="prClose" style="{inp}"></select></label>
      <label>우가클 월 광고예산<br><input id="prBudget" type="number" min="0" step="1" style="{inp}width:120px;"> 만원</label>
      <label>지금 하는 할인<br><select id="prDisc" style="{inp}">
        <option value="none">할인 안 함</option>
        <option value="small">소액 할인(1~3천원)</option>
        <option value="good">배달팁/큰 금액 할인</option></select></label>
      <label>한 달 배달매출<br><input id="prMonthly" type="number" min="0" step="1" style="{inp}width:120px;"> 만원</label>
    </div>
  </div>
  <div id="prCards" style="margin-top:6px;"></div>
  <div class="warn" style="margin-top:16px;font-size:13px;">※ 금액은 <b>비슷한 매장들이 실제로 바꿨을 때의 변화</b> 기반 <b>예상치</b>예요.
  광고는 광고비가, 할인은 마진이 함께 들어가니 <b>참고용</b>으로 봐주세요. (전 매장 합산 기준 월 약 +{_wman(default_total)} 기회)</div>
"""
    script = "const PRB=" + json.dumps(data, ensure_ascii=False) + ";\n" + PRESCRIBE_JS
    return body, script


def gen_combined(D, EFF):
    """패널들을 탭으로 묶은 단일 통합관리 파일."""
    prog = gen_progress(D)
    board = gen_board(D, EFF)
    dash_body, dash_script = dashboard_parts(D, EFF)
    TM = time_data()
    time_body, time_script = time_parts(TM)
    drill_body, drill_script = drilldown_parts(D)
    feats = store_features(D)
    cmp_body, cmp_script = compare_parts(D, feats)
    presc_body, presc_script = prescribe_parts(D, EFF, TM, feats)
    match_widget, match_script = gen_match_widget()
    tabcss = """
.topbar{background:linear-gradient(135deg,#1a8c34,#178030);color:#fff;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;}
.topbar b{font-size:18px;} .topbar span{font-size:12px;opacity:.8;margin-left:10px;}
.topbar .showall{background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:7px;padding:7px 12px;font-size:12.5px;font-weight:600;cursor:pointer;}
.topbar .showall:hover{background:rgba(255,255,255,.32);}
.tabs{display:flex;gap:0;background:#fff;border-bottom:1px solid var(--line);padding:0 16px;position:sticky;top:0;z-index:10;overflow-x:auto;}
.tab{padding:14px 20px;font-size:14px;font-weight:600;color:#64748b;cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap;}
.tab:hover{background:#f1f3f5;} .tab.on{color:#1971c2;border-bottom-color:#1971c2;}
.panel-title{font-size:26px;margin:8px 0 2px;} .panel-sub{color:var(--mut);margin:0 0 20px;}
.hidebtn{position:absolute;top:6px;right:9px;cursor:pointer;color:#ced4da;font-size:13px;font-weight:700;line-height:1;}
.hidebtn:hover{color:#e03131;}
"""
    return f"""<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>육식사관학교 빅데이터 통합관리</title>
<meta name="robots" content="noindex,nofollow">
<style>{CSS}{tabcss}</style>{CHARTJS}</head><body>
<div class="topbar"><div><b>🗂️ 육식사관학교 빅데이터 통합관리</b><span>배민 6개월 · {D['n_stores']}매장 · {won(D['baemin_total'])}원</span></div>
<button class="showall" onclick="showAllCards()">🔄 숨긴 카드 모두 보이기</button></div>
<div class="tabs">
  <div class="tab on" data-t="board">📈 분석 보드</div>
  <div class="tab" data-t="dash">📊 대시보드</div>
  <div class="tab" data-t="time">⏰ 시간대</div>
  <div class="tab" data-t="drill">🏪 매장별</div>
  <div class="tab" data-t="cmp">⚖️ 표본vs대상</div>
  <div class="tab" data-t="presc">💊 처방</div>
  <div class="tab" data-t="prog">🧭 진행기록/로직</div>
</div>
<div class="wrap">
  <div class="panel" id="board"><h1 class="panel-title">📈 배민 분석 보드</h1><p class="panel-sub">변경 → 매출 직접 영향 · 6개월</p>{match_widget}{board}</div>
  <div class="panel" id="dash" style="display:none"><h1 class="panel-title">📊 매출 분석 대시보드</h1><p class="panel-sub">배민 6개월 · 매장·채널·변경효과</p>{dash_body}</div>
  <div class="panel" id="time" style="display:none"><h1 class="panel-title">⏰ 시간대 분석</h1><p class="panel-sub">배달 피크타임 · 영업시간 변경 효과</p>{time_body}</div>
  <div class="panel" id="drill" style="display:none"><h1 class="panel-title">🏪 매장별 드릴다운</h1>{drill_body}</div>
  <div class="panel" id="cmp" style="display:none"><h1 class="panel-title">⚖️ 표본매장 vs 대상매장</h1>{cmp_body}</div>
  <div class="panel" id="presc" style="display:none"><h1 class="panel-title">💊 매장별 최적 처방</h1><p class="panel-sub">현재 → 권장 설정 + 기대 매출증가액(추정)</p>{presc_body}</div>
  <div class="panel" id="prog" style="display:none"><h1 class="panel-title">🧭 진행 기록 & 로직</h1><p class="panel-sub">수동 364회 → 자동 1회</p>{prog}</div>
</div>
<script>{dash_script}{time_script}{drill_script}{cmp_script}{presc_script}{match_script}{HIDE_JS}
function show(t){{
  document.querySelectorAll('.panel').forEach(p=>p.style.display='none');
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  document.getElementById(t).style.display='';
  document.querySelector('.tab[data-t="'+t+'"]').classList.add('on');
  if(t==='dash')initDashboard();
  if(t==='time')initTime();
  if(t==='drill')initDrill();
  if(t==='cmp')initCompare();
  if(t==='presc')initPrescribe();
  addHideButtons();
}}
document.querySelectorAll('.tab').forEach(x=>x.addEventListener('click',()=>show(x.dataset.t)));
initMatch(); addHideButtons();
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
    # ★ 통합관리 단일 파일(탭) — 배포용 이름 '빅데이터 통합관리'
    combined = gen_combined(D, EFF)
    open(os.path.join(OUT, "integrated.html"), "w", encoding="utf-8").write(combined)
    open(os.path.join(OUT, "빅데이터 통합관리.html"), "w", encoding="utf-8").write(combined)
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
