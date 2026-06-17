/* ============================================================
   메이트포스 '시간대별 매출' 자동 수집  (브라우저 콘솔용)
   ------------------------------------------------------------
   사용법:
   1) 메이트포스 '시간대별 매출분석' 화면(로그인 상태)에서
   2) F12 → Console → 이 코드 전체 붙여넣고 Enter
   3) 끝나면 matetech_시간대_시작_종료.json 자동 다운로드

   ※ 처음엔 START/END 3일로 테스트 → 파일을 Claude에게 전달해
     시간 필드 구조 확인 후 전체기간으로 재실행.
   행 원본을 그대로 보존(_operDt 태깅)한다.
   ============================================================ */
(async function () {
  const START = '20251216';   // 시작일 YYYYMMDD
  const END   = '20251218';   // 종료일 YYYYMMDD  ← 처음엔 3일 테스트!
  const PAGE_SIZE = 2000;
  const SLEEP_MS  = 250;

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
    u.searchParams.set('operDtFrom', day);
    u.searchParams.set('operDtTo', day);
    u.searchParams.set('page', page);
    u.searchParams.set('size', size);
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
        credentials: 'include',
        headers: { 'x-requested-with': 'XMLHttpRequest', accept: 'application/json' } });
      if (!res.ok) { console.warn('  !', day, 'page', page, 'HTTP', res.status); break; }
      const { content, totalPage } = extract(await res.json());
      content.forEach((r) => { r._operDt = day; });
      rows.push(...content);
      if (typeof totalPage === 'number') { if (page >= totalPage) break; }
      else if (content.length < PAGE_SIZE) break;
      page++; await sleep(SLEEP_MS);
    }
    return rows;
  }

  const days = [];
  for (let d = parseYmd(START); d <= parseYmd(END); d.setDate(d.getDate() + 1)) days.push(fmt(d));
  console.log('%c메이트포스 시간대별 수집 시작: ' + days.length + '일 (' + START + '~' + END + ')',
    'color:#2563eb;font-weight:bold');
  const all = [];
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    try { const rows = await fetchDay(day); all.push(...rows);
      console.log(`[${i + 1}/${days.length}] ${day}  +${rows.length}행  (누적 ${all.length})`);
    } catch (e) { console.error('  ! 실패', day, e); }
    await sleep(SLEEP_MS);
  }
  if (all.length) console.log('첫 행 샘플(시간 필드 확인용):', all[0]);
  const out = { source: 'matetech time (시간대별·매장별)', brand: '육식사관학교', brandCd: '20002',
    from: START, to: END, days: days.length, count: all.length, rows: all };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
  a.download = `matetech_시간대_${START}_${END}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  console.log('%c완료! 다운로드: ' + a.download + '  (총 ' + all.length + '행)', 'color:#16a34a;font-weight:bold');
})();
