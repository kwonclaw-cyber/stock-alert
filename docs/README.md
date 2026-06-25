# 배포 (GitHub Pages)

`docs/index.html` = **빅데이터 통합관리** 통합 파일을 **AES-256-GCM 비밀번호 암호화**한 정적 페이지.
비밀번호가 맞을 때만 브라우저(Web Crypto)에서 복호화되어 열린다. 소스를 봐도 평문 데이터는 노출되지 않는다.

## 활성화 (최초 1회, 저장소 관리자)
GitHub → **Settings → Pages → Build and deployment → Source: `GitHub Actions`** 선택.
이후 `docs/` 변경을 push하면 `.github/workflows/pages.yml`이 자동 배포한다.
URL: `https://kwonclaw-cyber.github.io/stock-alert/`

## 자료 갱신 + 재암호화
```bash
cd sample_collection
python3 build_store_map.py --slim 'dataset/sales/matetech_slim_*.json'
python3 build_master.py && python3 build_store_report.py
python3 analyze_effects.py && python3 analyze_discount.py && python3 analyze_time.py
python3 gen_pages.py
# 비밀번호 지정해 재암호화 (비번은 저장소에 저장되지 않음)
STATIC_PW='새비밀번호' python3 encrypt_html.py \
  'dataset/reports/빅데이터 통합관리.html' ../docs/index.html
```
