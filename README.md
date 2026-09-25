# Writing Profiles

A classroom tool that helps teachers answer one question:

> **How unusual is this piece of writing for this particular student?**

It compares a new piece with the student's **own earlier writing and writing process**, across three kinds of evidence:
- **authorship fingerprint:** style
- **argument and discourse:** how ideas are built
- **composition process:** how the document was written, and whether text arrived in large blocks

It is **not an AI detector**:
- It never produces an AI probability, never says a text was written by AI, and never decides whether a student cheated.
- It detects *that something is unusual*, not *why*.

Every report states: *An anomaly is not evidence of misconduct.*

## Opening the app

It is a plain website: no installation, no accounts, no server.

* **GitHub Pages:** Settings → Pages → Deploy from branch → `main` / root. Then open `https://<your-username>.github.io/writingreview/`.
* **On your computer:** run `python3 -m http.server 8000` in this folder, then visit <http://localhost:8000>. Double-clicking `index.html` does not work, because browsers block it.

The app opens with a **fictional demo class** of four students. Each one shows a situation the tool must handle responsibly:

| Student | Situation | What the tool says |
|---|---|---|
| S-1042 | Six earlier samples. The new essay shows sudden shifts in vocabulary, syntax and argument, a long unrevised stretch, and a 275-word block inserted at once | Investigation priority **HIGH** |
| S-2217 | A consistently sophisticated writer | **LOW**: typical for this student |
| S-3308 | Writing has become steadily more sophisticated over a year | **LOW**: recognised as development, not flagged |
| S-4410 | Only one earlier sample | **INCONCLUSIVE**: insufficient baseline |

## Using it with your class

1. **Build profiles.** *Add writing → Baseline writing*.
   * Upload `.docx` (Google Docs: File → Download → .docx), `.pdf` or `.txt` files, or paste text.
   * Use work you consider authentic and representative, such as in-class writing.
   * **3 samples is the minimum; 5–10 is better.**
2. **Add a piece to review.**
   * First answer the assignment-context questions: genre, timed, research, notes, AI or collaboration allowed, sentence frames, model essay, and vocabulary you taught.
   * Optionally attach process data: a Google Docs add-on report (PDF), a revision-history export (JSON), or a log from `capture.html`.
3. **Investigate.** The piece's page has these tabs:
   * **Overview:** the anomaly profile, strongest deviations, profile comparison and suggested follow-up questions
   * **Evidence:** every finding, with evidence quality, historical support and alternative explanations; you can mark each one reviewed or dismissed, or add a note
   * **Side by side:** earlier vs. current writing, with explained highlights
   * **Argument map**
   * **Process timeline**
   * **Statistics**
4. **Talk with the student.** *Conference mode* shows a neutral, student-facing view.
5. **Report.** A concise printable report, which can also be copied as text.
6. **Keep the profile current.** After review, *Add to student profile* makes the piece part of the baseline, so genuine development stops being flagged.

## Privacy

* All analysis runs in the browser. Student writing is never sent anywhere, and no external AI service is used.
* Data is stored only in this browser. You can also turn on a **passphrase lock** that encrypts it.
* Students are identified by ID; names are optional and can be hidden.
* You can delete a student's entire profile, or all data, at any time.

## Files

| Path | Purpose |
|---|---|
| `DESIGN.md` | Method, data model, statistics, safeguards |
| `js/features/` | Stylometry, discourse and process features |
| `js/profile/` | Genre-weighted student baseline, sufficiency, trends |
| `js/analysis/` | Comparison, anomaly profile, follow-up questions |
| `js/import/` | .docx, PDF, process reports and JSON imports |
| `js/ui/` | Teacher interface |
| `capture.html` | Writing editor that records the writing process (students are told) |
| `vendor/pdfjs/` | PDF reader (Mozilla pdf.js, Apache 2.0) |
| `examples/` | A fictional sample process-report PDF |
| `tests/` | Automated tests: `npm test` (Node 18+) |
