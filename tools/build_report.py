#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import html
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.common.io import read_jsonl


def esc(x: Any) -> str:
    return html.escape(str(x if x is not None else ""))


def avg(vals: List[float]) -> float:
    vals = [v for v in vals if v is not None]
    return round(sum(vals) / len(vals), 2) if vals else 0.0


def load_scores(paths: List[str]) -> List[Dict[str, Any]]:
    rows = []
    for p in paths:
        if p and Path(p).exists():
            rows.extend(read_jsonl(Path(p)))
    return rows


def group_summary(rows: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
    grouped = defaultdict(list)
    for r in rows:
        if r.get("score") is None:
            continue
        key = f"{r.get('task_id', 'unknown')}::{r.get('generation_model_id', 'unknown')}"
        grouped[key].append(float(r["score"]))

    return {k: {"count": len(v), "avg_score": avg(v)} for k, v in grouped.items()}


def build_html(title: str, text_rows: List[Dict], image_rows: List[Dict], summary: Dict) -> str:
    all_rows = text_rows + image_rows
    cards = "".join(
        f"<div class='card'><div class='k'>{esc(k)}</div>"
        f"<div class='v'>{v['avg_score']}</div><div class='s'>n={v['count']}</div></div>"
        for k, v in sorted(summary.items())
    )

    trs = []
    for r in all_rows:
        trs.append(
            "<tr>"
            f"<td>{esc(r.get('gen_item_id'))}</td>"
            f"<td>{esc(r.get('task_id'))}</td>"
            f"<td>{esc(r.get('generation_model_id'))}</td>"
            f"<td>{esc(r.get('score'))}</td>"
            f"<td>{esc(r.get('status'))}</td>"
            "</tr>"
        )

    return f"""<!doctype html>
<html><head><meta charset='utf-8'><title>{esc(title)}</title>
<style>
body{{font-family:system-ui,sans-serif;margin:24px;background:#f7f8fa;color:#111}}
.cards{{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}}
.card{{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;min-width:180px}}
.k{{font-size:12px;color:#666}} .v{{font-size:28px;font-weight:700}} .s{{font-size:12px;color:#888}}
table{{width:100%;border-collapse:collapse;background:#fff}}
th,td{{border:1px solid #e5e7eb;padding:8px;font-size:13px;text-align:left}}
th{{background:#f3f4f6}}
</style></head><body>
<h1>{esc(title)}</h1>
<h2>模型 × 任务 平均分</h2>
<div class='cards'>{cards}</div>
<h2>样本明细</h2>
<table><thead><tr><th>样本ID</th><th>任务</th><th>生成模型</th><th>分数</th><th>状态</th></tr></thead>
<tbody>{''.join(trs)}</tbody></table>
</body></html>"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--text-scores", default="")
    ap.add_argument("--image-scores", default="")
    ap.add_argument("--output", required=True)
    ap.add_argument("--title", default="Image-Text Model Eval Report")
    args = ap.parse_args()

    text_rows = load_scores([args.text_scores]) if args.text_scores else []
    image_rows = load_scores([args.image_scores]) if args.image_scores else []
    summary = group_summary(text_rows + image_rows)

    html_text = build_html(args.title, text_rows, image_rows, summary)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html_text, encoding="utf-8")
    print(f"report saved: {out}")


if __name__ == "__main__":
    main()
