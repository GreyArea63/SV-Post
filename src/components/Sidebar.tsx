import React, { useState } from 'react';
import { Folder, Plus, ChevronRight, ChevronDown, FileText, History as HistoryIcon, Play, Search } from 'lucide-react';
import { Collection, HistoryItem, HttpRequest } from '../types';

interface SidebarProps {
  collections: Collection[];
  history: HistoryItem[];
  onSelectRequest: (collectionId: string, requestId: string) => void;
  onSelectHistory: (item: HistoryItem) => void;
  onAddCollection: () => void;
  onRunRequest: (request: HttpRequest, collectionName: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  collections, 
  history, 
  onSelectRequest, 
  onSelectHistory, 
  onAddCollection, 
  onRunRequest 
}) => {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<'collections' | 'history'>('collections');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleCollection = (id: string) => {
    const newExpanded = new Set(expandedCollections);
    newExpanded.has(id) ? newExpanded.delete(id) : newExpanded.add(id);
    setExpandedCollections(newExpanded);
  };

  const METHOD_COLORS: Record<string, string> = { 
    GET: 'text-emerald-400', 
    POST: 'text-amber-400', 
    PUT: 'text-blue-400', 
    PATCH: 'text-purple-400', 
    DELETE: 'text-red-400',
    HEAD: 'text-gray-400',
    OPTIONS: 'text-orange-400'
  };

  const METHOD_BG: Record<string, string> = { 
    GET: 'bg-emerald-500/10', 
    POST: 'bg-amber-500/10', 
    PUT: 'bg-blue-500/10', 
    PATCH: 'bg-purple-500/10', 
    DELETE: 'bg-red-500/10',
    HEAD: 'bg-gray-500/10',
    OPTIONS: 'bg-orange-500/10'
  };

  const filteredCollections = collections.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.requests.some(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredHistory = history.filter(h => 
    h.request.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.request.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-[280px] bg-[#1a1a23] border-r border-[rgba(255,255,255,0.08)] flex flex-col shrink-0 animate-slide-in">
      {/* Header */}
      <div className="h-[38px] flex border-b border-[rgba(255,255,255,0.08)] shrink-0">
        <button 
          onClick={() => setActiveView('collections')} 
          className={`flex-1 px-3 py-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeView === 'collections' 
              ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' 
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          }`}
        >
          <Folder size={14} /> Коллекции
        </button>
        <button 
          onClick={() => setActiveView('history')} 
          className={`flex-1 px-3 py-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeView === 'history' 
              ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' 
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          }`}
        >
          <HistoryIcon size={14} /> История
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-[rgba(255,255,255,0.08)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск..."
            className="w-full pl-9 pr-3 py-2 bg-[#252532] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-gray-600"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-2">
        {activeView === 'collections' && (
          <div className="space-y-1">
            <button 
              onClick={onAddCollection} 
              className="w-full flex items-center gap-2 px-3 py-2.5 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all text-sm font-medium group"
            >
              <Plus size={14} className="group-hover:scale-110 transition-transform" /> 
              Новая коллекция
            </button>
            
            {filteredCollections.map(collection => (
              <div key={collection.id} className="space-y-1 animate-fade-in">
                <button
                  onClick={() => toggleCollection(collection.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg transition-all text-sm group"
                >
                  {expandedCollections.has(collection.id) ? (
                    <ChevronDown size={14} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400" />
                  )}
                  <Folder size={14} className="text-amber-400" />
                  <span className="flex-1 text-left truncate text-gray-300 group-hover:text-white transition-colors">
                    {collection.name}
                  </span>
                  <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                    {collection.requests.length}
                  </span>
                </button>
                
                {expandedCollections.has(collection.id) && (
                  <div className="ml-4 space-y-1 border-l-2 border-white/5 pl-2">
                    {collection.requests.map(request => (
                      <div key={request.id} className="flex items-center group/item">
                        <button
                          onClick={() => onSelectRequest(collection.id, request.id)}
                          className="flex-1 flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded transition-all text-xs"
                        >
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${METHOD_COLORS[request.method]} ${METHOD_BG[request.method]}`}>
                            {request.method}
                          </span>
                          <span className="flex-1 text-left truncate text-gray-400 group-hover/item:text-white transition-colors">
                            {request.name}
                          </span>
                        </button>
                        
                        <button
                          onClick={() => onRunRequest(request, collection.name)}
                          className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded opacity-0 group-hover/item:opacity-100 transition-all"
                          title="Запустить Runner"
                        >
                          <Play size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {filteredCollections.length === 0 && (
              <div className="text-center text-gray-500 py-8 text-sm">
                {searchQuery ? 'Ничего не найдено' : 'Нет коллекций'}
              </div>
            )}
          </div>
        )}
        
        {activeView === 'history' && (
          <div className="space-y-1">
            {filteredHistory.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-8">
                {searchQuery ? 'Ничего не найдено' : 'История пуста'}
              </div>
            ) : (
              filteredHistory.map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelectHistory(item)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg transition-all text-xs group animate-fade-in"
                >
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${METHOD_COLORS[item.request.method]} ${METHOD_BG[item.request.method]}`}>
                    {item.request.method}
                  </span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="truncate text-gray-300 group-hover:text-white transition-colors">
                      {item.request.name || item.request.url}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      {new Date(item.timestamp).toLocaleString('ru-RU', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit'
                      })}
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    item.response.status < 300 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
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