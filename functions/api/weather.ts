import { jsonResponse, optionsResponse } from '../_shared/auth.ts';

const REQUEST_TIMEOUT_MS = 8_000;
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

type GeoPoint = { latitude: number; longitude: number; label: string };

const fetchJson = async (url: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
};

const numericCoordinate = (value: string | null, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

const getCloudflarePoint = (request: Request): GeoPoint | null => {
  const cf = (request as Request & { cf?: { latitude?: string | number; longitude?: string | number; city?: string } }).cf;
  const latitude = numericCoordinate(String(cf?.latitude ?? ''), -90, 90);
  const longitude = numericCoordinate(String(cf?.longitude ?? ''), -180, 180);
  return latitude === null || longitude === null ? null : { latitude, longitude, label: typeof cf?.city === 'string' && cf.city ? cf.city : '当前位置' };
};

const getAutoPoint = async (request: Request): Promise<GeoPoint> => {
  const cloudflarePoint = getCloudflarePoint(request);
  if (cloudflarePoint) return cloudflarePoint;

  const ipLocation = await fetchJson('https://ipwho.is/');
  const latitude = numericCoordinate(String(ipLocation.latitude ?? ''), -90, 90);
  const longitude = numericCoordinate(String(ipLocation.longitude ?? ''), -180, 180);
  if (latitude === null || longitude === null) throw new Error('无法获取当前位置');
  const city = typeof ipLocation.city === 'string' && ipLocation.city ? ipLocation.city : '当前位置';
  return { latitude, longitude, label: city };
};

export const onRequestOptions = async () => optionsResponse();

export const onRequestGet = async (context: { request: Request }) => {
  const query = new URL(context.request.url).searchParams;
  try {
    const explicitLatitude = numericCoordinate(query.get('lat'), -90, 90);
    const explicitLongitude = numericCoordinate(query.get('lon'), -180, 180);
    const point = explicitLatitude !== null && explicitLongitude !== null
      ? { latitude: explicitLatitude, longitude: explicitLongitude, label: '当前位置' }
      : await getAutoPoint(context.request);

    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set('latitude', String(point.latitude));
    url.searchParams.set('longitude', String(point.longitude));
    url.searchParams.set('current', 'temperature_2m,wind_speed_10m,weather_code');
    url.searchParams.set('timezone', 'auto');

    const payload = await fetchJson(url.toString());
    const current = payload.current as Record<string, unknown> | undefined;
    const temperature = Number(current?.temperature_2m);
    const windSpeed = Number(current?.wind_speed_10m);
    const weatherCode = Number(current?.weather_code);
    if (!Number.isFinite(temperature) || !Number.isFinite(windSpeed)) throw new Error('天气数据为空');

    return jsonResponse({
      weather: {
        temperature,
        windSpeed,
        weatherCode: Number.isFinite(weatherCode) ? weatherCode : null,
        updatedAt: Date.now(),
        label: point.label,
      },
    }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Weather request failed';
    return jsonResponse({ error: '天气服务暂时不可用', detail }, { status: 502 });
  }
};
