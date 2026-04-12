// ═══════════════════════════════════════════════════════════
// ESGRIMA NACIONAL — Apps Script v4
// Guardado por lotes para evitar límite de URL
// ═══════════════════════════════════════════════════════════

const SHEET_ID = '17E0RKAi121rpPaCbVfBW8yiIamXQxz-dO7O464z8TOc';

const EQUIPOS = {
  'esgrima26masc': 'EspadaMasc',
  'esgrima26fem':  'EspadaFem',
  'florete26masc': 'FloreteMasc',
  'florete26fem':  'FloreteFem',
  'sable26masc':   'SableMasc',
};

// ── PUNTO DE ENTRADA ───────────────────────────────────────
function doGet(e) {
  const action   = e.parameter.action;
  const team     = e.parameter.team;
  const callback = e.parameter.callback;

  let result;

  try {
    if (action === 'wellness') {
      return getDatosWellness(team);

    } else if (action === 'load') {
      result = cargarDatos(team);

    } else if (action === 'save') {
      const data = JSON.parse(decodeURIComponent(e.parameter.data || '{}'));
      result = guardarDatosObj(team, data);

    } else if (action === 'saveChunk') {
      // Chunked saving: save weeks or comps separately
      const chunk = e.parameter.chunk; // 'weeks' or 'comps'
      const data  = JSON.parse(decodeURIComponent(e.parameter.data || '{}'));
      result = guardarChunk(team, chunk, data);

    } else {
      result = { error: 'Acción no reconocida: ' + action };
    }
  } catch(err) {
    result = { error: err.message };
  }

  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GUARDAR CHUNK ──────────────────────────────────────────
function guardarChunk(team, chunk, data) {
  try {
    const sheetName = EQUIPOS[team];
    if (!sheetName) return { error: 'Equipo no reconocido: ' + team };

    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { error: 'Hoja no encontrada: ' + sheetName };

    // Load existing data
    let existing = {};
    const raw = sheet.getRange(1, 1).getValue();
    if (raw) {
      try { existing = JSON.parse(raw); } catch(e) {}
    }

    if (chunk === 'weeks') {
      if (!existing.weeks) existing.weeks = [];
      const wOffset = data.offset || 0;
      const wBatch  = data.weeks || [];
      for (let i = 0; i < wBatch.length; i++) {
        existing.weeks[wOffset + i] = wBatch[i];
      }
      if (data.total) existing.weeks = existing.weeks.slice(0, data.total);
      existing.nid = data.nid || existing.nid;
    } else if (chunk === 'days') {
      if (!existing.days) existing.days = {};
      const entries = data.entries || [];
      entries.forEach(e => { existing.days[e.k] = e.v; });
    } else if (chunk === 'comps') {
      if (!existing.comps) existing.comps = [];
      const offset = data.offset || 0;
      const batch  = data.comps || [];
      // Replace/insert at offset
      for (let i = 0; i < batch.length; i++) {
        existing.comps[offset + i] = batch[i];
      }
      // Trim to total length if specified
      if (data.total) existing.comps = existing.comps.slice(0, data.total);
    }

    // Save updated data
    sheet.getRange(1, 1).setValue(JSON.stringify(existing));
    sheet.getRange(1, 2).setValue(new Date().toISOString());

    // Update legible view for weeks
    if (chunk === 'weeks') guardarLegibleSemanas(sheet, existing);
    if (chunk === 'comps' && data.offset === 0) guardarLegibleComps(sheet, existing);

    return { ok: true, chunk: chunk, saved: new Date().toISOString() };

  } catch (err) {
    return { error: err.message };
  }
}

// ── CARGAR DATOS ───────────────────────────────────────────
function cargarDatos(team) {
  try {
    const sheetName = EQUIPOS[team];
    if (!sheetName) return { error: 'Equipo no reconocido: ' + team };
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 1) return { data: null };
    const raw = sheet.getRange(1, 1).getValue();
    if (!raw) return { data: null };
    return { data: JSON.parse(raw) };
  } catch (err) {
    return { error: err.message };
  }
}

// ── GUARDAR DATOS COMPLETO ─────────────────────────────────
function guardarDatosObj(team, data) {
  try {
    const sheetName = EQUIPOS[team];
    if (!sheetName) return { error: 'Equipo no reconocido: ' + team };
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { error: 'Hoja no encontrada: ' + sheetName };
    sheet.getRange(1, 1).setValue(JSON.stringify(data));
    sheet.getRange(1, 2).setValue(new Date().toISOString());
    guardarLegibleComps(sheet, data);
    guardarLegibleSemanas(sheet, data);
    return { ok: true, saved: new Date().toISOString() };
  } catch (err) {
    return { error: err.message };
  }
}

