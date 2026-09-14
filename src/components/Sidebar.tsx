import { useState, useMemo, useCallback, memo } from 'react';
import { Folder, Clock, Plus, ChevronRight, ChevronDown, Play, Trash2, Search, GripVertical } from 'lucide-react';
import { Collection, HistoryItem } from '../types';
import { formatDate } from '../utils/helpers';
import { getMethodColor } from '../utils/methodColors';

// ============================================================
// ТИПЫ
// ============================================================
interface SidebarProps {
  collections: Collection[];
  history: HistoryItem[];
  onSelectRequest: (collectionId: string, requestId: string) => void;
  onSelectHistory: (item: HistoryItem) => void;
  onDeleteHistory: (id: string) => void;
  onAddCollection: () => void;
  onRunRequest: (request: Collection['requests'][0], collectionName: string) => void;
  onUpdateCollections: (collections: Collection[]) => void;
}

// ============================================================
// МЕМOИЗИРОВАННЫЕ КОМПОНЕНТЫ
// ============================================================

// Элемент запроса
const RequestItem = memo(({
  request,
  collectionId,
  collectionName,
  isDragging,
  onSelect,
  onRun,
  onDragStart,
  onDragEnd,
}: {
  request: Collection['requests'][0];
  collectionId: string;
  collectionName: string;
  isDragging: boolean;
  onSelect: (collectionId: string, requestId: string) => void;
  onRun: (request: Collection['requests'][0], collectionName: string) => void;
  onDragStart: (e: React.DragEvent, requestId: string, collectionId: string) => void;
  onDragEnd: () => void;
}) => (
  <div
    draggable
    onDragStart={(e) => onDragStart(e, request.id, collectionId)}
    onDragEnd={onDragEnd}
    className={`group flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-all cursor-pointer ${
      isDragging ? 'opacity-50' : ''
    }`}
    onClick={() => onSelect(collectionId, request.id)}
  >
    <GripVertical size={12} className="text-gray-600 cursor-grab active:cursor-grabbing" />
    <span className={`font-bold text-[10px] w-10 ${getMethodColor(request.method)}`}>
      {request.method}
    </span>
    <span className="flex-1 truncate">{request.name}</span>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRun(request, collectionName);
      }}
      className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all"
      aria-label="Запустить в Runner"
    >
      <Play size={10} />
    </button>
  </div>
));
RequestItem.displayName = 'RequestItem';

