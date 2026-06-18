"""미팅 녹음 → 텍스트 변환 → 요약 → Notion 업로드 (회사 PC 로컬 실행 도구).

브라우저에서 마이크로 회의를 녹음하고, 브라우저 내장 음성인식(Web Speech API,
한국어)으로 실시간 텍스트 변환을 합니다. 'Notion에 저장'을 누르면 서버(이 PC)가
Claude로 회의 요약(핵심 논의 / 결정사항 / 할 일)을 만들고, 요약 + 전문을
Notion 페이지로 업로드합니다.

웹에 배포되지 않고 이 PC에서만 동작합니다 (주소: http://localhost:5000).

필요 환경변수(같은 폴더의 .env 파일에 적으면 자동 로드):
  ANTHROPIC_API_KEY      : Claude 요약용 키
  NOTION_API_KEY         : Notion 통합(integration) 토큰
  그리고 다음 중 하나:
  NOTION_PARENT_PAGE_ID  : 회의록을 하위 페이지로 추가할 부모 페이지 ID
  NOTION_DATABASE_ID     : 또는 회의록을 추가할 데이터베이스 ID
                           (제목 속성명이 '이름'이 아니면 NOTION_TITLE_PROPERTY 지정)

실행:
  pip install -r requirements.txt
  python meeting_notes.py          # 또는 run_meeting.bat 더블클릭
"""

import os
import re
from datetime import datetime, timezone, timedelta

import anthropic
import requests
from flask import Flask, request, jsonify, Response

KST = timezone(timedelta(hours=9))
NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"
NOTION_TEXT_LIMIT = 2000  # Notion rich_text 단일 블록 최대 길이
NOTION_CHILDREN_LIMIT = 100  # 한 요청당 children 블록 최대 개수

app = Flask(__name__)


def _load_env_file():
    """스크립트 폴더의 .env 파일을 읽어 환경변수로 로드 (이미 설정된 값은 유지).

    형식: KEY=VALUE (한 줄에 하나, # 으로 시작하면 주석). 별도 패키지 없이 동작.
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and not os.environ.get(key):
                os.environ[key] = val


_load_env_file()


# ---------------------------------------------------------------------------
# 1) Claude 회의 요약
# ---------------------------------------------------------------------------
def summarize_meeting(transcript: str) -> str:
    """회의 전문을 받아 마크다운 형식의 요약을 반환."""
    prompt = f"""다음은 회의를 음성인식으로 받아쓴 전문입니다. 받아쓰기 특성상
오탈자나 끊김이 있을 수 있으니 맥락으로 자연스럽게 보정해서 이해하세요.

아래 형식의 한국어 마크다운으로 간결하게 정리해주세요.

## 한 줄 요약
(회의 핵심을 1~2문장으로)

## 핵심 논의
- (주요 논의 사항을 bullet로)

## 결정사항
- (확정된 결정을 bullet로, 없으면 "특별한 결정사항 없음")

## 할 일 (Action Items)
- (담당자가 언급됐다면 "담당자: 내용" 형태로, 없으면 "별도 할 일 없음")

