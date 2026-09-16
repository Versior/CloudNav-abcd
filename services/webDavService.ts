import { Category, LinkItem, WebDavConfig, SearchConfig, AIConfig } from "../types";

type BackupData = { links: LinkItem[], categories: Category[], searchConfig?: SearchConfig, aiConfig?: AIConfig };

/**
 * 所有 WebDAV 操作都返回带 error 的结果，而不是在失败时静默返回 null——
 * 否则界面只能显示一句笼统的「上传失败」，看不到真实原因（例如 520 表示
 * Cloudflare 边缘无法回源到该网盘）。
 */
export interface WebDavCheckResult { success: boolean; error?: string }
export interface WebDavUploadResult { success: boolean; filename: string; error?: string }
export interface WebDavDownloadResult { success: boolean; data?: BackupData; error?: string }
export interface WebDavListResult { success: boolean; files: string[]; error?: string }

const sanitizeLinks = (links: LinkItem[]): LinkItem[] => links.map(link => ({
    ...link,
    credentials: link.credentials?.map(credential => ({
        id: credential.id,
        label: credential.label,
        username: credential.username,
        account: credential.account,
        passwordCipher: credential.passwordCipher,
        passwordHint: credential.passwordHint,
        remark: credential.remark,
        updatedAt: credential.updatedAt,
    })),
}));

const sanitizeBackupData = (data: BackupData): BackupData => ({
    ...data,
    links: sanitizeLinks(data.links),
    aiConfig: data.aiConfig ? { ...data.aiConfig, apiKey: '' } : undefined,
});

const callWebDavProxy = async (
  operation: 'check' | 'upload' | 'download' | 'list',
  payload?: BackupData,
  filename?: string
) => {
    try {
        const response = await fetch('/api/webdav', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operation,
                payload: payload ? sanitizeBackupData(payload) : undefined,
                filename
            })
        });

        let data: any = null;
        try { data = await response.json(); } catch { /* 非 JSON 响应（如边缘错误页） */ }

        if (!response.ok) {
            const message = (data && (data.error || data.message))
                || `WebDAV 网关返回 HTTP ${response.status}`;
            console.error(`WebDAV Proxy Error: ${response.status} - ${message}`);
            return { ...(data || {}), success: false, error: message };
        }

        if (!data || typeof data !== 'object') {
            return { success: false, error: 'WebDAV 网关返回了空响应' };
        }

        return data;
    } catch (e) {
        console.error("WebDAV Proxy Network Error", e);
        return { success: false, error: `无法连接网关：${(e as Error)?.message || e}` };
    }
}

export const checkWebDavConnection = async (_config: WebDavConfig): Promise<WebDavCheckResult> => {
    const result = await callWebDavProxy('check');
    return { success: result?.success === true, error: result?.error };
};

export const uploadBackup = async (_config: WebDavConfig, data: BackupData): Promise<WebDavCheckResult> => {
    const result = await callWebDavProxy('upload', data);
    return { success: result?.success === true, error: result?.error };
};

export const uploadBackupWithTimestamp = async (_config: WebDavConfig, data: BackupData): Promise<WebDavUploadResult> => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `cloudnav_backup_${timestamp}.json`;
    const result = await callWebDavProxy('upload', data, filename);
    return { success: result?.success === true, filename, error: result?.error };
};

export const downloadBackup = async (_config: WebDavConfig, filename?: string): Promise<WebDavDownloadResult> => {
    const result = await callWebDavProxy('download', undefined, filename || 'navix_backup.json');
    if (result && Array.isArray(result.links) && Array.isArray(result.categories)) {
        return { success: true, data: result as BackupData };
    }

    // Fallback to old filename
    if (!filename) {
        const oldResult = await callWebDavProxy('download', undefined, 'cloudnav_backup.json');
        if (oldResult && Array.isArray(oldResult.links) && Array.isArray(oldResult.categories)) {
            return { success: true, data: oldResult as BackupData };
        }
        if (oldResult?.error && !result?.error) {
            return { success: false, error: oldResult.error };
        }
    }

    return { success: false, error: result?.error || '下载失败或文件格式错误。' };
};

export const listBackups = async (_config: WebDavConfig): Promise<WebDavListResult> => {
    const result = await callWebDavProxy('list');
    if (result && Array.isArray(result.files)) {
        return { success: result.success !== false, files: result.files as string[], error: result.error };
    }
    return { success: false, files: [], error: result?.error || '无法读取备份列表' };
};