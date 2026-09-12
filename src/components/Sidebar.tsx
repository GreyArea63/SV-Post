import React, { useState, useMemo } from 'react';
import { Folder, Clock, Plus, ChevronRight, ChevronDown, Play, Trash2, Search } from 'lucide-react';
import { Collection, HistoryItem } from '../types';
import { formatTime } from '../utils/helpers';
import { getMethodColor } from '../utils/methodColors';

interface SidebarProps {
  collections: Collection[];
  history: HistoryItem[];
  onSelectRequest: (collectionId: string, requestId: string) => void;
  onSelectHistory: (item: HistoryItem) => void;
  onDeleteHistory: (id: string) => void;
  onAddCollection: () => void;
  onRunRequest: (request: Collection['requests'][0], collectionName: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  history,
  onSelectRequest,
  onSelectHistory,
  onDeleteHistory,
  onAddCollection,
  onRunRequest,
}) => {
  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const toggleCollection = (id: string) => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCollections(newExpanded);
  };

  const lowerQuery = searchQuery.toLowerCase();

  const filteredCollections = useMemo(() => {
    if (!lowerQuery) return collections;
    return collections.filter(collection =>
      collection.name.toLowerCase().includes(lowerQuery) ||
      collection.requests.some(r => 
        r.name.toLowerCase().includes(lowerQuery) ||
        r.url.toLowerCase().includes(lowerQuery)
      )
    );
  }, [collections, lowerQuery]);

  const filteredHistory = useMemo(() => {
    if (!lowerQuery) return history;
    return history.filter(item => 
      item.request.name.toLowerCase().includes(lowerQuery) ||
      item.request.url.toLowerCase().includes(lowerQuery) ||
      item.request.method.toLowerCase().includes(lowerQuery)
    );
  }, [history, lowerQuery]);

  // Авто-раскрытие при поиске
  const isExpanded = (collectionId: string) => {
    if (searchQuery) return true;
    return expandedCollections.has(collectionId);
  };

  return (
    <div className="w-72 bg-[#1e1e1e] border-r border-[rgba(255,255,255,0.08)] flex flex-col h-full">
      <div className="flex border-b border-[rgba(255,255,255,0.08)]">
        <button
          onClick={() => { setActiveTab('collections'); setSearchQuery(''); }}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium transition-all ${
            activeTab === 'collections'
              ? 'text-gray-200 bg-[#252525] border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Folder size={14} />
          Коллекции
        </button>
        <button
          onClick={() => { setActiveTab('history'); setSearchQuery(''); }}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium transition-all ${
            activeTab === 'history'
              ? 'text-gray-200 bg-[#252525] border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Clock size={14} />
          История
        </button>
      </div>

      <div className="p-3 border-b border-[rgba(255,255,255,0.08)]">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'collections' && (
          <div className="p-2">
            <button
              onClick={onAddCollection}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-all mb-3"
            >
              <Plus size={14} />
              Новая коллекция
            </button>

            <div className="space-y-1">
              {filteredCollections.map(collection => (
                <div key={collection.id}>
                  <button
                    onClick={() => toggleCollection(collection.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-all"
                  >
                    {isExpanded(collection.id) ? (
                      <ChevronDown size={12} className="text-gray-500" />
                    ) : (
                      <ChevronRight size={12} className="text-gray-500" />
                    )}
                    <Folder size={12} className="text-amber-400" />
                    <span className="flex-1 text-left truncate">{collection.name}</span>
                    <span className="text-[10px] text-gray-500">{collection.requests.length}</span>
                  </button>

                  {isExpanded(collection.id) && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {collection.requests.map(request => (
                        <div
                          key={request.id}
                          className="group flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                          onClick={() => onSelectRequest(collection.id, request.id)}
                        >
                          <span className={`font-bold text-[10px] w-10 ${getMethodColor(request.method)}`}>
                            {request.method}
                          </span>
                          <span className="flex-1 truncate">{request.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunRequest(request, collection.name);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all"
                            aria-label="Запустить в Runner"
                          >
                            <Play size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {filteredCollections.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-500">
                  <Folder size={32} className="mx-auto mb-2 opacity-30" />
                  <p>{collections.length === 0 ? 'Нет коллекций' : 'Ничего не найдено'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-2">
            <div className="space-y-1">
              {filteredHistory.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectHistory(item)}
                  className="w-full flex items-start gap-2 px-2 py-2 text-xs text-left hover:bg-white/5 rounded-lg transition-all group"
                >
                  <span className={`font-bold text-[10px] w-10 shrink-0 ${getMethodColor(item.request.method)}`}>
                    {item.request.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-300 truncate font-medium">{item.request.name}</div>
                    <div className="text-gray-500 truncate text-[10px]">{item.request.url}</div>
                    <div className="text-gray-600 text-[10px] mt-0.5">
                      {formatTime(item.timestamp)} • {item.response?.status || '---'}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHistory(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                    aria-label="Удалить из истории"
                  >
                    <Trash2 size={10} />
                  </button>
                </button>
              ))}

              {filteredHistory.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-500">
                  <Clock size={32} className="mx-auto mb-2 opacity-30" />
                  <p>{history.length === 0 ? 'История пуста' : 'Ничего не найдено'}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};