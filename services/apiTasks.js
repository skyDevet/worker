// ============================================================
// apiTasks.js - Server-side version
// Same API as browser version; Capgo → fetch
// ============================================================

let apiLogs = [];

export function getApiLogs() { return apiLogs; }
export function clearApiLogs() { apiLogs = []; }

// ============================================================
// API ACTION EXECUTOR
// ============================================================

export async function executeApiAction(action, context = {}) {
  const startTime = Date.now();
  try {
    let result;

    if (action.endpoint) {
      const resolvedBody = resolveParams(action.data || {}, context);
      const url = resolveParams({ u: action.endpoint }, context).u;
      const response = await fetch(url, {
        method: action.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(action.headers || {}) },
        body: action.method === 'GET' ? undefined : JSON.stringify(resolvedBody)
      });

      const ct = response.headers.get('content-type') || '';
      let body;
      if (ct.includes('application/json')) body = await response.json();
      else body = { text: await response.text() };

      result = response.ok
        ? { success: true, data: body }
        : { success: false, error: body.error || `HTTP ${response.status}`, data: body };
    } else {
      result = { success: true, data: { simulated: true, action: action.id } };
    }

    apiLogs.push({
      timestamp: new Date().toISOString(),
      action: action.id || action.type,
      duration: Date.now() - startTime,
      success: result.success !== false
    });

    return result;
  } catch (error) {
    apiLogs.push({
      timestamp: new Date().toISOString(),
      action: action.id || action.type,
      duration: Date.now() - startTime,
      success: false,
      error: error.message
    });
    console.error(`❌ API Action [${action.id}] failed:`, error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// EXECUTE STEP API ACTIONS
// ============================================================

export async function executeStepApiActions(step, context = {}) {
  if (!step.apiActions || step.apiActions.length === 0) {
    return { success: true, continue: true };
  }

  const results = [];
  for (const action of step.apiActions) {
    if (action.condition && !evaluateCondition(action.condition, context)) continue;

    const result = await executeApiAction(action, context);
    results.push(result);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: getLocalizedMessage(action.onFailure?.message) || result.error,
        action, results
      };
    }

    if (action.onSuccess?.nextStep) {
      return {
        success: true, continue: false,
        nextStep: action.onSuccess.nextStep,
        message: getLocalizedMessage(action.onSuccess.message),
        result, results
      };
    }

    if (action.onSuccess?.continue === false) {
      return {
        success: true, continue: false,
        message: getLocalizedMessage(action.onSuccess?.message),
        result, results
      };
    }
  }

  return { success: true, continue: true, results, nextStep: step.onValid?.nextStep || null };
}

// ============================================================
// EXECUTE FIELD API ACTIONS
// ============================================================

export async function executeFieldApiActions(field, context = {}) {
  if (!field.apiActions || field.apiActions.length === 0) {
    return { success: true, continue: true };
  }

  const results = [];
  for (const action of field.apiActions) {
    const result = await executeApiAction(action, context);
    results.push(result);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: getLocalizedMessage(action.onFailure?.message) || result.error,
        action, results
      };
    }

    if (action.onSuccess?.message) {
      return {
        success: true, continue: false,
        message: getLocalizedMessage(action.onSuccess.message),
        result, results
      };
    }
  }

  return { success: true, continue: true, results };
}

// ============================================================
// HELPERS
// ============================================================

function resolveParams(params, context) {
  if (!params) return {};
  const result = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.includes('{{')) {
      const matches = value.match(/\{\{([^}]+)\}\}/g);
      if (matches) {
        let resolved = value;
        for (const match of matches) {
          const path = match.slice(2, -2).trim();
          const resolvedValue = getValueByPath(context, path);
          resolved = resolved.replace(match, resolvedValue !== undefined ? String(resolvedValue) : '');
        }
        result[key] = resolved;
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = resolveParams(value, context);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function getValueByPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    if (part === 'collected_data') return obj.collectedData || {};
    if (part === 'operator') return obj.operator || {};
    if (part === 'vehicles') return obj.vehicles || [];
    if (part === 'drivers') return obj.drivers || [];
    if (part === 'user_input') return obj.userInput || '';
    if (part === 'current_item') return obj.currentItem || {};
    current = current[part];
  }
  return current;
}

function evaluateCondition(condition, context) {
  if (!condition) return true;
  try {
    const resolved = resolveParams({ value: condition }, context);
    const expr = resolved.value || condition;
    return Function('"use strict"; return (' + expr + ')')();
  } catch { return true; }
}

function getLocalizedMessage(message) {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (typeof message === 'object') return message.en || message.am || '';
  return message;
}

export default {
  executeApiAction,
  executeStepApiActions,
  executeFieldApiActions,
  getApiLogs,
  clearApiLogs
};
