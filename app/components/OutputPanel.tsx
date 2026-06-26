
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { XCircle, Sparkles, Copy, Check, Download, Image as ImageIcon, ChevronDown, ChevronRight, Maximize, Trash2, Activity, BarChart, Terminal, Eye, EyeOff } from 'lucide-react';

interface Props {
  output: {
    text: string;
    isError: boolean;
    sourceCode?: string;
    language?: string;
    images?: { name: string, data: string, mimeType: string }[];
    isNeuralEngine?: boolean;
  } | null;
  onClear: () => void;
  onFixError: (code: string, error: string, language: string) => void;
  onViewImage: (img: { name: string, data: string, mimeType: string }) => void;
  onRemoveImage: (index: number) => void;
}

export const OutputPanel: React.FC<Props> = ({ output, onClear, onFixError, onViewImage, onRemoveImage }) => {
  const endRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [areImagesCollapsed, setAreImagesCollapsed] = useState(false);
  const [showRawLog, setShowRawLog] = useState(false);
  
  // Animation States
  const [bootSequence, setBootSequence] = useState(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output?.text]);

  useEffect(() => {
      if (output?.isNeuralEngine) {
          setShowRawLog(false);
          setBootSequence(0);
          const interval = setInterval(() => {
              setBootSequence(p => p < 100 ? p + 5 : 100);
          }, 50);
          return () => clearInterval(interval);
      } else {
          setShowRawLog(true);
      }
  }, [output?.isNeuralEngine, output?.text]);

  const handleCopy = async () => {
    if (output?.text) {
        await navigator.clipboard.writeText(output.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadImage = (e: React.MouseEvent, img: { name: string, data: string, mimeType: string }) => {
      e.stopPropagation();
      const link = document.createElement('a');
      link.href = `data:${img.mimeType};base64,${img.data}`;
      link.download = img.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Detect SPI Output
  const spiMetrics = useMemo(() => {
      if (!output?.text) return null;
      const marker = "__SPI_METRICS__:";
      const idx = output.text.indexOf(marker);
      if (idx !== -1) {
          try {
              const jsonStr = output.text.substring(idx + marker.length);
              const jsonPart = jsonStr.split('\n')[0];
              return JSON.parse(jsonPart);
          } catch (e) { return null; }
      }
      // Fallback Regex
      const syntropy = output.text.match(/Syntropy Level = ([\d\.]+)/);
      const pattern = output.text.match(/Pattern Strength = ([\d\.]+)/);
      const memory = output.text.match(/Memory State Norm = ([\d\.]+)/);
      
      if (syntropy) {
          return {
              syntropy_level: parseFloat(syntropy[1]),
              pattern_strength: pattern ? parseFloat(pattern[1]) : 0,
              memory_state_norm: memory ? parseFloat(memory[1]) : 0
          };
      }
      return null;
  }, [output?.text]);

  if (!output) {
      return (
          <div className="flex items-center justify-center h-full text-gray-500 text-xs italic select-none bg-[#0f1117]">
              Run code to see output here...
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full font-mono text-xs bg-[#0f1117] relative">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50 border-b border-gray-700 shrink-0">
            <div className="flex items-center gap-2">
                <span className={`uppercase tracking-wider font-semibold ${output.isError ? 'text-red-400' : 'text-green-400'}`}>
                    {output.isNeuralEngine ? 'NEURAL ENGINE ACTIVE' : (output.isError ? 'Execution Error' : 'Success')}
                </span>
                {output.isError && output.sourceCode && (
                    <button 
                        onClick={() => onFixError(output.sourceCode!, output.text, output.language || 'python')}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent-600/10 text-accent-400 border border-accent-500/30 hover:bg-accent-600 hover:text-white transition-colors ml-2"
                    >
                        <Sparkles className="w-3 h-3" />
                        Fix with AI
                    </button>
                )}
            </div>
            <div className="flex items-center gap-1">
                {output.isNeuralEngine && (
                    <button onClick={() => setShowRawLog(!showRawLog)} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors" title={showRawLog ? "Hide Raw Log" : "Show Raw Log"}>
                        {showRawLog ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                    </button>
                )}
                <button onClick={handleCopy} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors" title="Copy Output">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400"/> : <Copy className="w-3.5 h-3.5"/>}
                </button>
                <button onClick={onClear} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors" title="Clear">
                    <XCircle className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar space-y-4">
            
            {/* SPI Visualization Dashboard */}
            {output.isNeuralEngine && (
                <div className="mb-4">
                    {/* Boot Animation */}
                    {(!spiMetrics || bootSequence < 100) && (
                        <div className="font-mono text-cyan-500 mb-4">
                            <div className="flex justify-between mb-1">
                                <span>INITIALIZING DEMO COGNITIVE ARCHITECTURE...</span>
                                <span>{bootSequence}%</span>
                            </div>
                            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-500 transition-all duration-75 ease-out" style={{ width: `${bootSequence}%` }}></div>
                            </div>
                            <div className="mt-2 text-[10px] text-gray-500 space-y-0.5">
                                {bootSequence > 10 && <div>{'>'} Loading Numpy Matrices... OK</div>}
                                {bootSequence > 30 && <div>{'>'} Establishing Gemini Link... OK</div>}
                                {bootSequence > 60 && <div>{'>'} Calibrating Syntropy Fields...</div>}
                                {bootSequence > 90 && <div>{'>'} Neural Sync Complete.</div>}
                            </div>
                        </div>
                    )}

                    {spiMetrics && bootSequence >= 100 && (
                        <div className="bg-gray-900/80 border border-cyan-500/30 rounded-lg p-4 shadow-[0_0_20px_rgba(6,182,212,0.1)] relative overflow-hidden animate-in fade-in zoom-in duration-500">
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
                                    <h3 className="text-sm font-bold text-cyan-100 tracking-widest">SPI ENGINE STATUS (DEMO)</h3>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-cyan-500/70">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping"></div>
                                    LIVE
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                                {/* Syntropy Gauge */}
                                <div className="bg-black/40 p-4 rounded border border-cyan-900/50 flex flex-col items-center relative group">
                                    <span className="text-[10px] text-cyan-500 uppercase tracking-widest mb-2">Syntropy</span>
                                    <div className="relative w-20 h-20 flex items-center justify-center">
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                            <path className="text-gray-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2"/>
                                            <path className="text-cyan-500 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]" strokeDasharray={`${spiMetrics.syntropy_level * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        </svg>
                                        <div className="absolute text-lg font-bold text-white">{(spiMetrics.syntropy_level * 100).toFixed(0)}%</div>
                                    </div>
                                    <div className="text-[9px] text-gray-500 mt-2 text-center">System Harmony</div>
                                </div>

                                {/* Pattern Gauge */}
                                <div className="bg-black/40 p-4 rounded border border-purple-900/50 flex flex-col items-center relative group">
                                    <span className="text-[10px] text-purple-500 uppercase tracking-widest mb-2">Pattern Str</span>
                                    <div className="flex items-end justify-center gap-1 h-20 w-full px-2">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="w-3 bg-purple-900/30 rounded-sm h-full relative overflow-hidden">
                                                <div 
                                                    className="absolute bottom-0 w-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)] transition-all duration-500" 
                                                    style={{ height: `${Math.min(100, Math.max(0, (spiMetrics.pattern_strength * 50) - (i * 20)))}%` }}
                                                ></div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-xl font-bold text-white mt-[-30px] z-10 drop-shadow-md">{spiMetrics.pattern_strength.toFixed(2)}</div>
                                    <div className="text-[9px] text-gray-500 mt-2 text-center">Signal Coherence</div>
                                </div>

                                {/* Memory Gauge */}
                                <div className="bg-black/40 p-4 rounded border border-green-900/50 flex flex-col items-center relative group">
                                    <span className="text-[10px] text-green-500 uppercase tracking-widest mb-2">Memory</span>
                                    <div className="w-full h-20 flex items-center justify-center">
                                        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] transition-all duration-1000" style={{ width: `${Math.min(spiMetrics.memory_state_norm * 10, 100)}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="text-xl font-bold text-white mt-[-35px] mb-2">{spiMetrics.memory_state_norm.toFixed(2)}</div>
                                    <div className="text-[9px] text-gray-500 text-center">Plasticity Index</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Text Output - Hidden if Neural Engine unless toggled */}
            {(showRawLog || !output.isNeuralEngine) && output.text && (
                <div className={`relative ${output.isNeuralEngine ? 'border-t border-gray-800 pt-4' : ''}`}>
                    {output.isNeuralEngine && <div className="text-[10px] text-gray-500 mb-2 font-bold uppercase">Raw Execution Log</div>}
                    <pre className={`whitespace-pre-wrap break-words leading-relaxed ${output.isError ? 'text-red-300' : 'text-gray-300'}`}>
                        {output.text}
                    </pre>
                </div>
            )}
            
            {/* Image Output */}
            {output.images && output.images.length > 0 && (
                <div className="border-t border-gray-800 pt-4 mt-2">
                    <button 
                        onClick={() => setAreImagesCollapsed(!areImagesCollapsed)}
                        className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white mb-3 w-full group"
                    >
                        {areImagesCollapsed ? <ChevronRight className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                        Generated Images ({output.images.length})
                        <span className="text-gray-600 font-normal text-[10px] group-hover:text-gray-500 transition-colors ml-auto">
                            {areImagesCollapsed ? 'Click to show' : 'Click to minimize'}
                        </span>
                    </button>
                    
                    {!areImagesCollapsed && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                            {output.images.map((img, idx) => (
                                <div key={idx} className="bg-gray-800/50 rounded-lg border border-gray-700 p-2 group relative hover:border-gray-600 transition-colors">
                                    <div className="aspect-video bg-gray-900 rounded mb-2 flex items-center justify-center overflow-hidden relative">
                                        <img 
                                            src={`data:${img.mimeType};base64,${img.data}`} 
                                            alt={img.name} 
                                            className="max-w-full max-h-full object-contain"
                                            loading="lazy"
                                        />
                                        {/* Overlay */}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => onViewImage(img)}
                                                className="p-2 bg-gray-800 rounded-full hover:bg-accent-600 hover:text-white text-gray-300 transition-colors shadow-lg"
                                                title="Full Screen Preview"
                                            >
                                                <Maximize className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onRemoveImage(idx); }}
                                                className="p-2 bg-gray-800 rounded-full hover:bg-red-600 hover:text-white text-gray-300 transition-colors shadow-lg"
                                                title="Remove Image"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                            <ImageIcon className="w-3 h-3 text-purple-400 shrink-0" />
                                            <span className="text-[10px] text-gray-400 truncate max-w-[100px]" title={img.name}>{img.name}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => handleDownloadImage(e, img)}
                                            className="flex items-center gap-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors shadow-sm"
                                            title="Download to Disk"
                                        >
                                            <Download className="w-3 h-3" /> 
                                            <span>Save</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div ref={endRef} />
        </div>
    </div>
  );
};
