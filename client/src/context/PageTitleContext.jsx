import React, { createContext, useContext, useState, useCallback } from 'react';

const PageTitleContext = createContext({ title: '', setTitle: () => {} });

export function PageTitleProvider({ children }) {
  const [title, setTitleState] = useState('');
  const setTitle = useCallback((t) => setTitleState(t), []);
  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle(newTitle) {
  const { title, setTitle } = useContext(PageTitleContext);

  // Set title on mount if provided
  React.useEffect(() => {
    if (newTitle !== undefined) {
      setTitle(newTitle);
    }
  }, [newTitle, setTitle]);

  return { title, setTitle };
}

export default PageTitleContext;
