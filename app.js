
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

  const PENDING_STATE = 'Pendiente';

  const NON_PURCHASE_STATES = [
    PENDING_STATE,
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
      'submitReportBtn','submitHelp','saveIndicator','recordTemplate','refreshCsvBtn','refreshInfo','appHeading',
      'downloadExcelBtn'
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
    els.downloadExcelBtn.addEventListener('click', downloadExcelReport);
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
      const urls = buildCsvUrls(sourceUrl);
      let rawText = '';
      let lastError = null;

      for (const url of urls) {
        try {
          const response = await fetch(url, { cache: 'no-store' });
          if (!response.ok) throw new Error(`No se pudo leer el CSV (${response.status})`);
          rawText = await response.text();
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError) throw lastError;
      const parsed = parseCsvAuto(rawText).map(normalizeClient).filter(Boolean);
      state.clients = parsed;
      els.refreshInfo.textContent = `Base actualizada: ${formatDateTime(new Date())} · ${parsed.length} registros`;
      setSaveIndicator('saved', showMessage ? 'Base actualizada' : 'Listo');
    } catch (error) {
      console.error(error);
      state.clients = [];
      els.refreshInfo.textContent = getCsvLoadErrorMessage();
      setSaveIndicator('error', 'Error al actualizar base');
    }
  }

  function buildCsvUrls(sourceUrl) {
    const cleanUrl = String(sourceUrl || '').trim();
    if (!cleanUrl) return [];

    const protocol = window.location?.protocol || '';
    if (protocol === 'file:') return [cleanUrl];

    const separator = cleanUrl.includes('?') ? '&' : '?';
    return [`${cleanUrl}${separator}v=${Date.now()}`, cleanUrl];
  }

  function getCsvLoadErrorMessage() {
    if ((window.location?.protocol || '') === 'file:') {
      return 'No se pudo leer el CSV desde archivo local. AbrÃ­ la app desde GitHub Pages o con un servidor local.';
    }
    return 'No se pudo actualizar la base';
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
    els.statusFilter.innerHTML = ['<option value="">Todos los estados</option>', ...NON_PURCHASE_STATES.map(s => `<option value="${s}">${s}</option>`)].join('');
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
    renderDownloadButton(records);
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
      .filter(c => status ? getRecordStatus(c) === status : true)
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
      const locked = isReportSent(record.vendedor, record.mes, record.anio);
      const statusValue = getRecordStatus(record);
      const submitted = state.submissions[reportKey(record.vendedor, record.mes, record.anio)];

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

      updateRecordAppearance(node, statusValue, danger);

      const stateSelect = node.querySelector('.record-state');
      stateSelect.innerHTML = NON_PURCHASE_STATES.map(s => `<option value="${s}">${s}</option>`).join('');
      stateSelect.value = danger ? statusValue : '';
      stateSelect.disabled = !danger || locked;
      stateSelect.required = danger;
      updateStateAppearance(stateSelect, statusValue, danger);

      if (canEditRecord(record)) {
        stateSelect.addEventListener('change', () => {
          updateStateAppearance(stateSelect, stateSelect.value, danger);
          updateRecordAppearance(node, stateSelect.value, danger);
          saveRecordFeedback(record, stateSelect.value, '');
        });
      } else {
        stateSelect.disabled = true;
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

    els.submitReportBtn.disabled = pending > 0 || ownRecords.length === 0 || alreadySent;
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

  function renderDownloadButton(records) {
    const canDownload = state.currentUser?.role === 'admin' && state.currentUser.username === 'Fabricio';
    els.downloadExcelBtn.classList.toggle('hidden', !canDownload);
    if (!canDownload) return;
    els.downloadExcelBtn.disabled = !records.length;
  }

  function downloadExcelReport() {
    if (!(state.currentUser?.role === 'admin' && state.currentUser.username === 'Fabricio')) return;

    const records = getFilteredRecords();
    if (!records.length) {
      alert('No hay registros para exportar con los filtros seleccionados.');
      return;
    }

    const month = els.monthFilter.value || 'todos';
    const year = els.yearFilter.value || 'todos';
    const filename = `informe-vip-${slugify(month)}-${year}.xls`;
    const rows = records.map(record => {
      const fb = getFeedback(record.id);
      const sent = state.submissions[reportKey(record.vendedor, record.mes, record.anio)];
      const displayStatus = record.ventaPesos > 0 ? 'Con compra' : getRecordStatus(record);

      return `
        <tr>
          <td>${escapeHtml(record.cliente)}</td>
          <td>${escapeHtml(record.nombreAlternativo || '')}</td>
          <td>${escapeHtml(record.vendedor)}</td>
          <td>${escapeHtml(record.mes)}</td>
          <td>${record.anio}</td>
          <td>${formatCurrency(record.ventaPesos)}</td>
          <td>${escapeHtml(displayStatus)}</td>
          <td>${fb.updatedAt ? formatDateTime(fb.updatedAt) : '-'}</td>
          <td>${sent?.sent ? 'Si' : 'No'}</td>
          <td>${sent?.sentAt ? formatDateTime(sent.sentAt) : '-'}</td>
        </tr>`;
    }).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <table border="1">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Nombre alternativo</th>
                <th>Vendedor</th>
                <th>Mes</th>
                <th>Ano</th>
                <th>Venta</th>
                <th>Estado</th>
                <th>Ultima actualizacion</th>
                <th>Informe enviado</th>
                <th>Fecha envio</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>`;

    const blob = new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
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
          <td>${escapeHtml(getRecordStatus(record) || '-')}</td>
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
              <th>Actualización</th>
              <th>Envío</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="8">Sin registros.</td></tr>'}</tbody>
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
    const sentKey = reportKey(state.currentUser.fullName, month, year);
    if (pending > 0) {
      alert(`Todavía faltan ${pending} caso(s) con venta en cero sin completar.`);
      return;
    }

    if (!ownRecords.length || state.submissions[sentKey]?.sent) return;

    state.submissions[sentKey] = {
      sent: true,
      sentAt: new Date().toISOString(),
      vendor: state.currentUser.fullName,
      month,
      year
    };
    writeStorage('cv_submissions', state.submissions);
    setSaveIndicator('saved', 'Informe enviado');
    render();
    alert('Informe enviado con \u00E9xito');
  }

  function canEditRecord(record) {
    if (isReportSent(record.vendedor, record.mes, record.anio)) return false;
    return state.currentUser.role === 'admin' || sameVendor(record.vendedor, state.currentUser.fullName);
  }

  function isPendingFeedback(record) {
    if (record.ventaPesos > 0) return false;
    return getRecordStatus(record) === PENDING_STATE;
  }

  function getFeedback(id) {
    return state.feedback[id] || { estado: '', comentarios: '', updatedAt: '' };
  }

  function getRecordStatus(record) {
    const status = (getFeedback(record.id).estado || '').trim();
    if (record.ventaPesos > 0) return status;
    return status || PENDING_STATE;
  }

  function isReportSent(vendedor, mes, anio) {
    return Boolean(state.submissions[reportKey(vendedor, mes, anio)]?.sent);
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

  function updateStateAppearance(select, value, applies) {
    select.classList.remove('record-state--pending', 'record-state--complete');
    if (!applies) return;
    if (value === PENDING_STATE) {
      select.classList.add('record-state--pending');
      return;
    }
    if (value) select.classList.add('record-state--complete');
  }

  function updateRecordAppearance(node, value, applies) {
    node.classList.remove('is-danger', 'is-complete');
    if (!applies) return;
    if (value && value !== PENDING_STATE) {
      node.classList.add('is-complete');
      return;
    }
    node.classList.add('is-danger');
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
