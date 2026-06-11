"""올인원 생성기: 폴더에 넣은 파일들 → 통합본 + 분석 워크북 자동 생성.

한 매장 폴더에 아래를 넣고 실행하면 됩니다:
  - baemin_변경이력_*.json   (콘솔 스니펫 결과 1개)
  - matetech 엑셀들           (주문경로별/시간대별, 월별 여러 개)

사용:
  python generate.py <폴더경로> [매장이름]
  (폴더 생략 시 현재 폴더)

결과(폴더 안에 생성):
  <매장이름>_통합본.xlsx   — 일자별 타임라인/시간대별/배민 변경이력
  <매장이름>_분석.xlsx     — 일자별 분석/주차별/월별/분석요약
"""

import glob
import json
import os
import sys

import merge_sales
import analyze


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "."
    folder = os.path.abspath(folder)
    if not os.path.isdir(folder):
        print(f"폴더를 찾을 수 없습니다: {folder}")
        sys.exit(1)

    jsons = [f for f in glob.glob(os.path.join(folder, "*.json"))]
    if not jsons:
        print("배민 변경이력 JSON(baemin_변경이력_*.json)이 폴더에 없습니다.")
        sys.exit(1)
    bundle = jsons[0]
    if len(jsons) > 1:
        print(f"※ JSON이 여러 개라 첫 번째만 사용: {os.path.basename(bundle)}")

    # 매장 이름 결정: 인자 > JSON 안 shopNumber > 파일명
    name = sys.argv[2] if len(sys.argv) > 2 else None
    if not name:
        try:
            sn = json.load(open(bundle, encoding="utf-8")).get("shopNumber")
            name = f"매장_{sn}" if sn else os.path.splitext(os.path.basename(bundle))[0]
        except Exception:
            name = os.path.splitext(os.path.basename(bundle))[0]

    merged = os.path.join(folder, f"{name}_통합본.xlsx")
    analysis = os.path.join(folder, f"{name}_분석.xlsx")

    print(f"[1/2] 통합본 생성 …  ({name})")
    merge_sales.build(folder, bundle, merged)
    print(f"[2/2] 분석 생성 …")
    analyze.build(merged, analysis)

    print("\n완료! 아래 두 파일이 생겼습니다:")
    print(f"  · {merged}")
    print(f"  · {analysis}")


if __name__ == "__main__":
    main()
