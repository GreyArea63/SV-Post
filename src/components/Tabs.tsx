import { useState, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { HttpRequest, HttpResponse } from '../types';
import { getMethodColor } from '../utils/methodColors';

interface Tab {
  id: string;
  request: HttpRequest;
  response: HttpResponse | null;
  loading: boolean;
  error: string | null;
}

interface TabsProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onTabsReorder?: (tabs: Tab[]) => void;
}

const MAX_TABS = 10;

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
  onTabsReorder,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // ИСПРАВЛЕНИЕ 2.25: Drag-and-drop для переупорядочивания вкладок
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newTabs = [...tabs];
    const [draggedTab] = newTabs.splice(dragIndex, 1);
    newTabs.splice(dropIndex, 0, draggedTab);

    if (onTabsReorder) {
      onTabsReorder(newTabs);
    }

    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ИСПРАВЛЕНИЕ 2.26: Обработка средней кнопки мыши
  const handleMiddleClick = (e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) {
      e.preventDefault();
      onTabClose(tabId);
    }
  };

  // ИСПРАВЛЕНИЕ 3.44: preventDefault для Firefox auto-scroll
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  };

  return (
    <div className="h-[32px] bg-[#1e1e1e] border-b border-[rgba(255,255,255,0.08)] flex items-end px-2 shrink-0">
      <div 
        ref={tabsContainerRef}
        className="flex-1 flex items-end gap-0.5 overflow-x-auto scrollbar-hide"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isDragOver = dragOverIndex === index;
          
          return (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onMouseDown={handleMouseDown}
              onMouseUp={(e) => handleMiddleClick(e, tab.id)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer transition-all border-t-2 min-w-[120px] max-w-[200px] ${
                isActive
                  ? 'bg-[#252525] border-t-indigo-500 text-gray-200'
                  : isDragOver
                  ? 'bg-[#2d2d2d] border-t-gray-500 text-gray-400'
                  : 'bg-[#1e1e1e] border-t-transparent text-gray-500 hover:bg-[#252525] hover:text-gray-300'
              }`}
              onClick={() => onTabClick(tab.id)}
            >
              {/* ИСПРАВЛЕНИЕ 3.42: Используем getMethodColor вместо локальных констант */}
              <span className={`font-bold text-[10px] ${getMethodColor(tab.request.method)}`}>
                {tab.request.method}
              </span>
              
              <span className="flex-1 truncate">
                {tab.request.name || 'Untitled'}
              </span>

              {tab.loading && (
                <div className="w-3 h-3 border-2 border-gray-500 border-t-indigo-500 rounded-full animate-spin"></div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-all"
                aria-label="Close tab"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {/* Кнопка новой вкладки */}
        {tabs.length < MAX_TABS && (
          <button
            onClick={onNewTab}
            className="flex items-center justify-center w-7 h-7 ml-1 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded transition-all"
            aria-label="New tab"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
};