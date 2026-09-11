import React, { useState, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { HttpRequest } from '../types';

interface Tab {
  id: string;
  request: HttpRequest;
}

interface TabsProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onTabsReorder?: (tabs: Tab[]) => void;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
  onTabsReorder,
}) => {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const METHOD_COLORS: Record<string, string> = {
    GET: 'text-emerald-400',
    POST: 'text-amber-400',
    PUT: 'text-blue-400',
    PATCH: 'text-purple-400',
    DELETE: 'text-red-400',
    HEAD: 'text-gray-400',
    OPTIONS: 'text-orange-400',
  };

  const METHOD_BG: Record<string, string> = {
    GET: 'bg-emerald-500/10',
    POST: 'bg-amber-500/10',
    PUT: 'bg-blue-500/10',
    PATCH: 'bg-purple-500/10',
    DELETE: 'bg-red-500/10',
    HEAD: 'bg-gray-500/10',
    OPTIONS: 'bg-orange-500/10',
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
    // Делаем элемент полупрозрачным при перетаскивании
    const el = e.currentTarget as HTMLElement;
    setTimeout(() => { el.style.opacity = '0.5'; }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '1';
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedTabId !== tabId) {
      setDragOverTabId(tabId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    if (!draggedTabId || draggedTabId === targetTabId || !onTabsReorder) return;

    const draggedIndex = tabs.findIndex(t => t.id === draggedTabId);
    const targetIndex = tabs.findIndex(t => t.id === targetTabId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newTabs = [...tabs];
    const [draggedTab] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, draggedTab);

    onTabsReorder(newTabs);
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  // Закрытие по средней кнопке мыши
  const handleMiddleClick = (e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) {
      e.preventDefault();
      onTabClose(tabId);
    }
  };

  return (
    <div className="h-[34px] flex items-end bg-[#1a1a23] border-b border-[rgba(255,255,255,0.08)] shrink-0">
      <div 
        ref={tabsContainerRef}
        className="flex items-end flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab, index) => {
          const isActive = activeTabId === tab.id;
          const isDragOver = dragOverTabId === tab.id && draggedTabId !== tab.id;

          return (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, tab.id)}
              onDrop={(e) => handleDrop(e, tab.id)}
              onClick={() => onTabClick(tab.id)}
              onMouseDown={(e) => handleMiddleClick(e, tab.id)}
              className={`group relative flex items-center gap-1.5 px-3 cursor-pointer select-none transition-all duration-150 ${
                isDragOver ? 'translate-x-1' : ''
              }`}
              style={{
                minWidth: '120px',
                maxWidth: '200px',
                height: '30px',
                borderRadius: isActive ? '8px 8px 0 0' : '6px 6px 0 0',
                background: isActive 
                  ? 'linear-gradient(to bottom, #252532 0%, #1e1e2e 100%)' 
                  : 'transparent',
                border: isActive 
                  ? '1px solid rgba(255,255,255,0.12)' 
                  : '1px solid transparent',
                borderBottom: isActive ? 'none' : '1px solid rgba(255,255,255,0.08)',
                marginBottom: isActive ? '0' : '4px',
                marginRight: index < tabs.length - 1 ? '2px' : '0',
              }}
            >
              {/* Индикатор перетаскивания */}
              {isDragOver && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-indigo-500 rounded-full z-10" />
              )}

              {/* Метод */}
              <span 
                className={`shrink-0 font-bold text-[9px] px-1.5 py-0.5 rounded ${METHOD_COLORS[tab.request.method]} ${METHOD_BG[tab.request.method]}`}
              >
                {tab.request.method}
              </span>

              {/* Название */}
              <span className="flex-1 truncate text-[11px] text-gray-400 group-hover:text-gray-200 transition-colors">
                {tab.request.name || tab.request.url || 'Новый запрос'}
              </span>

              {/* Кнопка закрытия */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }
                }}
                className={`shrink-0 rounded p-0.5 transition-all ${
                  isActive 
                    ? 'opacity-60 hover:opacity-100 hover:bg-red-500/20' 
                    : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-red-500/20'
                }`}
              >
                <X size={10} className="text-gray-400 hover:text-red-400" />
              </button>

              {/* Индикатор несохранённых изменений (опционально) */}
              {!isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[rgba(255,255,255,0.08)] rounded-t-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* Кнопка новой вкладки */}
      {tabs.length < 10 && (
        <button
          onClick={onNewTab}
          className="flex items-center justify-center h-[30px] w-[30px] mb-[4px] ml-1 rounded-md hover:bg-white/5 transition-all group shrink-0"
          title="Новая вкладка (Ctrl+T)"
        >
          <Plus size={14} className="text-gray-500 group-hover:text-indigo-400 transition-colors" />
        </button>
      )}
    </div>
  );
};