import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { Folder, Clock, Plus, ChevronRight, ChevronDown, Play, Trash2, Search, GripVertical, Pencil, Copy } from 'lucide-react';
import { Collection, HistoryItem, HttpRequest } from '../types';
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
  onRunRequest: (request: HttpRequest, collectionName: string) => void;
  onUpdateCollections: (collections: Collection[]) => void;
  onRenameRequest: (collectionId: string, requestId: string, newName: string) => void;
  onDeleteRequest: (collectionId: string, requestId: string) => void;
  onDuplicateRequest: (collectionId: string, requestId: string) => void;
  onRenameCollection: (collectionId: string, newName: string) => void;
  onDeleteCollection: (collectionId: string) => void;
}

// ============================================================
// REQUEST ITEM
// ============================================================
const RequestItem = memo(({
  request,
  collectionId,
  collectionName,
  isDragging,
  isEditing,
  onSelect,
  onRun,
  onDragStart,
  onDragEnd,
  onFinishEdit,
  onCancelEdit,
  onContextMenu,
}: {
  request: HttpRequest;
  collectionId: string;
  collectionName: string;
  isDragging: boolean;
  isEditing: boolean;
  onSelect: (collectionId: string, requestId: string) => void;
  onRun: (request: HttpRequest, collectionName: string) => void;
  onDragStart: (e: React.DragEvent, requestId: string, collectionId: string) => void;
  onDragEnd: () => void;
  onFinishEdit: (newName: string) => void;
  onCancelEdit: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState(request.name);

  useEffect(() => {
    if (isEditing) {
      setEditValue(request.name);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isEditing, request.name]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = editValue.trim();
      if (trimmed && trimmed !== request.name) {
        onFinishEdit(trimmed);
      } else {
        onCancelEdit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit();
    }
  };

  const handleBlur = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== request.name) {
      onFinishEdit(trimmed);
    } else {
      onCancelEdit();
    }
  };

  if (isEditing) {
    return (
      <div className="group flex items-center gap-2 px-2 py-1.5 text-xs bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
        <GripVertical size={12} className="text-gray-600 opacity-30 shrink-0" />
        <span className={`font-bold text-[10px] w-10 shrink-0 ${getMethodColor(request.method)}`}>
          {request.method}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="flex-1 min-w-0 bg-[#1e1e1e] border border-indigo-500/50 rounded px-1.5 py-0.5 text-xs text-gray-200 outline-none"
        />
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, request.id, collectionId)}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      className={`group relative flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-all cursor-pointer ${isDragging ? 'opacity-50' : ''
        }`}
      onClick={() => onSelect(collectionId, request.id)}
      title={`${request.name}\n\n${request.method} ${request.url || '—'}\n\nПравый клик — меню`}
    >
      <GripVertical size={12} className="text-gray-600 cursor-grab active:cursor-grabbing shrink-0" />

      <span className={`font-bold text-[10px] w-10 shrink-0 ${getMethodColor(request.method)}`}>
        {request.method}
      </span>

      {/* Название — занимает всю оставшуюся ширину */}
      <span className="flex-1 truncate min-w-0 pr-1">
        {request.name}
      </span>

      {/* Только иконка Play — абсолютно позиционирована справа */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRun(request, collectionName);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
        aria-label="Запустить в Runner"
        title="Запустить в Runner"
      >
        <Play size={12} />
      </button>
    </div>
  );
});
RequestItem.displayName = 'RequestItem';

// ============================================================
// CONTEXT MENU
// ============================================================
interface ContextMenuProps {
  x: number;
  y: number;
  items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[];
  onClose: () => void;
}

