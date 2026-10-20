import { useEffect, useState } from 'react';
import type { MessageType, Priority } from '@civic-relay/schemas';
import type { Locale } from '../i18n';
import { t } from '../i18n';

type Props = {
  role: 'citizen' | 'coordinator';
  locale: Locale;
  dispatchSimulatedMessage: (type: MessageType, priority: Priority, body: string) => Promise<void> | void;
};

export function SimulationPanel({ role, locale, dispatchSimulatedMessage }: Props) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [exercise, setExercise] = useState(false);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown(value => value === null ? null : value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const startExercise = () => {
    setExercise(true);
    setCountdown(10);
  };

  return (
    <section className="rounded-xl border border-cyan-200 bg-white p-6 shadow">
      <h2 className="mb-4 text-xl font-bold">🎮 {t(locale,'scenarioTitle')}</h2>
      <p className="mb-5 text-sm leading-6 text-slate-600">{t(locale,'scenarioExplanation')}</p>
      {role === 'coordinator' ? (
        <button type="button" onClick={() => void dispatchSimulatedMessage('INFO','LOW','EXERCISE / fictional coordinator announcement')} className="w-full rounded-lg bg-slate-800 px-4 py-3 font-bold text-white hover:bg-slate-700">{t(locale,'scenarioBroadcast')}</button>
      ) : (
        <div className="space-y-3">
          <button type="button" onClick={startExercise} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-bold text-white hover:bg-blue-600">{t(locale,'scenarioAlert')}</button>
          <button type="button" onClick={() => void dispatchSimulatedMessage('INFO','LOW','EXERCISE / fictional two-way message')} className="w-full rounded-lg bg-indigo-700 px-4 py-3 font-bold text-white hover:bg-indigo-600">{t(locale,'scenarioBidi')}</button>
          {exercise && (
            <div role="status" className="rounded-xl border-2 border-orange-300 bg-orange-50 p-4 text-orange-950">
              <p className="font-bold">{t(locale,'scenarioAlertText')}</p>
              <p className="my-2 font-mono text-sm">{t(locale,'scenarioCount')}: {countdown ?? 0}s</p>
              <p className="mb-4 text-xs">{t(locale,'scenarioNoAuto')}</p>
              <button type="button" onClick={() => {
                setCountdown(null);
                setExercise(false);
                void dispatchSimulatedMessage('SAFE','LOW','EXERCISE / fictional safety confirmation');
              }} className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-600">{t(locale,'scenarioConfirm')}</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
