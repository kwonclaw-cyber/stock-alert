"""메이트포스 매장(매장코드+매장명) ↔ 배민 변경이력(shopNumber+shopName) 매핑.

메이트포스 매출은 '매장코드'(예: 1029164)로, 배민 변경이력은 'shopNumber'
(예: 14xxxxxx)로 식별된다. 둘을 잇는 키가 없으므로 **매장명**으로 매칭한다.

입력:
  - 메이트포스 '주문경로별_매출_매장별' xlsx (매장코드/매장명 보유)
  - dataset/manifest.csv (배민 187개 매장)
출력:
  - dataset/store_map.csv : mate_code | mate_name | shopNumber | baemin_name | status
    status = matched / mate_only(배민에 없음) / baemin_only(매출에 없음)

매칭 안 되는 건 status로 남겨 사람이 손으로 채우게 한다(억지 매칭 금지).
"""
import csv
import re
import sys
import openpyxl


def norm(s):
    """매장명 정규화: 브랜드 접두 제거 + 공백/특수문자 제거."""
    s = s or ""
    for pre in ("육식사관학교", "갈비집", "갈비랑찌개랑", "찌개랑갈비랑", "김삼구"):
        s = s.replace(pre, "")
    s = re.sub(r"[^0-9A-Za-z가-힣]", "", s)
    return s


def load_mate(xlsx):
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    ws = wb.active
    hdr = None
    stores = {}
    for row in ws.iter_rows(values_only=True):
        if hdr is None:
            if row and "매장코드" in [str(c) for c in row]:
                hdr = {str(c): i for i, c in enumerate(row)}
            continue
        ci, ni = hdr.get("매장코드"), hdr.get("매장명")
        code = row[ci] if ci is not None else None
        name = row[ni] if ni is not None else None
        if code and name:
            stores[str(code)] = name
    wb.close()
    return stores  # code -> name


def load_manifest(path):
    out = {}
    for r in csv.DictReader(open(path, encoding="utf-8-sig")):
        out[r["shopNumber"]] = r["shopName"]
    return out


def build(mate_xlsx, manifest_csv, out_csv):
    mate = load_mate(mate_xlsx)              # code -> name
    man = load_manifest(manifest_csv)        # shopNumber -> name
    man_by_norm = {}
    for sn, nm in man.items():
        man_by_norm.setdefault(norm(nm), []).append((sn, nm))

    rows = []
    used_sn = set()
    for code, mname in sorted(mate.items()):
        cands = man_by_norm.get(norm(mname), [])
        if len(cands) == 1:
            sn, bn = cands[0]
            used_sn.add(sn)
            rows.append([code, mname, sn, bn, "matched"])
        elif len(cands) > 1:
            rows.append([code, mname, "", " / ".join(f"{s}:{n}" for s, n in cands), "ambiguous"])
        else:
            rows.append([code, mname, "", "", "mate_only"])
    # 배민에만 있는 매장
    for sn, nm in sorted(man.items()):
        if sn not in used_sn:
            rows.append(["", "", sn, nm, "baemin_only"])

    with open(out_csv, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["mate_code", "mate_name", "shopNumber", "baemin_name", "status"])
        w.writerows(rows)

    from collections import Counter
    c = Counter(r[4] for r in rows)
    print(f"매핑 결과 → {out_csv}")
    for k in ("matched", "ambiguous", "mate_only", "baemin_only"):
        if c.get(k):
            print(f"  {k}: {c[k]}")
    print("\n[손보기 필요] 매출엔 있는데 배민변경이력에 못 붙은 매장:")
    for r in rows:
        if r[4] in ("mate_only", "ambiguous"):
            print(f"   {r[0]}  {r[1]}   ({r[4]})")


if __name__ == "__main__":
    mate_xlsx = sys.argv[1]
    manifest = sys.argv[2] if len(sys.argv) > 2 else "dataset/manifest.csv"
    out = sys.argv[3] if len(sys.argv) > 3 else "dataset/store_map.csv"
    build(mate_xlsx, manifest, out)
