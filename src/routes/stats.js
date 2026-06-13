'use strict';

const express = require('express');
const summary = require('../services/summary');
const { authRequired, requireRole } = require('../auth');
const { sendError, toPositiveInt } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authRequired);

function _parseFilters(req) {
  const yearStr = req.query.year;
  const year = yearStr ? parseInt(yearStr, 10) : undefined;
  if (yearStr !== undefined && (Number.isNaN(year) || year < 2000 || year > 2100)) {
    return null;
  }
  const district = req.query.district || undefined;
  return { year, district };
}

router.get('/inventory', wrap(async (req, res) => {
  const filters = _parseFilters(req);
  if (filters === null) return sendError(res, 400, '无效的年度参数');
  const data = await summary.getOrCompute('INVENTORY', filters);
  res.json({ data });
}));

router.get('/annual-increment', wrap(async (req, res) => {
  const filters = _parseFilters(req);
  if (filters === null) return sendError(res, 400, '无效的年度参数');
  const data = await summary.getOrCompute('ANNUAL_INCREMENT', filters);
  res.json({ data });
}));

router.get('/inspection', wrap(async (req, res) => {
  const filters = _parseFilters(req);
  if (filters === null) return sendError(res, 400, '无效的年度参数');
  const data = await summary.getOrCompute('INSPECTION', filters);
  res.json({ data });
}));

router.get('/hazard', wrap(async (req, res) => {
  const filters = _parseFilters(req);
  if (filters === null) return sendError(res, 400, '无效的年度参数');
  const data = await summary.getOrCompute('HAZARD', filters);
  res.json({ data });
}));

router.get('/equipment', wrap(async (req, res) => {
  const filters = _parseFilters(req);
  if (filters === null) return sendError(res, 400, '无效的年度参数');
  const data = await summary.getOrCompute('EQUIPMENT', filters);
  res.json({ data });
}));

router.post('/refresh', requireRole('ADMIN', 'MANAGER'), wrap(async (req, res) => {
  const body = req.body || {};
  const yearStr = body.year;
  const year = yearStr ? parseInt(yearStr, 10) : undefined;
  const district = body.district || undefined;

  const results = await summary.refreshAll({ year, district });
  res.json({ data: results });
}));

module.exports = router;
