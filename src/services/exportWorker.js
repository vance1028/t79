'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('../data/store');
const summary = require('./summary');

const EXPORTS_DIR = path.resolve(__dirname, '../../exports');
const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 500;

let timer = null;

function _ensureDir() {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
}

function _flattenObject(obj, prefix) {
  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result.push(..._flattenObject(value, fullKey));
    } else {
      result.push({ key: fullKey, value: value === null || value === undefined ? '' : value });
    }
  }
  return result;
}

function _toCsvRows(payload) {
  const rows = [];

  function extractFlat(obj, baseFields) {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const flat = {};
          for (const [k, v] of Object.entries(item)) {
            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
              const nested = _flattenObject(v, k);
              for (const n of nested) flat[n.key] = n.value;
            } else {
              flat[k] = v;
            }
          }
          rows.push({ ...baseFields, ...flat });
        } else {
          rows.push({ ...baseFields, value: item });
        }
      }
    } else if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v)) {
          extractFlat(v, { ...baseFields, _section: k });
        } else if (typeof v === 'object' && v !== null) {
          extractFlat(v, { ...baseFields, [k]: v });
        } else {
          rows.push({ ...baseFields, [k]: v });
        }
      }
    }
  }

  extractFlat(payload, {});
  return rows;
}

function _csvEscape(val) {
  const s = String(val === null || val === undefined ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function _buildCsvContent(payload) {
  const rows = _toCsvRows(payload);
  if (rows.length === 0) return '\uFEFF\n';

  const allKeys = new Set();
  for (const row of rows) {
    for (const k of Object.keys(row)) allKeys.add(k);
  }
  const headers = [...allKeys];

  const lines = [];
  lines.push(headers.map(_csvEscape).join(','));
  for (const row of rows) {
    lines.push(headers.map((h) => _csvEscape(row[h])).join(','));
  }
  return '\uFEFF' + lines.join('\n') + '\n';
}

async function _generateFile(task) {
  const filters = task.filters || {};
  const data = await summary.getOrCompute(task.metricType, {
    year: filters.year,
    district: filters.district,
  });

  const ext = task.format === 'JSON' ? 'json' : 'csv';
  const fileName = `${task.taskKey}.${ext}`;
  const filePath = path.join(EXPORTS_DIR, fileName);

  _ensureDir();

  if (task.format === 'JSON') {
    const content = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filePath, content, 'utf-8');
  } else {
    const content = _buildCsvContent(data);
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }

  return filePath;
}

async function _processTask(task) {
  try {
    await store.updateExportTask(task.id, { status: 'GENERATING', progress: 10 });
    const filePath = await _generateFile(task);
    await store.updateExportTask(task.id, {
      status: 'COMPLETED',
      progress: 100,
      filePath,
    });
  } catch (err) {
    await store.updateExportTask(task.id, {
      status: 'FAILED',
      progress: 0,
      errorMsg: err.message || String(err),
    });
  }
}

async function _poll() {
  try {
    const tasks = await store.listExportTasks({ status: 'QUEUED' });
    for (const task of tasks) {
      await _processTask(task);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('导出 worker 轮询异常:', err.message);
  }
}

function start() {
  if (timer) return;
  _ensureDir();
  timer = setInterval(_poll, POLL_INTERVAL_MS);
  _poll();
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function generateTaskKey(metricType, filters, format) {
  const payload = `${metricType}:${JSON.stringify(filters)}:${format}:${Date.now()}`;
  return crypto.createHash('md5').update(payload).digest('hex').substring(0, 16);
}

module.exports = { start, stop, generateTaskKey, EXPORTS_DIR };
