export const buildExtensionAssets = (opts: {
  domain: string;
  token: string;
  navTitle: string;
  browserType: 'chrome' | 'firefox';
}) => {
  const { domain, token, navTitle, browserType } = opts;
  const CONFIG = JSON.stringify({ apiBase: domain, token });

  const getManifestJson = () => JSON.stringify({
    manifest_version: 3,
    name: (navTitle || 'NaviX') + ' Pro',
    version: '7.6',
    minimum_chrome_version: '116',
    description: 'NaviX - 极速侧边栏与智能收藏',
    permissions: ['activeTab', 'scripting', 'sidePanel', 'storage', 'favicon', 'contextMenus', 'notifications', 'tabs'],
    background: { service_worker: 'background.js' },
    action: { default_title: '打开侧边栏 (Ctrl+Shift+E)' },
    side_panel: { default_path: 'sidebar.html' },
    icons: { '128': 'icon.png' },
    commands: { '_execute_action': { suggested_key: { default: 'Ctrl+Shift+E', mac: 'Command+Shift+E' }, description: '打开/关闭 NaviX 侧边栏' } },
    ...(browserType === 'firefox' ? { browser_specific_settings: { gecko: { id: 'navix@example.com', strict_min_version: '109.0' } } } : {}),
  }, null, 2);

  const extBackgroundJs = `// background.js - NaviX Assistant v7.6
const CONFIG = ${CONFIG};
let linkCache = [];
let categoryCache = [];

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  refreshCache().then(buildMenus);
});

async function refreshCache() {
  const data = await chrome.storage.local.get('cloudnav_data');
  if (data?.cloudnav_data) {
    linkCache = data.cloudnav_data.links || [];
    categoryCache = data.cloudnav_data.categories || [];
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'cloudnav_sidebar') return;
  port.onMessage.addListener((msg) => {
    if (msg.type === 'init' && msg.windowId) {
      const wPort = port;
      wPort.onDisconnect.addListener(() => {});
    }
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  try { await chrome.sidePanel.open({ windowId: tab.windowId }); } catch(e) {}
});

function buildMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'cloudnav_root', title: '\\u26a1 保存到 NaviX', contexts: ['page', 'link', 'action'] });
    (categoryCache.filter(c => !c.parentId)).forEach(cat => {
      const subCats = categoryCache.filter(sc => sc.parentId === cat.id);
      if (subCats.length > 0) {
        chrome.contextMenus.create({ id: 'parent_' + cat.id, parentId: 'cloudnav_root', title: cat.name, contexts: ['page', 'link', 'action'] });
        chrome.contextMenus.create({ id: 'save_to_' + cat.id, parentId: 'parent_' + cat.id, title: '保存到 ' + cat.name, contexts: ['page', 'link', 'action'] });
        subCats.forEach(sub => {
          chrome.contextMenus.create({ id: 'save_to_' + sub.id, parentId: 'parent_' + cat.id, title: sub.name, contexts: ['page', 'link', 'action'] });
        });
      } else {
        chrome.contextMenus.create({ id: 'save_to_' + cat.id, parentId: 'cloudnav_root', title: cat.name, contexts: ['page', 'link', 'action'] });
      }
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (String(info.menuItemId).startsWith('save_to_')) {
    const catId = String(info.menuItemId).replace('save_to_', '');
    const title = tab?.title || '';
    const url = info.linkUrl || tab?.url || '';
    try {
      const res = await fetch(CONFIG.apiBase + '/api/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.token },
        body: JSON.stringify({ title, url, categoryId: catId, icon: '' })
      });
      if (res.ok) {
        chrome.notifications.create({ type: 'basic', iconUrl: 'icon.png', title: '保存成功', message: '已保存到 NaviX' });
      }
    } catch(e) {}
  }
});
`;

  const extSidebarJs = `const CONFIG = ${CONFIG};
const CACHE_KEY = 'cloudnav_data';
let allLinks = [], allCategories = [], expandedCats = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('content');
  const searchInput = document.getElementById('search');

  const loadData = async () => {
    try {
      const cached = await chrome.storage.local.get(CACHE_KEY);
      if (cached[CACHE_KEY]) {
        allLinks = cached[CACHE_KEY].links || [];
        allCategories = cached[CACHE_KEY].categories || [];
        render();
        return;
      }
      container.innerHTML = '<div class="loading">同步数据中...</div>';
      const res = await fetch(CONFIG.apiBase + '/api/storage', {
        headers: { 'Authorization': 'Bearer ' + CONFIG.token }
      });
      if (!res.ok) throw new Error('Sync failed');
      const data = await res.json();
      allLinks = data.links || [];
      allCategories = data.categories || [];
      await chrome.storage.local.set({ [CACHE_KEY]: data });
      render();
    } catch(e) {
      container.innerHTML = '<div class="empty" style="color:#ef4444">加载失败</div>';
    }
  };

  const render = () => {
    let html = '';
    allCategories.filter(c => !c.parentId).forEach(cat => {
      const links = allLinks.filter(l => l.categoryId === cat.id);
      if (links.length === 0) return;
      const isOpen = expandedCats.has(cat.id);
      html += '<div class="cat-group"><div class="cat-header' + (isOpen ? ' active' : '') + '" data-id="' + cat.id + '" onclick="expandedCats=this.classList.toggle(\'active\', expandedCats)">' + cat.name + '</div><div class="cat-links">';
      links.forEach(link => {
        html += '<a href="' + link.url + '" target="_blank" class="link-item"><div class="link-info"><div class="link-title">' + link.title + '</div></div></a>';
      });
      html += '</div></div>';
    });
    container.innerHTML = html || '<div class="empty">暂无数据</div>';
  };

  loadData();
  searchInput?.addEventListener('input', () => render());
});
`;

  const extSidebarHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f172a;color:#f1f5f9}.cat-group{margin-bottom:2px}.cat-header{padding:8px 10px;font-size:13px;font-weight:600;cursor:pointer;user-select:none;border-radius:6px;display:flex;align-items:center}.cat-header:hover{background:#1e293b}.cat-links{display:none;padding-left:8px}.cat-header.active+.cat-links{display:block;}.link-item{display:flex;padding:6px 8px;border-radius:6px;text-decoration:none;color:#f1f5f9;gap:8px}.link-item:hover{background:#1e293b}.link-title{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.loading,.empty{text-align:center;padding:40px;color:#94a3b8;font-size:12px}input.search-input{width:100%;padding:8px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;outline:none;font-size:13px;box-sizing:border-box;margin:8px;width:calc(100% - 16px)}</style></head><body><input type="text" id="search" class="search-input" placeholder="搜索..."><div id="content"><div class="loading">初始化...</div></div></body></html>';

  return { getManifestJson, extBackgroundJs, extSidebarHtml, extSidebarJs };
};
