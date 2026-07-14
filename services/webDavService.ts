import { Category, LinkItem, WebDavConfig, SearchConfig, AIConfig } from "../types";

type BackupData = { links: LinkItem[], categories: Category[], searchConfig?: SearchConfig, aiConfig?: AIConfig };

const sanitizeBackupData = (data: BackupData): BackupData => ({
    ...data,
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

        if (!response.ok) {
            console.error(`WebDAV Proxy Error: ${response.status}`);
            return null;
        }

        return await response.json();
    } catch (e) {
        console.error("WebDAV Proxy Network Error", e);
        return null;
    }
}

export const checkWebDavConnection = async (_config: WebDavConfig): Promise<boolean> => {
    const result = await callWebDavProxy('check');
    return result?.success === true;
};

export const uploadBackup = async (_config: WebDavConfig, data: BackupData): Promise<boolean> => {
    const result = await callWebDavProxy('upload', data);
    return result?.success === true;
};

export const uploadBackupWithTimestamp = async (_config: WebDavConfig, data: BackupData): Promise<{ success: boolean; filename: string }> => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `cloudnav_backup_${timestamp}.json`;
    const result = await callWebDavProxy('upload', data, filename);
    return { success: result?.success === true, filename };
};

export const downloadBackup = async (_config: WebDavConfig, filename?: string): Promise<BackupData | null> => {
    const result = await callWebDavProxy('download', undefined, filename || 'navix_backup.json');
    if (result && Array.isArray(result.links) && Array.isArray(result.categories)) {
        return result as BackupData;
    }
    // Fallback to old filename
    if (!filename) {
        const oldResult = await callWebDavProxy('download', undefined, 'cloudnav_backup.json');
        if (oldResult && Array.isArray(oldResult.links) && Array.isArray(oldResult.categories)) {
            return oldResult as BackupData;
        }
    }
    return null;
};

export const listBackups = async (_config: WebDavConfig): Promise<string[]> => {
    const result = await callWebDavProxy('list');
    if (result && Array.isArray(result.files)) {
        return result.files as string[];
    }
    return [];
};
