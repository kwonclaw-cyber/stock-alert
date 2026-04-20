import yfinance as yf
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime, timezone, timedelta

# 한국 시간
KST = timezone(timedelta(hours=9))
now = datetime.now(KST).strftime("%Y-%m-%d %H:%M")

def get_index_data():
    tickers = {
        "나스닥": "^IXIC",
        "나스닥 선물 (야간)": "NQ=F",
        "S&P 500": "^GSPC",
        "다우존스": "^DJI",
    }
    result = []
    for name, ticker in tickers.items():
        t = yf.Ticker(ticker)
        hist = t.history(period="2d")
        if len(hist) < 2:
            continue
        prev, curr = hist["Close"].iloc[-2], hist["Close"].iloc[-1]
        change = curr - prev
        pct = (change / prev) * 100
        arrow = "▲" if change >= 0 else "▼"
        result.append(f"{name}: {curr:,.2f}  {arrow} {abs(change):,.2f} ({abs(pct):.2f}%)")
    return "\n".join(result)

def get_sector_data():
    sectors = {
        "기술 (XLK)": "XLK",
        "금융 (XLF)": "XLF",
        "에너지 (XLE)": "XLE",
        "헬스케어 (XLV)": "XLV",
        "산업재 (XLI)": "XLI",
        "통신 (XLC)": "XLC",
        "경기소비재 (XLY)": "XLY",
        "필수소비재 (XLP)": "XLP",
        "유틸리티 (XLU)": "XLU",
        "부동산 (XLRE)": "XLRE",
        "소재 (XLB)": "XLB",
    }
    data = []
    for name, ticker in sectors.items():
        t = yf.Ticker(ticker)
        hist = t.history(period="2d")
        if len(hist) < 2:
            continue
        prev, curr = hist["Close"].iloc[-2], hist["Close"].iloc[-1]
        pct = ((curr - prev) / prev) * 100
        data.append((name, pct))

    data.sort(key=lambda x: x[1], reverse=True)

    lines = []
    for name, pct in data:
        arrow = "▲" if pct >= 0 else "▼"
        lines.append(f"{arrow} {name}: {abs(pct):.2f}%")
    return "\n".join(lines)

def send_email(subject, body):
    sender = os.environ["GMAIL_ADDRESS"]
    password = os.environ["GMAIL_APP_PASSWORD"]
    receiver = os.environ["GMAIL_ADDRESS"]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = receiver
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender, password)
        server.sendmail(sender, receiver, msg.as_string())

if __name__ == "__main__":
    index_text = get_index_data()
    sector_text = get_sector_data()

    body = f"""
📊 미국 주식 시황 ({now} KST)
{'='*40}

📈 주요 지수
{index_text}

{'='*40}

🗂️ 섹터별 등락 (상위 → 하위)
{sector_text}

{'='*40}
"""
    send_email(f"[주식 시황] {now}", body)
    print("메일 전송 완료")
