// Extracts text from a PDF in the browser using the bundled pdf.js library
// (vendor/pdfjs). The file never leaves the teacher's computer.

let loading = null;

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('../../vendor/pdfjs/pdf.min.js', import.meta.url).href;
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
        resolve(window.pdfjsLib);
      };
      s.onerror = () => reject(new Error('Could not load the PDF reader (vendor/pdfjs).'));
      document.head.appendChild(s);
    });
  }
  return loading;
}

// Returns the text with one line per visual line of the PDF.
export async function pdfToText(arrayBuffer) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Group text items into lines by their vertical position.
    const rows = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) { if (item.hasEOL && rows.length) rows[rows.length - 1].eol = true; continue; }
      const y = item.transform[5];
      const x = item.transform[4];
      let row = rows.find((r) => Math.abs(r.y - y) < Math.max(2, (item.height || 10) * 0.4));
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, str: item.str, w: item.width || 0 });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      let line = '';
      let prevEnd = null;
      for (const it of r.items) {
        if (prevEnd != null && it.x - prevEnd > 1 && !line.endsWith(' ') && !it.str.startsWith(' ')) line += ' ';
        line += it.str;
        prevEnd = it.x + it.w;
      }
      pages.push(line.trim());
    }
  }
  if (!pages.join('').trim()) throw new Error('This PDF has no selectable text (it may be a scanned image).');
  return pages.join('\n');
}
