import React from 'react';
import type { MessageType, Priority } from '@civic-relay/schemas';
import './EmergencyButtons.css';

interface Props {
  onAction: (type: MessageType, priority: Priority) => void;
}

const EmergencyButtons: React.FC<Props> = ({ onAction }) => {
  return (
    <div className="emergency-buttons">
      <h2>Quick Actions</h2>
      <div className="button-grid">
        <button
          className="emergency-btn safe"
          onClick={() => onAction('SAFE', 'LOW')}
        >
          <span className="icon">✓</span>
          <span className="label">I'm Safe</span>
        </button>

        <button
          className="emergency-btn sos"
          onClick={() => onAction('SOS', 'CRITICAL')}
        >
          <span className="icon">🆘</span>
          <span className="label">I Need Help</span>
        </button>

        <button
          className="emergency-btn medical"
          onClick={() => onAction('MEDICAL', 'HIGH')}
        >
          <span className="icon">⚕️</span>
          <span className="label">Medical</span>
        </button>

        <button
          className="emergency-btn fire"
          onClick={() => onAction('FIRE', 'CRITICAL')}
        >
          <span className="icon">🔥</span>
          <span className="label">Fire</span>
        </button>

        <button
          className="emergency-btn infrastructure"
          onClick={() => onAction('INFRASTRUCTURE', 'MEDIUM')}
        >
          <span className="icon">⚠️</span>
          <span className="label">Infrastructure</span>
        </button>

        <button
          className="emergency-btn report"
          onClick={() => onAction('GENERAL_REPORT', 'LOW')}
        >
          <span className="icon">📝</span>
          <span className="label">General Report</span>
        </button>
      </div>
    </div>
  );
};

export default EmergencyButtons;
