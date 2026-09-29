'use client';

import { useEffect } from 'react';

export function BootstrapProvider({ children }) {
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js');
  }, []);

  return children;
}
