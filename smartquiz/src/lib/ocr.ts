import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export type ExtractionMethod = 'pdf-text' | 'ocr' | 'mixed';

export interface ExtractionProgress {
  message: string;
  progress: number;
  method?: ExtractionMethod;
  page?: number;
  totalPages?: number;
}

export interface ExtractedDocument {
  name: string;
  text: string;
  method: ExtractionMethod;
  pages: number;
}

interface OcrWorker {
  setParameters: (params: { tessedit_pageseg_mode: string }) => Promise<unknown>;
  recognize: (image: Blob) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
}

type ProgressReporter = (progress: ExtractionProgress) => void;
type TesseractLog = { status?: string; progress?: number };

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const OCR_PAGE_PIXEL_WIDTH = 2200;

let workerPromise: Promise<OcrWorker> | null = null;
let workerLogSink: ((log: TesseractLog) => void) | null = null;

function ocrStatusLabel(status: string): string {
  switch (status) {
    case 'loading tesseract core':
      return 'Loading the OCR engine…';
    case 'initializing tesseract':
      return 'Starting the OCR engine…';
    case 'loading language traineddata':
      return 'Loading English language data…';
    case 'initializing api':
      return 'Warming up local OCR…';
    case 'recognizing text':
      return 'Reading the page…';
    default:
      return status ? `${status[0].toUpperCase()}${status.slice(1)}…` : 'Preparing OCR…';
  }
}

async function getOcrWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (log) => {
          if (workerLogSink && log.status) {
            workerLogSink({ status: log.status, progress: log.progress });
          }
        },
      });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      return worker as unknown as OcrWorker;
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

function withOcrFailureHint(error: unknown): Error {
  const base = error instanceof Error ? error.message : 'The OCR engine could not read this file.';
  const networkHint =
    ' The OCR engine downloads its language data on first use. Check your connection and try again.';
  if (/fetch|network|load|worker|cds|failed/i.test(base)) {
    return new Error(`${base}${networkHint}`);
  }
  return new Error(base);
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not prepare this image for OCR.'));
    }, 'image/png');
  });
}

async function prepareImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, OCR_PAGE_PIXEL_WIDTH / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.filter = 'grayscale(1) contrast(1.12)';
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return await canvasToBlob(canvas);
  } catch {
    return file;
  }
}

function textItemsToText(items: unknown[]): string {
  let text = '';
  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || !('str' in raw)) continue;
    const item = raw as { str: string; hasEOL?: boolean };
    text += item.str;
    text += item.hasEOL ? '\n' : ' ';
  }
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function recognizePage(
  blob: Blob,
  report: ProgressReporter,
  baseProgress: number,
  span: number,
  pageInfo: { page: number; totalPages: number },
): Promise<string> {
  try {
    workerLogSink = (log) => {
      const stageProgress = typeof log.progress === 'number' ? log.progress : 0;
      const local =
        log.status === 'recognizing text'
          ? 0.35 + stageProgress * 0.65
          : Math.min(0.3, stageProgress * 0.3);
      report({
        message: ocrStatusLabel(log.status ?? ''),
        progress: Math.min(0.99, baseProgress + span * local),
        method: 'ocr',
        ...pageInfo,
      });
    };

    const worker = await getOcrWorker();
    const result = await worker.recognize(blob);
    return result.data.text;
  } catch (error) {
    throw withOcrFailureHint(error);
  } finally {
    workerLogSink = null;
  }
}

async function extractPdf(
  file: File,
  report: ProgressReporter,
): Promise<ExtractedDocument> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const sections: string[] = [];
  let usedText = false;
  let usedOcr = false;

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = textItemsToText(content.items);
      const pageBase = (pageNumber - 1) / pageCount;

      if (pageText.replace(/\s/g, '').length >= 40) {
        usedText = true;
        sections.push(`[Page ${pageNumber}]\n${pageText}`);
        report({
          message: `Extracted text from page ${pageNumber} of ${pageCount}.`,
          progress: pageNumber / pageCount,
          method: 'pdf-text',
          page: pageNumber,
          totalPages: pageCount,
        });
        page.cleanup();
        continue;
      }

      usedOcr = true;
      report({
        message: `Page ${pageNumber} has no text layer. Preparing OCR…`,
        progress: pageBase,
        method: 'ocr',
        page: pageNumber,
        totalPages: pageCount,
      });

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2.2, Math.max(1.4, OCR_PAGE_PIXEL_WIDTH / baseViewport.width));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const blob = await canvasToBlob(canvas);
      const text = await recognizePage(blob, report, pageBase, 1 / pageCount, {
        page: pageNumber,
        totalPages: pageCount,
      });
      sections.push(`[Page ${pageNumber}]\n${text.trim()}`);
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  const method: ExtractionMethod = usedText && usedOcr ? 'mixed' : usedOcr ? 'ocr' : 'pdf-text';
  return {
    name: file.name,
    text: sections.join('\n\n').trim(),
    method,
    pages: pageCount,
  };
}

async function extractImage(
  file: File,
  report: ProgressReporter,
): Promise<ExtractedDocument> {
  report({ message: 'Preparing image…', progress: 0.03, method: 'ocr' });
  const prepared = await prepareImage(file);
  const text = await recognizePage(prepared, report, 0.06, 0.9, { page: 1, totalPages: 1 });
  return {
    name: file.name,
    text: text.trim(),
    method: 'ocr',
    pages: 1,
  };
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name);
}

export function validateSourceFile(file: File): string | null {
  if (!isPdfFile(file) && !isImageFile(file)) {
    return `${file.name}: use a PDF, PNG, JPG, or WEBP file.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name}: keep files under 20 MB.`;
  }
  if (file.size === 0) {
    return `${file.name}: this file is empty.`;
  }
  return null;
}

export async function extractTextFromFile(
  file: File,
  onProgress: ProgressReporter,
): Promise<ExtractedDocument> {
  const error = validateSourceFile(file);
  if (error) throw new Error(error);
  if (isPdfFile(file)) return extractPdf(file, onProgress);
  return extractImage(file, onProgress);
}
