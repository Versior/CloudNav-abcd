import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/weather.ts';

test('weather API proxies a coordinate request to Open-Meteo', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async input => {
    requestedUrl = typeof input === 'string' ? input : input.url;
    return new Response(JSON.stringify({ current: { temperature_2m: 24.5, wind_speed_10m: 7.2, weather_code: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const response = await onRequestGet({ request: new Request('https://cloudnav.test/api/weather?lat=31.23&lon=121.47') });
    const payload = await response.json() as { weather?: { temperature?: number; windSpeed?: number; label?: string } };
    assert.equal(response.status, 200);
    assert.match(requestedUrl, /api\.open-meteo\.com\/v1\/forecast/);
    assert.equal(payload.weather?.temperature, 24.5);
    assert.equal(payload.weather?.windSpeed, 7.2);
    assert.equal(payload.weather?.label, '当前位置');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
