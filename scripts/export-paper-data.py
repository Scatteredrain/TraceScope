"""Export aggregate website data from the local manuscript and frozen packages.

Run from any directory with conda run -n medai python scripts/export-paper-data.py.
The export intentionally contains no examination IDs, raw reports or predictions.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    workspace = args.workspace.resolve()
    table = workspace / "overleaf/tables/tab_main_overview_v6_3_compact.tex"
    axis1_path = workspace / "Report-Grounded-VQA-Synthesis/data/axis1/canonical/axis1_t5_primary_analysis.json"
    axis2_path = workspace / "Report-Grounded-VQA-Synthesis/data/axis2/tables/classwise_summary.csv"
    models, references = [], {}
    family = ""
    for line in table.read_text().splitlines():
        if "multicolumn{20}" in line:
            for value in ["Proprietary", "General-purpose", "Video-native", "Medical"]:
                if value in line:
                    family = value
        if " & " not in line:
            continue
        line = re.sub(r"\\cellcolor\[HTML\]\{[A-Fa-f0-9]+\}", "", line)
        cells = line.rstrip().removesuffix("\\\\").split(" & ")
        if len(cells) != 20:
            continue
        scores = []
        valid = True
        for cell in cells[1:]:
            number = re.search(r"\d+\.\d+", cell)
            if number:
                scores.append(float(number.group()))
            elif cell.strip() == "-":
                scores.append(None)
            else:
                valid = False
                break
        if not valid:
            continue
        name = re.sub(r"\\textit\{([^}]+)\}", r"\1", cells[0]).strip()
        record = {"name": name, "family": family, "scores": scores}
        if name in ["random", "physician (subset)"]:
            references["random" if name == "random" else "physician"] = record
        else:
            models.append(record)
    assert len(models) == 22, f"Expected 22 models, got {len(models)}"

    task_specs = [
        ("Anatomy", "Anatomical site recognition", 1572, "Single image", "Station accuracy", [0, 1]),
        ("Findings", "Abnormal finding assessment", 3767, "Matched multi-image", "Exact set agreement", [2, 3, 4, 5]),
        ("Attributes", "Finding attribute specification", 895, "Matched multi-image", "Unit-aware numeric matching", [6, 7, 8, 9, 10]),
        ("Report", "Findings report generation", 600, "Examination-level images", "Site coverage · Finding recall", [11, 12, 13, 14, 15]),
        ("Impression", "Diagnostic impression prediction", 1637, "Matched multi-image", "Impression accuracy", [16]),
        ("Guidelines", "Guideline-grounded clinical reasoning", 635, "Matched multi-image", "Grade agreement · Reasoning consistency", [17, 18]),
    ]
    tasks = [dict(id=f"T{i}", name=name, title=title, count=count, evidence=evidence,
                  metric=metric, indices=indices, image=f"assets/task-{i}-evidence-1.webp",
                  example=f"assets/task-{i}-example.webp")
             for i, (name, title, count, evidence, metric, indices) in enumerate(task_specs, 1)]
    examples = [
        dict(question="Which station is this endoscopy frame documenting?", form="Single choice",
             options=["Cardia", "Gastric fundus", "Pylorus", "Gastric antrum"], reference="A · Cardia",
             explanation="Exact match against the physician-stated anatomical reference.",
             caption="One physician-annotated examination frame", label="SINGLE-IMAGE EVIDENCE"),
        dict(question="List the abnormal findings visible in this endoscopic image of the gastric angulus.", form="Select all that apply",
             options=["Irregular glandular structure", "Depression", "Thinned mucosa", "Fistula / sinus tract"], reference="A + B · Irregular glandular structure; depression",
             explanation="The full finding set must match. Recognizing one finding is insufficient for exact-set agreement.",
             caption="Three matched frames · Gastric angulus", label="MATCHED VISUAL EVIDENCE"),
        dict(question="This endoscopic image shows the esophagus. Describe the size of the mucosal break / defect.", form="Open quantitative answer",
             options=[], reference="5 mm", explanation="The reference is a quantitative size slot; evaluation normalizes units before numeric matching.",
             caption="Three matched frames · Esophagus", label="ATTRIBUTE-SPECIFIC EVIDENCE"),
        dict(question="These are all the images retained from one upper-GI endoscopy. Write the endoscopic findings, organised site by site.", form="Free-text report",
             options=[], reference="A site-indexed findings report",
             explanation="Reference excerpt — Gastric body: mucosa gray-white; scattered white areas on the lesser curvature; a xanthoma; rough, slightly depressed mucosa on the lesser curvature, biopsied. The complete report is in the paper example.",
             caption="Representative frames from the examination", label="EXAMINATION-LEVEL EVIDENCE"),
        dict(question="Based on these endoscopic images, give the endoscopic diagnosis.", form="Single choice",
             options=["Portal hypertensive gastropathy", "Gastric bezoar", "Gastric antral vascular ectasia (GAVE)", "Gastric retention"], reference="A · Portal hypertensive gastropathy",
             explanation="The reference is the endoscopic impression. The complete example includes predictions from all 22 models.",
             caption="Matched evidence across the examination", label="DIAGNOSTIC-IMPRESSION EVIDENCE"),
        dict(question="Grade this case according to the Paris Classification + MESDA-G Guideline for Early Gastric Cancer, and state the signs your grade rests on.", form="Structured reasoning",
             options=[], reference="Paris grade · 0-IIc", explanation="Evaluation separates exact grade agreement from sign recovery and reference-consistent reasoning. See the full paper example for the sign set and model chains.",
             caption="Four matched frames · Paris + MESDA-G", label="GUIDELINE-RELEVANT EVIDENCE"),
    ]
    for task, example in zip(tasks, examples):
        task.update(example)
    metric_specs = [
        ("Gastric site", "Accuracy on gastric-site recognition"), ("Organ", "Accuracy on organ recognition"),
        ("Normal state", "Normal-state judgment accuracy"), ("Finding presence", "Single-finding presence accuracy"),
        ("Enumeration · single", "Single-choice finding enumeration accuracy"), ("Enumeration · exact set", "Exact-set accuracy on select-all finding enumeration"),
        ("Size · MRA", "Mean relative accuracy for quantitative size answers"), ("Count · MRA", "Mean relative accuracy for quantitative count answers"),
        ("Position / distribution", "Categorical position and distribution accuracy"), ("Morphology", "Morphology accuracy"), ("Color", "Color accuracy"),
        ("Site coverage", "Coverage of canonical anatomical sites"), ("Finding recall", "Canonical finding recall"),
        ("ROUGE-L", "Wording-sensitive ROUGE-L control"), ("BioBERTScore", "Biomedical embedding similarity control"),
        ("SEFR · judge", "Judge-based report quality readout; descriptive"), ("Impression", "Diagnostic-impression accuracy"),
        ("Grade agreement", "Exact guideline-grade agreement"), ("ELRC · judge", "Judge-based reference-consistent reasoning readout; descriptive"),
    ]
    metrics = [dict(label=label, description=description) for label, description in metric_specs]
    axis1 = json.loads(axis1_path.read_text())
    order = axis1["scope"]["models"]["order"]
    presentations = axis1["scope"]["presentations"]["primary"]
    axis1_export = {"examinations": 193, "presentations": [p["paper_name"] for p in presentations],
                    "models": [{"id": model, "scores": [axis1["cells"][f"{model}|{p['tier']}"]["acc_all"] for p in presentations]} for model in order]}
    axis1_export["means"] = [sum(model["scores"][i] for model in axis1_export["models"]) / len(order) for i in range(5)]
    with axis2_path.open() as f:
        states = [{key: (value if key == "state" else float(value)) for key, value in row.items()} for row in csv.DictReader(f)]
    data = {"source": "TraceScope manuscript v4, Table 2; frozen diagnostic-axis packages", "tasks": tasks,
            "metrics": metrics, "models": models, **references, "axis1": axis1_export, "axis2": {"examinations": 1220, "models": 19, "states": states},
            "provenance": {str(path.relative_to(workspace)): hashlib.sha256(path.read_bytes()).hexdigest() for path in [table, axis1_path, axis2_path]}}
    out = repo / "site/data/benchmark.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"Exported {len(models)} models, {len(metrics)} metrics, six task examples and both axes → {out}")


if __name__ == "__main__":
    main()