const ContextMenu = memo(({ x, y, items, onClose }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Регулируем позицию, чтобы меню не уходило за край экрана
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 180);

  return (
    <div
      ref={menuRef}
      className="fixed z-[500] bg-[#252525] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-2xl py-1 min-w-[200px] animate-scale-in"
      style={{ left: adjustedX, top: adjustedY }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-all text-left ${item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-gray-300 hover:bg-white/5'
            }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
});
ContextMenu.displayName = 'ContextMenu';

// ============================================================
// COLLECTION ITEM
// ============================================================
const CollectionItem = memo(({
  collection,
  isExpanded,
  isDragOver,
  draggedRequestId,
  editingRequestId,
  onToggle,
  onSelectRequest,
  onRunRequest,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onFinishEditRequest,
  onCancelEditRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onRequestContextMenu,
  onCollectionContextMenu,
}: {
  collection: Collection;
  isExpanded: boolean;
  isDragOver: boolean;
  draggedRequestId: string | null;
  editingRequestId: string | null;
  onToggle: (id: string) => void;
  onSelectRequest: (collectionId: string, requestId: string) => void;
  onRunRequest: (request: HttpRequest, collectionName: string) => void;
  onDragStart: (e: React.DragEvent, requestId: string, collectionId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, collectionId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, collectionId: string) => void;
  onFinishEditRequest: (requestId: string, newName: string) => void;
  onCancelEditRequest: () => void;
  onDeleteRequest: (requestId: string) => void;
  onDuplicateRequest: (requestId: string) => void;
  onRequestContextMenu: (e: React.MouseEvent, requestId: string) => void;
  onCollectionContextMenu: (e: React.MouseEvent) => void;
}) => (
  <div>
    <button
      onClick={() => onToggle(collection.id)}
      onContextMenu={onCollectionContextMenu}
      onDragOver={(e) => onDragOver(e, collection.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, collection.id)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs transition-all rounded-lg ${isDragOver
          ? 'bg-indigo-500/20 border border-indigo-500/40'
          : 'text-gray-300 hover:bg-white/5'
        }`}
      title="Правый клик — меню коллекции"
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
            isEditing={editingRequestId === request.id}
            onSelect={onSelectRequest}
            onRun={onRunRequest}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onFinishEdit={(newName) => onFinishEditRequest(request.id, newName)}
            onCancelEdit={onCancelEditRequest}
            onContextMenu={(e) => onRequestContextMenu(e, request.id)}
          />
        ))}
        {collection.requests.length === 0 && (
          <div className="text-[10px] text-gray-600 italic px-2 py-1">
            Пустая коллекция
          </div>
        )}
      </div>
    )}
  </div>
));
CollectionItem.displayName = 'CollectionItem';

// ============================================================
// HISTORY ITEM
// ============================================================
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
  onRenameRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onRenameCollection,
  onDeleteCollection,
}) => {
  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedRequest, setDraggedRequest] = useState<{ requestId: string; collectionId: string } | null>(null);
  const [dragOverCollection, setDragOverCollection] = useState<string | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[];
  } | null>(null);

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

  const filteredHistory = useMemo(() => {
    if (!lowerQuery) return history;
    return history.filter(item =>
      item.request.name.toLowerCase().includes(lowerQuery) ||
      item.request.url.toLowerCase().includes(lowerQuery) ||
      item.request.method.toLowerCase().includes(lowerQuery)
    );
  }, [history, lowerQuery]);

  // ============================================================
  // Drag-and-Drop
  // ============================================================
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

    const newRequest: HttpRequest = {
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

  // ============================================================
  // Context Menu
  // ============================================================
  const handleRequestContextMenu = useCallback((e: React.MouseEvent, requestId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const collection = collections.find(c => c.requests.some(r => r.id === requestId));
    if (!collection) return;

    const request = collection.requests.find(r => r.id === requestId);

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Переименовать',
          icon: <Pencil size={12} />,
          onClick: () => setEditingRequestId(requestId),
        },
        {
          label: 'Копировать',
          icon: <Copy size={12} />,
          onClick: () => onDuplicateRequest(collection.id, requestId),
        },
        {
          label: 'Удалить',
          icon: <Trash2 size={12} />,
          onClick: () => {
            if (window.confirm(`Удалить запрос "${request?.name}"?`)) {
              onDeleteRequest(collection.id, requestId);
            }
          },
          danger: true,
        },
      ],
    });
  }, [collections, onDuplicateRequest, onDeleteRequest]);

  const handleCollectionContextMenu = useCallback((e: React.MouseEvent, collectionId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Переименовать коллекцию',
          icon: <Pencil size={12} />,
          onClick: () => {
            const newName = window.prompt('Новое название коллекции:', collection.name);
            if (newName && newName.trim() && newName.trim() !== collection.name) {
              onRenameCollection(collectionId, newName.trim());
            }
          },
        },
        {
          label: 'Удалить коллекцию',
          icon: <Trash2 size={12} />,
          onClick: () => {
            if (window.confirm(`Удалить коллекцию "${collection.name}" со всеми запросами?`)) {
              onDeleteCollection(collectionId);
            }
          },
          danger: true,
        },
      ],
    });
  }, [collections, onRenameCollection, onDeleteCollection]);

  // ============================================================
  // Edit Request
  // ============================================================
  const handleFinishEditRequest = useCallback((requestId: string, newName: string) => {
    const collection = collections.find(c => c.requests.some(r => r.id === requestId));
    if (collection) {
      onRenameRequest(collection.id, requestId, newName);
    }
    setEditingRequestId(null);
  }, [collections, onRenameRequest]);

  const handleCancelEditRequest = useCallback(() => {
    setEditingRequestId(null);
  }, []);

  return (
    <div className="w-72 bg-[#1e1e1e] border-r border-[rgba(255,255,255,0.08)] flex flex-col h-full">
      <div className="flex border-b border-[rgba(255,255,255,0.08)]">
        <button
          onClick={() => { setActiveTab('collections'); setSearchQuery(''); }}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium transition-all ${activeTab === 'collections'
              ? 'text-gray-200 bg-[#252525] border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-300'
            }`}
        >
          <Folder size={14} />
          Коллекции
        </button>
        <button
          onClick={() => { setActiveTab('history'); setSearchQuery(''); }}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium transition-all ${activeTab === 'history'
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
                  editingRequestId={editingRequestId}
                  onToggle={toggleCollection}
                  onSelectRequest={onSelectRequest}
                  onRunRequest={onRunRequest}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onFinishEditRequest={handleFinishEditRequest}
                  onCancelEditRequest={handleCancelEditRequest}
                  onDeleteRequest={(requestId) => onDeleteRequest(collection.id, requestId)}
                  onDuplicateRequest={(requestId) => onDuplicateRequest(collection.id, requestId)}
                  onRequestContextMenu={handleRequestContextMenu}
                  onCollectionContextMenu={(e) => handleCollectionContextMenu(e, collection.id)}
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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};