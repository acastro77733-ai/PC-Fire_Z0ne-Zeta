import React, { useState, useRef, useEffect } from 'react';
import { GripHorizontal, X, Minus, ChevronUp } from 'lucide-react';

interface Props {
  title: string;
  initialPosition?: { x: number, y: number };
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  defaultWidth?: string;
  defaultHeight?: string;
}

export const DraggablePanel: React.FC<Props> = ({ 
  title, 
  initialPosition, 
  children, 
  onClose, 
  className = '',
  defaultWidth = 'w-[500px]',
  defaultHeight = 'h-[300px]'
}) => {
  // Default position
  const [pos, setPos] = useState(initialPosition || { x: window.innerWidth / 2 - 250, y: window.innerHeight - 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });
  
  // Collapse State
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [storedHeight, setStoredHeight] = useState<string | undefined>(undefined);
  
  const panelRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    if (panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        setRel({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    e.stopPropagation();
    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPos({ x: e.clientX - rel.x, y: e.clientY - rel.y });
    e.stopPropagation();
    e.preventDefault();
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    } else {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
      const handleResize = () => {
          setPos(p => ({
              x: Math.min(p.x, window.innerWidth - 100),
              y: Math.min(p.y, window.innerHeight - 50)
          }));
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapse = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isCollapsed) {
          // Collapsing: Save current height from DOM (which might be set by CSS resize)
          if (panelRef.current) {
             setStoredHeight(panelRef.current.style.height);
          }
          setIsCollapsed(true);
      } else {
          // Expanding: State change triggers render with storedHeight
          setIsCollapsed(false);
      }
  };

  return (
    <div 
      ref={panelRef}
      style={{ 
          left: pos.x, 
          top: pos.y, 
          position: 'fixed', 
          zIndex: 40,
          // If collapsed, force auto height. If expanded, use stored height (if user resized) or let class handle it.
          height: isCollapsed ? 'auto' : storedHeight,
          minHeight: isCollapsed ? '0px' : undefined 
      }}
      className={`flex flex-col bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl overflow-hidden transition-colors ${defaultWidth} ${isCollapsed ? '' : defaultHeight} ${isCollapsed ? 'resize-none' : 'resize'} ${!isCollapsed && 'min-w-[300px] min-h-[150px]'} ${className}`}
    >
      {/* Header */}
      <div 
        onMouseDown={onMouseDown}
        className="bg-gray-800/80 px-3 py-2 cursor-grab active:cursor-grabbing flex items-center justify-between border-b border-gray-700/50 select-none shrink-0 group"
        onDoubleClick={toggleCollapse}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-gray-400 group-hover:text-gray-200 pointer-events-none">
           <GripHorizontal className="w-4 h-4 text-gray-500 group-hover:text-accent-400 transition-colors" />
           <span>{title}</span>
        </div>
        <div className="flex items-center gap-1 on-drag-ignore">
            <button 
                onMouseDown={(e) => e.stopPropagation()}
                onClick={toggleCollapse}
                className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700 cursor-pointer transition-colors"
                title={isCollapsed ? "Expand" : "Collapse"}
            >
                {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            </button>
            {onClose && (
                <button 
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onClose(); }} 
                    className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-700 cursor-pointer transition-colors"
                    title="Close"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
      </div>
      
      {/* Content */}
      {!isCollapsed && (
          <div className="flex-1 overflow-auto relative custom-scrollbar flex flex-col">
            {children}
          </div>
      )}
    </div>
  );
};