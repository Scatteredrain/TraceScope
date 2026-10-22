# Content provenance and release preparation

## Current content basis

The manuscript is the local `_ICLR2027__Tracescope_v4.pdf` dated 2026-09-26, with supporting source in `overleaf/`. Its main-text extraction agrees with the local Overleaf PDF; a text difference in appendix page 31 does not affect the site's main-text account.

| Website content | Source |
| --- | --- |
| 9,106 items / 4,893 examinations / 70,386 item–frame references / 22 models | Abstract, Section 3, Table 4 |
| Six task counts and evidence scope | `overleaf/tables/tab_dataset.tex` |
| 22 models and 19 displayed readouts | `overleaf/tables/tab_main_overview_v6_3_compact.tex` |
| Axis 1 individual accuracies and plotted means | `data/axis1/canonical/axis1_t5_primary_analysis.json` in the construction repository |
| Axis 2 state values | `data/axis2/tables/classwise_summary.csv` in the construction repository |
| Axis 1 equal-count −8.8 pp and Axis 2 adjacent Δκ | Section 5.3 / 5.4 and the frozen packages |
| 295-question physician reference | Current Section 5 and reader-study protocol |
| Task images, prompts, references and model-response plates | Six worked examples in Appendix D / `overleaf/figures/t[1-6]*.pdf` |

The JSON export records the exact SHA-256 hashes of its three result sources. It retains aggregates only: examination manifests, pathology labels by case, raw reports, local server paths and per-case predictions are excluded.

## Asset preparation

- `overview.webp`, `construction.webp`, `composition.webp`, `diagnostic-results.webp`: rendered from the corresponding paper PDF figures without changing values or topology.
- `task-N-evidence-1.webp`: extracted embedded evidence montage from the corresponding worked-example PDF.
- `task-N-example.webp`: full worked-example PDF rendered as an image, including actual model responses.
- `brand-illustration.png`: generated editorial artwork used only in the hero; see `brand-illustration.md` for its exact prompt and reference role. Clinical evidence and numerical plots remain source-grounded.
- `tracescope.pdf`: an exact copy of the current v4 manuscript, downloaded on demand rather than loaded during initial rendering.
- Fonts: Manrope and DM Serif Display, served locally with their accompanying SIL Open Font Licenses.
- `favicon.svg`: native vector identity created for this page.

## Interpretation retained in the interface

1. The 9,106 main-board items exclude repeated diagnostic-axis conditions.
2. Main-board tasks use task-appropriate still-image contexts. Video presentation is analyzed in Axis 1.
3. The benchmark has no train/validation/test partition.
4. 70,386 denotes item–frame references, not unique frames or the number delivered to every model.
5. Axis 1 has 193 fixed diagnostic targets and nine models. The plotted state curve is the ordinary model mean. The prespecified selected-to-retained trimmed-mean statistic and equal-count comparison are distinct analyses; the website does not equate them.
6. Axis 2 has 1,220 pathology-verified H. pylori targets and 19 models. State plots use balanced accuracy; adjacent changes use Cohen's κ.
7. The net-count ≥2 boundary is an added Axis 2 intervention. It is not imposed as a universal main-board T6 rule.
8. Physician results are a separate 295-question reader-study reference. They do not enter model ranking.
9. The six explorer tabs are separate representative examples, not six tasks on a single asserted examination. T4/T5 montages show representative frames; the paper specifies the complete delivered sets.
10. Judge readouts are descriptive complements to deterministic clinical scores. The site retains all 19 published columns and does not compute an overall model rank.

## Public-release preparation

The current user instruction authorizes local development and source pushes to a private repository. It does not request public hosting or a change of repository visibility. No deployment automation is included.

Before public release, update `site/config.js` with verified authors, affiliations if desired, paper URL, dataset URL, evaluation-code URL and citation. Replace the current review PDF with the release PDF, confirm the selected paper-derived clinical media are cleared for the intended release, settle source/media licenses, remove the robots noindex tag, and then choose the hosting configuration. The site makes no acceptance claim while those details are pending.
