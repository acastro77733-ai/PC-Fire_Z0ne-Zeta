import React, { useMemo, useState } from 'react';
import { Settings, TerminalSquare, Sparkles, RefreshCw } from 'lucide-react';
import { TerminalPanel } from './components/TerminalPanel';
import { GithubSettingsModal } from './components/GithubSettingsModal';
import { OutputPanel } from './components/OutputPanel';
import { CodeBlock } from './components/CodeBlock';
import { EnvVar, FileNode, GithubConfig, ToastData, ToastType } from './types';

const starterCode = `print("PowerCoder-Z is ready")
print("Use the terminal to run commands, sync GitHub repos, or upload a zip workspace.")`;

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<GithubConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [localDirHandle, setLocalDirHandle] = useState<any>(null);
  const [virtualData, setVirtualData] = useState<{ tree: FileNode[]; map: Map<string, File> } | null>(null);
  const [output, setOutput] = useState<{
    text: string;
    isError: boolean;
    sourceCode?: string;
    language?: string;
    images?: { name: string; data: string; mimeType: string }[];
    isNeuralEngine?: boolean;
  } | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const githubConfig = useMemo(() => {
    return savedConfigs.find((config) => config.id === activeConfigId) || null;
  }, [activeConfigId, savedConfigs]);

  const addToast = (message: string, type: ToastType) => {
    const nextToast: ToastData = { id: crypto.randomUUID(), message, type };
    setToast(nextToast);
    window.setTimeout(() => setToast((current) => (current?.id === nextToast.id ? null : current)), 2800);
  };

  const handleAddConfig = (config: GithubConfig) => {
    setSavedConfigs((current) => {
      const exists = current.some((item) => item.id === config.id);
      return exists ? current.map((item) => (item.id === config.id ? config : item)) : [...current, config];
    });
    setActiveConfigId(config.id);
    addToast(`Connected to ${config.owner}/${config.repo}`, ToastType.SUCCESS);
  };

  const handleRemoveConfig = (id: string) => {
    setSavedConfigs((current) => current.filter((item) => item.id !== id));
    if (activeConfigId === id) {
      setActiveConfigId(null);
    }
  };

  const handleClearOutput = () => setOutput(null);
  const handleFixError = (code: string, error: string, language: string) => {
    addToast(`Suggested fix is ready for ${language} execution.`, ToastType.INFO);
    setOutput({
      text: `Suggested fix placeholder:\n${error}\n\nReview the code and rerun it after updating the failing section.`,
      isError: true,
      sourceCode: code,
      language,
    });
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-accent-400">
              <TerminalSquare className="h-4 w-4" />
              PowerCoder-Z
            </div>
            <h1 className="mt-1 text-xl font-semibold text-white">Workspace shell</h1>
            <p className="text-sm text-gray-400">Run code, sync repos, and manage local files from one place.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 transition hover:border-accent-500 hover:text-white"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 transition hover:border-accent-500 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Reload
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:px-8">
        <section className="flex-1 rounded-2xl border border-gray-800 bg-gray-900/70 p-2 shadow-2xl shadow-black/20">
          <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950/80 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-white">Terminal</div>
              <div className="text-xs text-gray-400">Use this console to run Python, manage GitHub sync, and upload a zip workspace.</div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Ready
            </div>
          </div>
          <div className="h-[560px] overflow-hidden rounded-xl border border-gray-800">
            <TerminalPanel envVars={envVars} githubConfig={githubConfig} />
          </div>
        </section>

        <aside className="flex w-full flex-col gap-4 lg:w-[430px]">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-2 shadow-2xl shadow-black/20">
            <div className="mb-2 rounded-xl border border-gray-800 bg-gray-950/80 px-4 py-3">
              <div className="text-sm font-semibold text-white">Output</div>
              <div className="text-xs text-gray-400">Execution results show up here.</div>
            </div>
            <div className="h-[260px] overflow-hidden rounded-xl border border-gray-800">
              <OutputPanel
                output={output}
                onClear={handleClearOutput}
                onFixError={handleFixError}
                onViewImage={() => undefined}
                onRemoveImage={() => undefined}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-2 shadow-2xl shadow-black/20">
            <div className="mb-2 rounded-xl border border-gray-800 bg-gray-950/80 px-4 py-3">
              <div className="text-sm font-semibold text-white">Starter snippet</div>
              <div className="text-xs text-gray-400">Run this sample to confirm the runtime is working.</div>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-800">
              <CodeBlock
                language="python"
                code={starterCode}
                githubConfig={githubConfig}
                envVars={envVars}
                addToast={addToast}
                localDirHandle={localDirHandle}
                onOutput={(data) => setOutput({ ...data, isNeuralEngine: false })}
              />
            </div>
          </div>
        </aside>
      </main>

      <GithubSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        savedConfigs={savedConfigs}
        activeConfigId={activeConfigId}
        onSetActive={setActiveConfigId}
        onAddConfig={handleAddConfig}
        onRemoveConfig={handleRemoveConfig}
        envVars={envVars}
        onUpdateEnvVars={setEnvVars}
        localDirHandle={localDirHandle}
        onSetLocalDirHandle={setLocalDirHandle}
        onSetVirtualData={setVirtualData}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-gray-700 bg-gray-900/95 px-4 py-3 shadow-2xl shadow-black/30">
          <div className="text-sm font-medium text-white">{toast.message}</div>
          <div className="mt-1 text-xs text-gray-400">{toast.type}</div>
        </div>
      )}
    </div>
  );
};

export default App;
