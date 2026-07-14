const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['txt', 'pdf', 'docx']);

export async function parseResumeFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.size > MAX_RESUME_BYTES) throw new Error('Resume files must be 5MB or smaller.');
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
  }

  let text = '';
  if (extension === 'txt') text = await file.text();
  if (extension === 'pdf') text = await parsePdfFile(file);
  if (extension === 'docx') text = await parseWordFile(file);

  const normalized = text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim();
  if (!normalized) throw new Error('No readable text was found in this resume.');
  return normalized;
}

async function parsePdfFile(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    return pages.join('\n');
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse this PDF resume.');
  }
}

async function parseWordFile(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error('Failed to parse this DOCX resume.');
  }
}
