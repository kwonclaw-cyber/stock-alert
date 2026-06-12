// 배민 변경이력 콘솔 수집 스니펫 (응답 가로채기 방식)
// ─────────────────────────────────────────────────────────────
// 핵심: 우리가 요청을 새로 만들지 않고, 앱이 스스로 부르는 응답을 가로채서 모은다.
//       → 토큰/CORS/403 문제가 원천적으로 없음.
//
// 사용법(매장 1개당 반복):
//  1) self.baemin.com 로그인 → '변경이력' 화면.
//  2) F12 → Console 에 이 코드를 붙여넣고 Enter. (매장 바꿀 때마다 새로고침 후 다시 붙여넣기)
//  3) '가게' 탭 → '조회' → __scrollAll()
//  4) '즉시할인' 탭 → '조회' → __scrollAll()
//  5) '광고·서비스' 탭 → '조회' → __scrollAll()
//  6) __save() → JSON 다운로드. (매장명을 묻는 창이 뜨면 매출 파일과 똑같이 입력)
//
//  ⚡ 자동: 붙여넣은 뒤 __auto() 한 줄이면 3~5단계를 자동으로 돌고 __save()까지 합니다.
//     (탭/조회 버튼을 글자로 찾아 누름. 광고 캠페인 선택이 필요하면 그 탭만 수동으로)
//
//  ★ 200개 매장은 반드시 '매장별로 따로' __save() 하세요. (한 세션에 여러 매장을 쌓으면 섞입니다)
//  ★ 매장이 바뀐 게 감지되면 자동으로 초기화합니다. 수동 초기화는 __reset().
//  ★ 매장명을 미리 지정하려면 __setName('육식사관학교 강동천호점').
// ─────────────────────────────────────────────────────────────
(() => {
  if (window.__bmReady) { console.log('이미 설치됨. 탭 조회/스크롤 후 __save() 하세요. (다른 매장이면 새로고침 후 다시 붙여넣기)'); return; }
  const origFetch = window.fetch.bind(window);
  const store = { shopNumber: null, shopName: null, owner: null, shop: [], instantDiscount: [], ad: [], promotion: [] };
  let seen = new Set();

  function resetStore() {
    store.shop.length = 0; store.instantDiscount.length = 0; store.ad.length = 0; store.promotion.length = 0;
    seen = new Set();
  }

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

  // 응답 JSON에서 매장명을 최대한 자동으로 잡아둔다(있을 때만).
  function grabName(data) {
    if (store.shopName) return;
    try {
      const c = data && (data.shopName || data.name
        || (data.shop && (data.shop.shopName || data.shop.name))
        || (data.shopInfo && (data.shopInfo.shopName || data.shopInfo.name))
        || (data.data && (data.data.shopName || (data.data.shop && data.data.shop.shopName))));
      if (typeof c === 'string' && c.trim()) { store.shopName = c.trim(); console.log('%c매장명 자동감지: ' + store.shopName, 'color:#2f9e44'); }
    } catch (e) {}
  }

  function absorb(url, text) {
    if (!url || url.indexOf('self-api.baemin.com') < 0 || !text) return;
    let m = url.match(/shopNumber=(\d+)/);
    if (m) {
      const sn = m[1];
      if (store.shopNumber && store.shopNumber !== sn) {
        console.warn('%c⚠ 다른 매장 감지 (shopNumber ' + store.shopNumber + ' → ' + sn + ') · 이전 데이터를 자동 초기화했습니다. 매장 전환 시엔 새로고침을 권장합니다.', 'color:#e03131;font-weight:bold;font-size:13px');
        resetStore(); store.shopName = null; store.owner = null;
      }
      store.shopNumber = sn;
    }
    m = url.match(/shop-owners\/(\d+)\//); if (m) store.owner = m[1];
    let data; try { data = JSON.parse(text); } catch (e) { return; }
    grabName(data);
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

  // 매장명을 수동으로 지정(매출 파일의 매장명과 똑같이)
  window.__setName = function (n) { store.shopName = String(n || '').trim(); console.log('%c매장명 설정: ' + store.shopName, 'color:#2f9e44;font-weight:bold'); };

  // 현재 누적분을 비우고 새 매장 수집 시작
  window.__reset = function () { resetStore(); store.shopNumber = null; store.shopName = null; store.owner = null; console.log('%c초기화 완료. 새 매장 수집을 시작하세요.', 'color:#e8590c;font-weight:bold'); };

  // ── 자동 수집(__auto): 탭 이동 → 조회 → 스크롤을 자동으로 반복 ──
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  function isVisible(el) {
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    var s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  }
  // 화면에서 글자가 text를 포함하는 '가장 작은(잎)' 클릭요소를 찾는다
  function findClickable(text) {
    var els = document.querySelectorAll("button,a,li,span,div,[role='tab'],[role='button']");
    var best = null, bestLen = 1e9;
    for (var i = 0; i < els.length; i++) {
      var el = els[i], t = (el.textContent || '').trim();
      if (!t || t.indexOf(text) < 0) continue;
      if (!isVisible(el)) continue;
      if (t.length < bestLen) { best = el; bestLen = t.length; }
    }
    return best;
  }
  window.__click = function (text) { var el = findClickable(text); if (el) { el.click(); console.log('클릭:', text); return true; } console.warn('못찾음:', text); return false; };

  window.__auto = async function (opts) {
    opts = opts || {};
    var tabs = opts.tabs || ['가게', '즉시할인', '광고'];   // 탭 라벨(부분일치)
    var queryText = opts.query || '조회';                    // 조회 버튼 글자
    var doSave = opts.save !== false;                        // 기본: 끝나면 __save()
    console.log('%c▶ __auto 시작 (탭: ' + tabs.join(', ') + ')', 'color:#1971c2;font-weight:bold;font-size:13px');
    for (var i = 0; i < tabs.length; i++) {
      var tab = tabs[i];
      console.log('%c— [' + (i + 1) + '/' + tabs.length + '] 탭 이동: ' + tab, 'color:#495057');
      var tabEl = findClickable(tab);
      if (!tabEl) { console.warn('  ⚠ 탭을 못찾음: "' + tab + '" → 직접 누르고 __scrollAll() 하세요. 건너뜀.'); continue; }
      tabEl.click(); await wait(1300);
      var qEl = findClickable(queryText);
      if (qEl) { qEl.click(); console.log('  조회 클릭'); } else { console.warn('  ⚠ "' + queryText + '" 버튼 못찾음 → 직접 눌러주세요.'); }
      await wait(1600);
      await window.__scrollAll();
    }
    console.log('%c✓ 자동 수집 완료. 누적 가게 ' + store.shop.length + ' / 즉시할인 ' + store.instantDiscount.length + ' / 광고 ' + store.ad.length, 'color:#2f9e44;font-weight:bold;font-size:13px');
    if (doSave) window.__save(); else console.log('저장하려면 __save()');
  };

  window.__save = function () {
    if (!store.shopName) {
      const g = window.prompt('이 매장의 매장명을 매출 파일과 똑같이 입력하세요.\n(예: 육식사관학교 강동천호점)', '');
      if (g && g.trim()) store.shopName = g.trim();
    }
    const safe = (store.shopName || '').replace(/[\\/:*?"<>|]/g, '').trim();
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'baemin_변경이력_' + (store.shopNumber || 'shop') + (safe ? ('_' + safe) : '') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    console.log('%c✓ 저장 완료! [' + (store.shopName || '매장명없음') + ' / ' + (store.shopNumber || '?') + '] 총 ' + (store.shop.length + store.instantDiscount.length + store.ad.length + store.promotion.length) + '건', 'color:green;font-weight:bold;font-size:14px');
  };

  window.__bmStore = store;
  window.__bmReady = true;
  console.log('%c[설치완료] ⚡ __auto() 하면 자동으로 다 모으고 저장합니다. (수동: 탭 조회 → __scrollAll() → __save())', 'color:#e8590c;font-weight:bold;font-size:14px');
})();
