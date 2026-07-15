import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Clock, Eye, EyeOff, Activity, Tag, FileText, Bookmark, KeyRound, Plus, Trash2, Copy, Lock, Save, Eraser, ChevronDown } from 'lucide-react';
import { LinkItem, Category, SiteCredential } from '../types';
import { decryptCredentialPassword, encryptCredentialPassword } from '../services/credentialCrypto';

interface LinkDetailsDrawerProps {
  link: LinkItem | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onUpdate: (linkId: string, updates: Partial<LinkItem>) => void;
}

interface CredentialDraft {
  id: string;
  label: string;
  username: string;
  account: string;
  password: string;
  passwordCipher?: string;
  passwordHint?: string;
  remark: string;
  updatedAt: number;
}

const statusLabels: Record<string, string> = {
  unread: '未读',
  read: '已读',
  favorite: '收藏',
  archived: '归档',
};

const statusColors: Record<string, string> = {
  unread: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300',
  read: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-300',
  favorite: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300',
  archived: 'text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400',
};

const healthLabels: Record<string, string> = { ok: '正常', broken: '确定失效', redirected: '已跳转', unknown: '探测受阻/待确认' };
const healthColors: Record<string, string> = {
  ok: 'text-green-600', broken: 'text-red-600', redirected: 'text-amber-600', unknown: 'text-slate-500',
};

const newId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emptyCredential = (): CredentialDraft => ({
  id: newId(),
  label: '',
  username: '',
  account: '',
  password: '',
  remark: '',
  updatedAt: Date.now(),
});

const toDraft = (credential: SiteCredential): CredentialDraft => ({
  id: credential.id,
  label: credential.label || '',
  username: credential.username || '',
  account: credential.account || '',
  password: '',
  passwordCipher: credential.passwordCipher,
  passwordHint: credential.passwordHint,
  remark: credential.remark || '',
  updatedAt: credential.updatedAt,
});

const cleanText = (value: string) => value.trim() || undefined;

