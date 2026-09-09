import React, { useState } from 'react';
import { HttpResponse } from '../types';
import { formatJSON, formatSize, formatTime } from '../utils/helpers';
import { Send } from 'lucide-react';

interface ResponseViewerProps {
  response: HttpResponse | null;
  loading: boolean;
  error: string | null;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, loading, error }) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'meta'>('body');

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-[40px] flex items-center gap-4 px-4 bg-[#252525] border-b border-[#3d3d3d] shrink-0">
          <div className="text-sm text-gray-400">Отправка запроса...</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-[40px] flex items-center gap-4 px-4 bg-[#252525] border-b border-[#3d3d3d] shrink-0">
          <div className="font-bold text-red-500 text-sm">Ошибка</div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-red-500 text-center text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-[40px] flex items-center gap-4 px-4 bg-[#252525] border-b border-[#3d3d3d] shrink-0">
          <div className="text-sm text-gray-400">Response</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <Send size={40} className="text-gray-600 mb-3" />
          <div className="text-gray-500 text-center">
            <div className="text-base mb-1">Отправьте запрос для просмотра ответа</div>
            <div className="text-xs">Нажмите кнопку <span className="text-primary-500 font-medium">Send</span> или нажмите <kbd className="px-1.5 py-0.5 bg-[#2d2d2d] rounded text-[11px]">Enter</kbd> в поле URL</div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-500';
    if (status >= 300 && status < 400) return 'text-yellow-500';
    if (status >= 400 && status < 500) return 'text-orange-500';
    return 'text-red-500';
  };

  const getStatusBgColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-green-500/10 border-green-500/30';
    if (status >= 300 && status < 400) return 'bg-yellow-500/10 border-yellow-500/30';
    if (status >= 400 && status < 500) return 'bg-orange-500/10 border-orange-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Status Bar - 40px */}
      <div className="h-[40px] flex items-center gap-4 px-4 bg-[#252525] border-b border-[#3d3d3d] shrink-0">
        <div className={`px-2.5 py-1 rounded border ${getStatusBgColor(response.status)}`}>
          <span className={`font-bold text-sm ${getStatusColor(response.status)}`}>
            {response.status} {response.statusText}
          </span>
        </div>
        <div className="text-xs text-gray-400">
           {formatTime(response.time)}
        </div>
        <div className="text-xs text-gray-400">
          📦 {formatSize(response.size)}
        </div>
      </div>

      {/* Tabs - 36px */}
      <div className="h-[36px] flex border-b border-[#3d3d3d] bg-[#252525] shrink-0">
        {(['body', 'headers', 'meta'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 font-medium transition-colors text-xs h-full ${
              activeTab === tab
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === 'body' && 'Body'}
            {tab === 'headers' && 'Headers'}
            {tab === 'meta' && 'Meta'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {activeTab === 'body' && (
          <pre className="font-mono text-sm whitespace-pre-wrap text-gray-300">
            {typeof response.data === 'string'
              ? response.data
              : formatJSON(response.data)}
          </pre>
        )}

        {activeTab === 'headers' && (
          <div className="space-y-2">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-sm">
                <span className="font-bold text-primary-500 min-w-[150px] text-xs">{key}:</span>
                <span className="text-gray-300 break-all text-xs">{value}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'meta' && (
          <div className="space-y-3">
            <div className="flex gap-2 text-sm">
              <span className="font-bold text-primary-500 min-w-[150px] text-xs">Время ответа:</span>
              <span className="text-gray-300 text-xs">{formatTime(response.time)}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="font-bold text-primary-500 min-w-[150px] text-xs">Размер:</span>
              <span className="text-gray-300 text-xs">{formatSize(response.size)}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="font-bold text-primary-500 min-w-[150px] text-xs">Статус:</span>
              <span className={`${getStatusColor(response.status)} text-xs`}>
                {response.status} {response.statusText}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};