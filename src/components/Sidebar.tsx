import React, { useState } from 'react';
import { Folder, Plus, ChevronRight, ChevronDown, FileText, History as HistoryIcon } from 'lucide-react';
import { Collection, HistoryItem } from '../types';

interface SidebarProps {
  collections: Collection[];
  history: HistoryItem[];
  onSelectRequest: (collectionId: string, requestId: string) => void;
  onSelectHistory: (item: HistoryItem) => void;
  onAddCollection: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  history,
  onSelectRequest,
  onSelectHistory,
  onAddCollection,
}) => {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<'collections' | 'history'>('collections');

  const toggleCollection = (id: string) => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCollections(newExpanded);
  };

  const METHOD_COLORS: Record<string, string> = {
    GET: 'text-green-500',
    POST: 'text-yellow-500',
    PUT: 'text-blue-500',
    PATCH: 'text-purple-500',
    DELETE: 'text-red-500',
  };

  return (
    <div className="w-[280px] bg-[#252525] border-r border-[#3d3d3d] flex flex-col shrink-0">
      {/* View Switcher - 38px */}
      <div className="h-[38px] flex border-b border-[#3d3d3d] shrink-0">
        <button
          onClick={() => setActiveView('collections')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeView === 'collections'
              ? 'text-primary-500 border-b-2 border-primary-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Folder size={14} />
          Коллекции
        </button>
        <button
          onClick={() => setActiveView('history')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeView === 'history'
              ? 'text-primary-500 border-b-2 border-primary-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <HistoryIcon size={14} />
          История
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-2">
        {activeView === 'collections' && (
          <div className="space-y-1">
            <button
              onClick={onAddCollection}
              className="w-full flex items-center gap-2 px-3 py-2 text-primary-500 hover:bg-primary-500/10 rounded transition-colors text-sm"
            >
              <Plus size={14} />
              Новая коллекция
            </button>

            {collections.map(collection => (
              <div key={collection.id} className="space-y-1">
                <button
                  onClick={() => toggleCollection(collection.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#2d2d2d] rounded transition-colors text-sm"
                >
                  {expandedCollections.has(collection.id) ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                  <Folder size={14} className="text-yellow-500" />
                  <span className="flex-1 text-left truncate">{collection.name}</span>
                </button>

                {expandedCollections.has(collection.id) && (
                  <div className="ml-5 space-y-1">
                    {collection.requests.map(request => (
                      <button
                        key={request.id}
                        onClick={() => onSelectRequest(collection.id, request.id)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#2d2d2d] rounded transition-colors text-xs"
                      >
                        <FileText size={12} />
                        <span className={`font-bold ${METHOD_COLORS[request.method] || 'text-gray-400'}`}>
                          {request.method}
                        </span>
                        <span className="flex-1 text-left truncate">{request.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeView === 'history' && (
          <div className="space-y-1">
            {history.length === 0 ? (
              <div className="text-gray-400 text-xs text-center py-4">
                История пуста
              </div>
            ) : (
              history.map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelectHistory(item)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#2d2d2d] rounded transition-colors text-xs"
                >
                  <span className={`font-bold ${METHOD_COLORS[item.request.method] || 'text-gray-400'}`}>
                    {item.request.method}
                  </span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="truncate">{item.request.name || item.request.url}</div>
                    <div className="text-[11px] text-gray-500">
                      {new Date(item.timestamp).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <span className={`text-[11px] ${
                    item.response.status < 300 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {item.response.status}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};