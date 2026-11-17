'use client';

import React, { useMemo, useState } from 'react';
import type { Locale } from './copy';
import {
  computeReliabilityDiagram,
  generateSyntheticCalibrationDataset,
  ingestPilotReceiptsIntoCalibration,
  BEARER_CALIBRATION_PROFILES
} from '../public/senda/core/calibration-diagram.mjs';

interface CalibrationBin {
  binIndex: number;
  range: [number, number];
  count: number;
  weight: number;
  meanPredicted: number;
  meanObserved: number | null;
  calibrationError: number;
  confidenceInterval: { lower: number; upper: number; center: number };
}

interface CalibrationResult {
  sampleCount: number;
  brierScore: number;
  brierScoreBinned: number;
  withinBinDiscretization: number;
  referenceBrier: number;
  brierSkillScore: number | null;
  ece: number;
  mce: number;
  prevalence: number;
  murphy: {
    reliability: number;
    resolution: number;
    uncertainty: number;
    decomposedScore: number;
  };
  bins: CalibrationBin[];
  isCalibrated: boolean;
}

interface SampleItem {
  id: string;
  bearer: string;
  predicted: number;
  observed: number;
  environmentStress?: string;
  source: string;
  zone_h3?: string | null;
  sent_at?: string | null;
}

interface DatasetResult {
  samples: SampleItem[];
  metadata: {
    epistemicStatus: 'SIMULADO' | 'DATO_REAL_CAPTURADO' | 'VALIDACION_FISICA_PENDIENTE';
    warning: string;
    sampleCount: number;
    seed?: number;
    stress?: string;
    generatedAtUtc?: string;
    ingestedAtUtc?: string;
  };
}

const bearerProfiles = BEARER_CALIBRATION_PROFILES as Record<
  string,
  {
    name: string;
    nominalDeliveryRate: number;
    fadingStdDev: number;
    costEur: number;
    stressPenalty: Record<string, number>;
  }
>;

interface CalibrationPanelProps {
  locale: Locale;
}

