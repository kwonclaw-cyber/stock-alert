import os
import re
import sys
import tempfile
import smtplib
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import openpyxl
import anthropic
from playwright.sync_api import sync_playwright


KST = timezone(timedelta(hours=9))
LOGIN_URL = "https://www.matetech.co.kr/login"
SALES_URL = "https://www.matetech.co.kr/service/saa0060/sales/analysis/order-path"


def fetch_sales_excel(report_type: str) -> str:
    """matetech.co.kr 로그인 후 주문경로별 매출 엑셀 다운로드.

    report_type: 'daily' (전일 버튼) 또는 'weekly' (지난7일 버튼)
    """
    period_label = "전일" if report_type == "daily" else "지난7일"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(accept_downloads=True)
        page = ctx.new_page()

        page.goto(LOGIN_URL)
        page.fill("#member-id", os.environ["MATETECH_USERNAME"])
        page.fill("#member-pw", os.environ["MATETECH_PASSWORD"])
        page.click("#member-btn")
        page.wait_for_load_state("networkidle")

        page.goto(SALES_URL)
        page.wait_for_load_state("networkidle")

        page.get_by_role("button", name=period_label).click()
        page.wait_for_timeout(500)

        page.get_by_role("button", name="검색").click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        with page.expect_download() as dl_info:
            page.get_by_role("button", name="엑셀 다운로드").click()
        download = dl_info.value

        tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
        download.save_as(tmp.name)
        browser.close()
        return tmp.name


def parse_excel(filepath: str):
    """엑셀 4행 이후가 데이터 (1~2행 헤더, 3행 합계 라벨)."""
    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb.active

    rows = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        if not row or not row[0]:
            continue
        rows.append({
            "order_type": row[0],
            "channel": row[1],
            "channel_detail": row[2],
            "count": int(row[3] or 0),
            "amount": int(row[5] or 0),
        })
    return rows


def aggregate(rows):
    """채널 단위로 집계 (배민배달+배달의민족 → 배달의민족 등 동일 채널 합산)."""
    summary = {}
    total_count = 0
    total_amount = 0
    for r in rows:
        ch = r["channel"]
        if ch not in summary:
            summary[ch] = {"count": 0, "amount": 0}
        summary[ch]["count"] += r["count"]
        summary[ch]["amount"] += r["amount"]
        total_count += r["count"]
        total_amount += r["amount"]
    return summary, total_count, total_amount


def format_won(n):
    return f"{n:,}원"


def get_ai_analysis(report_type, summary, total_count, total_amount):
    period = "어제 (전일)" if report_type == "daily" else "지난 7일 (주간)"
    lines = []
    for ch, d in sorted(summary.items(), key=lambda x: -x[1]["amount"]):
        ratio = d["amount"] * 100 / total_amount if total_amount else 0
        lines.append(f"- {ch}: {d['count']:,}건, {d['amount']:,}원 ({ratio:.1f}%)")
    channel_text = "\n".join(lines)

    prompt = f"""다음은 외식 프랜차이즈의 {period} 매출 데이터입니다.

[총 합계]
- 총 주문 건수: {total_count:,}건
- 총 매출액: {total_amount:,}원
- 평균 객단가: {(total_amount/total_count if total_count else 0):,.0f}원

[채널별 매출]
{channel_text}

다음 형식으로 한국어로 간결하게 분석해주세요:

1. **매출 총평** (2~3문장): 전반적인 매출 흐름과 특이점
2. **채널별 인사이트** (2~3개): 주요 배달 플랫폼 비중과 시사점
3. **개선 제안** (1~2개): 매출 증대를 위해 고려해볼 점"""

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = text.replace("\n", "<br>")
    return text


def render_html(report_type, summary, total_count, total_amount, ai_text, now_str):
    title_type = "일간" if report_type == "daily" else "주간"
    avg = total_amount / total_count if total_count else 0

    channel_rows = ""
    for ch, d in sorted(summary.items(), key=lambda x: -x[1]["amount"]):
        ratio = d["amount"] * 100 / total_amount if total_amount else 0
        channel_rows += f"""
        <tr>
          <td style="padding:6px 12px;">{ch}</td>
          <td style="padding:6px 12px; text-align:right;">{d['count']:,}</td>
          <td style="padding:6px 12px; text-align:right; font-weight:bold;">{format_won(d['amount'])}</td>
          <td style="padding:6px 12px; text-align:right; color:#666;">{ratio:.1f}%</td>
        </tr>"""

    html = f"""
    <html><body style="font-family:Arial,sans-serif; max-width:700px; margin:auto; color:#222;">
      <h2 style="border-bottom:2px solid #333; padding-bottom:8px;">
        매출 리포트 ({title_type})
        <span style="font-size:14px; color:#666;">({now_str} KST)</span>
      </h2>

      <h3>전체 요약</h3>
      <table style="border-collapse:collapse; width:100%;">
        <tbody>
          <tr style="background:#f8f9fa;">
            <td style="padding:8px 12px; width:50%;">총 주문 건수</td>
            <td style="padding:8px 12px; text-align:right; font-weight:bold; font-size:16px;">{total_count:,}건</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;">총 매출액</td>
            <td style="padding:8px 12px; text-align:right; font-weight:bold; font-size:16px; color:#e03131;">{format_won(total_amount)}</td>
          </tr>
          <tr style="background:#f8f9fa;">
            <td style="padding:8px 12px;">평균 객단가</td>
            <td style="padding:8px 12px; text-align:right;">{avg:,.0f}원</td>
          </tr>
        </tbody>
      </table>

      <h3 style="margin-top:24px;">채널별 매출</h3>
      <table style="border-collapse:collapse; width:100%;">
        <thead>
          <tr style="background:#f1f3f5;">
            <th style="padding:6px 12px; text-align:left;">채널</th>
            <th style="padding:6px 12px; text-align:right;">건수</th>
            <th style="padding:6px 12px; text-align:right;">매출액</th>
            <th style="padding:6px 12px; text-align:right;">비중</th>
          </tr>
        </thead>
        <tbody>{channel_rows}</tbody>
      </table>

      <h3 style="margin-top:24px;">AI 분석</h3>
      <div style="background:#f8f9fa; padding:16px; border-radius:8px; line-height:1.6; font-size:14px;">
        {ai_text}
      </div>

      <p style="margin-top:24px; font-size:12px; color:#aaa;">
        본 메일은 자동 발송됩니다. matetech.co.kr 데이터 기반.
      </p>
    </body></html>
    """
    return html


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
    report_type = os.environ.get("REPORT_TYPE", "daily").strip().lower()
    if report_type not in ("daily", "weekly"):
        print(f"Unknown REPORT_TYPE: {report_type}, fallback to 'daily'")
        report_type = "daily"

    now_str = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
    title_type = "일간" if report_type == "daily" else "주간"

    print(f"[{now_str}] {title_type} 매출 리포트 생성 시작")

    excel_path = fetch_sales_excel(report_type)
    print(f"엑셀 다운로드 완료: {excel_path}")

    rows = parse_excel(excel_path)
    print(f"엑셀 파싱 완료: {len(rows)}개 행")

    summary, total_count, total_amount = aggregate(rows)
    print(f"집계 완료: {total_count:,}건 / {total_amount:,}원")

    ai_text = get_ai_analysis(report_type, summary, total_count, total_amount)
    print("AI 분석 완료")

    html = render_html(report_type, summary, total_count, total_amount, ai_text, now_str)
    subject = f"[매출 리포트 - {title_type}] {now_str}"
    send_email(subject, html)
    print(f"{title_type} 매출 리포트 메일 전송 완료")
