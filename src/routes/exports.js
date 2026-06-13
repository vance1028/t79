'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const store = require('../data/store');
const summary = require('../services/summary');
const exportWorker = require('../services/exportWorker');
const { authRequired } = require('../auth');
const { sendError, toPositiveInt } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_METRICS = ['INVENTORY', 'ANNUAL_INCREMENT', 'INSPECTION', 'HAZARD', 'EQUIPMENT'];
const VALID_FORMATS = ['CSV', 'JSON'];

router.use(authRequired);

function _csvEscape(val) {
  const s = String(val === null || val === undefined ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function _flattenForCsv(obj, prefix) {
  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result.push(..._flattenForCsv(value, fullKey));
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
              const nested = _flattenForCsv(v, k);
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

router.post('/', wrap(async (req, res) => {
  const body = req.body || {};
  const metricType = (body.metricType || '').toUpperCase();
  const format = (body.format || 'CSV').toUpperCase();
  const filters = body.filters || {};

  if (!VALID_METRICS.includes(metricType)) {
    return sendError(res, 400, `metricType 必须为 ${VALID_METRICS.join(' / ')}`);
  }
  if (!VALID_FORMATS.includes(format)) {
    return sendError(res, 400, `format 必须为 ${VALID_FORMATS.join(' / ')}`);
  }

  const year = filters.year ? parseInt(filters.year, 10) : undefined;
  if (filters.year !== undefined && (Number.isNaN(year) || year < 2000 || year > 2100)) {
    return sendError(res, 400, '无效的年度参数');
  }

  const taskKey = exportWorker.generateTaskKey(metricType, filters, format);

  const existing = await store.getExportTaskByKey(taskKey);
  if (existing) {
    if (['QUEUED', 'GENERATING', 'COMPLETED'].includes(existing.status)) {
      return res.json({ data: existing });
    }
    if (existing.status === 'FAILED') {
      await store.updateExportTask(existing.id, {
        status: 'QUEUED',
        progress: 0,
        filePath: null,
        errorMsg: null,
      });
      const retried = await store.getExportTask(existing.id);
      return res.json({ data: retried });
    }
  }

  const task = await store.createExportTask({
    taskKey,
    metricType,
    filters: { year, district: filters.district },
    format,
  });

  res.status(201).json({ data: task });
}));

router.get('/:id', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的任务 ID');
  const task = await store.getExportTask(id);
  if (!task) return sendError(res, 404, '导出任务不存在');
  res.json({ data: task });
}));

router.get('/:id/download', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的任务 ID');
  const task = await store.getExportTask(id);
  if (!task) return sendError(res, 404, '导出任务不存在');
  if (task.status !== 'COMPLETED') {
    return sendError(res, 400, `任务尚未完成，当前状态: ${task.status}`);
  }
  if (!task.filePath || !fs.existsSync(task.filePath)) {
    return sendError(res, 410, '导出文件已过期或不存在');
  }

  const ext = task.format === 'JSON' ? 'json' : 'csv';
  const contentType = task.format === 'JSON' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8';
  const fileName = `${task.taskKey}.${ext}`;

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

  const fileStream = fs.createReadStream(task.filePath, { encoding: 'utf-8' });
  fileStream.pipe(res);
}));

router.post('/:id/retry', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的任务 ID');
  const task = await store.getExportTask(id);
  if (!task) return sendError(res, 404, '导出任务不存在');
  if (task.status !== 'FAILED') {
    return sendError(res, 400, '只能重试失败的任务');
  }

  await store.updateExportTask(id, {
    status: 'QUEUED',
    progress: 0,
    filePath: null,
    errorMsg: null,
  });

  const updated = await store.getExportTask(id);
  res.json({ data: updated });
}));

router.get('/stream/:metricType', wrap(async (req, res) => {
  const metricType = (req.params.metricType || '').toUpperCase();
  if (!VALID_METRICS.includes(metricType)) {
    return sendError(res, 400, `metricType 必须为 ${VALID_METRICS.join(' / ')}`);
  }

  const format = (req.query.format || 'CSV').toUpperCase();
  if (!VALID_FORMATS.includes(format)) {
    return sendError(res, 400, `format 必须为 ${VALID_FORMATS.join(' / ')}`);
  }

  const yearStr = req.query.year;
  const year = yearStr ? parseInt(yearStr, 10) : undefined;
  if (yearStr !== undefined && (Number.isNaN(year) || year < 2000 || year > 2100)) {
    return sendError(res, 400, '无效的年度参数');
  }
  const district = req.query.district || undefined;

  const data = await summary.getOrCompute(metricType, { year, district });

  if (format === 'JSON') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${metricType.toLowerCase()}.json"`);
    res.write(JSON.stringify(data, null, 2));
    res.end();
  } else {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${metricType.toLowerCase()}.csv"`);

    const rows = _toCsvRows(data);
    if (rows.length > 0) {
      const allKeys = new Set();
      for (const row of rows) {
        for (const k of Object.keys(row)) allKeys.add(k);
      }
      const headers = [...allKeys];
      res.write('\uFEFF');
      res.write(headers.map(_csvEscape).join(',') + '\n');
      for (const row of rows) {
        res.write(headers.map((h) => _csvEscape(row[h])).join(',') + '\n');
      }
    } else {
      res.write('\uFEFF\n');
    }
    res.end();
  }
}));

module.exports = router;
