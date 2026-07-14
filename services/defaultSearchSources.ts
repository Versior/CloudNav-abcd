import { ExternalSearchSource } from '../types';

export const getDefaultSearchSources = (): ExternalSearchSource[] => [
  {
    id: 'bing', name: '必应', url: 'https://www.bing.com/search?q={query}',
    icon: 'Search', enabled: true, createdAt: Date.now()
  },
  {
    id: 'google', name: 'Google', url: 'https://www.google.com/search?q={query}',
    icon: 'Search', enabled: true, createdAt: Date.now()
  },
  {
    id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={query}',
    icon: 'Globe', enabled: true, createdAt: Date.now()
  },
  {
    id: 'sogou', name: '搜狗', url: 'https://www.sogou.com/web?query={query}',
    icon: 'Globe', enabled: true, createdAt: Date.now()
  },
  {
    id: 'yandex', name: 'Yandex', url: 'https://yandex.com/search/?text={query}',
    icon: 'Globe', enabled: true, createdAt: Date.now()
  },
  {
    id: 'github', name: 'GitHub', url: 'https://github.com/search?q={query}',
    icon: 'Github', enabled: true, createdAt: Date.now()
  },
  {
    id: 'linuxdo', name: 'Linux.do', url: 'https://linux.do/search?q={query}',
    icon: 'Terminal', enabled: true, createdAt: Date.now()
  },
  {
    id: 'bilibili', name: 'B站', url: 'https://search.bilibili.com/all?keyword={query}',
    icon: 'Play', enabled: true, createdAt: Date.now()
  },
  {
    id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query={query}',
    icon: 'Video', enabled: true, createdAt: Date.now()
  },
  {
    id: 'wikipedia', name: '维基', url: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}',
    icon: 'BookOpen', enabled: true, createdAt: Date.now()
  },
];
