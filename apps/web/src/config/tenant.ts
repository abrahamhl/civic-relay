/**
 * Tenant Configuration Loader
 * Mejora #3: White-label Branding - Dynamic Tenant Loading
 */

export interface TenantConfig {
  id: string;
  name: string;
  domain: string;
  region: string;
  language: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logo: string;
    favicon: string;
    logoAlt: string;
  };
  contact: {
    phone: string;
    email: string;
    emergencyNumber: string;
    website: string;
  };
  features: {
    e2eEncryption: boolean;
    offlineMode: boolean;
    multiTransport: boolean;
    cadIntegration: boolean;
    verificationRequired: boolean;
  };
  coverage: {
    municipalities: string[];
    population: number;
    area: string;
  };
  integrations: {
    cadSystem: string;
    weatherService: string;
    mapProvider: string;
  };
  theme: {
    fontFamily: string;
    borderRadius: string;
    shadowIntensity: 'light' | 'medium' | 'strong';
  };
  i18n: {
    defaultLanguage: string;
    availableLanguages: string[];
  };
  deployment: {
    environment: string;
    apiEndpoint: string;
    cdnUrl: string;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: string;
    maintainer: string;
  };
}

let currentTenant: TenantConfig | null = null;

/**
 * Load tenant configuration by ID
 */
export async function loadTenant(tenantId: string): Promise<TenantConfig> {
  try {
    // In production: fetch from API or CDN
    // For demo: fetch from public config files
    const response = await fetch(`/config/tenants/${tenantId}.json`);

    if (!response.ok) {
      throw new Error(`Failed to load tenant ${tenantId}: ${response.statusText}`);
    }

    const config: TenantConfig = await response.json();

    // Apply branding
    applyBranding(config);

    // Store current tenant
    currentTenant = config;
    localStorage.setItem('civic-relay-tenant', tenantId);

    console.log(`✅ Tenant loaded: ${config.name} (${config.region})`);

    return config;
  } catch (error) {
    console.error('Failed to load tenant:', error);
    throw error;
  }
}

/**
 * Apply tenant branding to the page
 */
function applyBranding(config: TenantConfig): void {
  const root = document.documentElement;

  // Apply CSS variables
  root.style.setProperty('--tenant-primary', config.branding.primaryColor);
  root.style.setProperty('--tenant-secondary', config.branding.secondaryColor);
  root.style.setProperty('--tenant-accent', config.branding.accentColor);
  root.style.setProperty('--tenant-font', config.theme.fontFamily);
  root.style.setProperty('--tenant-radius', config.theme.borderRadius);

  // Apply shadow intensity
  const shadowMap = {
    light: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    medium: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    strong: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  };
  root.style.setProperty('--tenant-shadow', shadowMap[config.theme.shadowIntensity]);

  // Update page title
  document.title = `${config.name} - ${config.region}`;

  // Update logo (if element exists)
  const logoEl = document.querySelector<HTMLImageElement>('#app-logo');
  if (logoEl) {
    logoEl.src = config.branding.logo;
    logoEl.alt = config.branding.logoAlt;
  }

  // Update favicon
  let favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.href = config.branding.favicon;

  // Apply language
  document.documentElement.lang = config.language;
}

/**
 * Get current tenant configuration
 */
export function getCurrentTenant(): TenantConfig | null {
  return currentTenant;
}

/**
 * Detect tenant from hostname (for multi-domain deployments)
 */
export function detectTenantFromHostname(): string {
  const hostname = window.location.hostname;

  // Map domains to tenant IDs
  const domainMap: Record<string, string> = {
    'alertamadrid.com': 'alertamadrid',
    'alertacat.cat': 'alertacat',
    'emergencycv.gva.es': 'emergencycv',
    'localhost': 'alertamadrid', // Default for development
  };

  for (const [domain, tenantId] of Object.entries(domainMap)) {
    if (hostname.includes(domain)) {
      return tenantId;
    }
  }

  // Default tenant
  return 'alertamadrid';
}

/**
 * Switch tenant (for testing/demos)
 */
export async function switchTenant(tenantId: string): Promise<void> {
  await loadTenant(tenantId);
  window.location.reload(); // Reload to apply changes
}

/**
 * Get available tenants
 */
export function getAvailableTenants(): Array<{ id: string; name: string; region: string }> {
  return [
    { id: 'alertamadrid', name: 'AlertaMadrid', region: 'Comunidad de Madrid' },
    { id: 'alertacat', name: 'AlertaCat', region: 'Catalunya' },
    { id: 'emergencycv', name: 'EmergencyCV', region: 'Comunitat Valenciana' },
  ];
}

/**
 * Initialize tenant on app startup
 */
export async function initializeTenant(): Promise<TenantConfig> {
  // 1. Check URL parameter (?tenant=xxx)
  const urlParams = new URLSearchParams(window.location.search);
  const urlTenant = urlParams.get('tenant');

  if (urlTenant) {
    return await loadTenant(urlTenant);
  }

  // 2. Check localStorage (previously selected)
  const storedTenant = localStorage.getItem('civic-relay-tenant');
  if (storedTenant) {
    return await loadTenant(storedTenant);
  }

  // 3. Detect from hostname
  const detectedTenant = detectTenantFromHostname();
  return await loadTenant(detectedTenant);
}
