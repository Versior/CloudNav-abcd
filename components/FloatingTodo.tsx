import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, ListTodo, Plus, Trash2 } from 'lucide-react';
import { normalizeWorkbenchTools, type WorkbenchToolsState } from '../services/workbenchTools';

interface FloatingTodoProps {
  value: WorkbenchToolsState;
  onChange: (value: WorkbenchToolsState) => void;
}

const FloatingTodo: React.FC<FloatingTodoProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState('');
  const pendingCount = value.todos.filter(todo => !todo.done).length;

  const update = (patch: Partial<WorkbenchToolsState>) => onChange(normalizeWorkbenchTools({ ...value, ...patch }));
  const addTodo = () => {
    const text = input.trim();
    if (!text) return;
    update({ todos: [...value.todos, { id: `todo-${Date.now()}`, text, done: false }] });
    setInput('');
  };

  return <aside data-todo-surface="floating" className={`cloudnav-floating-todo ${open ? 'is-open' : 'is-collapsed'}`} aria-label="悬浮待办事项">
    <button type="button" className="cloudnav-floating-todo-toggle" onClick={() => setOpen(current => !current)} aria-expanded={open}>
      <span className="cloudnav-floating-todo-mark"><ListTodo size={18} /></span>
      <span className="cloudnav-floating-todo-heading"><strong>待办事项</strong><small>{pendingCount ? `${pendingCount} 项待处理` : '今天很清爽'}</small></span>
      <b>{pendingCount}</b>
      {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
    </button>
    {open && <div className="cloudnav-floating-todo-body">
      <form className="cloudnav-floating-todo-add" onSubmit={event => { event.preventDefault(); addTodo(); }}>
        <input value={input} onChange={event => setInput(event.target.value)} placeholder="下一件要做的事…" aria-label="添加待办事项" />
        <button type="submit" aria-label="添加待办事项"><Plus size={16} /></button>
      </form>
      <div className="cloudnav-floating-todo-list">
        {value.todos.map(todo => <div key={todo.id} className={`cloudnav-floating-todo-row ${todo.done ? 'is-done' : ''}`}>
          <button type="button" className="cloudnav-floating-todo-check" onClick={() => update({ todos: value.todos.map(item => item.id === todo.id ? { ...item, done: !item.done } : item) })} aria-label={todo.done ? `恢复 ${todo.text}` : `完成 ${todo.text}`}>
            {todo.done && <Check size={12} />}
          </button>
          <span>{todo.text}</span>
          <button type="button" className="cloudnav-floating-todo-delete" onClick={() => update({ todos: value.todos.filter(item => item.id !== todo.id) })} aria-label={`删除 ${todo.text}`}><Trash2 size={13} /></button>
        </div>)}
        {value.todos.length === 0 && <p className="cloudnav-floating-todo-empty">把今天最重要的一件事放在这里</p>}
      </div>
    </div>}
  </aside>;
};

export default FloatingTodo;
