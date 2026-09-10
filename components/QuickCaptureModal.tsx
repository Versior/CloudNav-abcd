import React, { useEffect, useState } from 'react';
import { FileText, Link2, X, Zap } from 'lucide-react';
import type { Inspiration, InspirationType } from '../types';

export interface QuickCaptureInput {
  title: string;
  content: string;
  type: InspirationType;
  sourceUrl?: string;
  sourceTitle?: string;
  tags: string[];
}

interface QuickCaptureModalProps {
  isOpen: boolean;
  initial?: Partial<QuickCaptureInput>;
  onClose: () => void;
  onSave: (input: QuickCaptureInput) => void;
}

const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({ isOpen, initial, onClose, onSave }) => {
  const [form, setForm] = useState<QuickCaptureInput>({ title: '', content: '', type: 'idea', sourceUrl: '', sourceTitle: '', tags: [] });
  const [tagText, setTagText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setForm({ title: initial?.title || '', content: initial?.content || '', type: initial?.type || 'idea', sourceUrl: initial?.sourceUrl || '', sourceTitle: initial?.sourceTitle || '', tags: initial?.tags || [] });
    setTagText(initial?.tags?.join('、') || '');
  }, [initial, isOpen]);

  if (!isOpen) return null;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const tags = tagText.split(/[、,，\s]+/).map(value => value.trim()).filter(Boolean).slice(0, 12);
    if (!form.title.trim() || !form.content.trim()) return;
    onSave({ ...form, title: form.title.trim(), content: form.content.trim(), tags });
  };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-sm" onClick={onClose}>
    <form data-quick-capture onSubmit={submit} onClick={event => event.stopPropagation()} className="cloudnav-capture-modal w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
      <div className="mb-5 flex items-start justify-between gap-4"><div><div className="cloudnav-eyebrow"><Zap size={14} /> QUICK CAPTURE</div><h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">快速记录</h2><p className="mt-1 text-sm text-slate-500">先记下来，再慢慢整理。不会打断当前阅读。</p></div><button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button></div>
      <div className="grid gap-4 md:grid-cols-[1fr_180px]"><label className="md:col-span-1"><span className="cloudnav-field-label">标题</span><input autoFocus value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="这条记录想表达什么" className="cloudnav-field" /></label><label><span className="cloudnav-field-label">类型</span><select value={form.type} onChange={event => setForm({ ...form, type: event.target.value as InspirationType })} className="cloudnav-field"><option value="idea">灵感</option><option value="note">笔记</option><option value="quote">摘录</option><option value="bookmark">网页收藏</option></select></label></div>
      <label className="mt-4 block"><span className="cloudnav-field-label">内容</span><textarea required value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} placeholder="写下想法、结论或下一步行动…" rows={7} className="cloudnav-field resize-y" /></label>
      <div className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="cloudnav-field-label"><Link2 size={13} /> 来源链接</span><input value={form.sourceUrl} onChange={event => setForm({ ...form, sourceUrl: event.target.value })} placeholder="https://…" className="cloudnav-field" /></label><label><span className="cloudnav-field-label"><FileText size={13} /> 来源名称</span><input value={form.sourceTitle} onChange={event => setForm({ ...form, sourceTitle: event.target.value })} placeholder="RSS、网站或项目名称" className="cloudnav-field" /></label></div>
      <label className="mt-4 block"><span className="cloudnav-field-label">标签</span><input value={tagText} onChange={event => setTagText(event.target.value)} placeholder="用空格或逗号分隔" className="cloudnav-field" /></label>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="cloudnav-button-secondary">取消</button><button type="submit" className="cloudnav-button-primary">保存记录</button></div>
    </form>
  </div>;
};

export default QuickCaptureModal;
