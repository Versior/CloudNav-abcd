import { useState, useCallback } from 'react';

export const useAuth = () => {
  const [authToken, setAuthToken] = useState<boolean>(false);
  const [requiresAuth, setRequiresAuth] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [extensionToken, setExtensionToken] = useState('');
  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
    } catch {}
    setAuthToken(false);
    setExtensionToken('');
    setUnlockedCategoryIds(new Set());
  }, []);

  const handleCategoryActionAuth = useCallback(async (password: string): Promise<boolean> => {
    try {
      const authResponse = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (authResponse.ok) {
        const data = await authResponse.json();
        setAuthToken(true);
        setExtensionToken(data.extensionToken || '');
      }
      return authResponse.ok;
    } catch {
      return false;
    }
  }, []);

  return {
    authToken, setAuthToken,
    requiresAuth, setRequiresAuth,
    isCheckingAuth, setIsCheckingAuth,
    isAuthOpen, setIsAuthOpen,
    extensionToken, setExtensionToken,
    unlockedCategoryIds, setUnlockedCategoryIds,
    handleLogout, handleCategoryActionAuth,
  };
};
