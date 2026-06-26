
import React, { useState, useEffect } from 'react';
import { BRIDGE_SERVER_SCRIPT, checkBridgeHealth, crawlViaBridge } from '../services/bridgeService';
import { BridgeStatus } from '../types';
import { Activity, Download, AlertTriangle, CheckCircle2, Globe, Search, Server, Copy, Play } from 'lucide-react';

interface Props {
  onAddSpiderResult: (url: string, content: string) => void;
}

export const BridgePanel: React.FC<Props> = ({ onAddSpiderResult }) => {
  const [activeTab, setActiveTab] = useState<'connect' | 'spider'>('connect');
  const [health, setHealth] = useState<BridgeStatus>({ isConnected: false });
  const [isChecking, setIsChecking] = useState(false);

  // Spider State
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);

  const checkStatus = async () => {
      setIsChecking(true);
      const status = await checkBridgeHealth();
      setHealth(status);
      setIsChecking(false);
  };

  useEffect(() => {
      checkStatus();
      const interval = setInterval(checkStatus, 5000);
      return () => clearInterval(interval);
  }, []);

  const handleDownloadScript = () => {
      const blob = new Blob([BRIDGE_SERVER_SCRIPT], { type: 'text/x-python' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'powercoder_bridge.py';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const handleCrawl = async () => {
      if (!crawlUrl) return;
      if (!health.isConnected) {
          alert("Local Bridge is not connected. Please run the script first.");
          setActiveTab('connect');
          return;
      }

      setIsCrawling(true);
      try {
          const result = await crawlViaBridge(crawlUrl);
          if (result.success) {
              onAddSpiderResult(result.url, result.content);
              setCrawlUrl('');
          } else {
              alert("Crawl failed: " + result.error);
          }
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsCrawling(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 font-sans">
        {/* Tabs */}
        <div className="flex border-b border-gray-800 bg-gray-800/50">
            <button 
                onClick={() => setActiveTab('connect')}
                className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'connect' ? 'text-white border-b-2 border-accent-500 bg-gray-800' : 'text-gray-500 hover:text-gray-300'}`}
            >
                <Server className="w-4 h-4" />
                Local Server
            </button>
            <button 
                onClick={() => setActiveTab('spider')}
                className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'spider' ? 'text-white border-b-2 border-green-500 bg-gray-800' : 'text-gray-500 hover:text-gray-300'}`}
            >
                <Globe className="w-4 h-4" />
                Spider Web
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            
            {/* CONNECTION TAB */}
            {activeTab === 'connect' && (
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className={`p-4 rounded-xl border ${health.isConnected ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className={`text-sm font-bold flex items-center gap-2 ${health.isConnected ? 'text-green-400' : 'text-red-400'}`}>
                                <Activity className="w-4 h-4" />
                                {health.isConnected ? 'Bridge Connected' : 'Disconnected'}
                            </h3>
                            <button onClick={checkStatus} className="text-xs underline text-gray-400 hover:text-white">Refresh</button>
                        </div>
                        {health.isConnected ? (
                            <div className="text-xs text-gray-300 space-y-1">
                                <div>OS: <span className="text-white font-mono">{health.os}</span></div>
                                <div>Python: <span className="text-white font-mono">{health.pythonVersion}</span></div>
                                <div className="text-green-400/70 mt-2 text-[10px] flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Ready for local execution</div>
                            </div>
                        ) : (
                            <p className="text-xs text-red-300/70">Run the python script locally to enable native features.</p>
                        )}
                    </div>

                    {/* Setup Instructions */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase">How to Connect</h4>
                        <ol className="space-y-3 text-xs text-gray-300 list-decimal list-inside">
                            <li className="p-2 bg-gray-800 rounded border border-gray-700 flex items-center justify-between">
                                <span>Download <code>powercoder_bridge.py</code></span>
                                <button onClick={handleDownloadScript} className="p-1.5 bg-accent-600 hover:bg-accent-500 text-white rounded transition-colors">
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                            </li>
                            <li className="p-2 bg-gray-800 rounded border border-gray-700">
                                <div className="mb-1">Install dependencies:</div>
                                <code className="block bg-black p-1.5 rounded text-green-400 font-mono select-all">
                                    pip install flask flask-cors requests beautifulsoup4
                                </code>
                            </li>
                            <li className="p-2 bg-gray-800 rounded border border-gray-700">
                                <div className="mb-1">Run the server:</div>
                                <code className="block bg-black p-1.5 rounded text-green-400 font-mono select-all">
                                    python powercoder_bridge.py
                                </code>
                            </li>
                        </ol>
                    </div>
                </div>
            )}

            {/* SPIDER TAB */}
            {activeTab === 'spider' && (
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/20 rounded-xl p-4">
                         <h3 className="text-green-400 font-bold text-sm mb-1 flex items-center gap-2">
                            <Globe className="w-4 h-4"/> Web Automation Spider
                         </h3>
                         <p className="text-xs text-green-200/60">
                            Enter a URL. The local bridge will fetch the page, strip ads/scripts, and inject the clean text into the chat for analysis.
                         </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400">Target URL</label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <div className="absolute left-3 top-2.5 text-gray-500"><Search className="w-3.5 h-3.5"/></div>
                                <input 
                                    value={crawlUrl}
                                    onChange={e => setCrawlUrl(e.target.value)}
                                    placeholder="https://docs.python.org/3/..."
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-green-500 outline-none"
                                />
                            </div>
                            <button 
                                onClick={handleCrawl}
                                disabled={isCrawling || !health.isConnected}
                                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 rounded-lg font-medium text-xs transition-colors flex items-center gap-2"
                            >
                                {isCrawling ? <Activity className="w-3.5 h-3.5 animate-spin"/> : <Play className="w-3.5 h-3.5"/>}
                                Crawl
                            </button>
                        </div>
                        {!health.isConnected && (
                            <div className="text-[10px] text-red-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3"/> Local Bridge not connected.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
