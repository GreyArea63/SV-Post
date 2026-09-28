import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { Folder, FolderOpen, Clock, Plus, ChevronRight, ChevronDown, Play, Trash2, Search, GripVertical, Pencil, Copy } from 'lucide-react';
import { Collection, CollectionFolder, HistoryItem, HttpRequest } from '../types';
import { formatDate } from '../utils/helpers';
import { getMethodColor } from '../utils/methodColors';

interface SidebarProps {
  collections: Collection[];
  history: HistoryItem[];
  onSelectRequest: (collectionId: string, requestId: string, folderId?: string) => void;
  onSelectHistory: (item: HistoryItem) => void;
  onDeleteHistory: (id: string) => void;
  onAddCollection: () => void;
  onRunRequest: (request: HttpRequest, collectionName: string) => void;
  onUpdateCollections: (collections: Collection[]) => void;
  onRenameRequest: (collectionId: string, requestId: string, newName: string, folderId?: string) => void;
  onDeleteRequest: (collectionId: string, requestId: string, folderId?: string) => void;
  onDuplicateRequest: (collectionId: string, requestId: string, folderId?: string) => void;
  onRenameCollection: (collectionId: string, newName: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onCreateFolder: (collectionId: string, parentFolderId: string | null, name: string) => void;
  onRenameFolder: (collectionId: string, folderId: string, newName: string) => void;
  onDeleteFolder: (collectionId: string, folderId: string) => void;
  onMoveRequest: (
    sourceCollectionId: string,
    sourceFolderId: string | null,
    requestId: string,
    targetCollectionId: string,
    targetFolderId: string | null
  ) => void;
}

type DraggedItem = {
  type: 'request' | 'folder';
  id: string;
  collectionId: string;
  folderId: string | null;
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function findFolderInCollection(
  collection: Collection,
  folderId: string
): CollectionFolder | null {
  const search = (folders: CollectionFolder[]): CollectionFolder | null => {
    for (const f of folders) {
      if (f.id === folderId) return f;
      const found = search(f.folders);
      if (found) return found;
    }
    return null;
  };
  return search(collection.folders);
}

function findFolderWithRequest(
  collection: Collection,
  requestId: string
): CollectionFolder | null {
  const search = (folders: CollectionFolder[]): CollectionFolder | null => {
    for (const f of folders) {
      if (f.requests.some(r => r.id === requestId)) return f;
      const found = search(f.folders);
      if (found) return found;
    }
    return null;
  };
  return search(collection.folders);
}

function findRequestInFolder(
  collection: Collection,
  folderId: string,
  requestId: string
): HttpRequest | null {
  const folder = findFolderInCollection(collection, folderId);
  if (!folder) return null;
  return folder.requests.find(r => r.id === requestId) || null;
}

// ============================================================
// REQUEST ITEM
// ============================================================
const RequestItem = memo(({
  request,
  collectionId,
  collectionName,
  folderId,
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
  folderId: string | null;
  isDragging: boolean;
  isEditing: boolean;
  onSelect: (collectionId: string, requestId: string, folderId?: string) => void;
  onRun: (request: HttpRequest, collectionName: string) => void;
  onDragStart: (e: React.DragEvent, requestId: string, collectionId: string, folderId: string | null) => void;
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
      onDragStart={(e) => onDragStart(e, request.id, collectionId, folderId)}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      className={`group relative flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-all cursor-pointer ${isDragging ? 'opacity-50' : ''
        }`}
      onClick={() => onSelect(collectionId, request.id, folderId || undefined)}
      title={`${request.name}\n\n${request.method} ${request.url || '—'}\n\nПравый клик — меню`}
    >
      <GripVertical size={12} className="text-gray-600 cursor-grab active:cursor-grabbing shrink-0" />
      <span className={`font-bold text-[10px] w-10 shrink-0 ${getMethodColor(request.method)}`}>
        {request.method}
      </span>
      <span className="flex-1 truncate min-w-0 pr-1">
        {request.name}
      </span>
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
// FOLDER ITEM (рекурсивный)
// ============================================================
const FolderItem = memo(({
  folder,
  collectionId,
  collectionName,
  expandedFolders,
  draggedItem,
  editingRequestId,
  editingFolderId,
  dragOverTarget,
  onToggleFolder,
  onSelectRequest,
  onRunRequest,
  onDragStartRequest,
  onDragEnd,
  onDragStartFolder,
  onDropOnFolder,
  onDragOverFolder,
  onDragLeaveFolder,
  onFinishEditRequest,
  onCancelEditRequest,
  onFinishEditFolder,
  onCancelEditFolder,
  onRequestContextMenu,
  onFolderContextMenu,
}: {
  folder: CollectionFolder;
  collectionId: string;
  collectionName: string;
  expandedFolders: Set<string>;
  draggedItem: DraggedItem | null;
  editingRequestId: string | null;
  editingFolderId: string | null;
  dragOverTarget: string | null;
  onToggleFolder: (id: string) => void;
  onSelectRequest: (collectionId: string, requestId: string, folderId?: string) => void;
  onRunRequest: (request: HttpRequest, collectionName: string) => void;
  onDragStartRequest: (e: React.DragEvent, requestId: string, collectionId: string, folderId: string | null) => void;
  onDragEnd: () => void;
  onDragStartFolder: (e: React.DragEvent, folderId: string, collectionId: string) => void;
  onDropOnFolder: (e: React.DragEvent, folderId: string) => void;
  onDragOverFolder: (e: React.DragEvent, folderId: string) => void;
  onDragLeaveFolder: () => void;
  onFinishEditRequest: (requestId: string, newName: string) => void;
  onCancelEditRequest: () => void;
  onFinishEditFolder: (folderId: string, newName: string) => void;
  onCancelEditFolder: () => void;
  onRequestContextMenu: (e: React.MouseEvent, requestId: string, folderId: string | null) => void;
  onFolderContextMenu: (e: React.MouseEvent, folderId: string) => void;
}) => {
  const isExpanded = expandedFolders.has(folder.id);
  const isDragOver = dragOverTarget === folder.id;
  const isEditing = editingFolderId === folder.id;
  const [editValue, setEditValue] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(folder.name);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isEditing, folder.name]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = editValue.trim();
      if (trimmed && trimmed !== folder.name) {
        onFinishEditFolder(folder.id, trimmed);
      } else {
        onCancelEditFolder();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEditFolder();
    }
  };

  const handleBlur = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== folder.name) {
      onFinishEditFolder(folder.id, trimmed);
    } else {
      onCancelEditFolder();
    }
  };

  const totalItems = folder.requests.length + folder.folders.length;

  return (
    <div>
      {isEditing ? (
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
          <GripVertical size={12} className="text-gray-600 opacity-30 shrink-0" />
          <Folder size={12} className="text-amber-400 shrink-0" />
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
      ) : (
        <button
          draggable
          onDragStart={(e) => onDragStartFolder(e, folder.id, collectionId)}
          onDragEnd={onDragEnd}
          onClick={() => onToggleFolder(folder.id)}
          onContextMenu={(e) => onFolderContextMenu(e, folder.id)}
          onDragOver={(e) => onDragOverFolder(e, folder.id)}
          onDragLeave={onDragLeaveFolder}
          onDrop={(e) => onDropOnFolder(e, folder.id)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs transition-all rounded-lg ${isDragOver
            ? 'bg-indigo-500/20 border border-indigo-500/40'
            : 'text-gray-300 hover:bg-white/5'
            }`}
          title="Правый клик — меню папки"
        >
          {isExpanded ? (
            <ChevronDown size={12} className="text-gray-500 shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-gray-500 shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen size={12} className="text-amber-400 shrink-0" />
          ) : (
            <Folder size={12} className="text-amber-400 shrink-0" />
          )}
          <span className="flex-1 text-left truncate">{folder.name}</span>
          <span className="text-[10px] text-gray-500 shrink-0">{totalItems}</span>
        </button>
      )}

      {isExpanded && !isEditing && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-[rgba(255,255,255,0.05)] pl-1">
          {folder.folders.map(subFolder => (
            <FolderItem
              key={subFolder.id}
              folder={subFolder}
              collectionId={collectionId}
              collectionName={collectionName}
              expandedFolders={expandedFolders}
              draggedItem={draggedItem}
              editingRequestId={editingRequestId}
              editingFolderId={editingFolderId}
              dragOverTarget={dragOverTarget}
              onToggleFolder={onToggleFolder}
              onSelectRequest={onSelectRequest}
              onRunRequest={onRunRequest}
              onDragStartRequest={onDragStartRequest}
              onDragEnd={onDragEnd}
              onDragStartFolder={onDragStartFolder}
              onDropOnFolder={onDropOnFolder}
              onDragOverFolder={onDragOverFolder}
              onDragLeaveFolder={onDragLeaveFolder}
              onFinishEditRequest={onFinishEditRequest}
              onCancelEditRequest={onCancelEditRequest}
              onFinishEditFolder={onFinishEditFolder}
              onCancelEditFolder={onCancelEditFolder}
              onRequestContextMenu={onRequestContextMenu}
              onFolderContextMenu={onFolderContextMenu}
            />
          ))}

          {folder.requests.map(request => (
            <RequestItem
              key={request.id}
              request={request}
              collectionId={collectionId}
              collectionName={collectionName}
              folderId={folder.id}
              isDragging={draggedItem?.type === 'request' && draggedItem.id === request.id}
              isEditing={editingRequestId === request.id}
              onSelect={onSelectRequest}
              onRun={onRunRequest}
              onDragStart={onDragStartRequest}
              onDragEnd={onDragEnd}
              onFinishEdit={(newName) => onFinishEditRequest(request.id, newName)}
              onCancelEdit={onCancelEditRequest}
              onContextMenu={(e) => onRequestContextMenu(e, request.id, folder.id)}
            />
          ))}

          {totalItems === 0 && (
            <div className="text-[10px] text-gray-600 italic px-2 py-1">
              Пустая папка
            </div>
          )}
        </div>
      )}
    </div>
  );
});
FolderItem.displayName = 'FolderItem';

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

  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 220);

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
  expandedFolders,
  draggedItem,
  editingRequestId,
  editingFolderId,
  dragOverTarget,
  onToggle,
  onSelectRequest,
  onRunRequest,
  onToggleFolder,
  onDragStartRequest,
  onDragEnd,
  onDragStartFolder,
  onDropOnCollection,
  onDragOverCollection,
  onDragLeaveCollection,
  onDropOnFolder,
  onDragOverFolder,
  onDragLeaveFolder,
  onFinishEditRequest,
  onCancelEditRequest,
  onFinishEditFolder,
  onCancelEditFolder,
  onRequestContextMenu,
  onFolderContextMenu,
  onCollectionContextMenu,
}: {
  collection: Collection;
  isExpanded: boolean;
  isDragOver: boolean;
  expandedFolders: Set<string>;
  draggedItem: DraggedItem | null;
  editingRequestId: string | null;
  editingFolderId: string | null;
  dragOverTarget: string | null;
  onToggle: (id: string) => void;
  onSelectRequest: (collectionId: string, requestId: string, folderId?: string) => void;
  onRunRequest: (request: HttpRequest, collectionName: string) => void;
  onToggleFolder: (id: string) => void;
  onDragStartRequest: (e: React.DragEvent, requestId: string, collectionId: string, folderId: string | null) => void;
  onDragEnd: () => void;
  onDragStartFolder: (e: React.DragEvent, folderId: string, collectionId: string) => void;
  onDropOnCollection: (e: React.DragEvent, collectionId: string) => void;
  onDragOverCollection: (e: React.DragEvent, collectionId: string) => void;
  onDragLeaveCollection: () => void;
  onDropOnFolder: (e: React.DragEvent, folderId: string) => void;
  onDragOverFolder: (e: React.DragEvent, folderId: string) => void;
  onDragLeaveFolder: () => void;
  onFinishEditRequest: (requestId: string, newName: string) => void;
  onCancelEditRequest: () => void;
  onFinishEditFolder: (folderId: string, newName: string) => void;
  onCancelEditFolder: () => void;
  onRequestContextMenu: (e: React.MouseEvent, requestId: string, folderId: string | null) => void;
  onFolderContextMenu: (e: React.MouseEvent, folderId: string) => void;
  onCollectionContextMenu: (e: React.MouseEvent) => void;
}) => {
  const totalItems = collection.requests.length + collection.folders.length;

  return (
    <div>
      <button
        onClick={() => onToggle(collection.id)}
        onContextMenu={onCollectionContextMenu}
        onDragOver={(e) => onDragOverCollection(e, collection.id)}
        onDragLeave={onDragLeaveCollection}
        onDrop={(e) => onDropOnCollection(e, collection.id)}
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
        <span className="text-[10px] text-gray-500">{totalItems}</span>
      </button>

      {isExpanded && (
        <div className="ml-3 mt-1 space-y-0.5 border-l border-[rgba(255,255,255,0.05)] pl-1">
          {collection.folders.map(folder => (
            <FolderItem
              key={folder.id}
              folder={folder}
              collectionId={collection.id}
              collectionName={collection.name}
              expandedFolders={expandedFolders}
              draggedItem={draggedItem}
              editingRequestId={editingRequestId}
              editingFolderId={editingFolderId}
              dragOverTarget={dragOverTarget}
              onToggleFolder={onToggleFolder}
              onSelectRequest={onSelectRequest}
              onRunRequest={onRunRequest}
              onDragStartRequest={onDragStartRequest}
              onDragEnd={onDragEnd}
              onDragStartFolder={onDragStartFolder}
              onDropOnFolder={onDropOnFolder}
              onDragOverFolder={onDragOverFolder}
              onDragLeaveFolder={onDragLeaveFolder}
              onFinishEditRequest={onFinishEditRequest}
              onCancelEditRequest={onCancelEditRequest}
              onFinishEditFolder={onFinishEditFolder}
              onCancelEditFolder={onCancelEditFolder}
              onRequestContextMenu={onRequestContextMenu}
              onFolderContextMenu={onFolderContextMenu}
            />
          ))}

          {collection.requests.map(request => (
            <RequestItem
              key={request.id}
              request={request}
              collectionId={collection.id}
              collectionName={collection.name}
              folderId={null}
              isDragging={draggedItem?.type === 'request' && draggedItem.id === request.id}
              isEditing={editingRequestId === request.id}
              onSelect={onSelectRequest}
              onRun={onRunRequest}
              onDragStart={onDragStartRequest}
              onDragEnd={onDragEnd}
              onFinishEdit={(newName) => onFinishEditRequest(request.id, newName)}
              onCancelEdit={onCancelEditRequest}
              onContextMenu={(e) => onRequestContextMenu(e, request.id, null)}
            />
          ))}

          {totalItems === 0 && (
            <div className="text-[10px] text-gray-600 italic px-2 py-1">
              Пустая коллекция
            </div>
          )}
        </div>
      )}
    </div>
  );
});
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
  onRenameRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onRenameCollection,
  onDeleteCollection,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveRequest,
}) => {
  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[];
  } | null>(null);

  const toggleCollection = useCallback((id: string) => {
    setExpandedCollections(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const isExpanded = useCallback((collectionId: string) => {
    if (searchQuery) return true;
    return expandedCollections.has(collectionId);
  }, [searchQuery, expandedCollections]);

  // Drag & Drop
  const handleDragStartRequest = useCallback((
    e: React.DragEvent,
    requestId: string,
    collectionId: string,
    folderId: string | null
  ) => {
    setDraggedItem({ type: 'request', id: requestId, collectionId, folderId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'request', requestId, collectionId, folderId }));
  }, []);

  const handleDragStartFolder = useCallback((
    e: React.DragEvent,
    folderId: string,
    collectionId: string
  ) => {
    setDraggedItem({ type: 'folder', id: folderId, collectionId, folderId: null });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', folderId, collectionId }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverTarget(null);
  }, []);

  const handleDragOverCollection = useCallback((e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(collectionId);
  }, []);

  const handleDragOverFolder = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(folderId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDropOnCollection = useCallback((e: React.DragEvent, targetCollectionId: string) => {
    e.preventDefault();
    setDragOverTarget(null);
    if (!draggedItem) return;
    if (draggedItem.type === 'request') {
      onMoveRequest(
        draggedItem.collectionId,
        draggedItem.folderId,
        draggedItem.id,
        targetCollectionId,
        null
      );
    }
    setDraggedItem(null);
  }, [draggedItem, onMoveRequest]);

  const handleDropOnFolder = useCallback((e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    if (!draggedItem) return;

    let targetCollectionId: string | null = null;
    for (const c of collections) {
      if (findFolderInCollection(c, targetFolderId)) {
        targetCollectionId = c.id;
        break;
      }
    }
    if (!targetCollectionId) return;

    if (draggedItem.type === 'request') {
      onMoveRequest(
        draggedItem.collectionId,
        draggedItem.folderId,
        draggedItem.id,
        targetCollectionId,
        targetFolderId
      );
    }
    setDraggedItem(null);
  }, [draggedItem, collections, onMoveRequest]);

  // Context Menu
  const handleRequestContextMenu = useCallback((
    e: React.MouseEvent,
    requestId: string,
    folderId: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    let collection: Collection | undefined;
    if (folderId) {
      for (const c of collections) {
        if (findFolderInCollection(c, folderId)) {
          collection = c;
          break;
        }
      }
    } else {
      collection = collections.find(c => c.requests.some(r => r.id === requestId));
    }
    if (!collection) return;

    const request = folderId
      ? findRequestInFolder(collection, folderId, requestId)
      : collection.requests.find(r => r.id === requestId);

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
          onClick: () => onDuplicateRequest(collection!.id, requestId, folderId || undefined),
        },
        {
          label: 'Удалить',
          icon: <Trash2 size={12} />,
          onClick: () => {
            if (window.confirm(`Удалить запрос "${request?.name}"?`)) {
              onDeleteRequest(collection!.id, requestId, folderId || undefined);
            }
          },
          danger: true,
        },
      ],
    });
  }, [collections, onDuplicateRequest, onDeleteRequest]);

  const handleFolderContextMenu = useCallback((e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();

    let collection: Collection | undefined;
    for (const c of collections) {
      if (findFolderInCollection(c, folderId)) {
        collection = c;
        break;
      }
    }
    if (!collection) return;

    const folder = findFolderInCollection(collection, folderId);
    if (!folder) return;

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Новая подпапка',
          icon: <Plus size={12} />,
          onClick: () => onCreateFolder(collection!.id, folderId, ''),
        },
        {
          label: 'Переименовать',
          icon: <Pencil size={12} />,
          onClick: () => setEditingFolderId(folderId),
        },
        {
          label: 'Удалить папку',
          icon: <Trash2 size={12} />,
          onClick: () => {
            if (window.confirm(`Удалить папку "${folder.name}" и всё её содержимое?`)) {
              onDeleteFolder(collection!.id, folderId);
            }
          },
          danger: true,
        },
      ],
    });
  }, [collections, onCreateFolder, onDeleteFolder]);

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
          label: 'Новая папка',
          icon: <Plus size={12} />,
          onClick: () => onCreateFolder(collectionId, null, ''),
        },
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
            if (window.confirm(`Удалить коллекцию "${collection.name}" со всем содержимым?`)) {
              onDeleteCollection(collectionId);
            }
          },
          danger: true,
        },
      ],
    });
  }, [collections, onCreateFolder, onRenameCollection, onDeleteCollection]);

  const handleFinishEditRequest = useCallback((requestId: string, newName: string) => {
    for (const c of collections) {
      if (c.requests.some(r => r.id === requestId)) {
        onRenameRequest(c.id, requestId, newName);
        setEditingRequestId(null);
        return;
      }
      const folder = findFolderWithRequest(c, requestId);
      if (folder) {
        onRenameRequest(c.id, requestId, newName, folder.id);
        setEditingRequestId(null);
        return;
      }
    }
    setEditingRequestId(null);
  }, [collections, onRenameRequest]);

  const handleFinishEditFolder = useCallback((folderId: string, newName: string) => {
    for (const c of collections) {
      if (findFolderInCollection(c, folderId)) {
        onRenameFolder(c.id, folderId, newName);
        setEditingFolderId(null);
        return;
      }
    }
    setEditingFolderId(null);
  }, [collections, onRenameFolder]);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return history;
    return history.filter(item =>
      item.request.name.toLowerCase().includes(q) ||
      item.request.url.toLowerCase().includes(q) ||
      item.request.method.toLowerCase().includes(q)
    );
  }, [history, searchQuery]);

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
              {collections.map(collection => (
                <CollectionItem
                  key={collection.id}
                  collection={collection}
                  isExpanded={isExpanded(collection.id)}
                  isDragOver={dragOverTarget === collection.id}
                  expandedFolders={expandedFolders}
                  draggedItem={draggedItem}
                  editingRequestId={editingRequestId}
                  editingFolderId={editingFolderId}
                  dragOverTarget={dragOverTarget}
                  onToggle={toggleCollection}
                  onSelectRequest={onSelectRequest}
                  onRunRequest={onRunRequest}
                  onToggleFolder={toggleFolder}
                  onDragStartRequest={handleDragStartRequest}
                  onDragEnd={handleDragEnd}
                  onDragStartFolder={handleDragStartFolder}
                  onDropOnCollection={handleDropOnCollection}
                  onDragOverCollection={handleDragOverCollection}
                  onDragLeaveCollection={handleDragLeave}
                  onDropOnFolder={handleDropOnFolder}
                  onDragOverFolder={handleDragOverFolder}
                  onDragLeaveFolder={handleDragLeave}
                  onFinishEditRequest={handleFinishEditRequest}
                  onCancelEditRequest={() => setEditingRequestId(null)}
                  onFinishEditFolder={handleFinishEditFolder}
                  onCancelEditFolder={() => setEditingFolderId(null)}
                  onRequestContextMenu={handleRequestContextMenu}
                  onFolderContextMenu={handleFolderContextMenu}
                  onCollectionContextMenu={(e) => handleCollectionContextMenu(e, collection.id)}
                />
              ))}

              {collections.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-500">
                  <Folder size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Нет коллекций</p>
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