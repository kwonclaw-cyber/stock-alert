import yfinance as yf
import feedparser
import anthropic
import smtplib
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))
now = datetime.now(KST).strftime("%Y-%m-%d %H:%M")

# 테마별 미국 추적 티커 및 국내 관련 종목
THEMES = {
    "🤖 AI":         {"us": "BOTZ", "kr": [("삼성전자", "005930.KS"), ("SK하이닉스", "000660.KS"), ("NAVER", "035420.KS")]},
    "💾 반도체":     {"us": "SOXX", "kr": [("SK하이닉스", "000660.KS"), ("한미반도체", "042700.KS"), ("리노공업", "058470.KS")]},
    "🔋 2차전지":    {"us": "LIT",  "kr": [("LG에너지솔루션", "373220.KS"), ("삼성SDI", "006400.KS"), ("에코프로비엠", "247540.KQ")]},
    "🧬 바이오":     {"us": "XBI",  "kr": [("삼성바이오로직스", "207940.KS"), ("셀트리온", "068270.KS"), ("유한양행", "000100.KS")]},
    "🛡️ 방산":      {"us": "ITA",  "kr": [("한화에어로스페이스", "012450.KS"), ("현대로템", "064350.KS"), ("LIG넥스원", "079550.KS")]},
    "⚛️ 원전":      {"us": "URA",  "kr": [("두산에너빌리티", "034020.KS"), ("한전기술", "052690.KS"), ("한전KPS", "051600.KS")]},
    "🤖 로봇":       {"us": "ROBO", "kr": [("레인보우로보틱스", "277810.KQ"), ("현대차", "005380.KS"), ("두산로보틱스", "454910.KS")]},
    "🌱 친환경":     {"us": "ICLN", "kr": [("씨에스윈드", "112610.KS"), ("한화솔루션", "009830.KS"), ("OCI홀딩스", "010060.KS")]},
    "🎮 게임":       {"us": "HERO", "kr": [("크래프톤", "259960.KS"), ("넥슨게임즈", "225570.KQ"), ("엔씨소프트", "036570.KS")]},
    "💳 핀테크":     {"us": "FINX", "kr": [("카카오페이", "377300.KS"), ("토스뱅크", ""), ("크래프톤", "259960.KS")]},
}

def get_change(ticker, period="2d"):
    t = yf.Ticker(ticker)
    hist = t.history(period=period)
    if len(hist) < 2:
        return None, None, None
    prev, curr = hist["Close"].iloc[-2], hist["Close"].iloc[-1]
    change = curr - prev
    pct = (change / prev) * 100
    return curr, change, pct

def arrow_html(pct):
    if pct >= 0:
        return '<span style="color:#e03131;">▲</span>'
    else:
        return '<span style="color:#1971c2;">▼</span>'

def get_index_data():
    tickers = {
        "나스닥": "^IXIC",
        "나스닥 선물 (야간)": "NQ=F",
        "S&P 500": "^GSPC",
        "다우존스": "^DJI",
    }
    result = {}
    rows = ""
    for name, ticker in tickers.items():
        curr, change, pct = get_change(ticker)
        if curr is None:
            continue
        result[name] = pct
        arrow = arrow_html(pct)
        color = "#e03131" if pct >= 0 else "#1971c2"
        rows += f"""
        <tr>
          <td style="padding:6px 12px;">{name}</td>
          <td style="padding:6px 12px; text-align:right; font-weight:bold;">{curr:,.2f}</td>
          <td style="padding:6px 12px; text-align:right; color:{color};">
            {arrow} {abs(change):,.2f} ({abs(pct):.2f}%)
          </td>
        </tr>"""
    return rows, result