const LinkDetailsDrawer: React.FC<LinkDetailsDrawerProps> = ({ link, isOpen, onClose, categories, onUpdate }) => {
  const [note, setNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState<string>('');
  const [credentialDrafts, setCredentialDrafts] = useState<CredentialDraft[]>([]);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string>>({});
  const [masterPassword, setMasterPassword] = useState('');
  const [credentialMessage, setCredentialMessage] = useState('');
  const [expandedCredentialIds, setExpandedCredentialIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (link) {
      setNote(link.note || '');
      setTagsInput((link.tags || []).join(', '));
      setStatus(link.status || '');
      setCredentialDrafts((link.credentials || []).map(toDraft));
      setVisiblePasswords({});
      setMasterPassword('');
      setCredentialMessage('');
      setExpandedCredentialIds(new Set());
    }
  }, [link]);

  if (!isOpen || !link) return null;

  const category = categories.find(c => c.id === link.categoryId);
  const health = link.health;
  const timeAgo = (ts?: number) => {
    if (!ts) return '从未';
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  };

  const parseTags = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean);

  const saveNote = () => {
    onUpdate(link.id, { note: note.trim() || undefined });
    setCredentialMessage('笔记已保存');
  };

  const clearNote = () => {
    if (!note.trim() || confirm('确定清空这条网站笔记吗？')) {
      setNote('');
      onUpdate(link.id, { note: undefined });
      setCredentialMessage('笔记已清空');
    }
  };

  const toggleCredentialExpanded = (id: string) => {
    setExpandedCredentialIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCredentialDraft = () => {
    const draft = emptyCredential();
    setCredentialDrafts(prev => [...prev, draft]);
    setExpandedCredentialIds(current => new Set([...current, draft.id]));
  };

  const updateCredentialDraft = (id: string, updates: Partial<CredentialDraft>) => {
    setCredentialDrafts(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const copyText = async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCredentialMessage('已复制');
    } catch {
      setCredentialMessage('复制失败，请检查浏览器剪贴板权限');
    }
  };

  const persistCredentialDrafts = (drafts: CredentialDraft[], targetId?: string, encryptedPassword?: string | null) => {
    const credentials = drafts
      .map(draft => {
        const passwordCipher = draft.id === targetId
          ? encryptedPassword === null ? undefined : encryptedPassword ?? draft.passwordCipher
          : draft.passwordCipher;
        const changed = draft.id === targetId;
        return {
          id: draft.id,
          label: cleanText(draft.label),
          username: cleanText(draft.username),
          account: cleanText(draft.account),
          passwordCipher,
          passwordHint: cleanText(draft.passwordHint || ''),
          remark: cleanText(draft.remark),
          updatedAt: changed ? Date.now() : draft.updatedAt,
        } satisfies SiteCredential;
      })
      .filter(item => item.label || item.username || item.account || item.passwordCipher || item.remark);

    onUpdate(link.id, { credentials });
    setCredentialDrafts(credentials.map(toDraft));
  };

  const saveCredential = async (id: string) => {
    const draft = credentialDrafts.find(item => item.id === id);
    if (!draft) return;

    try {
      let encryptedPassword: string | undefined;
      if (draft.password) {
        if (!masterPassword) {
          setCredentialMessage('请先输入凭据主密码');
          return;
        }
        encryptedPassword = await encryptCredentialPassword(draft.password, masterPassword);
      }

      persistCredentialDrafts(credentialDrafts, id, encryptedPassword);
      setVisiblePasswords(prev => {
        const next = { ...prev };
        if (encryptedPassword) next[id] = draft.password;
        return next;
      });
      setCredentialMessage('账号信息已保存');
    } catch {
      setCredentialMessage('保存失败，请检查浏览器加密能力');
    }
  };

  const deleteCredential = (id: string) => {
    if (!confirm('确定删除这条账号记录吗？')) return;
    const nextDrafts = credentialDrafts.filter(item => item.id !== id);
    setCredentialDrafts(nextDrafts);
    persistCredentialDrafts(nextDrafts);
    setVisiblePasswords(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const clearCredentialPassword = (id: string) => {
    if (!confirm('确定清空这个账号已保存的密码吗？')) return;
    const nextDrafts = credentialDrafts.map(item => item.id === id ? { ...item, password: '', passwordCipher: undefined } : item);
    setCredentialDrafts(nextDrafts);
    persistCredentialDrafts(nextDrafts, id, null);
    setVisiblePasswords(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCredentialMessage('已清空密码');
  };

  const revealPassword = async (draft: CredentialDraft) => {
    if (visiblePasswords[draft.id]) {
      setVisiblePasswords(prev => {
        const next = { ...prev };
        delete next[draft.id];
        return next;
      });
      return;
    }

    if (draft.password) {
      setVisiblePasswords(prev => ({ ...prev, [draft.id]: draft.password }));
      return;
    }

    if (!draft.passwordCipher) {
      setCredentialMessage('这个账号还没有保存密码');
      return;
    }

    if (!masterPassword) {
      setCredentialMessage('请先输入凭据主密码');
      return;
    }

    try {
      const plain = await decryptCredentialPassword(draft.passwordCipher, masterPassword);
      setVisiblePasswords(prev => ({ ...prev, [draft.id]: plain }));
      setCredentialMessage('已解锁密码');
    } catch {
      setCredentialMessage('主密码不正确，无法解密');
    }
  };

  const copyPassword = async (draft: CredentialDraft) => {
    if (visiblePasswords[draft.id]) {
      await copyText(visiblePasswords[draft.id]);
      return;
    }

    if (!draft.passwordCipher) {
      setCredentialMessage('这个账号还没有保存密码');
      return;
    }

    if (!masterPassword) {
      setCredentialMessage('请先输入凭据主密码');
      return;
    }

    try {
      const plain = await decryptCredentialPassword(draft.passwordCipher, masterPassword);
      await copyText(plain);
    } catch {
      setCredentialMessage('主密码不正确，无法复制');
    }
  };

  return (
    <div className={`fixed inset-y-0 right-0 z-40 w-96 max-w-[calc(100%-1rem)] bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-sm truncate dark:text-white">链接详情</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X size={16} /></button>
      </div>

      <div className="overflow-y-auto h-full pb-20 p-4 space-y-4">
        <div>
          <h2 className="text-base font-bold dark:text-white break-words">{link.title}</h2>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all mt-1 flex items-center gap-1">
            <ExternalLink size={12} /> {link.url.length > 50 ? link.url.slice(0, 50) + '...' : link.url}
          </a>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {category && <><Bookmark size={12} /> {category.name}</>}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><Clock size={12} /> {timeAgo(link.lastVisitedAt)}</span>
          <span className="flex items-center gap-1"><Eye size={12} /> {link.visitCount || 0} 次</span>
        </div>

        {health && (
          <div className={`flex items-center gap-1 text-xs ${healthColors[health.status] || ''}`}>
            <Activity size={12} />
            {healthLabels[health.status] || '未知'}
            {health.statusCode ? ` (${health.statusCode})` : ''}
            <span className="text-slate-400 ml-1">{timeAgo(health.checkedAt)}</span>
          </div>
        )}

        {link.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">{link.description}</p>
        )}

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1"><FileText size={12} /> 网站笔记</label>
            <div className="flex items-center gap-1">
              <button onClick={saveNote} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"><Save size={12} /> 保存</button>
              <button onClick={clearNote} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"><Eraser size={12} /> 清空</button>
            </div>
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            className="w-full p-3 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={5} placeholder="记录用途、注意事项、账号提示、使用技巧..."
          />
          <p className="text-[11px] text-slate-400">点击保存后会立刻写入本地和云端。</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1"><KeyRound size={12} /> 账号保险箱</label>
              <p className="text-[11px] text-slate-400 mt-1">{credentialDrafts.length} 条账号，{credentialDrafts.filter(item => item.passwordCipher || item.password).length} 条保存了密码</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setMasterPassword(''); setVisiblePasswords({}); setCredentialMessage('已锁定账号保险箱'); }} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600">
                <Lock size={12} /> 锁定
              </button>
              <button onClick={addCredentialDraft} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700">
                <Plus size={12} /> 添加
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-slate-400" />
              <input type="password" value={masterPassword} onChange={e => setMasterPassword(e.target.value)}
                className="flex-1 p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="凭据主密码，用于保存/查看密码"
              />
              {masterPassword && (
                <button onClick={() => { setMasterPassword(''); setVisiblePasswords({}); }} className="px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">锁定</button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">密码只保存 AES-GCM 密文；忘记主密码就无法解密。</p>
            {credentialMessage && <p className="text-[11px] text-blue-600 dark:text-blue-400">{credentialMessage}</p>}
          </div>

          {credentialDrafts.length === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">还没有账号记录。</p>
          ) : (
            <div className="space-y-3">
              {credentialDrafts.map(draft => {
                const isExpanded = expandedCredentialIds.has(draft.id);
                return (
                <div key={draft.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => toggleCredentialExpanded(draft.id)} className="min-w-0 flex-1 text-left">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate flex items-center gap-1">
                        <ChevronDown size={13} className={`shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        {draft.label || draft.username || draft.account || '未命名账号'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{draft.username || draft.account || '未填写账号'} · {draft.passwordCipher ? '已加密保存密码' : draft.password ? '待保存新密码' : '未保存密码'}</div>
                    </button>
                    <button onClick={() => deleteCredential(draft.id)} className="p-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="删除"><Trash2 size={14} /></button>
                  </div>
                  {isExpanded && (
                    <>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={draft.label} onChange={e => updateCredentialDraft(draft.id, { label: e.target.value })}
                      className="p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="用途，如主账号"
                    />
                    <input value={draft.username} onChange={e => updateCredentialDraft(draft.id, { username: e.target.value })}
                      className="p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="用户名"
                    />
                  </div>

                  <div className="flex gap-2">
                    <input value={draft.account} onChange={e => updateCredentialDraft(draft.id, { account: e.target.value })}
                      className="flex-1 p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="账号/邮箱/手机号"
                    />
                    <button onClick={() => copyText(draft.account || draft.username)} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" title="复制账号"><Copy size={14} /></button>
                  </div>

                  <div className="flex gap-2">
                    <input type={visiblePasswords[draft.id] || draft.password ? 'text' : 'password'} value={draft.password || visiblePasswords[draft.id] || ''}
                      onChange={e => updateCredentialDraft(draft.id, { password: e.target.value })}
                      className="flex-1 p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder={draft.passwordCipher ? '留空表示不修改已保存密码' : '密码'}
                    />
                    <button onClick={() => revealPassword(draft)} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" title="显示/隐藏密码">
                      {visiblePasswords[draft.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => copyPassword(draft)} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" title="复制密码"><Copy size={14} /></button>
                  </div>

                  <textarea value={draft.remark} onChange={e => updateCredentialDraft(draft.id, { remark: e.target.value })}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={2} placeholder="账号备注，如绑定邮箱、恢复码位置、套餐信息..."
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{draft.updatedAt ? `更新于 ${timeAgo(draft.updatedAt)}` : '未保存'}</span>
                    <div className="flex items-center gap-2">
                      {draft.passwordCipher && (
                        <button onClick={() => clearCredentialPassword(draft.id)} className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600">清空密码</button>
                      )}
                      <button onClick={() => saveCredential(draft.id)} className="px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700">保存账号</button>
                    </div>
                  </div>
                    </>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1"><Tag size={12} /> 标签</label>
          <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} onBlur={() => onUpdate(link.id, { tags: parseTags(tagsInput) })}
            className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="用逗号分隔"
          />
          {link.tags && link.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {link.tags.map(t => <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">{t}</span>)}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1"><Activity size={12} /> 状态</label>
          <select value={status} onChange={e => { const v = e.target.value; setStatus(v); onUpdate(link.id, { status: (v || undefined) as LinkItem['status'] }); }}
            className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">无</option>
            {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {status && statusLabels[status] && (
            <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${statusColors[status] || ''}`}>{statusLabels[status]}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkDetailsDrawer;
