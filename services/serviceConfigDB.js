// ============================================================
// serviceConfigDB.js - Server-side version
// Same API as the browser version, in-memory backing store
// ============================================================

const STORE = new Map();       // id → config
const VERSIONS = new Map();    // serviceId → version

class ServiceConfigDB {
  constructor() { this.initialized = true; }
  async init() { return true; }

  async saveServiceConfig(config) {
    const now = new Date().toISOString();
    const configToSave = {
      ...config,
      createdAt: config.createdAt || now,
      updatedAt: now,
      isActive: config.isActive !== undefined ? config.isActive : true,
      version: (config.version || 0) + 1
    };
    if (!configToSave.id) configToSave.id = `${configToSave.serviceId}_${Date.now()}`;
    STORE.set(configToSave.id, configToSave);
    VERSIONS.set(configToSave.serviceId, configToSave.version);
    return configToSave;
  }

  async getServiceConfig(id) { return STORE.get(id) || null; }

  async getAllServiceConfigs(includeInactive = false) {
    let results = Array.from(STORE.values());
    if (!includeInactive) results = results.filter(c => c.isActive !== false);
    return results;
  }

  async getServiceConfigsByServiceId(serviceId, includeInactive = false) {
    let results = Array.from(STORE.values()).filter(c => c.serviceId === serviceId);
    if (!includeInactive) results = results.filter(c => c.isActive !== false);
    return results;
  }

  async getLatestServiceConfig(serviceId) {
    const configs = await this.getServiceConfigsByServiceId(serviceId);
    if (configs.length === 0) return null;
    configs.sort((a, b) => (b.version || 0) - (a.version || 0));
    return configs[0];
  }

  async getActiveServiceConfigs() { return this.getAllServiceConfigs(false); }

  async updateServiceConfig(id, updates) {
    const existing = STORE.get(id);
    if (!existing) throw new Error(`Service config with ID ${id} not found`);
    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString(), version: (existing.version || 0) + 1 };
    STORE.set(id, updated);
    return updated;
  }

  async deleteServiceConfig(id) { STORE.delete(id); return true; }
  async deactivateServiceConfig(id) { return this.updateServiceConfig(id, { isActive: false }); }
  async activateServiceConfig(id) { return this.updateServiceConfig(id, { isActive: true }); }

  async searchServiceConfigs(searchTerm) {
    const s = searchTerm.toLowerCase();
    return Array.from(STORE.values()).filter(c => {
      const nameMatch = c.name && typeof c.name === 'object'
        ? (c.name.en || '').toLowerCase().includes(s) || (c.name.am || '').toLowerCase().includes(s)
        : (c.name || '').toLowerCase().includes(s);
      const descMatch = c.description && typeof c.description === 'object'
        ? (c.description.en || '').toLowerCase().includes(s) || (c.description.am || '').toLowerCase().includes(s)
        : (c.description || '').toLowerCase().includes(s);
      const idMatch = (c.serviceId || '').toLowerCase().includes(s);
      return nameMatch || descMatch || idMatch;
    });
  }

  async exportServiceConfigs() {
    return JSON.stringify(await this.getAllServiceConfigs(true), null, 2);
  }

  async importServiceConfigs(jsonData) {
    const configs = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    if (!Array.isArray(configs)) throw new Error('Invalid data format. Expected array.');
    const results = [];
    for (const c of configs) results.push(await this.saveServiceConfig(c));
    return results;
  }

  async clearAllServiceConfigs() { STORE.clear(); VERSIONS.clear(); return true; }

  async getStats() {
    const configs = Array.from(STORE.values());
    const active = configs.filter(c => c.isActive !== false);
    const byService = {};
    configs.forEach(c => { byService[c.serviceId] = (byService[c.serviceId] || 0) + 1; });
    return {
      totalConfigs: configs.length,
      activeConfigs: active.length,
      inactiveConfigs: configs.length - active.length,
      byService,
      lastUpdated: configs.reduce((latest, c) => {
        const d = new Date(c.updatedAt);
        return d > latest ? d : latest;
      }, new Date(0))
    };
  }
}

let dbInstance = null;
export async function getServiceConfigDB() {
  if (!dbInstance) { dbInstance = new ServiceConfigDB(); await dbInstance.init(); }
  return dbInstance;
}

export function getLocalized(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object' && obj !== null) {
    const lang = 'en';
    const r = obj[lang];
    if (r !== undefined && r !== null && r !== '') return r;
    return obj.en || '';
  }
  return obj;
}

export function dbConfigToNLPFormat(dbConfig) {
  if (!dbConfig) return null;
  return {
    id: dbConfig.serviceId,
    name: dbConfig.name,
    description: dbConfig.description,
    initStep: dbConfig.initStep || 1,
    collectedData: dbConfig.collectedData || {},
    steps: dbConfig.steps || {},
    _metadata: { version: dbConfig.version, createdAt: dbConfig.createdAt, updatedAt: dbConfig.updatedAt }
  };
}

export function nlpServiceToDBFormat(serviceConfig, customId = null) {
  if (!serviceConfig) return null;
  const name = typeof serviceConfig.name === 'string' ? { en: serviceConfig.name, am: serviceConfig.name } : serviceConfig.name || { en: '', am: '' };
  const description = typeof serviceConfig.description === 'string' ? { en: serviceConfig.description, am: serviceConfig.description } : serviceConfig.description || { en: '', am: '' };
  return {
    id: customId || `${serviceConfig.id}_${Date.now()}`,
    serviceId: serviceConfig.id,
    name, description,
    initStep: serviceConfig.initStep || 1,
    collectedData: serviceConfig.collectedData || {},
    steps: serviceConfig.steps || {},
    isActive: true,
    version: 1
  };
}

export async function fetchServiceConfig(serviceId, useLatestVersion = true) {
  try {
    const db = await getServiceConfigDB();
    let dbConfig;
    if (useLatestVersion) dbConfig = await db.getLatestServiceConfig(serviceId);
    else { const c = await db.getServiceConfigsByServiceId(serviceId); dbConfig = c[0] || null; }
    if (!dbConfig) return null;
    return dbConfigToNLPFormat(dbConfig);
  } catch (e) {
    console.error(`Error fetching service config for ${serviceId}:`, e);
    return null;
  }
}

class ServiceConfigCache {
  constructor() { this.cache = new Map(); this.cacheTimeout = 5 * 60 * 1000; }
  async get(id) {
    const c = this.cache.get(id);
    if (c && (Date.now() - c.timestamp) < this.cacheTimeout) return c.data;
    return null;
  }
  set(id, data) { this.cache.set(id, { data, timestamp: Date.now() }); }
  clear() { this.cache.clear(); }
  invalidate(id) { this.cache.delete(id); }
}
const configCache = new ServiceConfigCache();

export async function fetchServiceConfigWithCache(serviceId, useLatestVersion = true) {
  const cached = await configCache.get(serviceId);
  if (cached) return cached;
  const config = await fetchServiceConfig(serviceId, useLatestVersion);
  if (config) configCache.set(serviceId, config);
  return config;
}

export async function updateServiceConfig(serviceId, updatedConfig) {
  const db = await getServiceConfigDB();
  const dbConfig = nlpServiceToDBFormat(updatedConfig);
  const saved = await db.saveServiceConfig(dbConfig);
  configCache.invalidate(serviceId);
  return saved;
}

export default {
  getServiceConfigDB,
  fetchServiceConfig,
  fetchServiceConfigWithCache,
  updateServiceConfig,
  dbConfigToNLPFormat,
  nlpServiceToDBFormat,
  getLocalized
};
