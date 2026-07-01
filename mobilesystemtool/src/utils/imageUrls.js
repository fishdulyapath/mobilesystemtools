const IMAGE_CACHE_KEY = Date.now().toString(36);

function appendQuery(url, params) {
  const search = new URLSearchParams(params);
  return `${url}${url.includes('?') ? '&' : '?'}${search.toString()}`;
}

export function productImageUrl(itemCode, apiBase = import.meta.env.VITE_API_BASE_URL) {
  return appendQuery(`${apiBase}/images`, {
    item_code: itemCode || '',
    'ngrok-skip-browser-warning': '1',
    _: IMAGE_CACHE_KEY,
  });
}

export function productImageGuidUrl(guidCode, apiBase = import.meta.env.VITE_API_BASE_URL) {
  return appendQuery(`${apiBase}/imagesguid`, {
    guid_code: guidCode || '',
    'ngrok-skip-browser-warning': '1',
    _: IMAGE_CACHE_KEY,
  });
}

export function docImageUrl(guidCode, apiBase = import.meta.env.VITE_API_BASE_URL) {
  return appendQuery(`${apiBase}/getDocImage/${encodeURIComponent(guidCode || '')}`, {
    'ngrok-skip-browser-warning': '1',
    _: IMAGE_CACHE_KEY,
  });
}
