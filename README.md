# TraceScope

The project website for **TraceScope: Tracing Failures from Evidence to Decision in Upper-GI Endoscopy**.

The repository is being prepared privately. No hosted site, deployment workflow or repository-visibility change is configured.

## Local preview

Requires Node.js 20 or newer. There are no npm dependencies to install.

```bash
npm run dev
```

Open `http://127.0.0.1:4173/`. The development server listens only on loopback. Source edits are visible after a browser refresh.

```bash
npm run check
npm run build
npm run preview
```

`build` checks data and resources and emits a self-contained static website to `dist/`. Stop the development server before running the production preview on the same port, or set `PORT=4174` for the second server. All resource paths are relative so the output can later live under `/TraceScope/` on GitHub Pages.

## Included

- Three-part research narrative with paper Figures 1, 2 and 3 visible by default and a zoomable figure viewer.
- A generated brand illustration styled to accompany the paper figures; its prompt and role are documented in `docs/brand-illustration.md`.
- Six task examples with original paper evidence, reference reveal and full model-response figures.
- Two interactive diagnostic-axis views after the main board. Axis 2 recreates the paper's 19-model radar from all 95 frozen balanced-accuracy values, with smooth state transitions, play/pause, model readouts and reduced-motion support.
- A main board open by default, showing all 22 models and 19 Table 2 readouts in six task groups, with a frozen model column, search, family filtering, sortable metrics and a separate physician reference.
- Downloadable manuscript and aggregate results.
- Responsive navigation, keyboard-accessible tabs and dialogs, local fonts, and reduced-motion support.

Task examples are expandable. The main board shows all tasks and models immediately, ordered by overall performance: readout ranks are averaged within each task and equally across six tasks, using the 17 deterministic columns and average ranks for ties. The two descriptive judge readouts are displayed but excluded from this viewing order. Individual metric sorting can be reset with **Overall performance**.

## Content and publication metadata

- `site/config.js`: verified paper/repository links and optional authors, venue, dataset link and citation metadata.
- `site/data/benchmark.json`: aggregate results and curated paper examples. No examination identifiers or raw clinical records are included.
- `public/assets/`: paper-derived images, current manuscript, original SVG identity, and fonts with their OFL licenses.
- `docs/design-references.md`: research on reference websites and adopted interaction patterns.
- `docs/content-provenance.md`: sources, data interpretation and release preparation.

Before the public release, replace the manuscript with its release version, complete verified authors/venue/data links, decide the code and clinical-media licenses, and remove the `noindex, nofollow` meta tag. Public hosting and repository visibility remain manual decisions. Do not enable Pages as part of ordinary development pushes.

The `citation` configuration is reserved until verified bibliographic metadata is available; it is not displayed in this draft. No authors or acceptance claim have been invented.

## Re-exporting manuscript data

The optional exporter uses the local sibling manuscript workspace and Python's standard library:

```bash
conda run -n medai python scripts/export-paper-data.py --workspace ..
```

It parses Table 2 and the frozen Axis 1/Axis 2 packages, and records SHA-256 hashes. Updating the source data should be followed by a build and browser checks.

## Browser checks

With the local server running and Playwright installed in `medai`:

```bash
conda run -n medai python scripts/browser-check.py
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` may point to an existing Chromium executable. Checks cover tasks/references, both axes, all table values, overall ordering, metric sorting/filtering, the frozen model column, radar values/geometry, playback, real polygon interpolation, reduced-motion support, dialogs, mobile navigation, six viewport sizes, downloads and browser errors. Screenshots and the report are written to ignored `qa/`.
