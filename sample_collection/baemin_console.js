// 배민 변경이력 콘솔 수집 스니펫 (응답 가로채기 방식)
// ─────────────────────────────────────────────────────────────
// 핵심: 우리가 요청을 새로 만들지 않고, 앱이 스스로 부르는 응답을 가로채서 모은다.
//       → 토큰/CORS/403 문제가 원천적으로 없음.
//
// 사용법:
//  1) self.baemin.com 로그인 → '변경이력' 화면.
//  2) F12 → Console 에 이 코드를 먼저 붙여넣고 Enter. ('allow pasting' 요구 시 입력)
//  3) '가게' 탭 → '조회' → 목록 끝까지 스크롤(다 불러오면 멈춤). __scrollAll() 쓰면 자동.
//  4) '즉시할인' 탭 → '조회' → 스크롤(또는 __scrollAll()).
//  5) '광고·서비스' 탭 → (캠페인/변경항목 골라가며) '조회' → 스크롤.
//  6) 콘솔에 __save() 입력 → JSON 파일 다운로드.
//  (수집 중 콘솔에 누적 건수가 계속 찍힙니다.)
// ─────────────────────────────────────────────────────────────
(() => {
  if (window.__bmReady) { console.log('이미 설치됨. 탭 조회/스크롤 후 __save() 하세요.'); return; }
  const origFetch = window.fetch.bind(window);
  const store = { shopNumber: null, owner: null, shop: [], instantDiscount: [], ad: [], promotion: [] };
  const seen = new Set();

  function push(arr, rows, key) {
    if (!Array.isArray(rows)) return 0;
    let added = 0;
    for (const r of rows) {
      const id = key(r);
      if (seen.has(id)) continue;
      seen.add(id); arr.push(r); added++;
    }
    return added;
  }

  function absorb(url, text) {
    if (!url || url.indexOf('self-api.baemin.com') < 0 || !text) return;
    let m = url.match(/shopNumber=(\d+)/); if (m) store.shopNumber = m[1];
    m = url.match(/shop-owners\/(\d+)\//); if (m) store.owner = m[1];
    let data; try { data = JSON.parse(text); } catch (e) { return; }
    const content = (data && data.content) || (data && data.data && data.data.content);
    let added = 0, label = '';
    if (url.indexOf('modify-history/shop') >= 0) { added = push(store.shop, content, r => 'S' + r.id); label = '가게'; }
    else if (url.indexOf('modify-history/instant-discount') >= 0) { added = push(store.instantDiscount, content, r => 'D' + r.id); label = '즉시할인'; }
    else if (url.indexOf('modify-history/ad-campaign') >= 0) { added = push(store.ad, content, r => 'A' + (r.id || (r.adCampaignId + r.historyType + r.createdAt + r.beforeValue + r.afterValue))); label = '광고'; }
    else if (url.indexOf('promotions/history') >= 0) { added = push(store.promotion, content, r => 'P' + (r.id || JSON.stringify(r).slice(0, 40))); label = '메뉴할인'; }
    else return;
    if (added) console.log('  +' + added + ' ' + label + '  (누적 가게 ' + store.shop.length + ' / 즉시할인 ' + store.instantDiscount.length + ' / 광고 ' + store.ad.length + ')');
  }

  // fetch 응답 가로채기
  window.fetch = function (input, init) {
    const url = (typeof input === 'string') ? input : (input && input.url);
    return origFetch.apply(this, arguments).then(res => {
      try { if (url && url.indexOf('self-api.baemin.com') >= 0) res.clone().text().then(t => absorb(url, t)).catch(() => {}); } catch (e) {}
      return res;
    });
  };

  // XHR 응답 가로채기 (배민은 XHR을 쓸 수 있음)
  const oOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) { this.__u = url; return oOpen.apply(this, arguments); };
  const oSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', () => {
      try { if (this.__u && this.__u.indexOf('self-api.baemin.com') >= 0) absorb(this.__u, this.responseText); } catch (e) {}
    });
    return oSend.apply(this, arguments);
  };

  // 현재 탭 목록을 끝까지 자동 스크롤해서 모두 불러온다
  window.__scrollAll = async function () {
    let last = -1, same = 0;
    for (let i = 0; i < 300 && same < 5; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      const sc = document.scrollingElement || document.documentElement;
      if (sc) sc.scrollTop = sc.scrollHeight;
      await new Promise(r => setTimeout(r, 600));
      const h = (sc ? sc.scrollHeight : document.body.scrollHeight);
      if (h === last) same++; else { same = 0; last = h; }
    }
    console.log('%c스크롤 완료. 누적 가게 ' + store.shop.length + ' / 즉시할인 ' + store.instantDiscount.length + ' / 광고 ' + store.ad.length, 'color:#1971c2');
  };

  window.__save = function () {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'baemin_변경이력_' + (store.shopNumber || 'shop') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    console.log('%c✓ 저장 완료! 총 ' + (store.shop.length + store.instantDiscount.length + store.ad.length + store.promotion.length) + '건', 'color:green;font-weight:bold;font-size:14px');
  };

  window.__bmStore = store;
  window.__bmReady = true;
  console.log('%c[설치완료] 이제 탭마다 "조회" 후 __scrollAll() 로 끝까지 불러오고, 마지막에 __save() 하세요.', 'color:#e8590c;font-weight:bold;font-size:14px');
})();
