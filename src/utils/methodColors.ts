export const getMethodColor = (method: string): string => {
  const colors: Record<string, string> = {
    GET: 'text-emerald-400',
    POST: 'text-amber-400',
    PUT: 'text-blue-400',
    PATCH: 'text-purple-400',
    DELETE: 'text-red-400',
    HEAD: 'text-gray-400',
    OPTIONS: 'text-orange-400',
  };
  return colors[method.toUpperCase()] || 'text-gray-400';
};

export const getMethodBg = (method: string): string => {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-500/10',
    POST: 'bg-amber-500/10',
    PUT: 'bg-blue-500/10',
    PATCH: 'bg-purple-500/10',
    DELETE: 'bg-red-500/10',
    HEAD: 'bg-gray-500/10',
    OPTIONS: 'bg-orange-500/10',
  };
  return colors[method.toUpperCase()] || 'bg-gray-500/10';
};