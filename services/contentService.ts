import type { ReadingDocumentInput } from './readingWorkspace.ts';

export const fetchReadableDocument = async (url: string): Promise<ReadingDocumentInput> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`/api/content?url=${encodeURIComponent(url)}`, { signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('正文抓取超时');
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.document || typeof payload.document !== 'object') {
    throw new Error(typeof payload?.error === 'string' ? payload.error : '正文抓取失败');
  }
  return payload.document as ReadingDocumentInput;
};
