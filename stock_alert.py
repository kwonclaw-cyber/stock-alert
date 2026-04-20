import yfinance as yf
import smtplib
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
        return f'<span style="color:#e03131;">▲</span>'
    else:
        return f'<span style="color:#1971c2;">▼</span>'

def get_index_rows():
    tickers = {
        "나스닥": "^IXIC",
        "나스닥 선물 (야간)": "NQ=F",
        "S&P 500": "^GSPC",
        "다우존스": "^DJI",
    }
    rows = ""
    for name, ticker in tickers.items():
        curr, change, pct = get_change(ticker)
        if curr is None:
            continue
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
    return rows

def get_theme_rows():
    data = []
    for name, info in THEMES.items():
        _, _, pct = get_change(info["us"])
        if pct is None:
            continue
        data.append((name, pct, info["kr"]))
    data.sort(key=lambda x: x[1], reverse=True)

    rows = ""
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
    return rows

def send_email(subject, html_body):
    sender = os.environ["GMAIL_ADDRESS"]
    password = os.environ["GMAIL_APP_PASSWORD"]
    receiver = os.environ["GMAIL_ADDRESS"]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = receiver
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender, password)
        server.sendmail(sender, receiver, msg.as_string())

if __name__ == "__main__":
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
        <tbody>{get_index_rows()}</tbody>
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
        <tbody>{get_theme_rows()}</tbody>
      </table>

      <p style="margin-top:24px; font-size:12px; color:#aaa;">
        본 메일은 자동 발송됩니다. 투자 참고용이며 투자 권유가 아닙니다.
      </p>
    </body></html>
    """
    send_email(f"[주식 시황] {now}", html)
    print("메일 전송 완료")
