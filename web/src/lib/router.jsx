import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const RouterCtx = createContext({ path: '/', nav: () => {} });
export const useRouter = () => useContext(RouterCtx);

export function RouterProvider({ children }) {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const fn = () => { setPath(location.pathname); window.scrollTo({ top: 0 }); };
    addEventListener('popstate', fn);
    return () => removeEventListener('popstate', fn);
  }, []);
  const nav = useCallback((to, opts = {}) => {
    if (/^https?:/.test(to)) { location.href = to; return; }
    history[opts.replace ? 'replaceState' : 'pushState']({}, '', to);
    setPath(to.split('?')[0]);
    window.scrollTo({ top: 0 });
  }, []);
  return <RouterCtx.Provider value={{ path, nav }}>{children}</RouterCtx.Provider>;
}

export function Link({ to, className, children, onClick, ...rest }) {
  const { nav } = useRouter();
  return (
    <a href={to} className={className}
      onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onClick?.(e); nav(to); }}
      {...rest}>{children}</a>
  );
}
