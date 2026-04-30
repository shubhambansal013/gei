'use client';
import { useState, useEffect } from 'react';

/**
 * Hook to calculate an optimal page size based on the available viewport height.
 * It assumes a fixed header/footer height and a standard row height.
 *
 * @param rowHeight The approximate height of a single table row in pixels (default 32 for dense excel-grid).
 * @param offsetHeight The total height of other elements on the page (header, search bar, pagination controls) in pixels.
 * @returns The calculated page size.
 */
export function useOptimalPageSize(rowHeight = 32, offsetHeight = 280) {
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    const calculate = () => {
      const availableHeight = window.innerHeight - offsetHeight;
      const count = Math.floor(availableHeight / rowHeight);
      // Clamp to reasonable values
      setPageSize(Math.max(10, Math.min(100, count)));
    };

    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [rowHeight, offsetHeight]);

  return pageSize;
}
