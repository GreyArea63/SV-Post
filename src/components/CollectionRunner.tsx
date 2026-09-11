import React, { useState, useRef } from 'react';
import { X, Play, Square, CheckCircle, XCircle, Clock, Upload, TrendingUp, TrendingDown } from 'lucide-react';
import { HttpRequest, Environment, KeyValuePair } from '../types';
import { parseCSV } from '../utils/csvParser';
import { generateId, replaceVariables, parseKeyValuePairs } from '../utils/helpers';
import axios from 'axios';

interface RunResult {
  iteration: number;
  status: number | string;
  success: boolean;
  time: number;
  error?: string;
  requestData?: Record<string, any>;
}

interface CollectionRunnerProps {
  requests: HttpRequest[];
  collectionName: string;
  environments: Environment[];
  activeEnvId: string | null;
  globalVariables: KeyValuePair[];
  onClose: () => void;
}

export const CollectionRunner: React.FC<CollectionRunnerProps> = ({
  requests, collectionName, environments, activeEnvId, globalVariables, onClose
}) => {
  const [iterations, setIterations] = useState(1);
  const [delay, setDelay] = useState(0);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [results, setResults] = useState<RunResult[]>([]);
  const [isCancelled, setIsCancelled] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDataFile(file);
    const text = await file.text();
    if (file.name.endsWith('.json')) {
      try { setParsedData(Array.isArray(JSON.parse(text)) ? JSON.parse(text) : [JSON.parse(text)]); } 
      catch { alert('Ошибка парсинга JSON'); }
    } else if (file.name.endsWith('.csv')) {
      setParsedData(parseCSV(text));
    } else {
      alert('Поддерживаются только .json и .csv');
    }
  };

  const startRun = async () => {
    setIsRunning(true);
    setIsCancelled(false);
    setResults([]);
    abortControllerRef.current = new AbortController();

    const activeEnv = environments.find(e => e.id === activeEnvId);
    const envVars = activeEnv?.variables.filter(v => v.enabled) || [];
    const globals = globalVariables.filter(v => v.enabled);
    const dataRows = parsedData.length > 0 ? parsedData.slice(0, iterations) : Array(iterations).fill({});
    const totalRequests = requests.length;

    for (let i = 0; i < dataRows.length; i++) {
      if (isCancelled) break;
      setCurrentIteration(i + 1);
      const rowData = dataRows[i];
      const dataVars: KeyValuePair[] = Object.entries(rowData).map(([key, value]) => ({
        id: generateId(), key, value: String(value), enabled: true
      }));
      const allVariables = [...globals, ...envVars, ...dataVars];

      for (let j = 0; j < totalRequests; j++) {
        if (isCancelled) break;
        const req = requests[j];
        const startTime = Date.now();

        try {
          const processedReq = {
            ...req,
            url: replaceVariables(req.url, allVariables),
            headers: req.headers.map(h => ({ ...h, value: replaceVariables(h.value, allVariables) })),
            queryParams: req.queryParams.map(p => ({ ...p, value: replaceVariables(p.value, allVariables) })),
            body: { ...req.body, content: replaceVariables(req.body.content, allVariables) },
          };

          let url = processedReq.url;
          const queryParams = parseKeyValuePairs(processedReq.queryParams);
          if (Object.keys(queryParams).length > 0) {
            url += (url.includes('?') ? '&' : '?') + new URLSearchParams(queryParams).toString();
          }

          const headers = parseKeyValuePairs(processedReq.headers);
          if (processedReq.auth?.type === 'bearer' && processedReq.auth.token) {
            headers['Authorization'] = `Bearer ${processedReq.auth.token}`;
          } else if (processedReq.auth?.type === 'basic' && processedRequest.auth.username) {
            headers['Authorization'] = `Basic ${btoa(`${processedReq.auth.username}:${processedReq.auth.password || ''}`)}`;
          }

          const config: any = { 
            method: processedReq.method.toLowerCase(), url, headers, timeout: 30000, 
            signal: abortControllerRef.current.signal 
          };
          
          if (processedReq.body.type !== 'none' && ['POST', 'PUT', 'PATCH'].includes(processedReq.method)) {
            if (processedReq.body.type === 'json') { 
              config.data = JSON.parse(processedReq.body.content); 
              headers['Content-Type'] = 'application/json'; 
            } else { 
              config.data = processedReq.body.content; 
            }
          }

          const response = await axios(config);
          setResults(prev => [...prev, {
            iteration: i + 1, status: response.status,
            success: response.status >= 200 && response.status < 300,
            time: Date.now() - startTime, requestData: rowData,
          }]);
        } catch (err: any) {
          if (axios.isCancel(err)) break;
          setResults(prev => [...prev, {
            iteration: i + 1, status: err.response?.status || 'Error',
            success: false, time: Date.now() - startTime,
            error: err.message, requestData: rowData,
          }]);
        }

        if (delay > 0 && !isCancelled) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    setIsRunning(false);
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const requestName = requests.length === 1 ? requests[0].name : `${requests.length} запросов`;
  const progress = Math.min(iterations, parsedData.length > 0 ? parsedData.length : iterations);
  const progressPercent = progress > 0 ? (currentIteration / progress) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-[#1a1a23] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Play size={16} className="text-white" />
            </div>
            Runner: {requestName}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-all">
            <X size={18} />
          </button>
        </div>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Configuration */}
          <div className="w-1/3 border-r border-[rgba(255,255,255,0.08)] p-4 space-y-4 overflow-y-auto">
            {!isRunning ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Итерации</label>
                  <input 
                    type="number" min="1" value={iterations} 
                    onChange={(e) => setIterations(Math.max(1, parseInt(e.target.value) || 1))} 
                    className="w-full px-3 py-2 bg-[#252532] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all" 
                  />
                  {parsedData.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1.5">
                      * Будет выполнено {Math.min(iterations, parsedData.length)} итераций по файлу
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Задержка (мс)</label>
                  <input 
                    type="number" min="0" step="100" value={delay} 
                    onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value) || 0))} 
                    className="w-full px-3 py-2 bg-[#252532] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all" 
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Файл данных</label>
                  <label className="flex items-center justify-center w-full px-3 py-4 border-2 border-dashed border-[rgba(255,255,255,0.15)] rounded-lg cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all">
                    <input type="file" accept=".csv,.json" className="hidden" onChange={handleFileUpload} />
                    <div className="text-center">
                      <Upload size={20} className="mx-auto text-gray-500 mb-1" />
                      <span className="text-xs text-gray-400">{dataFile ? dataFile.name : 'Нажмите для загрузки'}</span>
                    </div>
                  </label>
                  {parsedData.length > 0 && (
                    <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                      <CheckCircle size={12} /> Загружено строк: {parsedData.length}
                    </p>
                  )}
                </div>
                
                <button 
                  onClick={startRun} 
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-btn text-white rounded-lg font-medium transition-all"
                >
                  <Play size={16} /> Запустить
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20">
                  <div className="text-4xl font-bold gradient-text mb-1">{currentIteration}</div>
                  <div className="text-sm text-gray-400">Текущая итерация</div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Прогресс</span>
                    <span>{progressPercent.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#252532] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp size={12} className="text-emerald-400" />
                      <span className="text-xs text-gray-400">Успешно</span>
                    </div>
                    <div className="text-xl font-bold text-emerald-400">{successCount}</div>
                  </div>
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingDown size={12} className="text-red-400" />
                      <span className="text-xs text-gray-400">Ошибок</span>
                    </div>
                    <div className="text-xl font-bold text-red-400">{failCount}</div>
                  </div>
                </div>
                
                <button 
                  onClick={() => { setIsCancelled(true); abortControllerRef.current?.abort(); }} 
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg font-medium transition-all"
                >
                  <Square size={16} /> Остановить
                </button>
              </div>
            )}
          </div>

          {/* Right Panel: Results */}
          <div className="w-2/3 flex flex-col">
            <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.08)] bg-[#1a1a23]">
              <h3 className="text-sm font-medium text-gray-300">Результаты выполнения</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {results.length === 0 && !isRunning && (
                <div className="text-center text-gray-500 py-12">
                  <Clock size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Нажмите "Запустить" для начала</p>
                </div>
              )}
              
              {results.map((result, index) => (
                <div key={index} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  result.success 
                    ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10' 
                    : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                }`}>
                  {result.success ? (
                    <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200">
                      Итерация #{result.iteration}
                      {Object.keys(result.requestData || {}).length > 0 && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({Object.entries(result.requestData!).map(([k, v]) => `${k}=${v}`).join(', ')})
                        </span>
                      )}
                    </div>
                    {result.error && (
                      <div className="text-xs text-red-400 truncate mt-0.5" title={result.error}>{result.error}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result.status}
                    </div>
                    <div className="text-xs text-gray-500">{result.time} мс</div>
                  </div>
                </div>
              ))}
              
              {isRunning && (
                <div className="flex items-center gap-3 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/30 animate-pulse">
                  <Clock size={18} className="text-indigo-400 shrink-0 animate-spin" />
                  <div className="text-sm text-indigo-400">Выполняется итерация {currentIteration}...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};