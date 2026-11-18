import { useEffect, useState } from 'react';
import { createDemoSession } from '@civic-relay/core';
import type { MessageType, Priority, MessageEnvelope } from '@civic-relay/schemas';
import { LandingPage } from './components/LandingPage';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import EmergencyButtons from './components/EmergencyButtons';
import TransportStatus from './components/TransportStatus';
import MessageQueue from './components/MessageQueue';
import IncidentMap from './components/IncidentMap';
import { SimulationPanel } from './components/SimulationPanel';
import { initialLocale, t } from './i18n';
import type { Locale } from './i18n';
import './App.css';

const session = createDemoSession();
// Every transport here is an in-page simulator, NEVER a physical link.
session.transports.ip.setSimulatedState(true);
session.transports.mesh.setSimulatedState(true, 3);
session.transports.cellular.setSimulatedState(false);

function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [showLanding, setShowLanding] = useState(true);
  const [messages, setMessages] = useState<MessageEnvelope[]>([]);
  const [role, setRole] = useState<'citizen' | 'coordinator'>('citizen');
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem('civic-relay-language', locale);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', locale);
    window.history.replaceState({}, '', url.toString());
  }, [locale]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) setMessages(session.dispatcher.getStore().getAll().reverse());
    };
    void session.dispatcher.getStore().loadFromStorage().then(refresh).catch(() => {
      if (active) setError('Local storage is unavailable; this demo may lose its queue on reload.');
    });
    session.dispatcher.startPeriodicRetry(10000);
    const id = window.setInterval(refresh, 1000);
    return () => {
      active = false;
      clearInterval(id);
      session.dispatcher.stopPeriodicRetry();
    };
  }, []);

  const sendTestMessage = async (type: MessageType, priority: Priority, body?: string) => {
    setError('');
    const message = {
      id: crypto.randomUUID(),
      incidentId: null,
      createdAt: new Date().toISOString(),
      priority,
      origin: role === 'coordinator' ? 'simulated-coordinator' : 'simulated-citizen',
      payloadType: type,
      payload: { text: body ?? `TEST / ${type} — fictional data only` },
      approximateLocation: {
        lat: 40.4168,
        lon: -3.7038,
        confidence: 'LOW' as const,
        source: 'MANUAL' as const,
      },
      ttl: 3600,
      verificationState: 'UNVERIFIED' as const,
      deliveryHistory: [],
    };
    try {
      await session.dispatcher.dispatch(message as MessageEnvelope);
      setMessages(session.dispatcher.getStore().getAll().reverse());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  if (showLanding) {
    return <LandingPage locale={locale} onLocaleChange={setLocale} onEnterApp={() => {
      setShowLanding(false);
      window.scrollTo(0, 0);
    }} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-[#081a30] px-5 py-4 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => { setShowLanding(true); window.scrollTo(0,0); }} className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10">← {t(locale,'demoBack')}</button>
            <h1 className="text-xl font-black">{t(locale,'demoTitle')}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-white/10 px-3 py-2 text-xs">{t(locale,role === 'citizen' ? 'demoCitizen' : 'demoCoordinator')}</span>
            <button type="button" onClick={() => setRole(role === 'citizen' ? 'coordinator' : 'citizen')} className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10">{t(locale,'switchRole')}</button>
            <LanguageSwitcher locale={locale} onChange={setLocale} dark />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7">
        <div role="note" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-950">{t(locale,'demoBanner')}</div>
        {error && <div role="alert" className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">{error}</div>}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <SimulationPanel
              locale={locale}
              role={role}
              dispatchSimulatedMessage={(type, priority, body) => sendTestMessage(type, priority, body)}
            />
            <section className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-bold">{t(locale,'demoTransport')}</h2>
              <TransportStatus locale={locale}/>
            </section>
            {role === 'citizen' && (
              <section className="rounded-xl bg-white p-6 shadow">
                <h2 className="mb-4 text-xl font-bold">{t(locale,'demoActions')}</h2>
                <EmergencyButtons locale={locale} onAction={sendTestMessage}/>
              </section>
            )}
          </div>
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-bold">{t(locale,'demoQueue')}</h2>
              <MessageQueue locale={locale} messages={messages}/>
            </section>
            <section className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-bold">{t(locale,'demoMap')}</h2>
              <IncidentMap locale={locale} messages={messages}/>
            </section>
          </div>
        </div>
        <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="mb-2 font-bold text-blue-950">{t(locale,'demoInfoTitle')}</h2>
          <p className="text-sm leading-6 text-blue-950">{t(locale,'demoInfoBody')}</p>
        </section>
      </main>
    </div>
  );
}

export default App;