// ── VERSIÓN LEGIBLE COMPETICIONES ──────────────────────────
function guardarLegibleComps(sheet, data) {
  try {
    sheet.getRange(3, 1, 1, 7).setValues([['ID','NOMBRE','MES','SEMANA','DÍA INI','DÍA FIN','TIPO']]);
    sheet.getRange(3, 1, 1, 7).setFontWeight('bold');
    if (data.comps && data.comps.length > 0) {
      const rows = data.comps.filter(c=>c).map(c=>[c.id||'',c.name||'',c.mes||'',c.sem||'',c.dia||'',c.dia_fin||'',c.tipo||'']);
      if (rows.length > 0) sheet.getRange(4, 1, rows.length, 7).setValues(rows);
    }
  } catch(e) { Logger.log('Error comps legible: ' + e.message); }
}

// ── VERSIÓN LEGIBLE SEMANAS ────────────────────────────────
function guardarLegibleSemanas(sheet, data) {
  try {
    const wOffset = 9;
    sheet.getRange(3, wOffset, 1, 5).setValues([['SEM','MES','FASE','RPE','NOTAS']]);
    sheet.getRange(3, wOffset, 1, 5).setFontWeight('bold');
    if (data.weeks && data.weeks.length > 0) {
      const rows = data.weeks.map(w=>[w.num||'',w.mes||'',w.fase||'',w.rpe||'',w.notas||'']);
      sheet.getRange(4, wOffset, rows.length, 5).setValues(rows);
    }
  } catch(e) { Logger.log('Error weeks legible: ' + e.message); }
}

// ── VERSIÓN LEGIBLE DÍAS ───────────────────────────────────
function guardarLegibleDias(sheet, data) {
  try {
    if (!data.days || Object.keys(data.days).length === 0) return;
    const dOffset = 15;
    sheet.getRange(3, dOffset, 1, 3).setValues([['FECHA', 'FASE/RPE', 'NOTA']]);
    sheet.getRange(3, dOffset, 1, 3).setFontWeight('bold');
    const rows = Object.entries(data.days)
      .filter(([k,v]) => v && (v.nota || v.fase || v.rpe))
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([k,v]) => [k, (v.fase||'')+(v.rpe?' RPE '+v.rpe:''), v.nota||'']);
    if (rows.length > 0) {
      sheet.getRange(4, dOffset, rows.length, 3).setValues(rows);
    }
  } catch(e) { Logger.log('Error dias legible: ' + e.message); }
}

// ── WELLNESS ───────────────────────────────────────────────
function getDatosWellness(team) {
  const urls = {
    'masc': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrJjfRs6o3KsOAt3TKjxn-xFjkESXrkRVcseqMbK0xPdCTK-64RA9qteZwIDA3TpLnvh77plAs5Q15/pub?gid=201276040&single=true&output=csv',
    'fem':  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBv-dYvKkDDrXnJwY4gdGTAYj-IL34lcVsx3TL8cjspdU_hOdgi6wTLV7UDJVafIdtldOFMj34BSn6/pub?gid=1490399670&single=true&output=csv',
    'flm':  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSH56ayIJKpmCtT65kNv3rMRMf8vytNtvftlOB4Nd8eTaf6Q12l9iPwKbrrCpeg3vHH1nXRSac-8TEN/pub?output=csv',
    'flf':  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSachSG12vLbkQJd5WOIn3edpLGCjAKGOP9xBz-INJSKBrFHh8RmdPeld9LB1vUbKqWgGDrVALk_upg/pub?output=csv',
    'sab':  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTkbWHXjJzfw2CzOUfPk0vLYl40usTWdHJa-qZbILR1YRh9zpDkawlu2dVLQ_CN1F-2Zgchgx1I6juE/pub?output=csv',
  };
  const url = urls[team];
  if (!url) return ContentService.createTextOutput(JSON.stringify({error:'Equipo no reconocido'})).setMimeType(ContentService.MimeType.JSON);
  const csv = UrlFetchApp.fetch(url).getContentText('UTF-8');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.TEXT);
}

// ── TEST ───────────────────────────────────────────────────
function testAuth() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Logger.log('Sheet OK: ' + ss.getName());
}
