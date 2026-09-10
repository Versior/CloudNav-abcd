import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloudSun, RefreshCw } from 'lucide-react';
import { normalizeWorkbenchTools, type WorkbenchToolsState } from '../services/workbenchTools';

interface TopWeatherProps {
  value: WorkbenchToolsState;
  onChange: (value: WorkbenchToolsState) => void;
}

const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const WEATHER_ERROR_MESSAGE = '天气服务暂时不可用，请稍后重试';

const TopWeather: React.FC<TopWeatherProps> = ({ value, onChange }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadingRef = useRef(false);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const refreshWeather = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/weather?auto=1', { signal: controller.signal });
      const data = await response.json() as { weather?: WorkbenchToolsState['weather'] };
      if (!response.ok || !data.weather) throw new Error(WEATHER_ERROR_MESSAGE);
      onChangeRef.current(normalizeWorkbenchTools({ ...valueRef.current, weather: data.weather }));
    } catch {
      setError(WEATHER_ERROR_MESSAGE);
    } finally {
      window.clearTimeout(timeout);
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshWeather();
    const timer = window.setInterval(() => void refreshWeather(), WEATHER_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refreshWeather]);

  const weather = value.weather;
  return (
    <div className="cloudnav-top-weather" data-top-weather aria-live="polite">
      <CloudSun size={17} aria-hidden="true" />
      <div className="cloudnav-top-weather-copy">
        <strong>{weather ? `${weather.label} ${weather.temperature}°C` : loading ? '天气获取中…' : '天气未更新'}</strong>
        <small>{weather ? `风速 ${weather.windSpeed} km/h` : error || '自动刷新'}</small>
      </div>
      <button type="button" onClick={() => void refreshWeather()} disabled={loading} aria-label="刷新天气" title="刷新天气">
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  );
};

export default TopWeather;
