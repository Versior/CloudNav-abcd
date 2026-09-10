import React, { useEffect, useState } from 'react';
import { CloudSun, Clock3, MapPin } from 'lucide-react';
import { normalizeWorkbenchTools, type WorkbenchToolsState } from '../services/workbenchTools';

interface WorkbenchToolsProps {
  value: WorkbenchToolsState;
  onChange: (value: WorkbenchToolsState) => void;
}

const WorkbenchTools: React.FC<WorkbenchToolsProps> = ({ value, onChange }) => {
  const [now, setNow] = useState(() => new Date());
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const update = (patch: Partial<WorkbenchToolsState>) => onChange(normalizeWorkbenchTools({ ...value, ...patch }));
  const requestWeather = async (url: string) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('天气请求超时');
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    const data = await response.json() as { weather?: WorkbenchToolsState['weather']; detail?: string };
    if (!response.ok || !data.weather) throw new Error(data.detail || '天气服务暂时不可用');
    update({ weather: data.weather });
  };

  const loadWeather = () => {
    setLoadingWeather(true);
    setWeatherError('');
    const useAutomaticLocation = async () => {
      try {
        await requestWeather('/api/weather?auto=1');
        setWeatherError('');
      } catch (error) {
        setWeatherError(error instanceof Error ? error.message : '天气服务暂时不可用');
      } finally {
        setLoadingWeather(false);
      }
    };

    if (!navigator.geolocation) {
      void useAutomaticLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(async position => {
      try {
        await requestWeather(`/api/weather?lat=${encodeURIComponent(position.coords.latitude)}&lon=${encodeURIComponent(position.coords.longitude)}`);
        setWeatherError('');
        setLoadingWeather(false);
      } catch {
        await useAutomaticLocation();
      }
    }, () => {
      void useAutomaticLocation();
    }, { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 6_000 });
  };

  return <div data-dashboard-widget="tools" className="cloudnav-workbench-time-weather">
    <div className="cloudnav-workbench-time-panel">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><Clock3 size={15} className="text-blue-500" /> {now.toLocaleTimeString('zh-CN', { hour12: false })}<span className="text-xs font-normal text-slate-400">{now.toLocaleDateString('zh-CN')}</span></div>
      <div className="cloudnav-weather-row mt-3 flex items-center justify-between rounded-xl bg-sky-50 p-3 dark:bg-sky-950/20"><div className={`cloudnav-weather-copy flex items-center gap-2 text-xs ${weatherError ? 'is-error' : 'text-slate-600 dark:text-slate-300'}`}><CloudSun size={16} className="text-sky-500" />{value.weather ? `${value.weather.label} · ${value.weather.temperature}°C · 风速 ${value.weather.windSpeed} km/h` : weatherError || '点击获取当前位置天气'}</div><button type="button" onClick={loadWeather} disabled={loadingWeather} className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 disabled:opacity-50"><MapPin size={13} />{loadingWeather ? '获取中…' : value.weather ? '刷新天气' : '获取天气'}</button></div>
    </div>
  </div>;
};

export default WorkbenchTools;
