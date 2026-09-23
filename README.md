# Writing Process Review

A teacher-facing tool that highlights **unusual writing-process and textual patterns that may be worth a closer look**.

It is **not** an AI detector. It never gives an "AI probability", never labels writing as AI-generated and never decides whether a student cheated. Every flag shows the evidence behind it and other possible explanations, and you can dismiss it or add a note.

## Opening the app

The app is a set of plain web files (HTML, CSS, JavaScript). It needs no installation and has no server or accounts.

* **On the website:** once this folder is on GitHub Pages, open `…/writing-review/`.
* **On your own computer:** browsers block this kind of app when you double-click the file. In a terminal, from this folder, run:

  ```
  python3 -m http.server 8000
  ```

  Then visit <http://localhost:8000>.

The first time it opens, it loads **fictional demo data** for three invented students, so you can explore:

| Demo student | What it shows |
|---|---|
| Sam Rivera | Typed introduction, then a 395-word paste of very formulaic prose that differs from Sam's three earlier essays. Result: **Review recommended**. |
| Avery Chen | Typed steadily, with normal revisions. The one paste was a quotation, so it is downgraded. Result: **No notable patterns**. |
| Jordan Price | Text only: no process log and no baseline. Formulaic phrasing is noted, but on its own it can never reach "Review recommended". |

You can reset or clear the demo data under **Settings**.

## Using it with real students

1. **Build a baseline.** Under *Students & baselines*, add writing you know the student produced themselves (for example, in-class essays). Three or more samples give an *established* baseline.
2. **Collect writing-process data (optional but valuable).** Students write in `capture.html`, which records typing, deleting and pasting, and tells students clearly that this is recorded. They download the log and hand it in.
3. **Add the submission.** Under *Add submission*, attach the log and/or paste the final text.
4. **Review.**
   * Open the submission.
   * Click each signal to see its observed evidence, the student's baseline, an interpretation, other explanations and the rule that set its severity.
   * Mark signals as reviewed or dismissed, and add notes.
5. **Report.** *Teacher report* produces a concise, printable summary.

Everything is stored **only in your browser** (localStorage). Use *Settings → Export* to back up your data or move it to another computer.

## Files

| Path | Purpose |
|---|---|
| `DESIGN.md` | Architecture, data model, event schema, pipeline, baseline method, severity rules, safeguards |
| `index.html` | Teacher dashboard |
| `capture.html` | Writing-capture editor |
| `js/config.js` | Every threshold (also editable in *Settings*) |
| `js/text/`, `js/process/`, `js/baseline/` | Detectors, grouped by the kind of evidence they use |
| `js/pipeline/registry.js` | The list of detectors. Add new signals here. |
| `tests/` | Automated tests (`npm test`, needs Node 18+) |
