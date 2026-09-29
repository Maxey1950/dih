'use client';

import { useState, useEffect } from 'react';

export default function Alert() {
  const [isVisible, setIsVisible] = useState(true);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const getTheme = () => document.documentElement.getAttribute('data-bs-theme') === 'dark';
    setIsDarkTheme(getTheme());
    const obs = new MutationObserver(() => setIsDarkTheme(getTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
    return () => obs.disconnect();
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`alert alert-warning ${isDarkTheme ? 'border border-warning' : ''} rounded-0 shadow-lg mb-0 position-relative d-flex align-items-center py-3`}>
      <div className="container-fluid">
        <div className="row align-items-center">
          <div className="col-12 col-md-10 offset-md-1">
            <div className="d-flex align-items-start gap-3">
              <div className="flex-shrink-0">
                <div className={`${isDarkTheme ? 'bg-warning bg-opacity-25' : 'bg-dark bg-opacity-10'} rounded-circle d-flex align-items-center justify-content-center`} style={{ width: '2.5rem', height: '2.5rem' }}>
                  <i className={`bi bi-megaphone-fill ${isDarkTheme ? 'text-warning-emphasis' : 'text-dark'}`}></i>
                </div>
              </div>
              <div className="flex-grow-1">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <strong className={`${isDarkTheme ? 'text-warning-emphasis' : 'text-dark'} text-uppercase small fw-bold`}>
                    Development Update
                  </strong>
                  <span className={`badge ${isDarkTheme ? 'bg-warning text-dark' : 'bg-dark bg-opacity-10 text-dark'} small`}>New</span>
                </div>
                <p className={`mb-0 ${isDarkTheme ? 'text-warning-emphasis' : 'text-dark'} small lh-sm pe-5`}>
                  This site is under active development. Accounts, games and other features are being rebuilt and may be unavailable.
                </p>
              </div>
              <div className="flex-shrink-0">
                <button
                  type="button"
                  className={`btn-close ${isDarkTheme ? 'btn-close-white' : ''} opacity-100 rounded-circle p-2`}
                  aria-label="Close"
                  onClick={() => setIsVisible(false)}
                ></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
