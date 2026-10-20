import React from 'react';
import type { MessageType, Priority } from '@civic-relay/schemas';
import './EmergencyButtons.css';
import type { Locale } from '../i18n';
import { t } from '../i18n';

interface Props {
  locale: Locale;
  onAction: (type: MessageType, priority: Priority) => void;
}

const EmergencyButtons: React.FC<Props> = ({ onAction, locale }) => {
  return (
    <div className="emergency-buttons">
      <h2>{t(locale,'quickActions')}</h2>
      <div className="button-grid">
        <button
          className="emergency-btn safe"
          onClick={() => onAction('SAFE', 'LOW')}
        >
          <span className="icon">✓</span>
          <span className="label">{t(locale,'safe')}</span>
        </button>

        <button
          className="emergency-btn sos"
          onClick={() => onAction('SOS', 'CRITICAL')}
        >
          <span className="icon">🆘</span>
          <span className="label">{t(locale,'sos')}</span>
        </button>

        <button
          className="emergency-btn medical"
          onClick={() => onAction('MEDICAL', 'HIGH')}
        >
          <span className="icon">⚕️</span>
          <span className="label">{t(locale,'medical')}</span>
        </button>

        <button
          className="emergency-btn fire"
          onClick={() => onAction('FIRE', 'CRITICAL')}
        >
          <span className="icon">🔥</span>
          <span className="label">{t(locale,'fire')}</span>
        </button>

        <button
          className="emergency-btn infrastructure"
          onClick={() => onAction('INFRASTRUCTURE', 'MEDIUM')}
        >
          <span className="icon">⚠️</span>
          <span className="label">{t(locale,'infrastructure')}</span>
        </button>

        <button
          className="emergency-btn report"
          onClick={() => onAction('GENERAL_REPORT', 'LOW')}
        >
          <span className="icon">📝</span>
          <span className="label">{t(locale,'report')}</span>
        </button>
      </div>
    </div>
  );
};

export default EmergencyButtons;
