
import React, { useState, useEffect, useRef } from 'react';
import { GithubConfig, EnvVar, FileNode } from '../types';
import { getAuthenticatedUser, getUserRepositories } from '../services/githubService';
import { rememberGitHubToken, getStoredGitHubToken, clearStoredGitHubToken, clearAllStoredGitHubTokens } from '../services/authStorage';
import { selectLocalDirectory, FileSystemDirectoryHandle, buildVirtualFileTree } from '../services/localFileSystem';
import { Github, X, Loader2, Plus, Trash2, Settings, Database, FolderOpen, HardDrive, AlertTriangle, Search, ExternalLink, CheckCircle2, LogOut, Lock, Globe } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  savedConfigs: GithubConfig[];
  activeConfigId: string | null;
  onSetActive: (id: string) => void;
  onAddConfig: (config: GithubConfig) => void;
  onRemoveConfig: (id: string) => void;
  envVars: EnvVar[];
  onUpdateEnvVars: (vars: EnvVar[]) => void;
  localDirHandle: FileSystemDirectoryHandle | null;
  onSetLocalDirHandle: (handle: FileSystemDirectoryHandle | null) => void;
  onSetVirtualData: (data: { tree: FileNode[], map: Map<string, File> } | null) => void;
}

type Tab = 'repos' | 'local' | 'env';

