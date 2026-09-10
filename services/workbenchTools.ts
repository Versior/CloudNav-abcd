export interface WorkbenchTodo {
  id: string;
  text: string;
  done: boolean;
}

export interface WorkbenchWeather {
  temperature: number;
  windSpeed: number;
  updatedAt: number;
  label: string;
}

export interface WorkbenchToolsState {
  todos: WorkbenchTodo[];
  note: string;
  markdown: string;
  weather: WorkbenchWeather | null;
}

export const DEFAULT_WORKBENCH_TOOLS = {
  maxTodos: 50,
};

export const normalizeWorkbenchTools = (value: unknown): WorkbenchToolsState => {
  const candidate = value && typeof value === 'object' ? value as Partial<WorkbenchToolsState> : {};
  const todos = Array.isArray(candidate.todos) ? candidate.todos.filter(item => !!item && typeof item === 'object' && typeof (item as WorkbenchTodo).id === 'string' && typeof (item as WorkbenchTodo).text === 'string').slice(0, DEFAULT_WORKBENCH_TOOLS.maxTodos).map(item => ({ id: item.id, text: item.text.trim().slice(0, 160), done: item.done === true })).filter(item => item.text) : [];
  const weather = candidate.weather && typeof candidate.weather === 'object' && typeof (candidate.weather as WorkbenchWeather).temperature === 'number' ? {
    temperature: (candidate.weather as WorkbenchWeather).temperature,
    windSpeed: Number((candidate.weather as WorkbenchWeather).windSpeed || 0),
    updatedAt: Number((candidate.weather as WorkbenchWeather).updatedAt || 0),
    label: typeof (candidate.weather as WorkbenchWeather).label === 'string' ? (candidate.weather as WorkbenchWeather).label.slice(0, 80) : '当前天气',
  } : null;
  return {
    todos,
    note: '',
    markdown: '',
    weather,
  };
};
