const SHEETS = {
  feedback: 'feedback',
  submissions: 'envios_informe'
};

function doGet(e) {
  const action = getParam_(e, 'action') || 'ping';

  try {
    let result;

    if (action === 'ping') {
      result = {
        ok: true,
        message: 'ClientesVIP backend activo',
        timestamp: new Date().toISOString()
      };
    } else if (action === 'getFeedback') {
      result = {
        ok: true,
        feedback: readSheetObjects_(SHEETS.feedback)
      };
    } else if (action === 'getSubmissions') {
      result = {
        ok: true,
        submissions: readSheetObjects_(SHEETS.submissions)
      };
    } else if (action === 'getDashboard') {
      result = {
        ok: true,
        feedback: readSheetObjects_(SHEETS.feedback),
        submissions: readSheetObjects_(SHEETS.submissions)
      };
    } else {
      result = {
        ok: false,
        error: 'Accion no reconocida: ' + action
      };
    }

    return jsonResponse_(result, e);
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error.message
    }, e);
  }
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = payload.action;

    if (!action) {
      return jsonResponse_({
        ok: false,
        error: 'Falta action'
      });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    let result;

    try {
      if (action === 'saveFeedback') {
        result = saveFeedback_(payload);
      } else if (action === 'submitReport') {
        result = submitReport_(payload);
      } else {
        result = {
          ok: false,
          error: 'Accion no reconocida: ' + action
        };
      }
    } finally {
      lock.releaseLock();
    }

    return jsonResponse_(result);
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error.message
    });
  }
}

function saveFeedback_(payload) {
  const sheet = getSheet_(SHEETS.feedback);
  const headers = ensureHeaders_(sheet, [
    'key',
    'clienteId',
    'cliente',
    'vendedor',
    'mes',
    'anio',
    'estado',
    'comentarios',
    'updatedAt'
  ]);

  const key = payload.key || [
    payload.clienteId,
    payload.vendedor,
    payload.mes,
    payload.anio
  ].join('|');

  const rowObject = {
    key: key,
    clienteId: payload.clienteId || '',
    cliente: payload.cliente || '',
    vendedor: payload.vendedor || '',
    mes: payload.mes || '',
    anio: payload.anio || '',
    estado: payload.estado || '',
    comentarios: payload.comentarios || '',
    updatedAt: payload.updatedAt || new Date().toISOString()
  };

  upsertByKey_(sheet, headers, key, rowObject);

  return {
    ok: true,
    action: 'saveFeedback',
    key: key
  };
}

function submitReport_(payload) {
  const sheet = getSheet_(SHEETS.submissions);
  const headers = ensureHeaders_(sheet, [
    'key',
    'vendedor',
    'mes',
    'anio',
    'sent',
    'sentAt'
  ]);

  const key = payload.key || [
    payload.vendedor,
    payload.mes,
    payload.anio
  ].join('|');

  const rowObject = {
    key: key,
    vendedor: payload.vendedor || '',
    mes: payload.mes || '',
    anio: payload.anio || '',
    sent: payload.sent === false ? false : true,
    sentAt: payload.sentAt || new Date().toISOString()
  };

  upsertByKey_(sheet, headers, key, rowObject);

  return {
    ok: true,
    action: 'submitReport',
    key: key
  };
}

function getSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('No existe la hoja: ' + sheetName);
  }

  return sheet;
}

function ensureHeaders_(sheet, expectedHeaders) {
  const lastColumn = Math.max(sheet.getLastColumn(), expectedHeaders.length);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return expectedHeaders;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function(header) {
      return String(header || '').trim();
    });

  expectedHeaders.forEach(function(header) {
    if (currentHeaders.indexOf(header) === -1) {
      currentHeaders.push(header);
      sheet.getRange(1, currentHeaders.length).setValue(header);
    }
  });

  return currentHeaders.filter(function(header) {
    return header !== '';
  });
}

function upsertByKey_(sheet, headers, key, rowObject) {
  const keyColumnIndex = headers.indexOf('key') + 1;

  if (keyColumnIndex < 1) {
    throw new Error('La hoja no tiene columna key');
  }

  const lastRow = sheet.getLastRow();
  let targetRow = lastRow + 1;

  if (lastRow > 1) {
    const keys = sheet.getRange(2, keyColumnIndex, lastRow - 1, 1).getValues();

    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(key)) {
        targetRow = i + 2;
        break;
      }
    }
  }

  const rowValues = headers.map(function(header) {
    return rowObject[header] !== undefined ? rowObject[header] : '';
  });

  sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
}

function readSheetObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  return values.slice(1)
    .filter(function(row) {
      return row.some(function(cell) {
        return cell !== '';
      });
    })
    .map(function(row) {
      const item = {};

      headers.forEach(function(header, index) {
        if (header) {
          item[header] = row[index];
        }
      });

      return item;
    });
}

function parsePayload_(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (error) {
      throw new Error('JSON invalido en el body');
    }
  }

  if (e && e.parameter && Object.keys(e.parameter).length > 0) {
    return e.parameter;
  }

  return {};
}

function getParam_(e, name) {
  if (!e || !e.parameter) {
    return '';
  }

  return e.parameter[name] || '';
}

function jsonResponse_(data, e) {
  const callback = getParam_(e, 'callback');
  const json = JSON.stringify(data);

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
