// File path: /hooks/useUsage.ts

import { useState, useEffect } from 'react';

const MAX_FREE_USES = 5;

export function useUsage() {
  const [usageCount, setUsageCount] = useState(0);

  useEffect(() => {
    const count = parseInt(localStorage.getItem('gist_free_usage') || '0', 10);
    setUsageCount(count);
  }, []);

  const incrementUsage = () => {
    const newCount = usageCount + 1;
    setUsageCount(newCount);
    localStorage.setItem('gist_free_usage', newCount.toString());
  };

  const isLimitReached = usageCount >= MAX_FREE_USES;

  return { usageCount, incrementUsage, isLimitReached, MAX_FREE_USES };
}