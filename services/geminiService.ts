import { Category, LinkItem, AIConfig } from "../types";

const callAI = async (task: 'description' | 'category', body: Record<string, unknown>): Promise<string | null> => {
    try {
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, ...body })
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return typeof data.text === 'string' ? data.text.trim() : null;
    } catch (e) {
        console.error("AI request failed", e);
        return null;
    }
};

export const generateLinkDescription = async (title: string, url: string, _config: AIConfig): Promise<string> => {
  const result = await callAI('description', { title, url });
  return result || "生成描述失败";
};

export const suggestCategory = async (title: string, url: string, categories: Pick<Category, 'id' | 'name'>[], _config: AIConfig): Promise<string | null> => {
    return callAI('category', { title, url, categories });
};