[회의 전문]
{transcript}"""

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


# ---------------------------------------------------------------------------
# 2) 마크다운 → Notion 블록 변환
# ---------------------------------------------------------------------------
def _chunk(text: str, size: int = NOTION_TEXT_LIMIT):
    """text를 size 글자 이하 조각으로 분할."""
    return [text[i:i + size] for i in range(0, len(text), size)] or [""]


def _rich_text(text: str):
    return [{"type": "text", "text": {"content": c}} for c in _chunk(text)]


def _para(text: str):
    return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {"rich_text": _rich_text(text)},
    }


def markdown_to_blocks(md: str):
    """간단한 마크다운(제목/불릿/문단)을 Notion 블록 리스트로 변환."""
    blocks = []
    for raw in md.split("\n"):
        line = raw.rstrip()
        # 인라인 볼드 표시는 제거 (Notion 평문 처리)
        stripped = re.sub(r"\*\*(.+?)\*\*", r"\1", line).strip()
        if not stripped:
            continue
        if stripped.startswith("### "):
            blocks.append({
                "object": "block", "type": "heading_3",
                "heading_3": {"rich_text": _rich_text(stripped[4:])},
            })
        elif stripped.startswith("## "):
            blocks.append({
                "object": "block", "type": "heading_2",
                "heading_2": {"rich_text": _rich_text(stripped[3:])},
            })
        elif stripped.startswith("# "):
            blocks.append({
                "object": "block", "type": "heading_1",
                "heading_1": {"rich_text": _rich_text(stripped[2:])},
            })
        elif stripped.startswith(("- ", "* ")):
            blocks.append({
                "object": "block", "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": _rich_text(stripped[2:])},
            })
        else:
            blocks.append(_para(stripped))
    return blocks


def transcript_to_blocks(transcript: str):
    """전문을 문단 단위 Notion 블록으로 (긴 텍스트는 자동 분할)."""
    blocks = []
    paragraphs = [p.strip() for p in transcript.split("\n") if p.strip()]
    if not paragraphs:
        paragraphs = [transcript.strip() or "(내용 없음)"]
    for p in paragraphs:
        blocks.append(_para(p))
    return blocks


# ---------------------------------------------------------------------------
# 3) Notion 페이지 생성
# ---------------------------------------------------------------------------
def _notion_headers():
    return {
        "Authorization": f"Bearer {os.environ['NOTION_API_KEY']}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def create_notion_page(title: str, blocks: list) -> str:
    """Notion에 페이지 생성 후 URL 반환. children은 100개씩 나눠 추가."""
    db_id = os.environ.get("NOTION_DATABASE_ID", "").strip()
    page_id = os.environ.get("NOTION_PARENT_PAGE_ID", "").strip()

    if db_id:
        title_prop = os.environ.get("NOTION_TITLE_PROPERTY", "이름").strip() or "이름"
        parent = {"database_id": db_id}
        properties = {title_prop: {"title": [{"text": {"content": title}}]}}
    elif page_id:
        parent = {"page_id": page_id}
        properties = {"title": {"title": [{"text": {"content": title}}]}}
    else:
        raise RuntimeError(
            "NOTION_DATABASE_ID 또는 NOTION_PARENT_PAGE_ID 환경변수가 필요합니다."
        )

    first_batch = blocks[:NOTION_CHILDREN_LIMIT]
    rest = blocks[NOTION_CHILDREN_LIMIT:]

    resp = requests.post(
        f"{NOTION_API}/pages",
        headers=_notion_headers(),
        json={"parent": parent, "properties": properties, "children": first_batch},
        timeout=30,
    )
    resp.raise_for_status()
    page = resp.json()
    new_id = page["id"]

    # 나머지 블록을 100개씩 append
    for i in range(0, len(rest), NOTION_CHILDREN_LIMIT):
        batch = rest[i:i + NOTION_CHILDREN_LIMIT]
        r = requests.patch(
            f"{NOTION_API}/blocks/{new_id}/children",
            headers=_notion_headers(),
            json={"children": batch},
            timeout=30,
        )
        r.raise_for_status()

    return page.get("url", f"https://www.notion.so/{new_id.replace('-', '')}")


# ---------------------------------------------------------------------------
# 4) 라우트
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return Response(INDEX_HTML, mimetype="text/html")


@app.route("/save", methods=["POST"])
def save():
    data = request.get_json(force=True) or {}
    transcript = (data.get("transcript") or "").strip()
    title = (data.get("title") or "").strip()

    if not transcript:
        return jsonify({"ok": False, "error": "변환된 텍스트가 비어 있습니다."}), 400

    if not title:
        now = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
        title = f"회의록 {now}"

    try:
        summary = summarize_meeting(transcript)
    except Exception as e:  # 요약 실패해도 전문은 업로드
        summary = f"## 한 줄 요약\nAI 요약 생성에 실패했습니다. ({type(e).__name__}: {str(e)[:200]})"

    blocks = []
    blocks += markdown_to_blocks(summary)
    blocks.append({
        "object": "block", "type": "divider", "divider": {},
    })
    blocks.append({
        "object": "block", "type": "heading_2",
        "heading_2": {"rich_text": _rich_text("🎙️ 회의 전문")},
    })
    blocks += transcript_to_blocks(transcript)

    try:
        url = create_notion_page(title, blocks)
    except requests.HTTPError as e:
        detail = e.response.text[:500] if e.response is not None else str(e)
        return jsonify({"ok": False, "error": f"Notion 업로드 실패: {detail}"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": f"Notion 업로드 실패: {e}"}), 500

    return jsonify({"ok": True, "url": url, "title": title})


# ---------------------------------------------------------------------------
# 5) 프론트엔드 (단일 HTML 페이지)
# ---------------------------------------------------------------------------
INDEX_HTML = r"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>미팅 녹음 → Notion 회의록</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
         "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
         max-width: 760px; margin: 0 auto; padding: 24px; color: #222; background: #fafafa; }
  h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 10px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 16px 0; }
  input[type=text] { flex: 1; min-width: 220px; padding: 10px 12px; font-size: 15px;
                     border: 1px solid #ccc; border-radius: 8px; }
  button { padding: 10px 18px; font-size: 15px; border: none; border-radius: 8px;
           cursor: pointer; font-weight: 600; }
  #recBtn { background: #e03131; color: #fff; }
  #recBtn.recording { background: #2f9e44; }
  #saveBtn { background: #1971c2; color: #fff; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  .status { font-size: 14px; color: #666; margin-left: auto; }
  .dot { display:inline-block; width:10px; height:10px; border-radius:50%;
         background:#adb5bd; margin-right:6px; vertical-align:middle; }
  .dot.live { background:#e03131; animation: blink 1s infinite; }
  @keyframes blink { 50% { opacity: .3; } }
  textarea { width: 100%; min-height: 280px; padding: 14px; font-size: 15px; line-height: 1.6;
             border: 1px solid #ccc; border-radius: 8px; resize: vertical; background:#fff; }
  .hint { font-size: 13px; color: #888; margin-top: 6px; }
  #result { margin-top: 16px; padding: 14px; border-radius: 8px; font-size: 14px; display:none; }
  #result.ok { background:#ebfbee; border:1px solid #b2f2bb; }
  #result.err { background:#fff5f5; border:1px solid #ffc9c9; color:#c92a2a; }
  #result a { color:#1971c2; font-weight:600; }
  audio { width: 100%; margin-top: 12px; }
</style>
</head>
<body>
  <h1>🎙️ 미팅 녹음 → Notion 회의록</h1>

  <div class="row">
    <input id="title" type="text" placeholder="회의 제목 (비우면 날짜·시간 자동)">
  </div>

  <div class="row">
    <button id="recBtn">● 녹음 시작</button>
    <button id="saveBtn" disabled>Notion에 저장</button>
    <span class="status"><span id="dot" class="dot"></span><span id="statusText">대기 중</span></span>
  </div>

  <textarea id="transcript" placeholder="여기에 실시간으로 변환된 회의 내용이 표시됩니다. 직접 수정도 가능합니다."></textarea>
  <div class="hint">⚠️ 음성인식은 Chrome / Edge 브라우저에서 가장 잘 동작합니다. 녹음 종료 후 텍스트를 다듬은 뒤 저장하면 더 정확한 회의록이 됩니다.</div>

  <audio id="player" controls style="display:none;"></audio>

  <div id="result"></div>

<script>
const recBtn = document.getElementById('recBtn');
const saveBtn = document.getElementById('saveBtn');
const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const ta = document.getElementById('transcript');
const player = document.getElementById('player');
const resultBox = document.getElementById('result');

let recognition = null;
let recording = false;
let finalText = '';          // 확정된 텍스트
let mediaRecorder = null;
let audioChunks = [];

function setStatus(text, live) {
  statusText.textContent = text;
  dot.className = 'dot' + (live ? ' live' : '');
}

function showResult(html, ok) {
  resultBox.style.display = 'block';
  resultBox.className = ok ? 'ok' : 'err';
  resultBox.innerHTML = html;
}

// --- Web Speech API 음성인식 ---
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function startRecognition() {
  if (!SR) {
    showResult('이 브라우저는 음성인식(Web Speech API)을 지원하지 않습니다. Chrome 또는 Edge를 사용하세요. (녹음 파일은 저장되며, 텍스트는 직접 입력할 수 있습니다.)', false);
    return;
  }
  recognition = new SR();
  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const txt = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        finalText += txt + ' ';
      } else {
        interim += txt;
      }
    }
    ta.value = finalText + interim;
    ta.scrollTop = ta.scrollHeight;
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    setStatus('인식 오류: ' + e.error, recording);
  };

  // 장시간 회의 대응: 자동 종료되면 녹음 중일 때 재시작
  recognition.onend = () => {
    if (recording) {
      try { recognition.start(); } catch (_) {}
    }
  };

  try { recognition.start(); } catch (_) {}
}

async function startAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      player.src = URL.createObjectURL(blob);
      player.style.display = 'block';
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
  } catch (err) {
    showResult('마이크 접근 실패: ' + err.message, false);
    throw err;
  }
}

recBtn.addEventListener('click', async () => {
  if (!recording) {
    // 텍스트에 남아있는 사용자 입력을 finalText로 보존
    finalText = ta.value ? (ta.value.replace(/\s+$/, '') + ' ') : '';
    resultBox.style.display = 'none';
    try { await startAudio(); } catch (_) { return; }
    startRecognition();
    recording = true;
    recBtn.textContent = '■ 녹음 종료';
    recBtn.classList.add('recording');
    saveBtn.disabled = true;
    setStatus('녹음 중...', true);
  } else {
    recording = false;
    if (recognition) recognition.stop();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    finalText = ta.value.replace(/\s+$/, '') + ' ';
    recBtn.textContent = '● 녹음 시작';
    recBtn.classList.remove('recording');
    saveBtn.disabled = ta.value.trim().length === 0;
    setStatus('녹음 종료 — 저장 가능', false);
  }
});

ta.addEventListener('input', () => {
  if (!recording) saveBtn.disabled = ta.value.trim().length === 0;
});

saveBtn.addEventListener('click', async () => {
  const transcript = ta.value.trim();
  if (!transcript) return;
  saveBtn.disabled = true;
  setStatus('Claude 요약 + Notion 업로드 중...', true);
  try {
    const res = await fetch('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: document.getElementById('title').value, transcript }),
    });
    const data = await res.json();
    if (data.ok) {
      showResult('✅ 저장 완료: <a href="' + data.url + '" target="_blank">' + data.title + ' — Notion에서 열기</a>', true);
      setStatus('완료', false);
    } else {
      showResult('❌ ' + data.error, false);
      setStatus('실패', false);
    }
  } catch (err) {
    showResult('❌ 요청 실패: ' + err.message, false);
    setStatus('실패', false);
  } finally {
    saveBtn.disabled = false;
  }
});
</script>
</body>
</html>
"""


