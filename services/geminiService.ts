import { Category, LinkItem, AIConfig } from "../types";

const callAI = async (task: 'description' | 'category', body: Record<string, unknown>, config: AIConfig): Promise<string | null> => {
    try {
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, ...body, config })
        });

        const rawText = await response.text().catch(() => '');
        let data: any = {};
        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch {}
        if (!response.ok) {
            const isHtml = /<!doctype\s+html/i.test(rawText.trim()) || /<html[\s>]/i.test(rawText.trim());
            const detail = typeof data.error === 'string' && data.error.trim()
                ? data.error.trim()
                : isHtml
                    ? `AI 代理返回了 HTML 错误页（HTTP ${response.status}），请检查 API 地址/模型名称是否填成网页地址。`
                    : rawText.trim() || `请求失败（HTTP ${response.status}）`;
            throw new Error(detail.slice(0, 300));
        }

        return typeof data.text === 'string' ? data.text.trim() : null;
    } catch (e) {
        console.error("AI request failed", e);
        throw e;
    }
};

export const generateLinkDescription = async (title: string, url: string, config: AIConfig): Promise<string> => {
  const result = await callAI('description', { title, url }, config);
  return result || "生成描述失败";
};

export const suggestCategory = async (title: string, url: string, categories: Pick<Category, 'id' | 'name'>[], config: AIConfig): Promise<string | null> => {
    return callAI('category', { title, url, categories }, config);
};
