# Design references

Reviewed on 2026-10-22. These sites were inspected for structure and interaction; no source code, branding, datasets or illustrations were copied.

| Reference | Observation | Application to TraceScope |
| --- | --- | --- |
| [OpenVLHarness](https://openvlharness.github.io/) | Persistent section navigation, prominent resource links, architecture replay and benchmark-specific analysis | A clear project identity followed by interactive research content; the diagnostic axes explain the information interface |
| [Meta-Video](https://soumyasj.github.io/meta-video/) | Research narrative interleaves figures, protocol settings, interactive charts and an example explorer | Charts and examples are part of the explanation rather than separate decorations; metric descriptions stay near results |
| [MMMU](https://mmmu-benchmark.github.io/) | Immediate paper/code/data entry points, taxonomy, examples and evaluation results | Task coverage is visible early, followed by concrete examples and detailed readouts |
| [Video-MME](https://video-mme.github.io/home_page.html) | Results distinguish input conditions and expose sortable columns | Group all task readouts in one table, with individual metric sorting and a documented task-balanced default order |
| [LongVideoBench](https://longvideobench.github.io/index.html) | A representative video question makes the benchmark premise concrete before the leaderboard | Visitors encounter clinical evidence and a real question before detailed results |

## Visual direction

A concise academic project page: warm off-white, deep green, restrained orange, and serif accents. The main thread is **what is measured → how it is built → what is learned**. Figures 1, 2 and 3 carry the explanation. Examples are expandable; the main board is open by default, displaying all 22 models and all six task groups together. Its model column stays visible during horizontal scrolling. A small generated brand illustration follows the paper's friendly visual language. Native SVG charts use the frozen numerical sources.

The old anonymous-review showcase guide is a content reference. This site follows the user's newer plan: develop locally, push to the private TraceScope repository, and make the project public at acceptance or open-source release. No anonymity-themed product framing or public deployment has been added.
