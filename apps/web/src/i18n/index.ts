/**
 * Internationalization Configuration
 * Fase B: i18n (ES, EN, CA)
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: {
        translation: {
          // Emergency
          'emergency.safe': 'Estoy bien',
          'emergency.sos': 'Necesito ayuda',
          'emergency.medical': 'Emergencia médica',
          'emergency.fire': 'Incendio',
          'emergency.police': 'Policía',
          'emergency.infrastructure': 'Infraestructura',

          // Common
          'common.send': 'Enviar',
          'common.cancel': 'Cancelar',
          'common.close': 'Cerrar',
          'common.save': 'Guardar',
          'common.loading': 'Cargando...',

          // Dashboard
          'dashboard.title': 'Panel de Control',
          'dashboard.stats': 'Estadísticas',
          'dashboard.messages': 'Mensajes',
          'dashboard.alerts': 'Alertas',

          // Status
          'status.online': 'En línea',
          'status.offline': 'Desconectado',
          'status.connecting': 'Conectando...',
        }
      },
      en: {
        translation: {
          // Emergency
          'emergency.safe': "I'm safe",
          'emergency.sos': 'I need help',
          'emergency.medical': 'Medical emergency',
          'emergency.fire': 'Fire',
          'emergency.police': 'Police',
          'emergency.infrastructure': 'Infrastructure',

          // Common
          'common.send': 'Send',
          'common.cancel': 'Cancel',
          'common.close': 'Close',
          'common.save': 'Save',
          'common.loading': 'Loading...',

          // Dashboard
          'dashboard.title': 'Dashboard',
          'dashboard.stats': 'Statistics',
          'dashboard.messages': 'Messages',
          'dashboard.alerts': 'Alerts',

          // Status
          'status.online': 'Online',
          'status.offline': 'Offline',
          'status.connecting': 'Connecting...',
        }
      },
      ca: {
        translation: {
          // Emergency
          'emergency.safe': 'Estic bé',
          'emergency.sos': 'Necessito ajuda',
          'emergency.medical': 'Emergència mèdica',
          'emergency.fire': 'Incendi',
          'emergency.police': 'Policia',
          'emergency.infrastructure': 'Infraestructura',

          // Common
          'common.send': 'Enviar',
          'common.cancel': 'Cancel·lar',
          'common.close': 'Tancar',
          'common.save': 'Desar',
          'common.loading': 'Carregant...',

          // Dashboard
          'dashboard.title': 'Panell de Control',
          'dashboard.stats': 'Estadístiques',
          'dashboard.messages': 'Missatges',
          'dashboard.alerts': 'Alertes',

          // Status
          'status.online': 'En línia',
          'status.offline': 'Desconnectat',
          'status.connecting': 'Connectant...',
        }
      }
    },
    lng: 'es',
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
