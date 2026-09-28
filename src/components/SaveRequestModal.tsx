import { useState, useMemo } from 'react';
import { X, FolderPlus, Save } from 'lucide-react';
import { Collection, CollectionFolder, HttpRequest } from '../types';

interface SaveRequestModalProps {
  request: HttpRequest;
  collections: Collection[];
  onSave: (
    collectionId: string,
    requestName: string,
    request: HttpRequest,
    folderId?: string | null
  ) => void;
  onCreateCollection: (collectionName: string, requestName: string, request: HttpRequest) => void;
  onClose: () => void;
}

interface FolderPath {
  id: string;
  label: string;
}

function getFolderPaths(
  folders: CollectionFolder[],
  prefix: string = ''
): FolderPath[] {
  const result: FolderPath[] = [];
  for (const f of folders) {
    const path = prefix ? `${prefix} / ${f.name}` : f.name;
    result.push({ id: f.id, label: path });
    result.push(...getFolderPaths(f.folders, path));
  }
  return result;
}

export const SaveRequestModal: React.FC<SaveRequestModalProps> = ({
  request,
  collections,
  onSave,
  onCreateCollection,
  onClose,
}) => {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(collections[0]?.id || '');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [requestName, setRequestName] = useState(request.name || 'New Request');
  const [newCollectionName, setNewCollectionName] = useState('');

  const availableFolders = useMemo(() => {
    const collection = collections.find(c => c.id === selectedCollectionId);
    if (!collection) return [];
    return getFolderPaths(collection.folders);
  }, [collections, selectedCollectionId]);

  const handleCollectionChange = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    setSelectedFolderId('');
  };

  const handleSubmit = () => {
    if (mode === 'existing') {
      if (!selectedCollectionId || !requestName.trim()) return;
      onSave(
        selectedCollectionId,
        requestName,
        request,
        selectedFolderId || null
      );
    } else {
      if (!newCollectionName.trim() || !requestName.trim()) return;
      onCreateCollection(newCollectionName, requestName, request);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[400] p-4 animate-scale-in">
      <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
            <Save size={18} className="text-indigo-400" />
            Сохранить запрос
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-all" aria-label="Close">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Название запроса
            </label>
            <input
              type="text"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              className="w-full px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-gray-500"
              placeholder="Введите название запроса"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setMode('existing')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all ${mode === 'existing'
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'bg-[#2d2d2d] text-gray-400 border border-[rgba(255,255,255,0.08)] hover:bg-[#363636]'
                }`}
            >
              В существующую
            </button>
            <button
              onClick={() => setMode('new')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all ${mode === 'new'
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'bg-[#2d2d2d] text-gray-400 border border-[rgba(255,255,255,0.08)] hover:bg-[#363636]'
                }`}
            >
              <FolderPlus size={14} className="inline mr-1" />
              Новая коллекция
            </button>
          </div>

          {mode === 'existing' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  Коллекция
                </label>
                {collections.length > 0 ? (
                  <select
                    value={selectedCollectionId}
                    onChange={(e) => handleCollectionChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-gray-500"
                  >
                    {collections.map(collection => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-center py-4 text-sm text-gray-500 bg-[#252525] rounded-lg border border-[rgba(255,255,255,0.08)]">
                    Нет коллекций. Создайте новую.
                  </div>
                )}
              </div>

              {collections.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Папка (опционально)
                  </label>
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-gray-500"
                  >
                    <option value="">📁 Корень коллекции</option>
                    {availableFolders.map(folder => (
                      <option key={folder.id} value={folder.id}>
                        {folder.label}
                      </option>
                    ))}
                  </select>
                  {availableFolders.length === 0 && (
                    <p className="text-[10px] text-gray-600 mt-1">
                      В коллекции пока нет папок. Можно сохранить в корень.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Название новой коллекции
              </label>
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                className="w-full px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-gray-500"
                placeholder="Например: My API Tests"
                autoFocus={mode === 'new'}
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              (mode === 'existing' && (!selectedCollectionId || !requestName.trim())) ||
              (mode === 'new' && (!newCollectionName.trim() || !requestName.trim()))
            }
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};