const memoryTokenStore = new Map<string, string>();

export const rememberGitHubToken = (configId: string, token: string) => {
  const trimmed = token?.trim();
  if (!trimmed) {
    memoryTokenStore.delete(configId);
    return;
  }

  memoryTokenStore.set(configId, trimmed);
};

export const getStoredGitHubToken = (configId: string) => memoryTokenStore.get(configId) || '';

export const clearStoredGitHubToken = (configId: string) => {
  memoryTokenStore.delete(configId);
};

export const clearAllStoredGitHubTokens = () => {
  memoryTokenStore.clear();
};

export const getActiveSessionToken = () => {
  const values = Array.from(memoryTokenStore.values());
  return values[0] || '';
};