def get_news_data():
    sources = [
        ("Reuters 비즈니스", "https://feeds.reuters.com/reuters/businessNews"),
        ("CNBC",            "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
        ("MarketWatch",     "http://feeds.marketwatch.com/marketwatch/topstories/"),
    ]
    all_news = []
    items_html = ""
    for source_name, url in sources:
        feed = feedparser.parse(url)
        entries = feed.entries[:3]
        if not entries:
            continue
        items_html += f'<tr><td colspan="2" style="padding:8px 12px; background:#f8f9fa; font-weight:bold; font-size:13px; color:#555;">{source_name}</td></tr>'
        for entry in entries:
            title   = entry.get("title", "").strip()
            link    = entry.get("link", "#")
            summary = entry.get("summary", "")
            # HTML 태그 제거 후 100자 요약
            summary = re.sub(r"<[^>]+>", "", summary).strip()
            summary = summary[:100] + "..." if len(summary) > 100 else summary
            all_news.append(f"- {title}: {summary}")
            items_html += f"""
            <tr>
              <td style="padding:5px 12px 2px 20px; font-size:13px;">
                • <a href="{link}" style="color:#1c7ed6; text-decoration:none; font-weight:bold;">{title}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:2px 12px 8px 28px; font-size:12px; color:#666;">{summary}</td>
            </tr>"""
    return items_html, all_news

def get_theme_data():
    data = []
    rows = ""
    for name, info in THEMES.items():
        _, _, pct = get_change(info["us"])
        if pct is None:
            continue
        data.append((name, pct, info["kr"]))
    data.sort(key=lambda x: x[1], reverse=True)

    for name, pct, kr_stocks in data:
        arrow = arrow_html(pct)
        color = "#e03131" if pct >= 0 else "#1971c2"
        stock_names = ", ".join([s[0] for s in kr_stocks if s[1]])
        rows += f"""
        <tr>
          <td style="padding:6px 12px;">{name}</td>
          <td style="padding:6px 12px; text-align:right; color:{color}; font-weight:bold;">
            {arrow} {abs(pct):.2f}%
          </td>
          <td style="padding:6px 12px; color:#555; font-size:13px;">{stock_names}</td>
        </tr>"""
    return rows, data

def get_ai_analysis(index_data, theme_data, news_list):
    index_text = "\n".join([f"- {k}: {v:+.2f}%" for k, v in index_data.items()])
    theme_text = "\n".join([f"- {name}: {pct:+.2f}%" for name, pct, _ in theme_data])
    news_text  = "\n".join(news_list[:9])

    prompt = f"""다음은 오늘 미국 주식 시장 데이터입니다. 한국 투자자 관점에서 분석해주세요.

[주요 지수]
{index_text}

[테마별 등락]
{theme_text}

[주요 뉴스]
{news_text}

다음 형식으로 한국어로 작성해주세요:

1. **시장 총평** (2~3문장): 간밤 미국 시장 전반적인 흐름 요약
2. **주목할 테마** (2~3개): 오늘 한국 시장에서 주목할 테마와 이유
3. **리스크 요인** (1~2개): 오늘 주의해야 할 위험 요소
4. **오늘의 한 줄 전략**: 오늘 한국 주식 투자 방향 한 문장"""

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    text = message.content[0].text

    # 마크다운 볼드(**text**) → HTML <strong>
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    # 줄바꿈 → <br>
    text = text.replace("\n", "<br>")
    return text

def send_email(subject, html_body):
    sender   = os.environ["GMAIL_ADDRESS"]
    password = os.environ["GMAIL_APP_PASSWORD"]
    receiver = os.environ["GMAIL_ADDRESS"]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = sender
    msg["To"]      = receiver
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender, password)
        server.sendmail(sender, receiver, msg.as_string())

if __name__ == "__main__":
    index_rows, index_data = get_index_data()
    theme_rows, theme_data = get_theme_data()
    news_html, news_list   = get_news_data()

    html = f"""
    <html><body style="font-family:Arial,sans-serif; max-width:700px; margin:auto; color:#222;">
      <h2 style="border-bottom:2px solid #333; padding-bottom:8px;">
        📊 미국 주식 시황 <span style="font-size:14px; color:#666;">({now} KST)</span>
      </h2>

      <h3>📈 주요 지수</h3>
      <table style="border-collapse:collapse; width:100%;">
        <thead>
          <tr style="background:#f1f3f5;">
            <th style="padding:6px 12px; text-align:left;">지수</th>
            <th style="padding:6px 12px; text-align:right;">현재가</th>
            <th style="padding:6px 12px; text-align:right;">등락</th>
          </tr>
        </thead>
        <tbody>{index_rows}</tbody>
      </table>

      <h3 style="margin-top:24px;">🗂️ 테마별 등락 &amp; 국내 관련 종목</h3>
      <table style="border-collapse:collapse; width:100%;">
        <thead>
          <tr style="background:#f1f3f5;">
            <th style="padding:6px 12px; text-align:left;">테마</th>
            <th style="padding:6px 12px; text-align:right;">등락률</th>
            <th style="padding:6px 12px; text-align:left;">국내 관련 종목</th>
          </tr>
        </thead>
        <tbody>{theme_rows}</tbody>
      </table>

      <h3 style="margin-top:24px;">📰 주요 뉴스</h3>
      <table style="border-collapse:collapse; width:100%;">
        <tbody>{news_html}</tbody>
      </table>



      <p style="margin-top:24px; font-size:12px; color:#aaa;">
        본 메일은 자동 발송됩니다. 투자 참고용이며 투자 권유가 아닙니다.
      </p>
    </body></html>
    """
    send_email(f"[주식 시황] {now}", html)
    print("메일 전송 완료")
