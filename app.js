
(() => {
  const USERS = [
    { username: 'Fabricio', pin: '12051205', role: 'admin', fullName: 'Fabricio' },
    { username: 'Seba', pin: '1207', role: 'admin', fullName: 'Sebastián' },
    { username: 'Paola', pin: '1201', role: 'seller', fullName: 'Paola Balado' },
    { username: 'Tucu', pin: '1202', role: 'seller', fullName: 'Dario Lopez' },
    { username: 'Gaston', pin: '1203', role: 'seller', fullName: 'Gaston Rodriguez' },
    { username: 'Diego', pin: '1204', role: 'seller', fullName: 'Diego Daniel Ponce' },
    { username: 'Martin', pin: '1205', role: 'seller', fullName: 'Martin Aguilar' },
    { username: 'Leandro', pin: '1206', role: 'seller', fullName: 'Leandro del Hoyo' }
  ];

  const NON_PURCHASE_STATES = [
    '',
    'Precios altos',
    'Sin Stock / Faltantes',
    'Ya compró a otro proveedor',
    'No tenía necesidad',
    'Problema financiero',
    'No está comprando / Cerrado',
    'No respondió',
    'Compra el mes que viene',
    'Otro'
  ];

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const els = {};
  const state = {
    currentUser: null,
    clients: [],
    feedback: {},
    submissions: {},
    saveTimer: null
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheDom();
    populateUsers();
    bindEvents();
    hydrateLocalState();
    await loadBaseData(false);
    initFilters(false);
  }

  function cacheDom() {
    [
      'loginView','dashboardView','loginForm','loginUser','loginPin','loginError','logoutBtn','sessionName','sessionRole',
      'panelTitle','monthFilter','yearFilter','searchInput','sellerFilter','statusFilter','sentFilter','adminFilters',
      'recordsContainer','historyContainer','adminStatusBoard','metricTotal','metricPending','metricWithSales',
      'submitReportBtn','submitHelp','saveIndicator','recordTemplate','refreshCsvBtn','refreshInfo','appHeading'
    ].forEach(id => els[id] = document.getElementById(id));
  }

  function populateUsers() {
    els.loginUser.innerHTML = USERS.map(u => `<option value="${u.username}">${u.username}</option>`).join('');
    if (window.APP_CONFIG?.appTitle) els.appHeading.textContent = window.APP_CONFIG.appTitle;
  }

  function bindEvents() {
    els.loginForm.addEventListener('submit', onLogin);
    els.logoutBtn.addEventListener('click', logout);
    [els.monthFilter, els.yearFilter, els.searchInput, els.sellerFilter, els.statusFilter, els.sentFilter].forEach(el => {
      el.addEventListener('input', render);
      el.addEventListener('change', render);
    });
    els.submitReportBtn.addEventListener('click', submitReport);
    els.refreshCsvBtn.addEventListener('click', async () => {
      await loadBaseData(true);
      initFilters(true);
      render();
    });
  }

  async function loadBaseData(showMessage = false) {
    try {
      setSaveIndicator('saving', 'Actualizando base...');
      const sourceUrl = (window.APP_CONFIG?.remoteCsvUrl || '').trim() || (window.APP_CONFIG?.baseCsvPath || 'vips.csv');
      const response = await fetch(`${sourceUrl}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`No se pudo leer el CSV (${response.status})`);
      const rawText = await response.text();
      const parsed = parseCsvAuto(rawText).map(normalizeClient).filter(Boolean);
      state.clients = parsed;
      els.refreshInfo.textContent = `Base actualizada: ${formatDateTime(new Date())} · ${parsed.length} registros`;
      setSaveIndicator('saved', showMessage ? 'Base actualizada' : 'Listo');
    } catch (error) {
      console.error(error);
      state.clients = [];
      els.refreshInfo.textContent = 'No se pudo actualizar la base';
      setSaveIndicator('error', 'Error al actualizar base');
    }
  }

  function hydrateLocalState() {
    state.feedback = readStorage('cv_feedback', {});
    state.submissions = readStorage('cv_submissions', {});
  }

  function initFilters(keepCurrent = false) {
    const periods = [...new Set(state.clients.map(c => `${c.mes}|${c.anio}`))]
      .map(key => {
        const [mes, anio] = key.split('|');
        return { mes, anio: Number(anio) };
      })
      .sort((a, b) => (a.anio - b.anio) || (monthOrder(a.mes) - monthOrder(b.mes)));

    const months = [...new Set(periods.map(p => p.mes))].sort((a, b) => monthOrder(a) - monthOrder(b));
    const years = [...new Set(periods.map(p => p.anio))].sort((a, b) => a - b);
    const sellers = [...new Set(state.clients.map(c => c.vendedor))].sort((a, b) => a.localeCompare(b, 'es'));

    const prevMonth = keepCurrent ? els.monthFilter.value : '';
    const prevYear = keepCurrent ? els.yearFilter.value : '';

    els.monthFilter.innerHTML = months.map(m => `<option value="${m}">${m}</option>`).join('');
    els.yearFilter.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    els.sellerFilter.innerHTML = ['<option value="">Todos los vendedores</option>', ...sellers.map(s => `<option value="${s}">${s}</option>`)].join('');
    els.statusFilter.innerHTML = ['<option value="">Todos los estados</option>', ...NON_PURCHASE_STATES.filter(Boolean).map(s => `<option value="${s}">${s}</option>`)].join('');
    els.sentFilter.innerHTML = '<option value="">Enviados y no enviados</option><option value="sent">Enviados</option><option value="pending">No enviados</option>';

    if (keepCurrent && months.includes(prevMonth)) els.monthFilter.value = prevMonth;
    if (keepCurrent && years.map(String).includes(prevYear)) els.yearFilter.value = prevYear;

    if (!els.monthFilter.value) {
      const defaultMonth = window.APP_CONFIG?.defaultMonth || '';
      if (months.includes(defaultMonth)) els.monthFilter.value = defaultMonth;
      else if (periods.length) els.monthFilter.value = periods[periods.length - 1].mes;
    }

    if (!els.yearFilter.value) {
      const defaultYear = String(window.APP_CONFIG?.defaultYear || '');
      if (years.map(String).includes(defaultYear)) els.yearFilter.value = defaultYear;
      else if (periods.length) els.yearFilter.value = String(periods[periods.length - 1].anio);
    }
  }

  function onLogin(event) {
    event.preventDefault();
    const user = USERS.find(u => u.username === els.loginUser.value && u.pin === els.loginPin.value.trim());
    if (!user) {
      els.loginError.textContent = 'Usuario o PIN incorrecto.';
      els.loginError.classList.remove('hidden');
      return;
    }

    state.currentUser = user;
    els.loginPin.value = '';
    els.loginError.classList.add('hidden');
    els.loginView.classList.add('hidden');
    els.dashboardView.classList.remove('hidden');
    els.sessionName.textContent = user.fullName || user.username;
    els.sessionRole.textContent = user.role === 'admin' ? 'Administrador' : 'Vendedor';
    els.panelTitle.textContent = user.role === 'admin' ? 'Panel Administrador' : 'Panel Vendedor';
    els.adminFilters.classList.toggle('hidden', user.role !== 'admin');
    render();
  }

  function logout() {
    state.currentUser = null;
    els.dashboardView.classList.add('hidden');
    els.loginView.classList.remove('hidden');
  }

  function render() {
    if (!state.currentUser) return;
    const records = getFilteredRecords();
    renderMetrics(records);
    renderRecords(records);
    renderSubmitButton();
    renderAdminBoard();
    renderHistory(records);
  }

  function getFilteredRecords() {
    const month = els.monthFilter.value;
    const year = Number(els.yearFilter.value);
    const q = normalizeText(els.searchInput.value || '');
    const seller = els.sellerFilter.value;
    const status = els.statusFilter.value;
    const sent = els.sentFilter.value;

    return state.clients
      .filter(c => c.mes === month && c.anio === year)
      .filter(c => state.currentUser.role === 'admin' ? true : sameVendor(c.vendedor, state.currentUser.fullName || state.currentUser.username))
      .filter(c => seller ? c.vendedor === seller : true)
      .filter(c => {
        const merged = normalizeText(`${c.cliente} ${c.nombreAlternativo}`);
        return q ? merged.includes(q) : true;
      })
      .filter(c => {
        const fb = getFeedback(c.id);
        return status ? fb.estado === status : true;
      })
      .filter(c => {
        const sentKey = reportKey(c.vendedor, c.mes, c.anio);
        const isSent = Boolean(state.submissions[sentKey]?.sent);
        return sent === 'sent' ? isSent : sent === 'pending' ? !isSent : true;
      })
      .sort((a, b) => {
        if ((a.ventaPesos <= 0) !== (b.ventaPesos <= 0)) return a.ventaPesos <= 0 ? -1 : 1;
        return a.cliente.localeCompare(b.cliente, 'es');
      });
  }

  function renderMetrics(records) {
    els.metricTotal.textContent = records.length;
    els.metricPending.textContent = records.filter(isPendingFeedback).length;
    els.metricWithSales.textContent = records.filter(r => r.ventaPesos > 0).length;
  }

  function renderRecords(records) {
    els.recordsContainer.innerHTML = '';
    if (!records.length) {
      els.recordsContainer.innerHTML = '<div class="card empty-state">No hay registros para los filtros seleccionados.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    records.forEach(record => {
      const node = els.recordTemplate.content.firstElementChild.cloneNode(true);
      const fb = getFeedback(record.id);
      const danger = record.ventaPesos <= 0;
      const submitted = state.submissions[reportKey(record.vendedor, record.mes, record.anio)];
      const hasComment = Boolean((fb.comentarios || '').trim());

      node.querySelector('.record-client').textContent = record.cliente;
      node.querySelector('.record-alt').textContent = record.nombreAlternativo ? `Alt: ${record.nombreAlternativo}` : '';
      node.querySelector('.record-period').textContent = `${record.mes} ${record.anio}`;
      node.querySelector('.record-sales').textContent = formatCurrency(record.ventaPesos);
      node.querySelector('.record-updated').textContent = fb.updatedAt ? `Última actualización: ${formatDateTime(fb.updatedAt)}` : 'Sin cambios guardados';

      const sentEl = node.querySelector('.record-sent');
      if (submitted?.sent) {
        sentEl.textContent = `Informe enviado · ${formatDateTime(submitted.sentAt)}`;
        sentEl.classList.add('sent');
      } else {
        sentEl.textContent = 'Informe no enviado';
        sentEl.classList.add('not-sent');
      }

      if (danger) node.classList.add('is-danger');

      const stateSelect = node.querySelector('.record-state');
      stateSelect.innerHTML = NON_PURCHASE_STATES.map(s => `<option value="${s}">${s || 'Seleccionar motivo'}</option>`).join('');
      stateSelect.value = fb.estado || '';
      stateSelect.disabled = !danger;
      stateSelect.required = danger;

      const commentsPanel = node.querySelector('.record-comment-panel');
      const commentsEl = node.querySelector('.record-comments');
      const commentToggle = node.querySelector('.btn-comment-toggle');

      commentsEl.value = fb.comentarios || '';
      commentsEl.disabled = !danger;
      if (!danger) {
        commentsEl.placeholder = 'No requiere comentario';
        commentToggle.disabled = true;
        commentToggle.textContent = 'Sin comentario';
      } else {
        commentToggle.textContent = hasComment ? 'Ver comentario' : 'Agregar comentario';
      }

      if (hasComment) commentsPanel.classList.remove('hidden');

      commentToggle.addEventListener('click', () => {
        if (commentToggle.disabled) return;
        commentsPanel.classList.toggle('hidden');
        if (!commentsPanel.classList.contains('hidden')) commentsEl.focus();
      });

      if (canEditRecord(record)) {
        stateSelect.addEventListener('change', () => saveRecordFeedback(record, stateSelect.value, commentsEl.value));
        commentsEl.addEventListener('input', () => {
          saveRecordFeedback(record, stateSelect.value, commentsEl.value);
          commentToggle.textContent = commentsEl.value.trim() ? 'Ver comentario' : 'Agregar comentario';
        });
      } else {
        stateSelect.disabled = true;
        commentsEl.disabled = true;
        commentToggle.disabled = true;
      }

      fragment.appendChild(node);
    });

    els.recordsContainer.appendChild(fragment);
  }

  function renderSubmitButton() {
    if (state.currentUser.role === 'admin') {
      els.submitReportBtn.disabled = true;
      els.submitHelp.textContent = 'Desde administrador podés ver y editar, pero no enviar informes.';
      return;
    }

    const month = els.monthFilter.value;
    const year = Number(els.yearFilter.value);
    const ownRecords = state.clients.filter(c => c.mes === month && c.anio === year && sameVendor(c.vendedor, state.currentUser.fullName));
    const pending = ownRecords.filter(isPendingFeedback).length;
    const sentKey = reportKey(state.currentUser.fullName, month, year);
    const alreadySent = Boolean(state.submissions[sentKey]?.sent);

    els.submitReportBtn.disabled = pending > 0 || ownRecords.length === 0;
    els.submitReportBtn.textContent = alreadySent ? 'Informe Enviado' : 'Enviar Informe';

    if (!ownRecords.length) {
      els.submitHelp.textContent = 'No hay cuentas para este período.';
    } else if (alreadySent) {
      els.submitHelp.textContent = `Enviado el ${formatDateTime(state.submissions[sentKey].sentAt)}.`;
    } else if (pending > 0) {
      els.submitHelp.textContent = `Faltan ${pending} caso(s) con venta en cero sin motivo cargado.`;
    } else {
      els.submitHelp.textContent = 'Todo completo. Ya podés enviar el informe.';
    }
  }

  function renderAdminBoard() {
    if (state.currentUser.role !== 'admin') {
      els.adminStatusBoard.classList.add('hidden');
      return;
    }

    const month = els.monthFilter.value;
    const year = Number(els.yearFilter.value);
    const periodRecords = state.clients.filter(c => c.mes === month && c.anio === year);
    const grouped = groupBy(periodRecords, item => item.vendedor);

    const html = Object.keys(grouped).sort((a,b) => a.localeCompare(b, 'es')).map(vendor => {
      const records = grouped[vendor];
      const pending = records.filter(isPendingFeedback).length;
      const sent = Boolean(state.submissions[reportKey(vendor, month, year)]?.sent);
      return `
        <div class="status-board-item ${pending ? 'status-board-item--danger' : ''}">
          <h4>${vendor}</h4>
          <p>Total clientes: <strong>${records.length}</strong></p>
          <p>Pendientes: <strong>${pending}</strong></p>
          <p>Con compra: <strong>${records.filter(r => r.ventaPesos > 0).length}</strong></p>
          <p>Informe: <strong>${sent ? 'Enviado' : 'No enviado'}</strong></p>
        </div>`;
    }).join('');

    els.adminStatusBoard.innerHTML = `
      <div class="section-head">
        <div>
          <h3>Estado general por vendedor</h3>
          <p class="muted">Período: ${month || '-'} ${year || ''}</p>
        </div>
      </div>
      <div class="status-board-grid">${html || '<p>No hay datos para este período.</p>'}</div>
    `;
    els.adminStatusBoard.classList.remove('hidden');
  }

  function renderHistory(records) {
    const rows = records.map(record => {
      const fb = getFeedback(record.id);
      const sent = state.submissions[reportKey(record.vendedor, record.mes, record.anio)];
      return `
        <tr>
          <td>${escapeHtml(record.cliente)}</td>
          <td>${escapeHtml(record.vendedor)}</td>
          <td>${escapeHtml(record.mes)}</td>
          <td>${record.anio}</td>
          <td>${formatCurrency(record.ventaPesos)}</td>
          <td>${escapeHtml(fb.estado || '-')}</td>
          <td>${escapeHtml(fb.comentarios || '-')}</td>
          <td>${fb.updatedAt ? formatDateTime(fb.updatedAt) : '-'}</td>
          <td>${sent?.sentAt ? formatDateTime(sent.sentAt) : '-'}</td>
        </tr>`;
    }).join('');

    els.historyContainer.innerHTML = `
      <div class="section-head">
        <div>
          <h3>Historial del período filtrado</h3>
          <p class="muted">Se muestra solo lo visible según filtros actuales.</p>
        </div>
      </div>
      <div class="history-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Mes</th>
              <th>Año</th>
              <th>Venta</th>
              <th>Estado</th>
              <th>Comentarios</th>
              <th>Actualización</th>
              <th>Envío</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="9">Sin registros.</td></tr>'}</tbody>
        </table>
      </div>`;
    els.historyContainer.classList.remove('hidden');
  }

  function saveRecordFeedback(record, estado, comentarios) {
    if (!canEditRecord(record)) return;
    state.feedback[record.id] = {
      estado: (estado || '').trim(),
      comentarios: (comentarios || '').trim(),
      updatedAt: new Date().toISOString(),
      vendedor: record.vendedor,
      mes: record.mes,
      anio: record.anio,
      cliente: record.cliente
    };
    writeStorage('cv_feedback', state.feedback);
    setSaveIndicator('saving', 'Guardando...');
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      setSaveIndicator('saved', 'Guardado automáticamente');
      render();
    }, 220);
  }

  function submitReport() {
    if (state.currentUser.role !== 'seller') return;
    const month = els.monthFilter.value;
    const year = Number(els.yearFilter.value);
    const ownRecords = state.clients.filter(c => c.mes === month && c.anio === year && sameVendor(c.vendedor, state.currentUser.fullName));
    const pending = ownRecords.filter(isPendingFeedback).length;
    if (pending > 0) {
      alert(`Todavía faltan ${pending} caso(s) con venta en cero sin completar.`);
      return;
    }

    state.submissions[reportKey(state.currentUser.fullName, month, year)] = {
      sent: true,
      sentAt: new Date().toISOString(),
      vendor: state.currentUser.fullName,
      month,
      year
    };
    writeStorage('cv_submissions', state.submissions);
    setSaveIndicator('saved', 'Informe enviado');
    render();
  }

  function canEditRecord(record) {
    return state.currentUser.role === 'admin' || sameVendor(record.vendedor, state.currentUser.fullName);
  }

  function isPendingFeedback(record) {
    if (record.ventaPesos > 0) return false;
    return !getFeedback(record.id).estado;
  }

  function getFeedback(id) {
    return state.feedback[id] || { estado: '', comentarios: '', updatedAt: '' };
  }

  function reportKey(vendedor, mes, anio) {
    return `${slugify(vendedor)}__${slugify(mes)}__${anio}`;
  }

  function normalizeClient(raw) {
    const cliente = pick(raw, ['CLIENTE', 'NOMBRE DEL CLIENTE', 'CLIENTE VIP']);
    const vendedor = normalizeVendor(pick(raw, ['VENDEDOR', 'NOMBRE DEL VENDEDOR']));
    const nombreAlternativo = pick(raw, ['NOMBRE ALTERNATIVO', 'ALTERNATIVO', 'CUENTA ALTERNATIVA']);
    const fxCompra2025 = pick(raw, ['FX COMPRA 2025', 'FX COMPRA', 'FRECUENCIA 2025']);
    const status2025 = pick(raw, ['STATUS 2025', 'STATUS', 'ESTADO 2025']);
    const ventaPesos = parseMoney(pick(raw, ['VALUE $', 'VENTA EN PESOS', 'VENTA', 'VALUE$']));
    const mes = normalizeMonth(pick(raw, ['MES', 'MES INFORME']) || window.APP_CONFIG?.defaultMonth || '');
    const anio = parseInt(pick(raw, ['AÑO', 'ANIO', 'AÑO INFORME']) || window.APP_CONFIG?.defaultYear || '0', 10);

    if (!cliente || !vendedor || !mes || !anio) return null;
    return {
      id: slugify(`${cliente}|${vendedor}|${mes}|${anio}`),
      cliente,
      vendedor,
      nombreAlternativo,
      fxCompra2025,
      status2025,
      ventaPesos,
      mes,
      anio
    };
  }

  function normalizeVendor(value) {
    const clean = normalizeText(value);
    const map = {
      'paola': 'Paola Balado',
      'paola balado': 'Paola Balado',
      'dario lopez': 'Dario Lopez',
      'tucu': 'Dario Lopez',
      'gaston': 'Gaston Rodriguez',
      'gaston rodriguez': 'Gaston Rodriguez',
      'diego': 'Diego Daniel Ponce',
      'diego daniel ponce': 'Diego Daniel Ponce',
      'martin': 'Martin Aguilar',
      'martin aguilar': 'Martin Aguilar',
      'leandro': 'Leandro del Hoyo',
      'leandro del hoyo': 'Leandro del Hoyo'
    };
    return map[clean] || toTitleCase(String(value || '').trim());
  }

  function sameVendor(a, b) {
    return normalizeText(a) === normalizeText(b);
  }

  function normalizeMonth(value) {
    const clean = normalizeText(value);
    const map = {
      '1': 'Enero', '01': 'Enero', 'enero': 'Enero',
      '2': 'Febrero', '02': 'Febrero', 'febrero': 'Febrero',
      '3': 'Marzo', '03': 'Marzo', 'marzo': 'Marzo',
      '4': 'Abril', '04': 'Abril', 'abril': 'Abril',
      '5': 'Mayo', '05': 'Mayo', 'mayo': 'Mayo',
      '6': 'Junio', '06': 'Junio', 'junio': 'Junio',
      '7': 'Julio', '07': 'Julio', 'julio': 'Julio',
      '8': 'Agosto', '08': 'Agosto', 'agosto': 'Agosto',
      '9': 'Septiembre', '09': 'Septiembre', 'septiembre': 'Septiembre', 'setiembre': 'Septiembre',
      '10': 'Octubre', 'octubre': 'Octubre',
      '11': 'Noviembre', 'noviembre': 'Noviembre',
      '12': 'Diciembre', 'diciembre': 'Diciembre'
    };
    return map[clean] || (value ? toTitleCase(String(value).trim()) : '');
  }

  function monthOrder(month) {
    const idx = MONTHS.findIndex(m => normalizeText(m) === normalizeText(month));
    return idx === -1 ? 99 : idx;
  }

  function parseMoney(value) {
    if (value == null) return 0;
    const cleaned = String(value)
      .replace(/\$/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '.')
      .replace(/\s+/g, '')
      .trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function parseCsvAuto(text) {
    const cleaned = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!cleaned) return [];

    const firstLine = cleaned.split(/\r?\n/)[0] || '';
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) delimiter = ';';

    const rows = splitCsvRows(cleaned, delimiter);
    if (!rows.length) return [];

    const headers = rows[0].map(cell => sanitizeHeader(cell));
    return rows.slice(1)
      .filter(row => row.some(Boolean))
      .map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = (row[index] || '').trim();
        });
        return obj;
      });
  }

  function splitCsvRows(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(cell);
        cell = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
    row.push(cell);
    rows.push(row);
    return rows;
  }

  function sanitizeHeader(header) {
    return String(header || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function pick(obj, keys) {
    for (const key of keys) {
      const normalized = sanitizeHeader(key);
      if (obj[normalized] != null && obj[normalized] !== '') return obj[normalized];
    }
    return '';
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function setSaveIndicator(kind, message) {
    els.saveIndicator.className = `save-indicator ${kind}`;
    els.saveIndicator.textContent = message;
  }

  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  function slugify(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function formatDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function toTitleCase(value) {
    return String(value || '').toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
  }

  function groupBy(items, fn) {
    return items.reduce((acc, item) => {
      const key = fn(item);
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
