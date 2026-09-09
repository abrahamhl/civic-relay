import React, { useState, useEffect } from 'react';
import './TransportStatus.css';

const TransportStatus: React.FC = () => {
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
          {online ? 'IP Transport Available' : 'Offline - Messages Queued'}
        </span>
      </div>
    </div>
  );
};

export default TransportStatus;
