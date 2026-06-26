
import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Cloud, Server, Play, DownloadCloud, UploadCloud, Archive, Monitor } from 'lucide-react';
import { setOutputCallbacks, executeTerminalCommand, deployRepoToVFS, createZipArchive, installRepoRequirements, detectAndRunEntryPoint } from '../services/pythonRuntime';
import { EnvVar, GithubConfig, RuntimeMode } from '../types';

interface Props {
  envVars: EnvVar[];
  githubConfig: GithubConfig | null;
}

export const TerminalPanel: React.FC<Props> = ({ envVars, githubConfig }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('browser');
  const [isDeploying, setIsDeploying] = useState(false);
  const commandBufferRef = useRef<string>('');

  const isElectron = !!window.electron;

  // Auto-switch to Electron mode if available
  useEffect(() => {
      if (isElectron) setRuntimeMode('electron' as any);
  }, [isElectron]);

  const theme = {
    background: '#0f1117',
    foreground: '#cccccc',
    cursor: '#ffffff',
    cursorAccent: '#0f1117',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5',
  };

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;
    // @ts-ignore
    if (!window.Terminal || !window.FitAddon) return;
    // @ts-ignore
    const term = new window.Terminal({ cursorBlink: true, theme: theme, fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: 13, lineHeight: 1.2, allowTransparency: true });
    // @ts-ignore
    const fitAddon = new window.FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    term.writeln('\x1b[1;32m✓ System Ready\x1b[0m');
    if (isElectron) term.writeln('\x1b[1;35m● Runtime: Desktop App (Native Node.js)\x1b[0m');
    else term.writeln('\x1b[1;34m● Runtime: Browser (Pyodide)\x1b[0m');
    
    term.write('\r\n\x1b[1;32muser@powercoder\x1b[0m:\x1b[1;34m~\x1b[0m$ ');

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData(async (e: string) => {
        switch (e) {
            case '\r': // Enter
                term.write('\r\n');
                const command = commandBufferRef.current;
                commandBufferRef.current = '';
                if (command.trim()) {
                    try {
                        await executeTerminalCommand(command, envVars, githubConfig, isElectron ? 'electron' as any : runtimeMode); 
                    } catch (err) {}
                }
                term.write('\x1b[1;32muser@powercoder\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
                break;
            case '\u007F': // Backspace
                if (commandBufferRef.current.length > 0) {
                    commandBufferRef.current = commandBufferRef.current.slice(0, -1);
                    term.write('\b \b');
                }
                break;
            default:
                if (e.length === 1 && e.charCodeAt(0) >= 32) {
                    commandBufferRef.current += e;
                    term.write(e);
                }
        }
    });

    setOutputCallbacks(
      (msg) => term.write(msg.replace(/\n/g, '\r\n')),
      (msg) => term.write(`\x1b[31m${msg.replace(/\n/g, '\r\n')}\x1b[0m`)
    );

    return () => { term.dispose(); xtermRef.current = null; };
  }, [envVars, githubConfig]);

  useEffect(() => {
      if (xtermRef.current && !isElectron) {
          xtermRef.current.writeln(`\r\n\x1b[1;33m[System] Switched to ${runtimeMode.toUpperCase()} Runtime\x1b[0m`);
          xtermRef.current.write('\x1b[1;32muser@powercoder\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
      }
  }, [runtimeMode]);

  useEffect(() => {
      if (!containerRef.current || !fitAddonRef.current) return;
      const observer = new ResizeObserver(() => { try { if (containerRef.current?.offsetParent) fitAddonRef.current?.fit(); } catch(e){} });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
  }, []);

  const handlePostDeploy = async () => {
      // 1. Install Requirements
      await installRepoRequirements();
      // 2. Auto-Run Entry Point
      await detectAndRunEntryPoint(envVars);
  };

  const handleSyncAndRun = async () => {
      if (!githubConfig) { xtermRef.current?.writeln('\x1b[31mNo GitHub repository connected.\x1b[0m'); return; }
      setIsDeploying(true);
      try {
          if (runtimeMode === 'browser') { 
              const success = await deployRepoToVFS(githubConfig);
              if (success) {
                  await handlePostDeploy();
              }
          } 
          else { 
              xtermRef.current?.writeln('\x1b[1;33mTo run in Local Mode, please clone the repo manually or use git commands.\x1b[0m');
              xtermRef.current?.writeln('git clone https://github.com/' + githubConfig.owner + '/' + githubConfig.repo + '.git');
          }
      } finally {
          setIsDeploying(false);
          xtermRef.current?.write('\x1b[1;32muser@powercoder\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
      }
  };

  const handleZipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      if (!file.name.endsWith('.zip')) { xtermRef.current?.writeln('\x1b[31mOnly .zip files are supported.\x1b[0m'); return; }
      const reader = new FileReader();
      reader.onload = async (evt) => {
          if (evt.target?.result) {
              xtermRef.current?.writeln(`\x1b[1;34m> Uploading ${file.name}...\x1b[0m`);
              const config = githubConfig || { id: 'manual', token: '', owner: 'manual', repo: 'upload', branch: 'main' };
              const success = await deployRepoToVFS(config, evt.target.result as ArrayBuffer);
              if (success) {
                  await handlePostDeploy();
              }
              xtermRef.current?.write('\x1b[1;32muser@powercoder\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
          }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
  };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-[#0f1117] relative group">
       <div className="absolute top-2 right-4 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           {!isElectron && (
               <>
               <input type="file" ref={zipInputRef} onChange={handleZipUpload} accept=".zip" className="hidden" />
               <button onClick={() => zipInputRef.current?.click()} className="p-1 rounded flex items-center gap-1 text-[10px] font-medium transition-colors bg-gray-700 hover:bg-gray-600 text-white" title="Upload Zip to VFS"><UploadCloud className="w-3 h-3" /></button>
               <button onClick={() => createZipArchive(runtimeMode)} className="p-1 rounded flex items-center gap-1 text-[10px] font-medium transition-colors bg-gray-700 hover:bg-gray-600 text-white" title="Download Workspace as Zip"><Archive className="w-3 h-3" /></button>
               <div className="w-[1px] h-4 bg-gray-700 mx-1"></div>
               {githubConfig && <button onClick={handleSyncAndRun} disabled={isDeploying} className={`p-1 rounded flex items-center gap-1 text-[10px] font-medium transition-colors ${isDeploying ? 'bg-accent-600/50 cursor-wait' : 'bg-accent-600 hover:bg-accent-500'} text-white`} title="Clone Repo & Run main.py"><DownloadCloud className={`w-3 h-3 ${isDeploying ? 'animate-bounce' : ''}`} />{isDeploying ? 'Syncing...' : 'Sync & Run'}</button>}
               <div className="w-[1px] h-4 bg-gray-700 mx-1"></div>
               </>
           )}

           {isElectron ? (
               <div className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 border border-purple-500/30 rounded text-[10px] text-purple-300">
                   <Monitor className="w-3 h-3" /> Desktop Native
               </div>
           ) : (
               <div className="flex bg-gray-800 rounded-lg p-0.5 border border-gray-700">
                   <button onClick={() => setRuntimeMode('browser')} className={`p-1 rounded flex items-center gap-1 text-[10px] font-medium transition-colors ${runtimeMode === 'browser' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`} title="Browser Sandbox (Pyodide)"><Cloud className="w-3 h-3" /> Browser</button>
                   <button onClick={() => setRuntimeMode('local')} className={`p-1 rounded flex items-center gap-1 text-[10px] font-medium transition-colors ${runtimeMode === 'local' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`} title="Local Machine (Bridge)"><Server className="w-3 h-3" /> Local</button>
               </div>
           )}

           <button onClick={() => { xtermRef.current?.clear(); xtermRef.current?.write('\x1b[1;32muser@powercoder\x1b[0m:\x1b[1;34m~\x1b[0m$ '); }} className="p-1 text-gray-500 hover:text-white bg-gray-800/50 rounded hover:bg-gray-700" title="Clear Terminal"><Trash2 className="w-3.5 h-3.5" /></button>
       </div>
       <div className="flex-1 p-2 overflow-hidden"><div ref={terminalRef} className="w-full h-full" /></div>
    </div>
  );
};