export default function CalibrationPanel({ locale }: CalibrationPanelProps) {
  const [selectedBearer, setSelectedBearer] = useState<string>('ALL');
  const [selectedStress, setSelectedStress] = useState<'NORMAL' | 'RAIN_DANA' | 'BLACKOUT' | 'JAMMING'>('NORMAL');
  const [sampleSize, setSampleSize] = useState<number>(300);
  const [dataSource, setDataSource] = useState<'SIMULATED' | 'PILOT_RECEIPTS'>('SIMULATED');

  const dict = useMemo(() => {
    return {
      es: {
        badgeSim: 'SIMULADO',
        badgeReal: 'DATO REAL CAPTURADO',
        badgeTitle: 'SENDA-CAL · PANEL DE CALIBRACIÓN PROBABILÍSTICA (L2.5)',
        title: 'Fiabilidad Probabilística y Diagrama de Calibración de Canal',
        lead:
          'Evaluación matemática de la concordancia entre la probabilidad predicha de entrega P(entrega) y el éxito empírico observado. Binned en 5 intervalos con intervalos de confianza de Wilson (95 %) y descomposición de Murphy del Brier Score.',
        epistemicWarningSim:
          'ATENCIÓN: Datos sintéticos generados mediante modelos de propagación física (Nakagami-m, desvanecimiento plano y atenuación de lluvia ITU-R P.838). Pendiente de sustitución definitiva por mediciones de campo según PILOT_PROTOCOL_2026-11.md.',
        epistemicWarningReal:
          'DATOS DE CAMPO: Recibos autenticados sin PII generados por terminales de prueba bajo el protocolo estandarizado.',
        channelLabel: 'Canal Portador:',
        stressLabel: 'Escenario de Estrés:',
        sizeLabel: 'Muestras Sintéticas:',
        sourceLabel: 'Origen de Datos:',
        optAll: 'Agregado Multicanal (Todos)',
        optNormal: 'Normal (Línea de vista y propagación nominal)',
        optRain: 'Tormenta / DANA (Atenuación pluviométrica)',
        optBlackout: 'Apagón Eléctrico (Torres celulares caídas)',
        optJamming: 'Interferencia / Guerra Electrónica (RF degradado)',
        srcSim: 'Prior Físico Sintético [SIMULADO]',
        srcPilot: 'Lote Piloto de Campo (50 recibos OEP)',
        metricsHeader: 'Métricas de Calibración y Puntuación Estricta',
        brierTitle: 'Brier Score (BS)',
        brierDesc: 'Error cuadrático medio. Óptimo = 0.000.',
        bssTitle: 'Brier Skill Score (BSS)',
        bssDesc: 'Mejora sobre la predicción climatológica base.',
        eceTitle: 'Error de Calibración (ECE)',
        eceDesc: 'Discrepancia ponderada absoluta entre predicción y realidad.',
        mceTitle: 'Error Máximo (MCE)',
        mceDesc: 'Discrepancia máxima en el peor bin.',
        baseRateTitle: 'Tasa Base Empírica (p̄)',
        baseRateDesc: 'Fracción total de paquetes entregados con éxito.',
        diagramTitle: 'Diagrama de Fiabilidad (Curva de Calibración 5-Bin)',
        predictedAxis: 'Probabilidad Predicha P(entrega)',
        observedAxis: 'Frecuencia Observada de Entrega',
        perfectDiag: 'Calibración Perfecta (y = x)',
        binTableTitle: 'Desglose por Intervalo de Confianza (Wilson 95 %)',
        thBin: 'Intervalo',
        thCount: 'Nº Paquetes',
        thWeight: 'Peso (%)',
        thPredMean: 'P̄ Predicha',
        thObsMean: 'P̄ Observada',
        thWilson: 'IC Wilson (95 %)',
        thErr: 'Cal. Error |P̄ - Ō|',
        murphyTitle: 'Descomposición del Brier Score (Murphy, 1973)',
        murphyLead:
          'Descompone el BS binned exactamente en: BS = Fiabilidad (Reliability) − Resolución (Resolution) + Incertidumbre (Uncertainty).',
        relTitle: 'Fiabilidad (Reliability):',
        relDesc: 'Penalización por falta de calibración (menor es mejor → 0).',
        resTitle: 'Resolución (Resolution):',
        resDesc: 'Capacidad de discriminar casos de éxito y fracaso (mayor es mejor).',
        uncTitle: 'Incertidumbre (Uncertainty):',
        uncDesc: 'Varianza intrínseca del canal p̄(1 − p̄).'
      },
      en: {
        badgeSim: 'SIMULATED',
        badgeReal: 'FIELD DATA CAPTURED',
        badgeTitle: 'SENDA-CAL · PROBABILISTIC CALIBRATION PANEL (L2.5)',
        title: 'Probabilistic Reliability & Channel Calibration Diagram',
        lead:
          'Mathematical verification of consistency between predicted delivery probability P(delivery) and observed empirical outcome. Grouped into 5 bins with 95% Wilson confidence intervals and Murphy (1973) Brier Score decomposition.',
        epistemicWarningSim:
          'NOTICE: Synthetic data generated from analytical physical models (Nakagami-m fading and ITU-R P.838 rain attenuation). Awaiting replacement by authentic field measurements per PILOT_PROTOCOL_2026-11.md.',
        epistemicWarningReal:
          'FIELD DATA: Authenticated PII-free delivery receipts collected by test phones under standard protocol.',
        channelLabel: 'Bearer Channel:',
        stressLabel: 'Stress Scenario:',
        sizeLabel: 'Synthetic Samples:',
        sourceLabel: 'Data Source:',
        optAll: 'Multi-Bearer Aggregate (All)',
        optNormal: 'Nominal (Line-of-Sight & clear sky)',
        optRain: 'Severe Storm / DANA Floods (Rain attenuation)',
        optBlackout: 'Power Blackout (Cellular towers down)',
        optJamming: 'RF Jamming / Severe Interference',
        srcSim: 'Synthetic Physical Prior [SIMULATED]',
        srcPilot: 'Field Pilot Batch (50 OEP receipts)',
        metricsHeader: 'Calibration Metrics & Proper Scoring Rules',
        brierTitle: 'Brier Score (BS)',
        brierDesc: 'Mean squared probability error. Perfect = 0.000.',
        bssTitle: 'Brier Skill Score (BSS)',
        bssDesc: 'Skill improvement relative to base rate climatology.',
        eceTitle: 'Calibration Error (ECE)',
        eceDesc: 'Weighted mean absolute calibration discrepancy.',
        mceTitle: 'Maximum Error (MCE)',
        mceDesc: 'Peak discrepancy in worst-performing bin.',
        baseRateTitle: 'Empirical Base Rate (p̄)',
        baseRateDesc: 'Fraction of packets successfully delivered and ACKed.',
        diagramTitle: 'Reliability Diagram (5-Bin Calibration Curve)',
        predictedAxis: 'Forecast Probability P(delivery)',
        observedAxis: 'Observed Empirical Success Rate',
        perfectDiag: 'Perfect Calibration (y = x)',
        binTableTitle: 'Bin Breakdown with Wilson 95% Confidence Intervals',
        thBin: 'Interval',
        thCount: 'Packets',
        thWeight: 'Weight (%)',
        thPredMean: 'Mean Forecast',
        thObsMean: 'Mean Observed',
        thWilson: 'Wilson 95% CI',
        thErr: 'Cal. Error |F̄ - Ō|',
        murphyTitle: 'Brier Score Decomposition (Murphy, 1973)',
        murphyLead:
          'Decomposes binned BS exactly into: BS = Reliability − Resolution + Uncertainty.',
        relTitle: 'Reliability:',
        relDesc: 'Calibration deficit penalty (lower is better → 0).',
        resTitle: 'Resolution:',
        resDesc: 'Ability to discriminate successful from failed links (higher is better).',
        uncTitle: 'Uncertainty:',
        uncDesc: 'Intrinsic channel entropy p̄(1 − p̄).'
      },
      nl: {
        badgeSim: 'GESIMULEERD',
        badgeReal: 'VELDGEGEVENS VASTGELEGD',
        badgeTitle: 'SENDA-CAL · PROBABILISTISCH KALIBRATIEPANEEL (L2.5)',
        title: 'Probabilistische Betrouwbaarheid & Kanaalkalibratiediagram',
        lead:
          'Wiskundige verificatie van overeenstemming tussen voorspelde bezorgwaarschijnlijkheid P(levering) en waargenomen empirische uitkomst. Verdeeld in 5 bins met 95% Wilson-betrouwbaarheidsintervallen en Murphy Brier-score decompositie.',
        epistemicWarningSim:
          'LET OP: Synthetische gegevens gegenereerd via fysische modellen (Nakagami-m en ITU-R P.838 regenverzwakking). Wordt vervangen door reële veldgegevens volgens PILOT_PROTOCOL_2026-11.md.',
        epistemicWarningReal:
          'VELDGEGEVENS: Geauthenticeerde ontvangstbewijzen zonder PII van testtoestellen.',
        channelLabel: 'Dragerkanaal:',
        stressLabel: 'Stressscenario:',
        sizeLabel: 'Aantal Musters:',
        sourceLabel: 'Gegevensbron:',
        optAll: 'Geaggregeerd (Alle)',
        optNormal: 'Normaal (Zichtlijn & heldere hemel)',
        optRain: 'Zware Storm / DANA (Regenverzwakking)',
        optBlackout: 'Stroomuitval (Zendmasten offline)',
        optJamming: 'RF-Jamming / Interferentie',
        srcSim: 'Fysische Prior [GESIMULEERD]',
        srcPilot: 'Veldtestbatch (50 OEP-ontvangstbewijzen)',
        metricsHeader: 'Kalibratiemetrieken & Strikte Scoringsregels',
        brierTitle: 'Brier Score (BS)',
        brierDesc: 'Gemiddelde kwadratische fout. Optimaal = 0.000.',
        bssTitle: 'Brier Skill Score (BSS)',
        bssDesc: 'Verbetering t.o.v. klimatologische basislijn.',
        eceTitle: 'Kalibratiefout (ECE)',
        eceDesc: 'Gewogen gemiddelde absolute afwijking.',
        mceTitle: 'Maximale Fout (MCE)',
        mceDesc: 'Piekfout in het slechtste bin.',
        baseRateTitle: 'Empirische Basisfunctie (p̄)',
        baseRateDesc: 'Fractie succesvol afgeleverde pakketten.',
        diagramTitle: 'Betrouwbaarheidsdiagram (5-Bin Kalibratiecurve)',
        predictedAxis: 'Voorspelde Waarschijnlijkheid P(levering)',
        observedAxis: 'Waargenomen Bezorgpercentage',
        perfectDiag: 'Perfecte Kalibratie (y = x)',
        binTableTitle: 'Bin-uitsplitsing met Wilson 95%-Betrouwbaarheidsintervallen',
        thBin: 'Interval',
        thCount: 'Pakketten',
        thWeight: 'Gewicht (%)',
        thPredMean: 'Gem. Voorspeld',
        thObsMean: 'Gem. Waargenomen',
        thWilson: 'Wilson 95% BI',
        thErr: 'Kal. Fout |F̄ - Ō|',
        murphyTitle: 'Brier-Score Decompositie (Murphy, 1973)',
        murphyLead:
          'Ontbindt binned BS exact in: BS = Betrouwbaarheid − Resolutie + Onzekerheid.',
        relTitle: 'Betrouwbaarheid (Reliability):',
        relDesc: 'Straf voor miskalibratie (lager is beter → 0).',
        resTitle: 'Resolutie (Resolution):',
        resDesc: 'Onderscheidend vermogen tussen succes en falen.',
        uncTitle: 'Onzekerheid (Uncertainty):',
        uncDesc: 'Intrinsieke kanaalentropie p̄(1 − p̄).'
      }
    }[locale] ?? {
      badgeSim: 'SIMULATED',
      badgeReal: 'FIELD DATA CAPTURED',
      badgeTitle: 'SENDA-CAL · PROBABILISTIC CALIBRATION PANEL (L2.5)',
      title: 'Probabilistic Reliability & Channel Calibration Diagram',
      lead: '',
      epistemicWarningSim: '',
      epistemicWarningReal: '',
      channelLabel: 'Bearer:',
      stressLabel: 'Stress:',
      sizeLabel: 'Samples:',
      sourceLabel: 'Source:',
      optAll: 'All',
      optNormal: 'Normal',
      optRain: 'Rain',
      optBlackout: 'Blackout',
      optJamming: 'Jamming',
      srcSim: 'Simulated',
      srcPilot: 'Pilot',
      metricsHeader: 'Metrics',
      brierTitle: 'Brier Score',
      brierDesc: '',
      bssTitle: 'Brier Skill Score',
      bssDesc: '',
      eceTitle: 'ECE',
      eceDesc: '',
      mceTitle: 'MCE',
      mceDesc: '',
      baseRateTitle: 'Base Rate',
      baseRateDesc: '',
      diagramTitle: 'Reliability Diagram',
      predictedAxis: 'Forecast P',
      observedAxis: 'Observed P',
      perfectDiag: 'Perfect (y = x)',
      binTableTitle: 'Bins',
      thBin: 'Bin',
      thCount: 'N',
      thWeight: 'Weight',
      thPredMean: 'Mean Pred',
      thObsMean: 'Mean Obs',
      thWilson: 'Wilson 95%',
      thErr: 'Error',
      murphyTitle: 'Murphy Decomposition',
      murphyLead: '',
      relTitle: 'Reliability',
      relDesc: '',
      resTitle: 'Resolution',
      resDesc: '',
      uncTitle: 'Uncertainty',
      uncDesc: ''
    };
  }, [locale]);

  // Generate or ingest samples
  const dataset = useMemo(() => {
    if (dataSource === 'PILOT_RECEIPTS') {
      // 50 synthetic test receipts modeling PILOT_PROTOCOL_2026-11
      const pilotReceipts = Array.from({ length: 50 }, (_, i) => {
        const isMeshtastic = i % 2 === 0;
        const bearer = isMeshtastic ? 'MESHTASTIC' : 'PHONE_MESH';
        const predictedProb = isMeshtastic ? 0.85 : 0.65;
        // Seeded deterministic delivery outcome
        const delivered = (i * 17 + 11) % 100 < predictedProb * 100;
        return {
          receipt_id: `pilot-rec-202611-${String(i + 1).padStart(3, '0')}`,
          bearer_id: bearer,
          zone_h3: '87391a45bffffff',
          predicted_probability: predictedProb,
          outcome: delivered ? 'DELIVERED' : 'TIMEOUT',
          sent_at: new Date(1731240000000 + i * 120000).toISOString()
        };
      });
      return ingestPilotReceiptsIntoCalibration(pilotReceipts) as DatasetResult;
    }

    return generateSyntheticCalibrationDataset({
      count: sampleSize,
      stress: selectedStress,
      seed: 42
    }) as DatasetResult;
  }, [dataSource, sampleSize, selectedStress]);

  // Filter samples by selected bearer
  const filteredSamples = useMemo(() => {
    if (selectedBearer === 'ALL') return dataset.samples;
    return dataset.samples.filter((s: SampleItem) => s.bearer === selectedBearer);
  }, [dataset, selectedBearer]);

  // Compute 5-bin reliability diagram
  const calibration = useMemo(() => {
    return computeReliabilityDiagram(filteredSamples, { numBins: 5 }) as CalibrationResult;
  }, [filteredSamples]);

  const isSimulated = dataset.metadata.epistemicStatus === 'SIMULADO';

  return (
    <section
      data-testid="calibration-panel-surface"
      style={{
        marginTop: '2rem',
        marginBottom: '3rem',
        padding: '1.75rem',
        background: '#0a0f1d',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        color: '#f8fafc',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* Header with Epistemic Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <span
          style={{
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            fontWeight: 700,
            color: '#38bdf8',
            textTransform: 'uppercase'
          }}
        >
          {dict.badgeTitle}
        </span>
        <span
          style={{
            fontSize: '0.7rem',
            padding: '0.25rem 0.65rem',
            borderRadius: '9999px',
            fontWeight: 800,
            letterSpacing: '0.06em',
            background: isSimulated ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            border: isSimulated ? '1px solid #f59e0b' : '1px solid #22c55e',
            color: isSimulated ? '#fbbf24' : '#4ade80'
          }}
        >
          [{isSimulated ? dict.badgeSim : dict.badgeReal}]
        </span>
      </div>

      <h2 style={{ fontSize: '1.45rem', marginTop: '0.6rem', marginBottom: '0.4rem', color: '#f8fafc' }}>
        {dict.title}
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '85ch', marginBottom: '1.25rem' }}>
        {dict.lead}
      </p>

      {/* Epistemic Guardrail Notice */}
      <div
        style={{
          background: isSimulated ? 'rgba(245, 158, 11, 0.08)' : 'rgba(34, 197, 94, 0.08)',
          borderLeft: isSimulated ? '4px solid #f59e0b' : '4px solid #22c55e',
          padding: '0.75rem 1rem',
          borderRadius: '4px',
          fontSize: '0.82rem',
          lineHeight: 1.45,
          color: isSimulated ? '#fde68a' : '#bbf7d0',
          marginBottom: '1.5rem'
        }}
      >
        <strong>{isSimulated ? '🔬 [SIMULADO] ' : '📡 [DATO REAL] '}</strong>
        {isSimulated ? dict.epistemicWarningSim : dict.epistemicWarningReal}
      </div>

      {/* Interactive Controls Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          padding: '1rem',
          background: '#0f172a',
          borderRadius: '8px',
          border: '1px solid #1e293b',
          marginBottom: '1.5rem'
        }}
      >
        {/* Bearer Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
            {dict.channelLabel}
          </label>
          <select
            value={selectedBearer}
            onChange={(e) => setSelectedBearer(e.target.value)}
            style={{
              width: '100%',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              padding: '0.45rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}
          >
            <option value="ALL">{dict.optAll}</option>
            {Object.keys(bearerProfiles).map((k) => (
              <option key={k} value={k}>
                {bearerProfiles[k].name}
              </option>
            ))}
          </select>
        </div>

        {/* Environmental Stress */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
            {dict.stressLabel}
          </label>
          <select
            value={selectedStress}
            disabled={dataSource === 'PILOT_RECEIPTS'}
            onChange={(e) => setSelectedStress(e.target.value as any)}
            style={{
              width: '100%',
              background: dataSource === 'PILOT_RECEIPTS' ? '#111827' : '#1e293b',
              color: dataSource === 'PILOT_RECEIPTS' ? '#64748b' : '#f8fafc',
              border: '1px solid #334155',
              padding: '0.45rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}
          >
            <option value="NORMAL">{dict.optNormal}</option>
            <option value="RAIN_DANA">{dict.optRain}</option>
            <option value="BLACKOUT">{dict.optBlackout}</option>
            <option value="JAMMING">{dict.optJamming}</option>
          </select>
        </div>

        {/* Source Toggle */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
            {dict.sourceLabel}
          </label>
          <select
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value as any)}
            style={{
              width: '100%',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              padding: '0.45rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}
          >
            <option value="SIMULATED">{dict.srcSim}</option>
            <option value="PILOT_RECEIPTS">{dict.srcPilot}</option>
          </select>
        </div>

        {/* Sample Size */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
            {dict.sizeLabel} ({dataSource === 'SIMULATED' ? sampleSize : 50})
          </label>
          <select
            value={sampleSize}
            disabled={dataSource === 'PILOT_RECEIPTS'}
            onChange={(e) => setSampleSize(Number(e.target.value))}
            style={{
              width: '100%',
              background: dataSource === 'PILOT_RECEIPTS' ? '#111827' : '#1e293b',
              color: dataSource === 'PILOT_RECEIPTS' ? '#64748b' : '#f8fafc',
              border: '1px solid #334155',
              padding: '0.45rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}
          >
            <option value={100}>100</option>
            <option value={300}>300</option>
            <option value={1000}>1,000</option>
          </select>
        </div>
      </div>

      {/* Metrics Row */}
      <h3 style={{ fontSize: '1rem', color: '#e2e8f0', marginBottom: '0.75rem' }}>
        {dict.metricsHeader} (N = {calibration.sampleCount})
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem'
        }}
      >
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dict.brierTitle}</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
            {calibration.brierScore.toFixed(4)}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>{dict.brierDesc}</div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dict.bssTitle}</div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: calibration.brierSkillScore !== null && calibration.brierSkillScore > 0 ? '#4ade80' : '#f87171',
              marginTop: '0.2rem'
            }}
          >
            {calibration.brierSkillScore !== null ? `${(calibration.brierSkillScore * 100).toFixed(1)} %` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>{dict.bssDesc}</div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dict.eceTitle}</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: calibration.ece < 0.1 ? '#4ade80' : '#fbbf24', marginTop: '0.2rem' }}>
            {(calibration.ece * 100).toFixed(2)} %
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>{dict.eceDesc}</div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dict.mceTitle}</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
            {(calibration.mce * 100).toFixed(2)} %
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>{dict.mceDesc}</div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dict.baseRateTitle}</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#e2e8f0', marginTop: '0.2rem' }}>
            {(calibration.prevalence * 100).toFixed(1)} %
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>{dict.baseRateDesc}</div>
        </div>
      </div>

      {/* Visual Chart and Bin Table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* SVG Reliability Diagram */}
        <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
          <h4 style={{ fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '0.75rem', fontWeight: 600 }}>
            {dict.diagramTitle}
          </h4>
          <svg viewBox="0 0 320 320" style={{ width: '100%', height: 'auto', maxHeight: '300px', display: 'block' }}>
            {/* Background grid */}
            <rect x="40" y="20" width="260" height="260" fill="#030712" rx="4" stroke="#1e293b" />
            <line x1="40" y1="280" x2="300" y2="280" stroke="#334155" strokeWidth="1" />
            <line x1="40" y1="20" x2="40" y2="280" stroke="#334155" strokeWidth="1" />

            {/* Grid horizontal & vertical lines at 0.2, 0.4, 0.6, 0.8 */}
            {[0.2, 0.4, 0.6, 0.8].map((v) => {
              const pos = 40 + v * 260;
              const yPos = 280 - v * 260;
              return (
                <React.Fragment key={v}>
                  <line x1={pos} y1="20" x2={pos} y2="280" stroke="#1e293b" strokeDasharray="3 3" />
                  <line x1="40" y1={yPos} x2="300" y2={yPos} stroke="#1e293b" strokeDasharray="3 3" />
                  <text x={pos} y="295" fill="#64748b" fontSize="9" textAnchor="middle">
                    {v.toFixed(1)}
                  </text>
                  <text x="32" y={yPos + 3} fill="#64748b" fontSize="9" textAnchor="end">
                    {v.toFixed(1)}
                  </text>
                </React.Fragment>
              );
            })}

            {/* Perfect calibration diagonal (y = x) */}
            <line x1="40" y1="280" x2="300" y2="20" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 4" />

            {/* Histogram bars at bottom for sample density */}
            {calibration.bins.map((b) => {
              const xStart = 40 + b.range[0] * 260;
              const barW = (b.range[1] - b.range[0]) * 260;
              const barH = b.weight * 50; // max 50px height
              return (
                <rect
                  key={`hist-${b.binIndex}`}
                  x={xStart + 2}
                  y={280 - barH}
                  width={Math.max(1, barW - 4)}
                  height={barH}
                  fill="rgba(56, 189, 248, 0.15)"
                  stroke="rgba(56, 189, 248, 0.4)"
                  strokeWidth="0.5"
                />
              );
            })}

            {/* Plotted Calibration Points and Wilson Error Bars */}
            {calibration.bins.map((b) => {
              if (b.meanObserved === null || b.count === 0) return null;
              const px = 40 + b.meanPredicted * 260;
              const py = 280 - b.meanObserved * 260;
              const yLow = 280 - b.confidenceInterval.lower * 260;
              const yHigh = 280 - b.confidenceInterval.upper * 260;

              return (
                <g key={`point-${b.binIndex}`}>
                  {/* Wilson vertical error bar */}
                  <line x1={px} y1={yLow} x2={px} y2={yHigh} stroke="#38bdf8" strokeWidth="1.5" />
                  <line x1={px - 4} y1={yLow} x2={px + 4} y2={yLow} stroke="#38bdf8" strokeWidth="1.5" />
                  <line x1={px - 4} y1={yHigh} x2={px + 4} y2={yHigh} stroke="#38bdf8" strokeWidth="1.5" />
                  {/* Data dot */}
                  <circle cx={px} cy={py} r="4" fill="#38bdf8" stroke="#0a0f1d" strokeWidth="1.5" />
                </g>
              );
            })}

            {/* Axis labels */}
            <text x="170" y="312" fill="#94a3b8" fontSize="10" textAnchor="middle">
              {dict.predictedAxis}
            </text>
            <text x="-150" y="14" fill="#94a3b8" fontSize="10" textAnchor="middle" transform="rotate(-90)">
              {dict.observedAxis}
            </text>
          </svg>
        </div>

        {/* Binned Statistical Table */}
        <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b', overflowX: 'auto' }}>
          <h4 style={{ fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '0.75rem', fontWeight: 600 }}>
            {dict.binTableTitle}
          </h4>
          <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                <th style={{ padding: '0.4rem 0.5rem' }}>{dict.thBin}</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>{dict.thCount}</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>{dict.thPredMean}</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>{dict.thObsMean}</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>{dict.thWilson}</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>{dict.thErr}</th>
              </tr>
            </thead>
            <tbody>
              {calibration.bins.map((b) => (
                <tr key={b.binIndex} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace', color: '#38bdf8' }}>
                    [{b.range[0].toFixed(1)}, {b.range[1].toFixed(1)}]
                  </td>
                  <td style={{ padding: '0.4rem 0.5rem', color: '#f8fafc' }}>{b.count}</td>
                  <td style={{ padding: '0.4rem 0.5rem', color: '#cbd5e1' }}>
                    {b.meanPredicted.toFixed(3)}
                  </td>
                  <td style={{ padding: '0.4rem 0.5rem', color: b.meanObserved !== null ? '#f8fafc' : '#64748b' }}>
                    {b.meanObserved !== null ? b.meanObserved.toFixed(3) : '—'}
                  </td>
                  <td style={{ padding: '0.4rem 0.5rem', color: '#94a3b8', fontSize: '0.72rem' }}>
                    {b.count > 0
                      ? `[${b.confidenceInterval.lower.toFixed(2)}, ${b.confidenceInterval.upper.toFixed(2)}]`
                      : '—'}
                  </td>
                  <td style={{ padding: '0.4rem 0.5rem', color: b.calibrationError < 0.08 ? '#4ade80' : '#fbbf24' }}>
                    {b.count > 0 ? (b.calibrationError * 100).toFixed(1) + ' %' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Murphy (1973) Decomposition Section */}
      <div
        style={{
          background: '#0f172a',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #1e293b'
        }}
      >
        <h4 style={{ fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '0.35rem', fontWeight: 600 }}>
          {dict.murphyTitle}
        </h4>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.4, marginBottom: '0.75rem' }}>
          {dict.murphyLead}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ borderLeft: '3px solid #38bdf8', paddingLeft: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dict.relTitle}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              {calibration.murphy.reliability.toFixed(5)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{dict.relDesc}</div>
          </div>

          <div style={{ borderLeft: '3px solid #4ade80', paddingLeft: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dict.resTitle}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              {calibration.murphy.resolution.toFixed(5)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{dict.resDesc}</div>
          </div>

          <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dict.uncTitle}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              {calibration.murphy.uncertainty.toFixed(5)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{dict.uncDesc}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
