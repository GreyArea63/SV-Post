import { useState } from 'react';
import { HttpResponse } from '../types';
import { formatJSON, formatSize, formatTime } from '../utils/helpers';
import { Clock, HardDrive, CheckCircle, AlertCircle, XCircle, Download, Copy, Send } from 'lucide-react';

interface ResponseViewerProps {
  response: HttpResponse | null;
  loading: boolean;
  error: string | null;
}

const getStatusColor = (status: number): string => {
  if (status >= 200 && status < 300) return 'text-emerald-400';
  if (status >= 300 && status < 400) return 'text-amber-400';
  if (status >= 400 && status < 500) return 'text-orange-400';
  return 'text-red-400';
};

const getStatusBg = (status: number): string => {
  if (status >= 200 && status < 300) return 'bg-emerald-500/10 border-emerald-500/30';
  if (status >= 300 && status < 400) return 'bg-amber-500/10 border-amber-500/30';
  if (status >= 400 && status < 500) return 'bg-orange-500/10 border-orange-500/30';
  return 'bg-red-500/10 border-red-500/30';
};

const getStatusIcon = (status: number) => {
  if (status >= 200 && status < 300) return <CheckCircle size={14} className="text-emerald-400" />;
  if (status >= 400) return <XCircle size={14} className="text-red-400" />;
  return <AlertCircle size={14} className="text-amber-400" />;
};

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, loading, error }) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'cookies' | 'test'>('body');
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = () => {
    if (!response?.data) return;
    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {
      // Fallback для старых браузеров или HTTP
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!response?.data) return;
    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const HeaderBar = () => (
    <div className="h-[40px] flex items-center justify-between px-4 border-b border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-200">Response</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className={`p-1 transition-colors ${copySuccess ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
          title={copySuccess ? 'Скопировано!' : 'Copy'}
          aria-label="Copy response"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={handleDownload}
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          title="Download"
          aria-label="Download response"
        >
          <Download size={14} />
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e]">
        <HeaderBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-[3px] border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
            <div className="text-gray-400 text-sm">Sending request...</div>
            <div className="text-gray-600 text-xs mt-1">Waiting for response</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e]">
        <HeaderBar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <XCircle size={48} className="mx-auto text-red-400 mb-3 opacity-60" />
            <div className="text-red-400 text-sm font-medium mb-2">Request failed</div>
            <div className="text-gray-500 text-xs break-all">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!response) {
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <HeaderBar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#2d2d2d] flex items-center justify-center mx-auto mb-4">
            <Send size={24} className="text-gray-500" />
          </div>
          <div className="text-gray-400 text-sm font-medium mb-1">Нет ответа</div>
          <div className="text-gray-600 text-xs">Отправьте запрос для получения ответа</div>
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <HeaderBar />

      <div className="h-[32px] flex items-center gap-3 px-4 bg-[#252525] border-b border-[rgba(255,255,255,0.08)] shrink-0">
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${getStatusBg(response.status)}`}>
          {getStatusIcon(response.status)}
          <span className={`font-bold text-xs ${getStatusColor(response.status)}`}>
            {response.status} {response.statusText}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          <Clock size={10} />
          <span>{formatTime(response.time)}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          <HardDrive size={10} />
          <span>{formatSize(response.size)}</span>
        </div>
      </div>

      <div className="h-[32px] flex items-center gap-0 px-2 border-b border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] shrink-0">
        {(['body', 'headers', 'cookies', 'test'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 font-medium transition-all text-xs rounded ${
              activeTab === tab
                ? 'text-gray-200 bg-[#2d2d2d]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-[#2d2d2d]/50'
            }`}
          >
            {tab === 'body' && 'Body'}
            {tab === 'headers' && 'Headers'}
            {tab === 'cookies' && 'Cookies'}
            {tab === 'test' && 'Test Results'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 min-h-0">
        {activeTab === 'body' && (
          <pre className="font-mono text-xs whitespace-pre-wrap text-gray-300 leading-relaxed">
            {typeof response.data === 'string' ? response.data : formatJSON(response.data)}
          </pre>
        )}

        {activeTab === 'headers' && (
          <div className="space-y-1">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs p-1.5 rounded hover:bg-[#2d2d2d] transition-colors">
                <span className="font-medium text-indigo-400 min-w-[140px]">{key}:</span>
                <span className="text-gray-300 break-all">{String(value)}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'cookies' && (
          <div className="text-center text-gray-500 py-8 text-sm">
            <p>Cookies not available in browser environment</p>
          </div>
        )}

        {activeTab === 'test' && (
          <div className="text-center text-gray-500 py-8 text-sm">
            <p>Test scripts coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
};