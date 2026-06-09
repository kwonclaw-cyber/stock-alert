// 배민 변경이력 콘솔 수집 스니펫
// ─────────────────────────────────────────────────────────────
// 사용법:
//  1) self.baemin.com 에 로그인하고 '변경이력' 화면을 연다.
//  2) F12 → '콘솔(Console)' 탭.
//  3) 이 파일 내용을 통째로 붙여넣고 Enter. (Chrome이 막으면 'allow pasting' 입력)
//  4) 안내대로 화면에서 '조회'를 한 번 누른다. (인증·매장번호 자동 포착)
//  5) 콘솔에 __bm() 입력 후 Enter → 6개월치 수집 → JSON 파일 자동 다운로드.
//  6) 다른 가게도 받으려면: 가게 드롭다운 변경 → '조회' → 다시 __bm()
// ─────────────────────────────────────────────────────────────
(() => {
  if (window.__bmReady) { console.log('이미 준비됨. 조회 누른 뒤 __bm() 실행.'); return; }
  const API = 'https://self-api.baemin.com';
  const origFetch = window.fetch.bind(window);
  const cap = { auth: null, shop: null, owner: null };

  function note(u) {
    if (!u || u.indexOf('self-api.baemin.com') < 0) return;
    let m = u.match(/shopNumber=(\d+)/); if (m) cap.shop = m[1];
    m = u.match(/shop-owners\/(\d+)\//); if (m) cap.owner = m[1];
  }
  function setAuth(a) {
    if (!a || cap.auth) return;
    cap.auth = a;
    console.log('%c✓ 인증 토큰 포착됨 — 이제 __bm() 실행하세요.', 'color:green;font-weight:bold');
  }

  // fetch 후킹 (인증 토큰 + 매장번호 포착)
  window.fetch = function (input, init) {
    try {
      const url = (typeof input === 'string') ? input : (input && input.url);
      note(url);
      let h = (init && init.headers) || (input && input.headers);
      if (h) {
        if (h instanceof Headers) { setAuth(h.get('authorization')); }
        else { setAuth(h.authorization || h.Authorization); }
      }
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };

  // XHR(axios) 후킹 — 배민은 XHR을 쓸 수 있어 반드시 같이 잡는다
  const oOpen = XMLHttpRequest.prototype.open;
  const oSet = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) { this.__u = url; note(url); return oOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    try { if (this.__u && this.__u.indexOf('self-api.baemin.com') >= 0 && k.toLowerCase() === 'authorization') setAuth(v); } catch (e) {}
    return oSet.apply(this, arguments);
  };

  function ymd(d) { return d.toISOString().slice(0, 10); }
  function range6m() {
    const end = new Date();
    const start = new Date(); start.setMonth(start.getMonth() - 6); start.setDate(start.getDate() - 3);
    return [ymd(start), ymd(end)];
  }

  // 저장소(localStorage/sessionStorage)에서 JWT 토큰을 직접 찾아낸다 (후킹 실패 대비)
  function looksJwt(x) { return typeof x === 'string' && x.split('.').length === 3 && x.replace(/^Bearer\s+/i, '').length > 40; }
  function asBearer(x) { return /^Bearer\s+/i.test(x) ? x : ('Bearer ' + x); }
  function digToken(v, depth) {
    if (depth > 4 || v == null) return null;
    if (typeof v === 'string') {
      if (looksJwt(v)) return asBearer(v);
      if (v.length > 1 && (v[0] === '{' || v[0] === '[')) { try { return digToken(JSON.parse(v), depth + 1); } catch (e) {} }
      return null;
    }
    if (typeof v === 'object') {
      for (const k of Object.keys(v)) {
        const r = digToken(v[k], depth + 1); if (r) return r;
      }
    }
    return null;
  }
  function findToken() {
    for (const store of [window.localStorage, window.sessionStorage]) {
      try {
        for (let i = 0; i < store.length; i++) {
          const v = store.getItem(store.key(i));
          const t = digToken(v, 0); if (t) return t;
        }
      } catch (e) {}
    }
    return null;
  }

  async function getJson(url) {
    const headers = { 'Accept': 'application/json' };
    if (cap.auth) headers['Authorization'] = cap.auth;
    const r = await origFetch(url, { headers, credentials: 'include' });
    if (!r.ok) { console.warn('  ! 상태', r.status, url.slice(0, 90)); return null; }
    try { return await r.json(); } catch (e) { return null; }
  }
  async function pageCursor(base) {
    let out = [], url = base, g = 0;
    while (g++ < 500) {
      const d = await getJson(url); if (!d || !d.content) break;
      out = out.concat(d.content);
      if (!d.hasNext) break;
      const nx = d.nextCursorId; if (nx == null || nx === '') break;
      url = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'cursorId=' + nx;
    }
    return out;
  }

  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  window.__bm = async function () {
    let sn = cap.shop;
    if (!sn) sn = prompt('매장번호 8자리를 입력하세요 (가게 드롭다운에 보이는 숫자)');
    if (!sn) { console.warn('매장번호가 없습니다.'); return; }
    if (!cap.auth) { cap.auth = findToken(); if (cap.auth) console.log('%c✓ 저장소에서 인증 토큰 발견', 'color:green'); }
    if (!cap.auth) console.warn('※ 인증 토큰을 못 잡았습니다. 화면에서 "조회"를 한 번 누른 뒤 다시 __bm() 하세요.');

    const [s, e] = range6m();
    console.log('%c수집 시작 매장 ' + sn + ' (' + s + ' ~ ' + e + ')', 'color:#1971c2;font-weight:bold');

    const shop = await pageCursor(`${API}/v1/modify-history/shop?shopNumber=${sn}&modifiedStartDate=${s}&modifiedEndDate=${e}&size=100`);
    console.log('  · 가게 변경이력', shop.length);

    const disc = await pageCursor(`${API}/v1/modify-history/instant-discount?shopNumber=${sn}&status=ALL&modifiedStartDate=${s}&modifiedEndDate=${e}&size=100`);
    console.log('  · 즉시할인 변경이력', disc.length);

    let ad = [];
    const camps = await getJson(`${API}/v2/ad-center/ad-campaigns/operating-ad-campaign/by-shop-number?shopNumber=${sn}`);
    if (Array.isArray(camps)) {
      for (const c of camps) {
        const cid = c.id; if (!cid) continue;
        for (const ht of ['LISTING_INVENTORY_DISPLAY_PAUSE', 'CPC_BUDGET']) {
          const rows = await pageCursor(`${API}/v1/modify-history/ad-campaign?shopNumber=${sn}&adCampaignId=${cid}&historyType=${ht}&modifiedStartDate=${s}&modifiedEndDate=${e}&size=100`);
          ad = ad.concat(rows);
        }
      }
    }
    console.log('  · 광고 변경이력', ad.length, '(' + (camps ? camps.length : 0) + '개 캠페인)');

    const bundle = { shopNumber: sn, owner: cap.owner, range: [s, e], shop, instantDiscount: disc, ad };
    download('baemin_변경이력_' + sn + '.json', bundle);
    console.log('%c✓ 완료! baemin_변경이력_' + sn + '.json 다운로드됨. (총 ' + (shop.length + disc.length + ad.length) + '건)', 'color:green;font-weight:bold;font-size:14px');
    return bundle;
  };

  window.__bmReady = true;
  console.log('%c[준비완료] 화면에서 "조회"를 한 번 누른 뒤, 콘솔에  __bm()  입력하고 Enter 하세요.', 'color:#e8590c;font-weight:bold;font-size:14px');
})();
