
import React, { useState, useEffect } from 'react';
import { GithubConfig, ToastType, EnvVar } from '../types';
import { pushFileToGithub } from '../services/githubService';
import { runPythonCode } from '../services/pythonRuntime';
import { saveToLocalFile, FileSystemDirectoryHandle } from '../services/localFileSystem';
import { GitCommit, Check, Copy, Terminal, Loader2, Play, AlertTriangle, HardDrive, Download } from 'lucide-react';

interface Props {
  language: string;
  code: string;
  githubConfig: GithubConfig | null;
  envVars: EnvVar[];
  addToast: (message: string, type: ToastType) => void;
  localDirHandle?: FileSystemDirectoryHandle | null;
  onOutput: (data: { text: string, isError: boolean, sourceCode: string, language: string, images?: { name: string, data: string, mimeType: string }[] }) => void;
}

export const CodeBlock: React.FC<Props> = ({ language, code, githubConfig, envVars, addToast, localDirHandle, onOutput }) => {
  const [filename, setFilename] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [showPushUI, setShowPushUI] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  // Auto-detect filename
  useEffect(() => {
    const firstLine = code.split('\n')[0].trim();
    if (firstLine.includes(language) || firstLine.startsWith('//') || firstLine.startsWith('#')) {
       const match = firstLine.match(/[\w-]+\.\w+/);
       if (match) {
         setFilename(match[0]);
       }
    }
  }, [code, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = async () => {
    setIsRunning(true);

    try {
      if (language === 'javascript' || language === 'js') {
        // Capture console.log
        const logs: string[] = [];
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        console.log = (...args) => logs.push(args.map(a => String(a)).join(' '));
        console.warn = (...args) => logs.push('[WARN] ' + args.map(a => String(a)).join(' '));
        console.error = (...args) => logs.push('[ERROR] ' + args.map(a => String(a)).join(' '));
        
        // Prepare Env for JS
        const processEnv = envVars.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
        
        // Execute with mocked process.env
        try {
            const runFunc = new Function('process', code);
            runFunc({ env: processEnv });
        } catch(e: any) {
            console.error(e.toString());
        }
        
        // Restore console
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
        
        onOutput({
            text: logs.length > 0 ? logs.join('\n') : 'Code executed successfully (no output).',
            isError: logs.some(l => l.includes('[ERROR]')),
            sourceCode: code,
            language
        });
      } 
      else if (language === 'python' || language === 'py') {
        const result = await runPythonCode(code, envVars);
        onOutput({
            text: result.text || 'Code executed successfully.',
            isError: false,
            sourceCode: code,
            language,
            images: result.images
        });
      }
      else {
        addToast(`Client-side execution for ${language} is not supported yet.`, ToastType.INFO);
      }
    } catch (err: any) {
      onOutput({
          text: err.toString(),
          isError: true,
          sourceCode: code,
          language
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handlePush = async () => {
    if (!filename) {
      addToast("Filename is required", ToastType.ERROR);
      return;
    }
    if (!githubConfig) {
      addToast("No active GitHub repository configured", ToastType.ERROR);
      return;
    }

    setIsPushing(true);
    try {
      const result = await pushFileToGithub(
        githubConfig,
        filename,
        code,
        commitMsg || `Add ${filename}`
      );
      
      if (result.success) {
        addToast(`Successfully pushed ${filename} to ${githubConfig.repo}`, ToastType.SUCCESS);
        setShowPushUI(false);
      } else {
        addToast(`Push failed: ${result.message}`, ToastType.ERROR);
      }
    } catch (e) {
      addToast("An error occurred during push", ToastType.ERROR);
    } finally {
      setIsPushing(false);
    }
  };

  const handleLocalSave = async () => {
    if (!localDirHandle) {
      addToast("No local directory connected", ToastType.ERROR);
      return;
    }
    let targetFile = filename;
    if (!targetFile) {
      targetFile = prompt("Enter filename (e.g. main.py):", filename) || '';
    }
    if (!targetFile) return;

    setIsSavingLocal(true);
    try {
      await saveToLocalFile(localDirHandle, targetFile, code);
      setFilename(targetFile);
      addToast(`Saved ${targetFile} to local disk`, ToastType.SUCCESS);
    } catch (e: any) {
      console.error(e);
      addToast(`Failed to save locally: ${e.message}`, ToastType.ERROR);
    } finally {
      setIsSavingLocal(false);
    }
  };

  const handleDownload = () => {
    let targetFile = filename || `script.${language === 'python' ? 'py' : 'js'}`;
    if (!filename) {
        targetFile = prompt("Enter filename to download:", targetFile) || '';
    }
    if (!targetFile) return;

    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast(`Downloaded ${targetFile}`, ToastType.SUCCESS);
  };

  const canRun = ['javascript', 'js', 'python', 'py'].includes(language.toLowerCase());

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-gray-700 bg-gray-900 shadow-md group relative z-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-400 font-mono uppercase">
          <Terminal className="w-3 h-3" />
          {language || 'plaintext'}
          {filename && <span className="text-gray-500 normal-case mx-1">• {filename}</span>}
        </div>
        <div className="flex items-center gap-2">
           {canRun && (
             <button
               onClick={handleRun}
               disabled={isRunning}
               className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors ${
                   isRunning ? 'text-gray-400 cursor-wait' : 'text-green-400 hover:text-green-300 hover:bg-green-400/10'
               }`}
               title={`Run ${language === 'python' ? 'Python (Pyodide)' : 'JavaScript'}`}
             >
               {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Play className="w-3.5 h-3.5" />}
               Run
             </button>
           )}
           
           {localDirHandle ? (
             <button
                onClick={handleLocalSave}
                disabled={isSavingLocal}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors ${
                  isSavingLocal ? 'text-gray-400' : 'text-blue-400 hover:text-blue-300 hover:bg-blue-400/10'
                }`}
                title={`Save to ${localDirHandle.name}`}
             >
                {isSavingLocal ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <HardDrive className="w-3.5 h-3.5" />}
                Save
             </button>
           ) : (
             <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                title="Download file"
             >
                <Download className="w-3.5 h-3.5" />
                Download
             </button>
           )}

           <button
            onClick={() => setShowPushUI(!showPushUI)}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors ${
               showPushUI ? 'bg-accent-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title={!githubConfig ? "Configure repository to push" : "Push to GitHub"}
          >
            <GitCommit className="w-3.5 h-3.5" />
            {showPushUI ? 'Cancel' : 'Push'}
          </button>
          
          <button
            onClick={handleCopy}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
            title="Copy code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* GitHub Push UI */}
      {showPushUI && (
        <div className="bg-gray-800/80 p-3 border-b border-gray-700 animate-in slide-in-from-top-2">
           <div className="flex flex-col gap-2 sm:flex-row">
             <input 
                type="text" 
                placeholder="path/to/filename.ext" 
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-xs text-white focus:border-accent-500 outline-none flex-1 font-mono"
             />
             <input 
                type="text" 
                placeholder="Commit message (optional)" 
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                className="bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-xs text-white focus:border-accent-500 outline-none flex-[2]"
             />
             <button
                onClick={handlePush}
                disabled={isPushing || !githubConfig}
                className="bg-green-600 hover:bg-green-500 text-white text-xs font-medium px-4 py-1.5 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
                {isPushing ? <Loader2 className="w-3 h-3 animate-spin"/> : <GitCommit className="w-3 h-3" />}
                Commit
             </button>
           </div>
           <div className="mt-2 text-[10px] flex items-center gap-1">
              {githubConfig ? (
                 <span className="text-gray-400">Pushing to <strong className="text-gray-300">{githubConfig.owner}/{githubConfig.repo}</strong> branch <code className="bg-gray-800 px-1 rounded">{githubConfig.branch}</code></span>
              ) : (
                 <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> No active repository selected. Open settings to configure.</span>
              )}
           </div>
        </div>
      )}

      {/* Code Content */}
      <div className="overflow-x-auto p-4 bg-gray-900 custom-scrollbar">
        <code className="font-mono text-sm text-gray-200 whitespace-pre leading-relaxed">
          {code}
        </code>
      </div>
    </div>
  );
};