export const GithubSettingsModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  savedConfigs, 
  activeConfigId, 
  onSetActive, 
  onAddConfig, 
  onRemoveConfig,
  envVars,
  onUpdateEnvVars,
  localDirHandle,
  onSetLocalDirHandle,
  onSetVirtualData
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('repos');
  
  // Auth State
  const [token, setToken] = useState('');
  const [allowWriteAccess, setAllowWriteAccess] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [authUser, setAuthUser] = useState<{login: string, avatar_url: string} | null>(null);
  const [authError, setAuthError] = useState('');
  
  // Repo Selection State
  const [availableRepos, setAvailableRepos] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [page, setPage] = useState(1);
  
  // Environment State
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  
  // Local File State
  const virtualFileInputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Auto-login if we have a token saved in a config
  useEffect(() => {
    if (isOpen && savedConfigs.length > 0 && !isAuthenticated) {
        const active = savedConfigs.find(c => c.id === activeConfigId) || savedConfigs[0];
        const storedToken = getStoredGitHubToken(active?.id || '');
        if (active && (active.token || storedToken)) {
            const tokenToUse = active.token || storedToken;
            setToken(tokenToUse);
            validateToken(tokenToUse);
        }
    }
  }, [isOpen]);

  const validateToken = async (tokenToUse: string) => {
    if (!tokenToUse.trim()) return;
    setIsValidating(true);
    setAuthError('');
    
    const user = await getAuthenticatedUser(tokenToUse);
    
    if (user) {
        setAuthUser(user);
        setIsAuthenticated(true);
        loadRepositories(tokenToUse, 1);
    } else {
        setIsAuthenticated(false);
        setAuthError('Invalid Access Token. Please check permissions.');
    }
    setIsValidating(false);
  };

  const loadRepositories = async (authToken: string, pageNum: number) => {
      setIsLoadingRepos(true);
      const repos = await getUserRepositories(authToken, pageNum);
      
      if (pageNum === 1) {
          setAvailableRepos(repos);
      } else {
          setAvailableRepos(prev => [...prev, ...repos]);
      }
      setPage(pageNum);
      setIsLoadingRepos(false);
  };

  const handleLogout = () => {
      setIsAuthenticated(false);
      setAuthUser(null);
      setToken('');
      setAvailableRepos([]);
      setRepoSearch('');
      clearAllStoredGitHubTokens();
  };

  const handleConnectRepo = (repo: any) => {
      // Check if already connected
      const existing = savedConfigs.find(c => c.owner === repo.owner.login && c.repo === repo.name);
      if (existing) {
          onSetActive(existing.id);
          return;
      }

      const config: GithubConfig = {
          id: crypto.randomUUID(),
          token: '',
          owner: repo.owner.login,
          repo: repo.name,
          branch: repo.default_branch,
          allowWriteAccess: allowWriteAccess
      };

      rememberGitHubToken(config.id, token);
      onAddConfig(config);
  };

  const filteredRepos = availableRepos.filter(r => 
      r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  // --- Environment Variable Handlers ---
  const handleAddEnv = () => {
    if (newEnvKey.trim() && newEnvValue.trim()) {
        const newVar: EnvVar = {
            id: crypto.randomUUID(),
            key: newEnvKey.trim().toUpperCase(),
            value: newEnvValue.trim()
        };
        onUpdateEnvVars([...envVars, newVar]);
        setNewEnvKey('');
        setNewEnvValue('');
    }
  };

  const handleRemoveEnv = (id: string) => {
      onUpdateEnvVars(envVars.filter(v => v.id !== id));
  };

  // --- Local File Handlers ---
  const handleSelectLocalFolder = async () => {
    setLocalError(null);
    try {
      const handle = await selectLocalDirectory();
      onSetLocalDirHandle(handle);
      onSetVirtualData(null);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        if (e.message.includes('Access Denied') || e.message.includes('embedded view')) {
            virtualFileInputRef.current?.click();
            return;
        }
        setLocalError(e.message);
      }
    }
  };

  const handleVirtualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const { tree, fileMap } = buildVirtualFileTree(e.target.files);
          onSetVirtualData({ tree, map: fileMap });
          onSetLocalDirHandle(null);
          setLocalError(null);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-gray-900/90 border-b border-gray-700 shrink-0 flex items-center justify-between px-6 py-4">
             <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Settings
             </h2>
             <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-48 bg-gray-900 border-r border-gray-800 p-2 flex flex-col gap-1 shrink-0">
                <button onClick={() => setActiveTab('repos')} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'repos' ? 'bg-accent-600 text-white shadow-lg shadow-accent-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                    <Github className="w-4 h-4"/> GitHub Access
                </button>
                <button onClick={() => setActiveTab('local')} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'local' ? 'bg-accent-600 text-white shadow-lg shadow-accent-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                    <HardDrive className="w-4 h-4"/> Local Files
                </button>
                <button onClick={() => setActiveTab('env')} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'env' ? 'bg-accent-600 text-white shadow-lg shadow-accent-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                    <Database className="w-4 h-4"/> Variables
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-800 relative">
                
                {/* --- GITHUB TAB --- */}
                {activeTab === 'repos' && (
                    <div className="h-full flex flex-col">
                        {/* Auth Section */}
                        <div className="p-6 border-b border-gray-700 bg-gray-800/50">
                            {!isAuthenticated ? (
                                <div className="space-y-5 max-w-md mx-auto text-center py-6">
                                    <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                        <Github className="w-8 h-8 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Authenticate with GitHub</h3>
                                        <p className="text-sm text-gray-400 mt-1">Connect to access and sync your repositories.</p>
                                        <p className="text-xs text-amber-400/90 mt-2">Tokens are kept only for the current session and are not written to browser storage.</p>
                                        <label className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-300">
                                            <span>Allow GitHub write access</span>
                                            <input type="checkbox" checked={allowWriteAccess} onChange={(e) => setAllowWriteAccess(e.target.checked)} className="h-4 w-4 rounded border-gray-600 bg-gray-800" />
                                        </label>
                                    </div>
                                    
                                    <div className="space-y-3 pt-2">
                                        <a href="https://github.com/settings/tokens/new?description=PowerCoder-Z&scopes=repo,workflow,user:email,read:user" target="_blank" rel="noreferrer" className="block w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-600">
                                            <ExternalLink className="w-4 h-4" /> Generate Secure Token
                                        </a>
                                        
                                        <div className="relative">
                                            <input 
                                                type="password" 
                                                placeholder="Paste your token here (ghp_...)" 
                                                value={token} 
                                                onChange={(e) => { setToken(e.target.value); setAuthError(''); }} 
                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-accent-500 transition-colors" 
                                            />
                                        </div>
                                        
                                        <button 
                                            onClick={() => validateToken(token)} 
                                            disabled={isValidating || !token} 
                                            className="w-full py-2.5 bg-accent-600 hover:bg-accent-500 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-accent-600/20"
                                        >
                                            {isValidating ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Connect Account'}
                                        </button>
                                        
                                        {authError && <p className="text-xs text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">{authError}</p>}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <img src={authUser?.avatar_url} alt="Profile" className="w-12 h-12 rounded-full border-2 border-green-500/50" />
                                        <div>
                                            <div className="text-base font-bold text-white flex items-center gap-2">
                                                @{authUser?.login}
                                                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-medium uppercase tracking-wide border border-green-500/30">Active</span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">Ready to sync repositories</div>
                                        </div>
                                    </div>
                                    <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-colors border border-transparent hover:border-red-400/50">
                                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Repo Selection */}
                        {isAuthenticated && (
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="p-4 border-b border-gray-700 flex items-center gap-3 bg-gray-800 sticky top-0 z-10">
                                    <div className="flex-1 relative">
                                        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                                        <input 
                                            type="text" 
                                            placeholder="Search your repositories..." 
                                            value={repoSearch} 
                                            onChange={(e) => setRepoSearch(e.target.value)} 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-accent-500 outline-none" 
                                        />
                                    </div>
                                    <button onClick={() => loadRepositories(token, 1)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg" title="Refresh List">
                                        <Loader2 className={`w-4 h-4 ${isLoadingRepos ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                    {filteredRepos.length === 0 && !isLoadingRepos ? (
                                        <div className="text-center py-10 text-gray-500 text-sm">No repositories found matching "{repoSearch}"</div>
                                    ) : (
                                        filteredRepos.map(repo => {
                                            const isConnected = savedConfigs.some(c => c.owner === repo.owner.login && c.repo === repo.name);
                                            const isActive = activeConfigId === savedConfigs.find(c => c.owner === repo.owner.login && c.repo === repo.name)?.id;
                                            
                                            return (
                                                <div key={repo.id} onClick={() => handleConnectRepo(repo)} className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${isActive ? 'bg-accent-900/20 border-accent-500 shadow-sm' : isConnected ? 'bg-gray-800 border-gray-700 opacity-75 hover:opacity-100 hover:border-gray-600' : 'bg-gray-800/30 border-transparent hover:bg-gray-800 hover:border-gray-600'}`}>
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'bg-accent-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : isConnected ? 'bg-green-500' : 'bg-gray-600 group-hover:bg-gray-500'}`}></div>
                                                        <div className="min-w-0">
                                                            <div className={`text-sm font-medium truncate flex items-center gap-2 ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                                                                {repo.name}
                                                                {repo.private ? <Lock className="w-3 h-3 text-gray-500"/> : <Globe className="w-3 h-3 text-gray-500"/>}
                                                            </div>
                                                            <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                                                                {repo.owner.login} <span className="text-gray-700">•</span> {repo.default_branch}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {isConnected ? (
                                                        <div className="flex items-center gap-2">
                                                            {isActive && <span className="text-[10px] font-bold text-accent-400 uppercase tracking-wider mr-2">Connected</span>}
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); const conf = savedConfigs.find(c => c.owner === repo.owner.login && c.repo === repo.name); if (conf) onRemoveConfig(conf.id); }} 
                                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors" 
                                                                title="Disconnect"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : ( 
                                                        <button className="p-2 bg-gray-700 hover:bg-accent-600 text-gray-300 hover:text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                            <Plus className="w-4 h-4" />
                                                        </button> 
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                    {availableRepos.length > 0 && availableRepos.length % 100 === 0 && (
                                        <button onClick={() => loadRepositories(token, page + 1)} className="w-full py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
                                            Load More Repositories...
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- LOCAL FILES TAB --- */}
                {activeTab === 'local' && (
                    <div className="p-8 flex flex-col items-center justify-center h-full space-y-6 text-center">
                         <div className="w-20 h-20 bg-gray-700/30 rounded-full flex items-center justify-center mb-2"><FolderOpen className="w-10 h-10 text-accent-400" /></div>
                        <div><h3 className="text-xl font-semibold text-white mb-2">Sync with Local Disk</h3><p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">PowerCoder-Z can read/write to your project folder via the File System Access API.</p></div>
                        {localDirHandle ? (
                            <div className="w-full max-w-md bg-green-500/10 border border-green-500/30 p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-400" /><div className="text-left"><div className="text-sm text-green-300 font-bold">{localDirHandle.name}</div><div className="text-xs text-green-400/70">Sync Active</div></div></div>
                                <button onClick={() => onSetLocalDirHandle(null)} className="text-sm text-gray-400 hover:text-white underline decoration-gray-500">Disconnect</button>
                            </div>
                        ) : (
                            <>
                            <button onClick={handleSelectLocalFolder} className="px-6 py-3 bg-accent-600 hover:bg-accent-500 text-white transition-all rounded-xl font-semibold shadow-lg shadow-accent-600/20 flex items-center gap-2"><HardDrive className="w-5 h-5" /> Select Project Folder</button>
                            <input type="file" className="hidden" ref={virtualFileInputRef} onChange={handleVirtualFileSelect} webkitdirectory="" directory="" />
                            </>
                        )}
                        {localError && <div className="max-w-md bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-300 flex items-start gap-2 text-left"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{localError}</span></div>}
                    </div>
                )}

                {/* --- ENV VARS TAB --- */}
                {activeTab === 'env' && (
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between"><h3 className="text-sm font-medium text-white uppercase tracking-wider">Environment Variables</h3></div>
                        <div className="space-y-3">
                            {envVars.map(env => (
                                <div key={env.id} className="flex items-center gap-2 bg-gray-900/50 p-3 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                                    <div className="flex-1 grid grid-cols-2 gap-4"><code className="text-accent-400 font-bold text-sm">{env.key}</code><code className="text-gray-500 text-sm truncate">{env.value}</code></div>
                                    <button onClick={() => handleRemoveEnv(env.id)} className="text-gray-500 hover:text-red-400 p-2 rounded hover:bg-gray-800"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                            {envVars.length === 0 && <div className="text-gray-500 text-sm italic text-center py-4">No variables configured</div>}
                        </div>
                        <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 space-y-3">
                            <div className="text-xs font-medium text-gray-400 uppercase">Add New Variable</div>
                            <div className="flex gap-2">
                                <input placeholder="KEY" value={newEnvKey} onChange={e => setNewEnvKey(e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-accent-500" />
                                <input placeholder="VALUE" value={newEnvValue} onChange={e => setNewEnvValue(e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-accent-500" />
                                <button onClick={handleAddEnv} className="bg-gray-700 hover:bg-accent-600 text-white p-2 rounded-lg transition-colors"><Plus className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
