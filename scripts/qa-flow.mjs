/**
 * QA E2E — flujo completo de turnos (API)
 * Uso: node scripts/qa-flow.mjs
 *      BASE_URL=http://localhost:8741 node scripts/qa-flow.mjs
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:8741/api';

const USERS = {
  admin: { username: 'admin', password: 'CencoicAdmin2026' },
  filtro: { username: 'filtro', password: 'CencoicFiltro2026' },
  maria: { username: 'maria', password: 'CencoicVent2026' },
  juan: { username: 'juan', password: 'CencoicVent2026' },
};

let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  failed++;
  console.error(`  ✗ ${label}${detail ? `: ${detail}` : ''}`);
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.error ? data.error : text;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

async function login(userKey) {
  const u = USERS[userKey];
  const data = await api('/auth/login', { method: 'POST', body: u });
  return { token: data.token, user: data.user, windowId: data.windowId };
}

async function main() {
  console.log('============================================');
  console.log('  QA — Turnos Dispensario');
  console.log(`  ${BASE}`);
  console.log('============================================\n');

  try {
    const health = await api('/health');
    if (health.status === 'ok' && health.db === 'connected') ok('Salud API + DB');
    else fail('Salud', JSON.stringify(health));
  } catch (e) {
    fail('Salud API', e.message);
    console.error('\nAbortando: el servidor no responde.');
    process.exit(1);
  }

  let adminToken;
  let filtroToken;
  let mariaSession;
  let juanSession;

  try {
    const admin = await login('admin');
    adminToken = admin.token;
    ok('Login admin');
  } catch (e) {
    fail('Login admin', e.message);
    process.exit(1);
  }

  try {
    filtroToken = (await login('filtro')).token;
    ok('Login filtro');
  } catch (e) {
    fail('Login filtro', e.message);
  }

  try {
    mariaSession = await login('maria');
    ok('Login maria (ventanilla)');
  } catch (e) {
    fail('Login maria', e.message);
  }

  try {
    juanSession = await login('juan');
    ok('Login juan (ventanilla)');
  } catch (e) {
    fail('Login juan', e.message);
  }

  const priorities = await api('/priorities', { token: adminToken });
  const byCode = Object.fromEntries(priorities.map((p) => [p.code, p]));
  for (const code of ['GEN', 'PEN', 'PRI']) {
    if (byCode[code]) ok(`Prioridad ${code} existe`);
    else fail(`Prioridad ${code}`, 'no encontrada');
  }

  const windows = await api('/windows', { token: adminToken });
  const w1 = windows.find((w) => w.number === 1);
  const w2 = windows.find((w) => w.number === 2);
  if (w1 && w2) ok('Ventanillas 1 y 2 existen');
  else fail('Ventanillas', 'faltan ventanilla 1 o 2');

  if (w1 && w2 && byCode.GEN && byCode.PEN) {
    await api(`/windows/${w1.id}/priorities`, {
      method: 'PUT',
      token: adminToken,
      body: { priorityIds: [byCode.GEN.id, byCode.PEN.id, byCode.PRI?.id].filter(Boolean) },
    });
    await api(`/windows/${w2.id}/priorities`, {
      method: 'PUT',
      token: adminToken,
      body: { priorityIds: [byCode.PEN.id, byCode.GEN.id, byCode.PRI?.id].filter(Boolean) },
    });
    ok('Orden vent.1: GEN→PEN | vent.2: PEN→GEN');
  }

  const created = [];
  if (filtroToken) {
    for (const code of ['GEN', 'PEN', 'GEN', 'PEN']) {
      const p = byCode[code];
      if (!p) continue;
      const t = await api('/tickets/generate', {
        method: 'POST',
        token: filtroToken,
        body: { priorityId: p.id },
      });
      created.push(t);
    }
    ok(`Generados ${created.length} turnos de prueba`);
  }

  async function finishActive(windowId, token) {
    try {
      const state = await api(`/tickets/window/${windowId}/state`, { token });
      const active = state.activeTicket;
      if (!active) return;
      if (active.status === 'LLAMADO') {
        await api(`/tickets/${active.id}/start`, { method: 'POST', token, body: { windowId } });
      }
      if (active.status === 'LLAMADO' || active.status === 'ATENDIENDO') {
        await api(`/tickets/${active.id}/finish`, { method: 'POST', token, body: { windowId } });
      }
    } catch {
      /* ventanilla libre */
    }
  }

  if (mariaSession?.windowId && w1) {
    await finishActive(w1.id, mariaSession.token);
    try {
      const next1 = await api('/tickets/take-next', {
        method: 'POST',
        token: mariaSession.token,
        body: { windowId: w1.id },
      });
      if (next1.priority?.code === 'GEN') ok('Vent.1 llama GEN primero (respeta orden)');
      else fail('Vent.1 orden', `esperaba GEN, obtuvo ${next1.priority?.code} (${next1.displayCode})`);

      await api(`/tickets/${next1.id}/start`, {
        method: 'POST',
        token: mariaSession.token,
        body: { windowId: w1.id },
      });
      await api(`/tickets/${next1.id}/finish`, {
        method: 'POST',
        token: mariaSession.token,
        body: { windowId: w1.id },
      });
      ok('Vent.1 atendió y finalizó turno');

      const next2 = await api('/tickets/take-next', {
        method: 'POST',
        token: mariaSession.token,
        body: { windowId: w1.id },
      });
      if (next2.priority?.code === 'PEN') ok('Vent.1 llama PEN después de GEN');
      else fail('Vent.1 segundo turno', `esperaba PEN, obtuvo ${next2.priority?.code}`);

      await api(`/tickets/${next2.id}/start`, {
        method: 'POST',
        token: mariaSession.token,
        body: { windowId: w1.id },
      });
      await api(`/tickets/${next2.id}/finish`, {
        method: 'POST',
        token: mariaSession.token,
        body: { windowId: w1.id },
      });
    } catch (e) {
      fail('Flujo ventanilla 1', e.message);
    }
  }

  if (juanSession?.windowId && w2) {
    await finishActive(w2.id, juanSession.token);
    try {
      const next1 = await api('/tickets/take-next', {
        method: 'POST',
        token: juanSession.token,
        body: { windowId: w2.id },
      });
      if (next1.priority?.code === 'PEN') ok('Vent.2 llama PEN primero (respeta orden)');
      else fail('Vent.2 orden', `esperaba PEN, obtuvo ${next1.priority?.code}`);

      await api(`/tickets/${next1.id}/start`, {
        method: 'POST',
        token: juanSession.token,
        body: { windowId: w2.id },
      });
      await api(`/tickets/${next1.id}/finish`, {
        method: 'POST',
        token: juanSession.token,
        body: { windowId: w2.id },
      });
    } catch (e) {
      fail('Flujo ventanilla 2', e.message);
    }
  }

  try {
    const display = await api('/tv/display');
    if (display.settings) ok('Pantalla TV responde');
    else fail('Pantalla TV', 'sin settings');
  } catch (e) {
    fail('Pantalla TV', e.message);
  }

  try {
    const print = await api('/tickets/print-settings', { token: adminToken });
    if (print.messageFontScale !== undefined) ok('Config ticket messageFontScale');
    else fail('Config ticket', 'falta messageFontScale');
  } catch (e) {
    fail('Config ticket', e.message);
  }

  console.log('\n============================================');
  console.log(`  Resultado: ${passed} OK, ${failed} FAIL`);
  console.log('============================================');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});
