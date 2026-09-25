// Reads uploaded writing samples in the browser: plain text, Word (.docx,
// including Google Docs "Download → .docx") and PDF. Nothing is uploaded.

const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open .docx files. Copy and paste the text instead.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Minimal ZIP reader: finds one file by name.
export async function readZipEntry(buffer, wanted) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This file is not a valid .docx document.');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const td = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = td.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + size);
      const out = method === 0 ? data : method === 8 ? await inflateRaw(data) : null;
      if (!out) throw new Error('Unsupported compression in this .docx file.');
      return td.decode(out);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${wanted} not found in the document.`);
}

export function docxXmlToText(xml) {
  const body = xml.replace(/<w:footnote[\s\S]*?<\/w:footnote>/g, '');
  return body.split(/<\/w:p>/).map((p) => {
    const parts = [];
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g;
    let m;
    while ((m = re.exec(p))) parts.push(m[1] != null ? decodeXml(m[1]) : m[0] === '<w:tab/>' ? '\t' : '\n');
    return parts.join('');
  }).map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function readDocument(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    const xml = await readZipEntry(await file.arrayBuffer(), 'word/document.xml');
    return { text: docxXmlToText(xml), kind: 'docx' };
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const { pdfToText } = await import('./pdfText.js');
    const raw = await pdfToText(await file.arrayBuffer());
    // Re-join lines into paragraphs: a line ending without punctuation continues.
    const text = raw.split('\n').reduce((acc, line) => {
      const prev = acc[acc.length - 1];
      if (prev != null && prev && !/[.!?:"”)]$/.test(prev)) acc[acc.length - 1] = `${prev} ${line}`;
      else acc.push(line);
      return acc;
    }, []).join('\n\n');
    return { text, kind: 'pdf', note: 'Text taken from a PDF: check paragraph breaks.' };
  }
  if (name.endsWith('.doc')) throw new Error('Old .doc files are not supported. Save as .docx or copy the text.');
  return { text: (await file.text()).replace(/\r\n/g, '\n').trim(), kind: 'text' };
}

// "Sam Rivera - Macbeth essay.docx" → a readable title.
export const titleFromFile = (name) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
