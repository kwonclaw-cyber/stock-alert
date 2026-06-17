/* ============================================================
   메이트포스 '시간대별 매출' 자동수집 (슬림+월별분할, 콘솔용)
   ------------------------------------------------------------
   '시간대별 매출분석' 화면(로그인 상태)에서 F12 → Console → 붙여넣기 → Enter.
   6개월을 자동 수집해 월별 슬림 파일(matetech_time_slim_YYYYMM.json)로 다운로드.

   슬림 필드: d(날짜) s(매장코드) t(시간대 orderTm) a(총매출) q(총건수)
             da(배달매출) dq(배달건수)
   ※ 시간대별은 채널(배민/쿠팡) 분리 안 됨 → da는 배달 전체 합산.
   ============================================================ */
(async function () {
  const START = '20251216';   // 시작일
  const END   = '20260617';   // 종료일 (6개월 전체)
  const PAGE_SIZE = 3000;
  const SLEEP_MS  = 220;

  const TEMPLATE =
    'https://www.matetech.co.kr/api/srv0030/brands/100683/sales/analysis/time' +
    '?hqBrandId=100683&branchCd=&svUserId=&svUserNm=&msStrId=&strType=' +
    '&shopInShopSalesType=&nameplate=&dailyYn=N&storeYn=Y&searchDate=oper' +
    '&enpCd=mp_sandle&enpNm=%EC%82%B0%EB%93%A4%EA%B7%B8%EB%A6%B0&corpCd=1002' +
    '&brandCd=20002&brandNm=%EC%9C%A1%EC%8B%9D%EC%82%AC%EA%B4%80%ED%95%99%EA%B5%90' +
    '&branchNm=&strNm=&agncCd=&agncTp=&agncNm=&enterpriseCode=mp_sandle' +
    '&corporationCode=1002&storeCode=&brandLic=POS&storeLic=&lic=&brandPosVendor=' +
    '&operDtFrom=20251216&operDtTo=20251216&month=' +
    '&corpNm=%EC%9C%A1%EC%8B%9D%EC%82%AC%EA%B4%80%ED%95%99%EA%B5%90&page=1&size=100';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  const parseYmd = (s) => new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  function buildUrl(day, page, size) {
    const u = new URL(TEMPLATE);
    u.searchParams.set('operDtFrom', day); u.searchParams.set('operDtTo', day);
    u.searchParams.set('page', page); u.searchParams.set('size', size);
    return u.toString();
  }
  function extract(data) {
    const r = data && data.data && data.data.result ? data.data.result : null;
    if (r && Array.isArray(r.content)) return { content: r.content, totalPage: r.totalPage };
    if (Array.isArray(data)) return { content: data, totalPage: null };
    const c = (data && (data.content || data.list || data.rows)) || [];
    return { content: Array.isArray(c) ? c : [], totalPage: null };
  }
  async function fetchDay(day) {
    const rows = []; let page = 1;
    while (true) {
      const res = await fetch(buildUrl(day, page, PAGE_SIZE), {
        credentials: 'include', headers: { 'x-requested-with': 'XMLHttpRequest', accept: 'application/json' } });
      if (!res.ok) { console.warn('  !', day, 'page', page, 'HTTP', res.status); break; }
      const { content, totalPage } = extract(await res.json());
      rows.push(...content);
      if (typeof totalPage === 'number') { if (page >= totalPage) break; }
      else if (content.length < PAGE_SIZE) break;
      page++; await sleep(SLEEP_MS);
    }
    return rows;
  }

  const days = [];
  for (let d = parseYmd(START); d <= parseYmd(END); d.setDate(d.getDate() + 1)) days.push(fmt(d));
  console.log('%c시간대별 수집 시작: ' + days.length + '일 (' + START + '~' + END + ')',
    'color:#2563eb;font-weight:bold');

  const byMonth = {}, stores = {};
  let total = 0;
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    try {
      const raw = await fetchDay(day);
      const mon = day.slice(0, 4) + '-' + day.slice(4, 6);
      (byMonth[mon] = byMonth[mon] || []);
      for (const r of raw) {
        stores[r.msStrId] = r.strNm;
        byMonth[mon].push({ d: day, s: r.msStrId, t: r.orderTm,
          a: r.sumActualSaleAmt || 0, q: r.sumCount || 0,
          da: r.deliveryActualSaleAmt || 0, dq: r.deliveryCount || 0 });
      }
      total += raw.length;
      console.log(`[${i + 1}/${days.length}] ${day}  +${raw.length}행  (누적 ${total})`);
    } catch (e) { console.error('  ! 실패', day, e); }
    await sleep(SLEEP_MS);
  }

  const months = Object.keys(byMonth).sort();
  for (const mon of months) {
    const rowsM = byMonth[mon];
    const stM = {}; rowsM.forEach((r) => { stM[r.s] = stores[r.s]; });
    const out = { source: 'matetech time slim', brand: '육식사관학교', month: mon, stores: stM, rows: rowsM };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
    a.download = 'matetech_time_slim_' + mon.replace('-', '') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    await sleep(500);
    console.log('다운로드:', a.download, rowsM.length + '행');
  }
  console.log('%c완료! ' + months.length + '개 월별 파일 (총 ' + total + '행)', 'color:#16a34a;font-weight:bold');
})();
