import { useState, useCallback } from 'react';
import { LinkItem, Category } from '../types';
import { LOCAL_STORAGE_KEY } from '../constants/storageKeys';
import { loadFromLocal as loadLocalService } from '../services/localStorageService';

export const useLocalData = () => {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadLocal = useCallback(() => {
    const result = loadLocalService();
    setLinks(result.links);
    setCategories(result.categories);
  }, []);

  const updateDataImpl = useCallback((
    newLinks: LinkItem[],
    newCategories: Category[],
    authToken: boolean,
    dataVersionRef: { current: number },
    syncToCloud: (links: LinkItem[], categories: Category[], retry?: number) => Promise<boolean>
  ) => {
    setLinks(newLinks);
    setCategories(newCategories);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: newLinks, categories: newCategories, version: dataVersionRef.current }));
    if (authToken) {
      syncToCloud(newLinks, newCategories);
    }
  }, []);

  return {
    links, setLinks,
    categories, setCategories,
    selectedCategory, setSelectedCategory,
    loadLocal, updateDataImpl,
  };
};
