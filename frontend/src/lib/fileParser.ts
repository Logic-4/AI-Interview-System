export async function parseResumeFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'txt') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  if (extension === 'pdf') {
    return parsePdfFile(file);
  }

  if (extension === 'doc' || extension === 'docx') {
    return parseWordFile(file);
  }

  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
}

async function parsePdfFile(file: File): Promise<string> {
  try {
    // Dynamically load pdf.js via CDN to avoid heavy bundle sizes and dependency issues
    const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.mjs' /* @vite-ignore */ as any);
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(' ') + '\n';
    }
    return fullText;
  } catch (error) {
    console.error("PDF Parsing Error:", error);
    throw new Error("Failed to parse PDF file.");
  }
}

async function parseWordFile(file: File): Promise<string> {
  try {
    // Dynamically load mammoth via CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error("Word Parsing Error:", error);
    throw new Error("Failed to parse Word file.");
  }
}
