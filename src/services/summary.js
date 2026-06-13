'use strict';

const store = require('../data/store');

const METRIC_TYPES = ['INVENTORY', 'ANNUAL_INCREMENT', 'INSPECTION', 'HAZARD', 'EQUIPMENT'];

const COMPUTE_MAP = {
  INVENTORY: (f) => store.computeInventory(f),
  ANNUAL_INCREMENT: (f) => store.computeAnnualIncrement(f),
  INSPECTION: (f) => store.computeInspectionCoverage(f),
  HAZARD: (f) => store.computeHazardStats(f),
  EQUIPMENT: (f) => store.computeEquipmentStats(f),
};

async function getOrCompute(metricType, { year, district } = {}) {
  if (!METRIC_TYPES.includes(metricType)) {
    throw new Error(`未知的统计类型: ${metricType}`);
  }

  const distKey = district || '';
  const hasYear = year !== undefined && year !== null;
  const statYear = hasYear ? year : new Date().getFullYear();

  if (hasYear) {
    const cached = await store.getSummary(statYear, distKey, metricType);
    if (cached && !cached.stale) {
      return cached.payload;
    }
  }

  const payload = await COMPUTE_MAP[metricType]({
    year: hasYear ? statYear : undefined,
    district: distKey || undefined,
  });

  if (hasYear) {
    await store.saveSummary(statYear, distKey, metricType, payload);
  }

  return payload;
}

async function refreshStale() {
  const staleList = await store.listStaleSummaries();
  const results = { refreshed: 0, failed: 0, errors: [] };

  for (const item of staleList) {
    try {
      const computeFn = COMPUTE_MAP[item.metricType];
      if (!computeFn) {
        results.failed += 1;
        results.errors.push({ metricType: item.metricType, error: '未知的统计类型' });
        continue;
      }
      const payload = await computeFn({
        year: item.statYear,
        district: item.district || undefined,
      });
      await store.saveSummary(item.statYear, item.district, item.metricType, payload);
      results.refreshed += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push({ metricType: item.metricType, error: err.message });
    }
  }

  return results;
}

async function refreshAll({ year, district } = {}) {
  const results = { refreshed: 0, failed: 0, errors: [] };

  for (const metricType of METRIC_TYPES) {
    if (year) {
      try {
        const payload = await COMPUTE_MAP[metricType]({
          year,
          district: district || undefined,
        });
        await store.saveSummary(year, district || '', metricType, payload);
        results.refreshed += 1;
      } catch (err) {
        results.failed += 1;
        results.errors.push({ metricType, error: err.message });
      }
    } else {
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 8; y <= currentYear; y += 1) {
        try {
          const payload = await COMPUTE_MAP[metricType]({ year: y, district: district || undefined });
          await store.saveSummary(y, district || '', metricType, payload);
          results.refreshed += 1;
        } catch (err) {
          results.failed += 1;
          results.errors.push({ metricType, year: y, error: err.message });
        }
      }
    }
  }

  return results;
}

async function markStale(year, district) {
  if (year !== undefined && district !== undefined) {
    await store.markSummariesStale(year, district);
  } else if (year !== undefined) {
    await store.markSummariesStale(year);
  } else {
    await store.markAllSummariesStale();
  }
}

module.exports = { METRIC_TYPES, getOrCompute, refreshStale, refreshAll, markStale };
