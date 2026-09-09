import React from 'react';
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
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
}) => {
  const METHOD_COLORS: Record<string, string> = {
    GET: 'text-green-500',
    POST: 'text-yellow-500',
    PUT: 'text-blue-500',
    PATCH: 'text-purple-500',
    DELETE: 'text-red-500',
    HEAD: 'text-gray-500',
    OPTIONS: 'text-orange-500',
  };

  return (
    <div className="h-[38px] flex items-center bg-[#252525] border-b border-[#3d3d3d] overflow-x-auto shrink-0">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`flex items-center gap-2 px-3 border-r border-[#3d3d3d] cursor-pointer min-w-[120px] max-w-[180px] group h-full ${
            activeTabId === tab.id
              ? 'bg-[#1e1e1e] border-b-2 border-b-primary-500'
              : 'hover:bg-[#2d2d2d]'
          }`}
          onClick={() => onTabClick(tab.id)}
        >
          <span className={`font-bold text-[11px] ${METHOD_COLORS[tab.request.method] || 'text-gray-400'}`}>
            {tab.request.method}
          </span>
          <span className="flex-1 truncate text-xs">
            {tab.request.name || tab.request.url || 'Новый запрос'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            className="opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded p-0.5 transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {tabs.length < 10 && (
        <button
          onClick={onNewTab}
          className="flex items-center justify-center h-full px-3 hover:bg-[#2d2d2d] transition-colors"
          title="Новая вкладка"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
};