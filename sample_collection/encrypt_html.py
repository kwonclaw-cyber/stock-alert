"""정적 HTML을 비밀번호로 암호화(AES-256-GCM) → 비번 맞을 때만 브라우저에서 복호화.

내용 자체를 암호화하므로 소스를 봐도 평문이 안 보인다(단순 JS 잠금과 다름).
복호화는 Web Crypto(PBKDF2-SHA256 → AES-GCM)로 클라이언트에서 수행.

사용:
  STATIC_PW='비밀번호' python3 encrypt_html.py <입력.html> <출력.html>
"""
import base64
import os
import sys

from Crypto.Cipher import AES
from Crypto.Protocol.KDF import PBKDF2
from Crypto.Hash import SHA256

ITER = 200000


def encrypt(plaintext: str, password: str) -> dict:
    salt = os.urandom(16)
    iv = os.urandom(12)
    key = PBKDF2(password, salt, dkLen=32, count=ITER, hmac_hash_module=SHA256)
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ct, tag = cipher.encrypt_and_digest(plaintext.encode("utf-8"))
    b64 = lambda b: base64.b64encode(b).decode()
    return {"salt": b64(salt), "iv": b64(iv), "ct": b64(ct + tag)}  # Web Crypto: ct||tag


LOADER = """<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>육식사관학교 빅데이터 통합관리 · 잠금</title>
<style>
body{{margin:0;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#0f2342;
  display:flex;align-items:center;justify-content:center;min-height:100vh;color:#fff;}}
.box{{background:#fff;color:#212529;border-radius:16px;padding:34px 30px;width:340px;
  box-shadow:0 12px 40px rgba(0,0,0,.35);text-align:center;}}
.box h1{{font-size:18px;margin:0 0 4px;}} .box p{{font-size:13px;color:#868e96;margin:0 0 18px;}}
.box input{{width:100%;padding:11px 13px;font-size:15px;border:1px solid #ced4da;border-radius:9px;box-sizing:border-box;}}
.box button{{width:100%;margin-top:10px;padding:11px;font-size:15px;font-weight:700;border:0;border-radius:9px;
  background:#1a8c34;color:#fff;cursor:pointer;}} .box button:hover{{background:#178030;}}
.err{{color:#e03131;font-size:13px;margin-top:10px;min-height:16px;}}
.lock{{font-size:34px;margin-bottom:6px;}}
</style></head><body>
<div class="box">
  <div class="lock">🔒</div>
  <h1>육식사관학교 빅데이터 통합관리</h1>
  <p>열람하려면 비밀번호를 입력하세요.</p>
  <input id="pw" type="password" placeholder="비밀번호" autofocus
    onkeydown="if(event.key==='Enter')go()">
  <button onclick="go()">열기</button>
  <div class="err" id="err"></div>
</div>
<script>
const SALT="{salt}",IV="{iv}",CT="{ct}",ITER={iter};
const dec=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function decrypt(pw){{
  const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({{name:'PBKDF2',salt:dec(SALT),iterations:ITER,hash:'SHA-256'}},
    km,{{name:'AES-GCM',length:256}},false,['decrypt']);
  const pt=await crypto.subtle.decrypt({{name:'AES-GCM',iv:dec(IV)}},key,dec(CT));
  return new TextDecoder().decode(pt);
}}
async function go(){{
  const pw=document.getElementById('pw').value, err=document.getElementById('err');
  err.textContent='복호화 중…';
  try{{
    const html=await decrypt(pw);
    sessionStorage.setItem('unlocked','1');
    document.open();document.write(html);document.close();
  }}catch(e){{err.textContent='비밀번호가 올바르지 않습니다.';}}
}}
</script></body></html>"""


def main():
    inp, outp = sys.argv[1], sys.argv[2]
    pw = os.environ.get("STATIC_PW") or (sys.argv[3] if len(sys.argv) > 3 else "")
    if not pw:
        sys.exit("비밀번호 필요: STATIC_PW 환경변수 또는 3번째 인자")
    plaintext = open(inp, encoding="utf-8").read()
    e = encrypt(plaintext, pw)
    html = LOADER.format(salt=e["salt"], iv=e["iv"], ct=e["ct"], iter=ITER)
    os.makedirs(os.path.dirname(outp) or ".", exist_ok=True)
    open(outp, "w", encoding="utf-8").write(html)
    print(f"암호화 완료 → {outp}  ({len(html)//1024}KB, 평문 {len(plaintext)//1024}KB)")


if __name__ == "__main__":
    main()
