import React from 'react';
import type { MessageEnvelope } from '@civic-relay/schemas';
import './MessageQueue.css';
import type { Locale } from '../i18n';
import { t } from '../i18n';

interface Props {
  locale: Locale;
  messages: MessageEnvelope[];
}

const MessageQueue: React.FC<Props> = ({ messages, locale }) => {
  const getDeliveryStatus = (message: MessageEnvelope): string => {
    const delivered = message.deliveryHistory.filter(a => a.status === 'DELIVERED');
    if (delivered.length > 0) {
      return `✓ ${t(locale,'queuePaths')}: ${delivered.length}`;
    }
    const queued = message.deliveryHistory.filter(a => a.status === 'QUEUED');
    if (queued.length > 0) {
      return `⏳ ${t(locale,'queueQueued')}`;
    }
    return `⏳ ${t(locale,'queuePending')}`;
  };

  const getVerificationBadge = (state: string): React.ReactNode => {
    const badges: Record<string, { label: string; className: string }> = {
      UNVERIFIED: { label: t(locale,'unverified'), className: 'badge-unverified' },
      CORROBORATED: { label: t(locale,'corroborated'), className: 'badge-corroborated' },
      OFFICIAL: { label: t(locale,'official'), className: 'badge-official' },
      DISPUTED: { label: t(locale,'disputed'), className: 'badge-disputed' },
    };
    const badge = badges[state] || badges.UNVERIFIED;
    return <span className={`verification-badge ${badge.className}`}>{badge.label}</span>;
  };

  if (messages.length === 0) {
    return (
      <div className="message-queue empty">
        <p>{t(locale,'queueEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="message-queue">
      <h2>{t(locale,'queueHistory')}</h2>
      <div className="message-list">
        {messages.map((msg) => (
          <div key={msg.id} className="message-card">
            <div className="message-header">
              <span className={`message-type type-${msg.payloadType.toLowerCase()}`}>
                {msg.payloadType}
              </span>
              <span className={`message-priority priority-${msg.priority.toLowerCase()}`}>
                {msg.priority}
              </span>
            </div>
            <div className="message-body">
              <div className="message-time">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </div>
              <div className="message-status">{getDeliveryStatus(msg)}</div>
              {getVerificationBadge(msg.verificationState)}
            </div>
            {msg.deliveryHistory.length > 0 && (
              <details className="message-details">
                <summary>{t(locale,'queueAttempts')} ({msg.deliveryHistory.length})</summary>
                <ul>
                  {msg.deliveryHistory.map((attempt, i) => (
                    <li key={i}>
                      {attempt.transportId}: {attempt.status}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MessageQueue;
