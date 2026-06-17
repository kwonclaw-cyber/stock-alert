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
import json
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


def load_mate_from_slim(sales_glob):
    """slim 매출 파일들에서 매장코드->매장명 수집(6개월 합집합)."""
    import glob as _glob
    stores = {}
    for f in sorted(_glob.glob(sales_glob)):
        d = json.load(open(f, encoding="utf-8"))
        for code, name in d.get("stores", {}).items():
            stores[str(code)] = name
    return stores


def build(mate_xlsx, manifest_csv, out_csv):
    mate = load_mate(mate_xlsx)              # code -> name
    match_and_write(mate, manifest_csv, out_csv)


def match_and_write(mate, manifest_csv, out_csv):
    man = load_manifest(manifest_csv)        # shopNumber -> name
    man_by_norm = {}
    for sn, nm in man.items():
        man_by_norm.setdefault(norm(nm), []).append((sn, nm))

    rows = []
    used_sn = set()
    pending = []  # 1차(정확) 매칭 실패분 → 2차(부분일치) 시도
    for code, mname in sorted(mate.items()):
        cands = man_by_norm.get(norm(mname), [])
        if len(cands) == 1:
            sn, bn = cands[0]
            used_sn.add(sn)
            rows.append([code, mname, sn, bn, "matched"])
        elif len(cands) > 1:
            rows.append([code, mname, "", " / ".join(f"{s}:{n}" for s, n in cands), "ambiguous"])
        else:
            pending.append([code, mname])

    # 2차: 지역접두 차이(강서점↔강서본점, 수영점↔부산수영점 등) — 한쪽이 다른 쪽을
    #      포함하고, 아직 안 쓰인 배민매장 후보가 '유일'할 때만 매칭(억지 금지)
    for code, mname in pending:
        mn = norm(mname)
        hits = []
        for sn, bn in man.items():
            if sn in used_sn:
                continue
            bn_n = norm(bn)
            if mn and bn_n and (mn in bn_n or bn_n in mn):
                hits.append((sn, bn))
        if len(hits) == 1:
            sn, bn = hits[0]
            used_sn.add(sn)
            rows.append([code, mname, sn, bn, "matched_fuzzy"])
        else:
            note = " / ".join(f"{s}:{n}" for s, n in hits) if hits else ""
            rows.append([code, mname, "", note, "mate_only"])
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
    for k in ("matched", "matched_fuzzy", "ambiguous", "mate_only", "baemin_only"):
        if c.get(k):
            print(f"  {k}: {c[k]}")
    print("\n[손보기 필요] 매출엔 있는데 배민변경이력에 못 붙은 매장:")
    for r in rows:
        if r[4] in ("mate_only", "ambiguous"):
            print(f"   {r[0]}  {r[1]}   ({r[4]})")


if __name__ == "__main__":
    # 사용법:
    #   build_store_map.py --slim 'dataset/sales/matetech_slim_*.json'   (권장: 6개월 전체 매장)
    #   build_store_map.py <xlsx>                                        (단일 엑셀)
    manifest = "dataset/manifest.csv"
    out = "dataset/store_map.csv"
    if len(sys.argv) > 1 and sys.argv[1] == "--slim":
        pattern = sys.argv[2] if len(sys.argv) > 2 else "dataset/sales/matetech_slim_*.json"
        mate = load_mate_from_slim(pattern)
        match_and_write(mate, manifest, out)
    else:
        build(sys.argv[1], manifest, out)
