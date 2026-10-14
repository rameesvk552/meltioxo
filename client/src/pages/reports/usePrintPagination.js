import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

// Printing must include all filtered rows, even when the interactive table is paginated.
export default function usePrintPagination(pageSize = 25) {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);
  return printing ? false : { pageSize, showSizeChanger: true };
}