// Элемент коллекции
const CollectionItem = memo(({
  collection,
  isExpanded,
  isDragOver,
  draggedRequestId,
  onToggle,
  onSelectRequest,
  onRunRequest,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  collection: Collection;
  isExpanded: boolean;
  isDragOver: boolean;
  draggedRequestId: string | null;
  onToggle: (id: string) => void;
  onSelectRequest: (collectionId: string, requestId: string) => void;
  onRunRequest: (request: Collection['requests'][0], collectionName: string) => void;
  onDragStart: (e: React.DragEvent, requestId: string, collectionId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, collectionId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, collectionId: string) => void;
}) => (
  <div>
    <button
      onClick={() => onToggle(collection.id)}
      onDragOver={(e) => onDragOver(e, collection.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, collection.id)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs transition-all rounded-lg ${
        isDragOver
          ? 'bg-indigo-500/20 border border-indigo-500/40'
          : 'text-gray-300 hover:bg-white/5'
      }`}
    >
      {isExpanded ? (
        <ChevronDown size={12} className="text-gray-500" />
      ) : (
        <ChevronRight size={12} className="text-gray-500" />
      )}
      <Folder size={12} className="text-amber-400" />
      <span className="flex-1 text-left truncate">{collection.name}</span>
      <span className="text-[10px] text-gray-500">{collection.requests.length}</span>
    </button>

    {isExpanded && (
      <div className="ml-6 mt-1 space-y-0.5">
        {collection.requests.map(request => (
          <RequestItem
            key={request.id}
            request={request}
            collectionId={collection.id}
            collectionName={collection.name}
            isDragging={draggedRequestId === request.id}
            onSelect={onSelectRequest}
            onRun={onRunRequest}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    )}
  </div>
));
CollectionItem.displayName = 'CollectionItem';

// Элемент истории
const HistoryItemComponent = memo(({
  item,
  onSelect,
  onDelete,
}: {
  item: HistoryItem;
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}) => (
  <button
    onClick={() => onSelect(item)}
    className="w-full flex items-start gap-2 px-2 py-2 text-xs text-left hover:bg-white/5 rounded-lg transition-all group"
  >
    <span className={`font-bold text-[10px] w-10 shrink-0 ${getMethodColor(item.request.method)}`}>
      {item.request.method}
    </span>
    <div className="flex-1 min-w-0">
      <div className="text-gray-300 truncate font-medium">{item.request.name}</div>
      <div className="text-gray-500 truncate text-[10px]">{item.request.url}</div>
      <div className="text-gray-600 text-[10px] mt-0.5">
        {formatDate(item.timestamp)} • {item.response?.status || '---'}
      </div>
    </div>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDelete(item.id);
      }}
      className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
      aria-label="Удалить из истории"
    >
      <Trash2 size={10} />
    </button>
  </button>
));
HistoryItemComponent.displayName = 'HistoryItemComponent';

// ============================================================
// ГЛАВНЫЙ КОМПОНЕНТ
// ============================================================
export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  history,
  onSelectRequest,
  onSelectHistory,
  onDeleteHistory,
  onAddCollection,
  onRunRequest,
  onUpdateCollections,
}) => {
  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedRequest, setDraggedRequest] = useState<{ requestId: string; collectionId: string } | null>(null);
  const [dragOverCollection, setDragOverCollection] = useState<string | null>(null);

  const toggleCollection = useCallback((id: string) => {
    setExpandedCollections(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return newExpanded;
    });
  }, []);

  const lowerQuery = searchQuery.toLowerCase();

  // Мемоизация отфильтрованных коллекций
  const filteredCollections = useMemo(() => {
    if (!lowerQuery) return collections;
    
    return collections.map(collection => {
      const filteredRequests = collection.requests.filter(request =>
        request.name.toLowerCase().includes(lowerQuery) ||
        request.url.toLowerCase().includes(lowerQuery) ||
        request.method.toLowerCase().includes(lowerQuery)
      );
      
      if (collection.name.toLowerCase().includes(lowerQuery) || filteredRequests.length > 0) {
        return {
          ...collection,
          requests: filteredRequests.length > 0 ? filteredRequests : collection.requests,
        };
      }
      return null;
    }).filter(Boolean) as Collection[];
  }, [collections, lowerQuery]);

  const isExpanded = useCallback((collectionId: string) => {
    if (searchQuery) return true;
    return expandedCollections.has(collectionId);
  }, [searchQuery, expandedCollections]);

  // Мемоизация отфильтрованной истории
  const filteredHistory = useMemo(() => {
    if (!lowerQuery) return history;
    return history.filter(item => 
      item.request.name.toLowerCase().includes(lowerQuery) ||
      item.request.url.toLowerCase().includes(lowerQuery) ||
      item.request.method.toLowerCase().includes(lowerQuery)
    );
  }, [history, lowerQuery]);

  // Drag-and-Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, requestId: string, collectionId: string) => {
    setDraggedRequest({ requestId, collectionId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ requestId, collectionId }));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCollection(collectionId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCollection(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetCollectionId: string) => {
    e.preventDefault();
    setDragOverCollection(null);
    
    if (!draggedRequest) return;
    
    const { requestId, collectionId: sourceCollectionId } = draggedRequest;
    
    if (sourceCollectionId === targetCollectionId) {
      setDraggedRequest(null);
      return;
    }
    
    const sourceCollection = collections.find(c => c.id === sourceCollectionId);
    const targetCollection = collections.find(c => c.id === targetCollectionId);
    
    if (!sourceCollection || !targetCollection) {
      setDraggedRequest(null);
      return;
    }
    
    const request = sourceCollection.requests.find(r => r.id === requestId);
    if (!request) {
      setDraggedRequest(null);
      return;
    }
    
    const newRequest = {
      ...request,
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
    };
    
    const updatedSourceCollection = {
      ...sourceCollection,
      requests: sourceCollection.requests.filter(r => r.id !== requestId),
    };
    
    const updatedTargetCollection = {
      ...targetCollection,
      requests: [...targetCollection.requests, newRequest],
    };
    
    const updatedCollections = collections.map(c => {
      if (c.id === sourceCollectionId) return updatedSourceCollection;
      if (c.id === targetCollectionId) return updatedTargetCollection;
      return c;
    });
    
    onUpdateCollections(updatedCollections);
    setDraggedRequest(null);
  }, [draggedRequest, collections, onUpdateCollections]);

  const handleDragEnd = useCallback(() => {
    setDraggedRequest(null);
    setDragOverCollection(null);
  }, []);

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
                <CollectionItem
                  key={collection.id}
                  collection={collection}
                  isExpanded={isExpanded(collection.id)}
                  isDragOver={dragOverCollection === collection.id}
                  draggedRequestId={draggedRequest?.requestId || null}
                  onToggle={toggleCollection}
                  onSelectRequest={onSelectRequest}
                  onRunRequest={onRunRequest}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />
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
              {filteredHistory.map(item => (
                <HistoryItemComponent
                  key={item.id}
                  item={item}
                  onSelect={onSelectHistory}
                  onDelete={onDeleteHistory}
                />
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