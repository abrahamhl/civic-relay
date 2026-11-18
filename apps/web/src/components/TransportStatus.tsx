import React, { useState, useEffect } from 'react';
import './TransportStatus.css';
import type { Locale } from '../i18n';
import { t } from '../i18n';

const TransportStatus: React.FC<{locale: Locale}> = ({locale}) => {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="transport-status">
      <div className={`status-indicator ${online ? 'online' : 'offline'}`}>
        <span className="dot"></span>
        <span className="label">
          {t(locale, online ? 'online' : 'offline')}
        </span>
      </div>
    </div>
  );
};

export default TransportStatus;
