import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, CheckCheck, ChevronDown, ChevronUp, GripVertical, ListFilter,
  ListTodo, Plus, Trash2, X,
} from 'lucide-react';
import { normalizeWorkbenchTools, type WorkbenchToolsState } from '../services/workbenchTools';

interface FloatingTodoProps {
  value: WorkbenchToolsState;
  onChange: (value: WorkbenchToolsState) => void;
}

type TodoFilter = 'all' | 'active' | 'done';
type Point = { x: number; y: number };
type TodoUiState = { open: boolean; filter: TodoFilter; x: number | null; y: number | null };

const TODO_UI_KEY = 'cloudnav-floating-todo-ui';
const DEFAULT_TODO_UI: TodoUiState = { open: true, filter: 'all', x: null, y: null };

const isFilter = (value: unknown): value is TodoFilter => value === 'all' || value === 'active' || value === 'done';
const isFinitePoint = (x: unknown, y: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y);
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

const readTodoUiState = (): TodoUiState => {
  if (typeof window === 'undefined') return DEFAULT_TODO_UI;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TODO_UI_KEY) || 'null') as Partial<TodoUiState> | null;
    const hasPoint = isFinitePoint(parsed?.x, parsed?.y);
    return {
      open: parsed?.open !== false,
      filter: isFilter(parsed?.filter) ? parsed.filter : DEFAULT_TODO_UI.filter,
      x: hasPoint ? parsed?.x || 0 : null,
      y: hasPoint ? parsed?.y || 0 : null,
    };
  } catch {
    return DEFAULT_TODO_UI;
  }
};

const FloatingTodo: React.FC<FloatingTodoProps> = ({ value, onChange }) => {
  const [ui, setUi] = useState<TodoUiState>(DEFAULT_TODO_UI);
  const [draftPosition, setDraftPosition] = useState<Point | null>(null);
  const [input, setInput] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

  useEffect(() => {
    setUi(readTodoUiState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(TODO_UI_KEY, JSON.stringify(ui)); } catch { /* localStorage may be unavailable */ }
  }, [hydrated, ui]);

  const pendingCount = value.todos.filter(todo => !todo.done).length;
  const doneCount = value.todos.length - pendingCount;
  const visibleTodos = useMemo(() => value.todos.filter(todo => ui.filter === 'all' || (ui.filter === 'active' ? !todo.done : todo.done)), [ui.filter, value.todos]);
  const visualPosition = draftPosition || (ui.x !== null && ui.y !== null ? { x: ui.x, y: ui.y } : null);
  const positionStyle = visualPosition ? { left: `${visualPosition.x}px`, top: `${visualPosition.y}px`, right: 'auto', bottom: 'auto' } : undefined;

  const update = (patch: Partial<WorkbenchToolsState>) => onChange(normalizeWorkbenchTools({ ...value, ...patch }));
  const addTodo = () => {
    const text = input.trim();
    if (!text) return;
    update({ todos: [...value.todos, { id: `todo-${Date.now()}`, text, done: false }] });
    setInput('');
  };
  const toggleTodo = (id: string) => update({ todos: value.todos.map(todo => todo.id === id ? { ...todo, done: !todo.done } : todo) });
  const removeTodo = (id: string) => update({ todos: value.todos.filter(todo => todo.id !== id) });
  const clearCompleted = () => { if (doneCount) update({ todos: value.todos.filter(todo => !todo.done) }); };

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startLeft: rect.left, startTop: rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraftPosition({ x: rect.left, y: rect.top });
  };
  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    setDraftPosition({
      x: clamp(drag.startLeft + event.clientX - drag.startX, 12, window.innerWidth - rect.width - 12),
      y: clamp(drag.startTop + event.clientY - drag.startY, 72, window.innerHeight - rect.height - 12),
    });
  };
  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const left = rect.left < window.innerWidth / 2 ? 12 : Math.max(12, window.innerWidth - rect.width - 12);
    const top = clamp(rect.top, 72, window.innerHeight - rect.height - 12);
    dragRef.current = null;
    setDraftPosition(null);
    setUi(previous => ({ ...previous, x: left, y: top }));
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <aside ref={panelRef} data-todo-surface="floating" data-cloudnav-floating-todo-ui="true" style={positionStyle} className={`cloudnav-floating-todo ${ui.open ? 'is-open' : 'is-collapsed'} ${draftPosition ? 'is-dragging' : ''}`} aria-label="悬浮待办事项">
    <div className="cloudnav-floating-todo-toggle">
      <button type="button" className="cloudnav-floating-todo-drag-handle" data-todo-drag-handle="true" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} aria-label="拖动待办事项" title="拖动待办事项"><GripVertical size={16} /></button>
      <button type="button" className="cloudnav-floating-todo-toggle-main" onClick={() => setUi(previous => ({ ...previous, open: !previous.open }))} aria-expanded={ui.open}>
        <span className="cloudnav-floating-todo-mark"><ListTodo size={18} /></span>
        <span className="cloudnav-floating-todo-heading"><strong>待办事项</strong><small>{pendingCount ? `${pendingCount} 项待处理` : '今天很清爽'}</small></span>
        <b>{pendingCount}</b>
        {ui.open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      <button type="button" className="cloudnav-floating-todo-close" onClick={() => setUi(previous => ({ ...previous, open: false }))} aria-label="收起待办事项" title="收起"><X size={15} /></button>
    </div>
    {ui.open && <div className="cloudnav-floating-todo-body">
      <form className="cloudnav-floating-todo-add" onSubmit={event => { event.preventDefault(); addTodo(); }}>
        <input value={input} onChange={event => setInput(event.target.value)} placeholder="下一件要做的事…" aria-label="添加待办事项" />
        <button type="submit" aria-label="添加待办事项"><Plus size={16} /></button>
      </form>
      <div className="cloudnav-floating-todo-tools" aria-label="待办筛选">
        <ListFilter size={14} aria-hidden="true" />
        {(['all', 'active', 'done'] as const).map(filter => <button key={filter} type="button" data-todo-filter={filter} className={ui.filter === filter ? 'is-active' : ''} onClick={() => setUi(previous => ({ ...previous, filter }))}>{filter === 'all' ? `全部 ${value.todos.length}` : filter === 'active' ? `进行中 ${pendingCount}` : `已完成 ${doneCount}`}</button>)}
        <button type="button" className="cloudnav-floating-todo-clear" onClick={clearCompleted} disabled={!doneCount}><CheckCheck size={14} />清除已完成</button>
      </div>
      <div className="cloudnav-floating-todo-list">
        {visibleTodos.map(todo => <div key={todo.id} className={`cloudnav-floating-todo-row ${todo.done ? 'is-done' : ''}`}>
          <button type="button" className="cloudnav-floating-todo-check" onClick={() => toggleTodo(todo.id)} aria-label={todo.done ? `恢复 ${todo.text}` : `完成 ${todo.text}`}>
            {todo.done && <Check size={12} />}
          </button>
          <span title={todo.text}>{todo.text}</span>
          <button type="button" className="cloudnav-floating-todo-delete" onClick={() => removeTodo(todo.id)} aria-label={`删除 ${todo.text}`}><Trash2 size={13} /></button>
        </div>)}
        {visibleTodos.length === 0 && <p className="cloudnav-floating-todo-empty">{ui.filter === 'done' ? '还没有已完成事项' : ui.filter === 'active' ? '进行中的事项已清空' : '把今天最重要的一件事放在这里'}</p>}
      </div>
    </div>}
  </aside>;
};

export default FloatingTodo;
