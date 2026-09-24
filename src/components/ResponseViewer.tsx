import { useState } from 'react';
import { HttpResponse, TestResult } from '../types';
import { formatJSON, formatSize, formatTime } from '../utils/helpers';
import {
  Clock,
  HardDrive,
  CheckCircle,
  AlertCircle,
  XCircle,
  Download,
  Copy,
  Send,
  Terminal,
  FileText,
} from 'lucide-react';

interface ResponseViewerProps {
  response: HttpResponse | null;
  loading: boolean;
  error: string | null;
  testResults?: TestResult[];
  scriptLogs?: string[];
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
  if (status >= 200 && status < 300)
    return <CheckCircle size={14} className="text-emerald-400" />;
  if (status >= 400) return <XCircle size={14} className="text-red-400" />;
  return <AlertCircle size={14} className="text-amber-400" />;
};

export const ResponseViewer: React.FC<ResponseViewerProps> = ({
  response,
  loading,
  error,
  testResults,
  scriptLogs,
}) => {
  const [activeTab, setActiveTab] = useState<
    'body' | 'headers' | 'cookies' | 'tests' | 'console'
  >('body');
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = () => {
    if (!response?.data) return;
    const text =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data, null, 2);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(() => {
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
    const text =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data, null, 2);
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
          className={`p-1 transition-colors ${
            copySuccess ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
          }`}
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
            <div className="text-gray-600 text-xs">
              Отправьте запрос для получения ответа
            </div>
          </div>
        </div>
      </div>
    );
  }

  const passedTests = testResults?.filter((t) => t.passed).length || 0;
  const failedTests = testResults?.filter((t) => !t.passed).length || 0;
  const totalTests = testResults?.length || 0;
  const hasLogs = scriptLogs && scriptLogs.length > 0;

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <HeaderBar />

      {/* Status bar */}
      <div className="h-[32px] flex items-center gap-3 px-4 bg-[#252525] border-b border-[rgba(255,255,255,0.08)] shrink-0">
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${getStatusBg(
            response.status
          )}`}
        >
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

      {/* Tabs */}
      <div className="h-[32px] flex items-center gap-0 px-2 border-b border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] shrink-0">
        <button
          onClick={() => setActiveTab('body')}
          className={`px-3 py-1 font-medium transition-all text-xs rounded flex items-center gap-1 ${
            activeTab === 'body'
              ? 'text-gray-200 bg-[#2d2d2d]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-[#2d2d2d]/50'
          }`}
        >
          <FileText size={12} />
          Body
        </button>
        <button
          onClick={() => setActiveTab('headers')}
          className={`px-3 py-1 font-medium transition-all text-xs rounded ${
            activeTab === 'headers'
              ? 'text-gray-200 bg-[#2d2d2d]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-[#2d2d2d]/50'
          }`}
        >
          Headers
        </button>
        <button
          onClick={() => setActiveTab('cookies')}
          className={`px-3 py-1 font-medium transition-all text-xs rounded ${
            activeTab === 'cookies'
              ? 'text-gray-200 bg-[#2d2d2d]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-[#2d2d2d]/50'
          }`}
        >
          Cookies
        </button>
        <button
          onClick={() => setActiveTab('tests')}
          className={`px-3 py-1 font-medium transition-all text-xs rounded flex items-center gap-1 ${
            activeTab === 'tests'
              ? 'text-gray-200 bg-[#2d2d2d]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-[#2d2d2d]/50'
          }`}
        >
          <CheckCircle size={12} />
          Tests
          {totalTests > 0 && (
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                failedTests > 0
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {passedTests}/{totalTests}
            </span>
          )}
        </button>
        {hasLogs && (
          <button
            onClick={() => setActiveTab('console')}
            className={`px-3 py-1 font-medium transition-all text-xs rounded flex items-center gap-1 ${
              activeTab === 'console'
                ? 'text-gray-200 bg-[#2d2d2d]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-[#2d2d2d]/50'
            }`}
          >
            <Terminal size={12} />
            Console
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/20 text-blue-400">
              {scriptLogs!.length}
            </span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 min-h-0">
        {activeTab === 'body' && (
          <pre className="font-mono text-xs whitespace-pre-wrap text-gray-300 leading-relaxed">
            {typeof response.data === 'string'
              ? response.data
              : formatJSON(response.data)}
          </pre>
        )}

        {activeTab === 'headers' && (
          <div className="space-y-1">
            {Object.entries(response.headers).map(([key, value]) => (
              <div
                key={key}
                className="flex gap-2 text-xs p-1.5 rounded hover:bg-[#2d2d2d] transition-colors"
              >
                <span className="font-medium text-indigo-400 min-w-[140px]">
                  {key}:
                </span>
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

        {activeTab === 'tests' && (
          <div className="space-y-2">
            {totalTests > 0 ? (
              <>
                {/* Summary */}
                <div className="flex items-center gap-3 px-3 py-2 bg-[#252525] rounded-lg border border-[rgba(255,255,255,0.08)] mb-3">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-emerald-400" />
                    <span className="text-xs text-gray-300">
                      <span className="font-bold text-emerald-400">{passedTests}</span>{' '}
                      passed
                    </span>
                  </div>
                  {failedTests > 0 && (
                    <div className="flex items-center gap-1.5">
                      <XCircle size={14} className="text-red-400" />
                      <span className="text-xs text-gray-300">
                        <span className="font-bold text-red-400">{failedTests}</span>{' '}
                        failed
                      </span>
                    </div>
                  )}
                  <div className="ml-auto text-[10px] text-gray-500">
                    {totalTests} total
                  </div>
                </div>

                {/* Test list */}
                {testResults!.map((test, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      test.passed
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    {test.passed ? (
                      <CheckCircle
                        size={16}
                        className="text-emerald-400 shrink-0 mt-0.5"
                      />
                    ) : (
                      <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-200">
                        {test.name}
                      </div>
                      {test.error && (
                        <div className="text-xs text-red-400 mt-1 font-mono bg-red-500/10 px-2 py-1 rounded break-all">
                          {test.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No tests executed</p>
                <p className="text-xs mt-1">
                  Add tests in the Scripts tab using pm.test()
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'console' && hasLogs && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-2">
              <Terminal size={12} className="text-blue-400" />
              <span className="text-xs text-blue-400 font-medium">
                Script Console Output
              </span>
            </div>
            {scriptLogs!.map((log, index) => (
              <div
                key={index}
                className="font-mono text-xs text-gray-300 px-3 py-1.5 bg-[#252525] rounded border border-[rgba(255,255,255,0.05)] break-all"
              >
                <span className="text-gray-600 mr-2">[{index + 1}]</span>
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};