def selftest():
    """마이크/브라우저 없이 Claude 요약 + Notion 업로드 연결을 점검.

    실행: python meeting_notes.py --selftest
    """
    missing = [k for k in ("ANTHROPIC_API_KEY", "NOTION_API_KEY") if not os.environ.get(k)]
    if not (os.environ.get("NOTION_DATABASE_ID") or os.environ.get("NOTION_PARENT_PAGE_ID")):
        missing.append("NOTION_DATABASE_ID 또는 NOTION_PARENT_PAGE_ID")
    if missing:
        print("❌ 누락된 환경변수: " + ", ".join(missing))
        print("   같은 폴더의 .env 파일에 값을 채웠는지 확인하세요.")
        return 1

    sample = (
        "오늘 회의에서는 신규 미팅 회의록 자동화 도구를 점검했습니다. "
        "철수가 다음 주까지 Notion 템플릿을 정리하기로 했고, "
        "영희는 음성인식 정확도를 테스트하기로 했습니다. "
        "예산은 기존 범위 내에서 진행하기로 결정했습니다."
    )
    now = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
    title = f"[셀프테스트] 회의록 {now}"

    print("1) Claude 요약 생성 중...")
    try:
        summary = summarize_meeting(sample)
        print("   ✅ 요약 생성 완료")
    except Exception as e:
        print(f"   ❌ 요약 실패: {type(e).__name__}: {str(e)[:300]}")
        return 1

    blocks = markdown_to_blocks(summary)
    blocks.append({"object": "block", "type": "divider", "divider": {}})
    blocks.append({
        "object": "block", "type": "heading_2",
        "heading_2": {"rich_text": _rich_text("🎙️ 회의 전문")},
    })
    blocks += transcript_to_blocks(sample)

    print("2) Notion 페이지 생성 중...")
    try:
        url = create_notion_page(title, blocks)
        print(f"   ✅ 업로드 완료: {url}")
        print("\n🎉 셀프테스트 성공 — run_meeting.bat 으로 실제 녹음을 시작하세요.")
        return 0
    except requests.HTTPError as e:
        detail = e.response.text[:500] if e.response is not None else str(e)
        print(f"   ❌ Notion 업로드 실패: {detail}")
        return 1
    except Exception as e:
        print(f"   ❌ Notion 업로드 실패: {type(e).__name__}: {e}")
        return 1


if __name__ == "__main__":
    import sys
    if "--selftest" in sys.argv:
        raise SystemExit(selftest())
    port = int(os.environ.get("PORT", "5000"))
    url = f"http://localhost:{port}"
    import threading
    import webbrowser
    threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    print(f"\n브라우저가 자동으로 열립니다 → {url}")
    print("열리지 않으면 위 주소를 크롬/엣지에 직접 입력하세요. (종료: Ctrl+C)\n")
    app.run(host="127.0.0.1", port=port, debug=False)
