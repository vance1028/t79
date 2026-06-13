'use strict';

const { pool } = require('../db');
const { hashPassword } = require('../utils/password');

/* ----------------------------- 映射 ----------------------------- */

function mapUser(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    role: r.role,
    department: r.department,
    status: r.status,
    createdAt: r.created_at,
  };
}

function mapUserWithHash(r) {
  if (!r) return null;
  return { ...mapUser(r), passwordHash: r.password_hash };
}

function mapProject(r) {
  if (!r) return null;
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    protectionLevel: r.protection_level,
    areaSqm: Number(r.area_sqm),
    address: r.address,
    district: r.district,
    peacetimeUse: r.peacetime_use,
    status: r.status,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapEquipment(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    category: r.category,
    model: r.model,
    installDate: r.install_date,
    status: r.status,
    createdAt: r.created_at,
  };
}

function mapInspection(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    inspectorId: r.inspector_id,
    inspectDate: r.inspect_date,
    type: r.type,
    result: r.result,
    issues: r.issues,
    createdAt: r.created_at,
  };
}

function mapHazard(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    inspectionId: r.inspection_id,
    severity: r.severity,
    description: r.description,
    status: r.status,
    discoveredAt: r.discovered_at,
    rectifiedAt: r.rectified_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapExportTask(r) {
  if (!r) return null;
  return {
    id: r.id,
    taskKey: r.task_key,
    metricType: r.metric_type,
    filters: typeof r.filters === 'string' ? JSON.parse(r.filters) : r.filters,
    format: r.format,
    status: r.status,
    progress: r.progress,
    filePath: r.file_path,
    errorMsg: r.error_msg,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/* --------------------------- 初始化/重置 --------------------------- */

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['inspections', 'hazards', 'equipments', 'projects', 'users', 'stat_summaries', 'export_tasks']) {
      await conn.query(`TRUNCATE TABLE ${t}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    await conn.query(
      `INSERT INTO users (id, username, password_hash, name, role, department) VALUES
        (1, 'admin', ?, '系统管理员', 'ADMIN', '人防办信息科'),
        (2, 'manager', ?, '张管理', 'MANAGER', '工程管理科'),
        (3, 'inspector', ?, '李巡检', 'INSPECTOR', '维护管理科')`,
      [hashPassword('admin123'), hashPassword('manager123'), hashPassword('inspect123')],
    );

    const DISTRICTS = ['城关区', '江南区', '高新区', '开发区', '西湖区'];
    const TYPES = ['COMBINED', 'BASEMENT', 'SINGLE', 'SHELTER'];
    const LEVELS = ['4', '4B', '5', '6', '6B'];
    const STATUSES = ['NORMAL', 'MAINTENANCE', 'DECOMMISSIONED'];
    const USES = ['地下停车场', '商业仓储', '社区活动中心', '物资储备库', '人员掩蔽', '应急指挥', '医疗救护', '暂未利用'];

    const PROJ_NAMES = [
      '中心广场地下人防工程', '滨江路防空地下室', '老城区单建掘开式工程', '科技园人员掩蔽所',
      '火车站枢纽人防工程', '新城商务区地下空间', '河畔花园防空地下室', '大学城掩蔽工程',
      '文化中心地下防护工程', '体育场馆人防工程', '产业基地防空设施', '港口物流人防地下室',
      '医院地下救护站', '学校操场掩蔽所', '商场地下防护空间', '住宅小区结建防空地下室',
      '政务中心地下指挥所', '工业园区防护工程', '物流园防空地下室', '古镇保护区人防工程',
      '湿地公园地下掩体', '机场配套人防工程', '地铁换乘站防护段', '会展中心地下空间',
      '金融街人防地下室', '生态城防护工程', '科技城防空设施', '文旅区人防工程',
      '高铁站配套人防', '老城区改造防护段', '新区CBD地下空间', '教育园区掩蔽所',
    ];

    const EQUIP_CATS = ['PROTECTIVE_DOOR', 'VENTILATION', 'POWER', 'WATER', 'OTHER'];
    const EQUIP_NAMES_MAP = {
      PROTECTIVE_DOOR: ['防护密闭门', '防爆波活门', '密闭门'],
      VENTILATION: ['战时通风机', '滤毒通风设备', '进排风机'],
      POWER: ['柴油发电机组', '配电柜', 'UPS电源'],
      WATER: ['给排水泵', '污水处理设备', '消防水泵'],
      OTHER: ['通信设备', '监控设备', '照明设备'],
    };
    const EQUIP_MODELS = {
      PROTECTIVE_DOOR: ['HFM2030', 'HK600', 'HM1520'],
      VENTILATION: ['F300', 'LD60', 'SR500'],
      POWER: ['50GF', 'PCM200', 'GK100'],
      WATER: ['WQ15', 'SHP30', 'XBD10'],
      OTHER: ['HW200', 'JK800', 'ZM50'],
    };
    const EQUIP_STATUSES = ['NORMAL', 'FAULT', 'MAINTENANCE'];

    const HAZARD_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'];
    const HAZARD_DESCS = {
      MINOR: ['墙面渗水', '标识脱落', '照明不足', '通风噪声偏大', '门扇启闭不灵活'],
      MAJOR: ['给排水泵故障', '通风设备异响', '防护门密封条老化', '消防管道锈蚀', '应急照明失效'],
      CRITICAL: ['滤毒设备老化失效', '结构裂缝扩展', '发电机无法启动', '防火分区破坏', '密闭段渗漏严重'],
    };
    const HAZARD_STATUSES = ['OPEN', 'RECTIFIED', 'CLOSED'];

    const projectRows = [];
    let projId = 1;
    for (let year = 2018; year <= 2026; year += 1) {
      const countForYear = year <= 2020 ? 5 : (year <= 2023 ? 7 : 6);
      for (let i = 0; i < countForYear; i += 1) {
        const d = DISTRICTS[projId % DISTRICTS.length];
        const t = TYPES[projId % TYPES.length];
        const l = LEVELS[projId % LEVELS.length];
        const area = Math.round((2000 + Math.random() * 10000) * 100) / 100;
        const use = USES[projId % USES.length];
        const nameIdx = (projId - 1) % PROJ_NAMES.length;
        const completedAt = year < 2026
          ? `${year}-${String(1 + (projId % 12)).padStart(2, '0')}-${String(1 + (projId % 28)).padStart(2, '0')}`
          : null;
        const statusIdx = year <= 2012 && projId % 7 === 0 ? 2 : (projId % 9 === 0 ? 1 : 0);
        const st = STATUSES[statusIdx];
        const code = `RF-${year}-${String(projId).padStart(3, '0')}`;
        const addr = `${d}${['人民路', '建设路', '解放路', '科技路', '滨江路', '环城路'][projId % 6]}${projId * 11 + 5}号`;
        projectRows.push([projId, code, PROJ_NAMES[nameIdx] + (projId > PROJ_NAMES.length ? `(${d})` : ''), t, l, area, addr, d, use, st, completedAt]);
        projId += 1;
      }
    }

    for (let offset = 0; offset < projectRows.length; offset += 20) {
      const batch = projectRows.slice(offset, offset + 20);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = batch.flat();
      await conn.query(
        `INSERT INTO projects (id, code, name, type, protection_level, area_sqm, address, district, peacetime_use, status, completed_at) VALUES ${placeholders}`,
        values,
      );
    }

    const equipRows = [];
    let eqId = 1;
    for (const proj of projectRows) {
      const eqCount = 2 + (proj[0] % 4);
      for (let ei = 0; ei < eqCount; ei += 1) {
        const cat = EQUIP_CATS[ei % EQUIP_CATS.length];
        const names = EQUIP_NAMES_MAP[cat];
        const models = EQUIP_MODELS[cat];
        const eName = names[ei % names.length] + (eqCount > 3 ? String(ei + 1) : '');
        const model = models[ei % models.length];
        const completedYear = proj[10] ? parseInt(proj[10].substring(0, 4), 10) : 2025;
        const installDate = `${completedYear}-${String(1 + (ei % 12)).padStart(2, '0')}-${String(1 + (ei % 28)).padStart(2, '0')}`;
        let eStatus = 'NORMAL';
        if (proj[0] % 7 === 0 && ei === 1) eStatus = 'FAULT';
        else if (proj[0] % 11 === 0 && ei === 2) eStatus = 'MAINTENANCE';
        equipRows.push([eqId, proj[0], eName, cat, model, installDate, eStatus]);
        eqId += 1;
      }
    }

    for (let offset = 0; offset < equipRows.length; offset += 50) {
      const batch = equipRows.slice(offset, offset + 50);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = batch.flat();
      await conn.query(
        `INSERT INTO equipments (id, project_id, name, category, model, install_date, status) VALUES ${placeholders}`,
        values,
      );
    }

    const inspRows = [];
    let inspId = 1;
    for (const proj of projectRows) {
      if (!proj[10]) continue;
      const completedYear = parseInt(proj[10].substring(0, 4), 10);
      for (let y = completedYear; y <= 2026; y += 1) {
        const inspectCount = y === 2026 ? (1 + (proj[0] % 2)) : (proj[0] % 3 === 0 ? 2 : 1);
        for (let ii = 0; ii < inspectCount; ii += 1) {
          const month = 1 + ((projId + y + ii) % 12);
          const day = 1 + ((proj[0] + ii) % 28);
          const dateStr = `${y}-${String(Math.min(month, 12)).padStart(2, '0')}-${String(Math.min(day, 28)).padStart(2, '0')}`;
          const type = ii === 0 ? 'ROUTINE' : (ii === 1 ? 'ROUTINE' : 'SPECIAL');
          let result = 'PASS';
          if (proj[0] % 5 === 0 && y === 2025) result = 'FAIL';
          else if (proj[0] % 7 === 0 && y === 2026) result = 'FAIL';
          else if (proj[0] % 3 === 0 && ii === 1 && y >= 2024) result = 'FAIL';
          const issues = result === 'FAIL'
            ? ['设备老化需更换', '密封条失效', '通风不达标', '消防设施过期', '给排水异常'][ii % 5]
            : '';
          inspRows.push([inspId, proj[0], 3, dateStr, type, result, issues]);
          inspId += 1;
        }
      }
    }

    for (let offset = 0; offset < inspRows.length; offset += 50) {
      const batch = inspRows.slice(offset, offset + 50);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = batch.flat();
      await conn.query(
        `INSERT INTO inspections (id, project_id, inspector_id, inspect_date, type, result, issues) VALUES ${placeholders}`,
        values,
      );
    }

    const hazardRows = [];
    let hazId = 1;
    for (const insp of inspRows) {
      if (insp[5] !== 'FAIL') continue;
      if (insp[0] % 2 === 0 && insp[0] % 3 !== 0) continue;
      const severity = HAZARD_SEVERITIES[insp[0] % 3];
      const descs = HAZARD_DESCS[severity];
      const desc = descs[insp[0] % descs.length];
      const discoveredAt = insp[3];
      let hStatus = 'OPEN';
      let rectifiedAt = null;
      const discoveredYear = parseInt(discoveredAt.substring(0, 4), 10);
      if (discoveredYear <= 2023) {
        hStatus = HAZARD_STATUSES[insp[0] % 2 === 0 ? 2 : 1];
        const rMonth = 1 + (insp[0] % 12);
        const rDay = 1 + (insp[0] % 28);
        rectifiedAt = `${discoveredYear + (rMonth > 6 ? 0 : 1)}-${String(Math.min(rMonth, 12)).padStart(2, '0')}-${String(Math.min(rDay, 28)).padStart(2, '0')}`;
      } else if (discoveredYear === 2024 && insp[0] % 3 === 0) {
        hStatus = 'RECTIFIED';
        rectifiedAt = `2024-${String(7 + (insp[0] % 6)).padStart(2, '0')}-15`;
      }
      hazardRows.push([hazId, insp[1], insp[0], severity, desc, hStatus, discoveredAt, rectifiedAt]);
      hazId += 1;
    }

    for (let offset = 0; offset < hazardRows.length; offset += 50) {
      const batch = hazardRows.slice(offset, offset + 50);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = batch.flat();
      await conn.query(
        `INSERT INTO hazards (id, project_id, inspection_id, severity, description, status, discovered_at, rectified_at) VALUES ${placeholders}`,
        values,
      );
    }
  } finally {
    conn.release();
  }
}

async function isEmpty() {
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM users');
  return rows[0].cnt === 0;
}

/* ----------------------------- 用户 ----------------------------- */

async function findUserByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  return mapUserWithHash(rows[0]);
}

async function getUser(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return mapUser(rows[0]);
}

async function listUsers() {
  const [rows] = await pool.query('SELECT * FROM users ORDER BY id');
  return rows.map(mapUser);
}

async function createUser({ username, password, name = '', role = 'INSPECTOR', department = '' }) {
  const [r] = await pool.query(
    'INSERT INTO users (username, password_hash, name, role, department) VALUES (?, ?, ?, ?, ?)',
    [username, hashPassword(password), name, role, department],
  );
  return getUser(r.insertId);
}

/* ----------------------------- 人防工程 ----------------------------- */

async function listProjects({ status, district, keyword } = {}) {
  const where = [];
  const params = [];
  if (status !== undefined) { where.push('status = ?'); params.push(status); }
  if (district !== undefined) { where.push('district = ?'); params.push(district); }
  if (keyword !== undefined && keyword !== '') {
    where.push('(name LIKE ? OR code LIKE ? OR address LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM projects ${clause} ORDER BY id`, params);
  return rows.map(mapProject);
}

async function getProject(id) {
  const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
  return mapProject(rows[0]);
}

async function findProjectByCode(code) {
  const [rows] = await pool.query('SELECT * FROM projects WHERE code = ?', [code]);
  return mapProject(rows[0]);
}

async function createProject(p) {
  const [r] = await pool.query(
    `INSERT INTO projects (code, name, type, protection_level, area_sqm, address, district, peacetime_use, status, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.code, p.name, p.type || 'COMBINED', p.protectionLevel || '6', p.areaSqm || 0,
     p.address || '', p.district || '', p.peacetimeUse || '', p.status || 'NORMAL', p.completedAt || null],
  );
  return getProject(r.insertId);
}

async function updateProject(id, patch) {
  const map = {
    name: 'name', type: 'type', protectionLevel: 'protection_level', areaSqm: 'area_sqm',
    address: 'address', district: 'district', peacetimeUse: 'peacetime_use',
    status: 'status', completedAt: 'completed_at',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); params.push(patch[k]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP(3)');
    params.push(id);
    await pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getProject(id);
}

async function deleteProject(id) {
  const [r] = await pool.query('DELETE FROM projects WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

/* ----------------------------- 设备设施 ----------------------------- */

async function listEquipments(projectId) {
  const [rows] = await pool.query(
    'SELECT * FROM equipments WHERE project_id = ? ORDER BY id', [projectId]);
  return rows.map(mapEquipment);
}

async function createEquipment(e) {
  const [r] = await pool.query(
    `INSERT INTO equipments (project_id, name, category, model, install_date, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [e.projectId, e.name, e.category || 'OTHER', e.model || '', e.installDate || null, e.status || 'NORMAL'],
  );
  const [rows] = await pool.query('SELECT * FROM equipments WHERE id = ?', [r.insertId]);
  return mapEquipment(rows[0]);
}

/* ----------------------------- 检查记录 ----------------------------- */

async function listInspections({ projectId } = {}) {
  if (projectId !== undefined) {
    const [rows] = await pool.query(
      'SELECT * FROM inspections WHERE project_id = ? ORDER BY inspect_date DESC, id DESC', [projectId]);
    return rows.map(mapInspection);
  }
  const [rows] = await pool.query('SELECT * FROM inspections ORDER BY inspect_date DESC, id DESC');
  return rows.map(mapInspection);
}

async function createInspection(i) {
  const [r] = await pool.query(
    `INSERT INTO inspections (project_id, inspector_id, inspect_date, type, result, issues)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [i.projectId, i.inspectorId || null, i.inspectDate, i.type || 'ROUTINE', i.result || 'PASS', i.issues || ''],
  );
  const [rows] = await pool.query('SELECT * FROM inspections WHERE id = ?', [r.insertId]);
  return mapInspection(rows[0]);
}

/* ----------------------------- 隐患记录 ----------------------------- */

async function listHazards({ projectId, year, district, status: hStatus } = {}) {
  const where = [];
  const params = [];
  if (projectId !== undefined) { where.push('h.project_id = ?'); params.push(projectId); }
  if (year !== undefined) { where.push('YEAR(h.discovered_at) = ?'); params.push(year); }
  if (hStatus !== undefined) { where.push('h.status = ?'); params.push(hStatus); }
  if (district !== undefined && district !== '') {
    where.push('h.project_id IN (SELECT id FROM projects WHERE district = ?)');
    params.push(district);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT h.* FROM hazards h ${clause} ORDER BY h.discovered_at DESC, h.id DESC`, params);
  return rows.map(mapHazard);
}

async function getHazard(id) {
  const [rows] = await pool.query('SELECT * FROM hazards WHERE id = ?', [id]);
  return mapHazard(rows[0]);
}

async function createHazard(h) {
  const [r] = await pool.query(
    `INSERT INTO hazards (project_id, inspection_id, severity, description, status, discovered_at, rectified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [h.projectId, h.inspectionId || null, h.severity || 'MINOR', h.description || '',
     h.status || 'OPEN', h.discoveredAt, h.rectifiedAt || null],
  );
  return getHazard(r.insertId);
}

async function updateHazard(id, patch) {
  const colMap = {
    severity: 'severity', description: 'description', status: 'status',
    rectifiedAt: 'rectified_at',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(colMap)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); params.push(patch[k]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP(3)');
    params.push(id);
    await pool.query(`UPDATE hazards SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getHazard(id);
}

/* ------------------------- 统计原始查询 ------------------------- */

function _inventoryWhere(year, district) {
  const where = [];
  const params = [];
  if (year !== undefined) {
    where.push('completed_at <= ?');
    params.push(`${year}-12-31`);
  }
  if (district !== undefined && district !== '') {
    where.push('district = ?');
    params.push(district);
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

async function computeInventory({ year, district } = {}) {
  const { clause, params } = _inventoryWhere(year, district);

  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS totalCount, COALESCE(SUM(area_sqm), 0) AS totalArea FROM projects ${clause}`, params);

  const [byLevel] = await pool.query(
    `SELECT protection_level AS level, COUNT(*) AS count, COALESCE(SUM(area_sqm), 0) AS area
     FROM projects ${clause} GROUP BY protection_level ORDER BY protection_level`, params);

  const [byType] = await pool.query(
    `SELECT type, COUNT(*) AS count, COALESCE(SUM(area_sqm), 0) AS area
     FROM projects ${clause} GROUP BY type ORDER BY type`, params);

  const [byStatus] = await pool.query(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(area_sqm), 0) AS area
     FROM projects ${clause} GROUP BY status ORDER BY status`, params);

  const districtClause = year !== undefined
    ? `WHERE completed_at <= ?`
    : '';
  const districtParams = year !== undefined ? [`${year}-12-31`] : [];
  const [byDistrict] = await pool.query(
    `SELECT district, COUNT(*) AS count, COALESCE(SUM(area_sqm), 0) AS area
     FROM projects ${districtClause} GROUP BY district ORDER BY district`, districtParams);

  return {
    year: year || null,
    district: district || null,
    totalCount: Number(totals.totalCount),
    totalArea: Number(totals.totalArea),
    byProtectionLevel: byLevel.map((r) => ({ level: r.level, count: Number(r.count), area: Number(r.area) })),
    byType: byType.map((r) => ({ type: r.type, count: Number(r.count), area: Number(r.area) })),
    byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count), area: Number(r.area) })),
    byDistrict: byDistrict.map((r) => ({ district: r.district, count: Number(r.count), area: Number(r.area) })),
  };
}

async function computeAnnualIncrement({ year, district } = {}) {
  const where = ['completed_at IS NOT NULL'];
  const params = [];
  if (year !== undefined) {
    where.push('YEAR(completed_at) = ?');
    params.push(year);
  }
  if (district !== undefined && district !== '') {
    where.push('district = ?');
    params.push(district);
  }

  const clause = `WHERE ${where.join(' AND ')}`;

  if (year !== undefined) {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS newCount, COALESCE(SUM(area_sqm), 0) AS newArea FROM projects ${clause}`, params);
    return {
      year,
      district: district || null,
      newCount: Number(row.newCount),
      newArea: Number(row.newArea),
    };
  }

  const [rows] = await pool.query(
    `SELECT YEAR(completed_at) AS year, COUNT(*) AS newCount, COALESCE(SUM(area_sqm), 0) AS newArea
     FROM projects ${clause} GROUP BY YEAR(completed_at) ORDER BY year`, params);
  return {
    year: null,
    district: district || null,
    yearly: rows.map((r) => ({ year: r.year, newCount: Number(r.newCount), newArea: Number(r.newArea) })),
  };
}

async function computeInspectionCoverage({ year, district } = {}) {
  const y = year || new Date().getFullYear();
  const yearStart = `${y}-01-01`;
  const yearEnd = `${y}-12-31`;

  const districtFilter = district && district !== '' ? 'AND p.district = ?' : '';
  const districtParam = district && district !== '' ? [district] : [];

  const [[dueRow]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM projects p
     WHERE p.status IN ('NORMAL','MAINTENANCE')
       AND p.completed_at <= ?
       ${districtFilter}`,
    [yearEnd, ...districtParam],
  );
  const dueCount = Number(dueRow.cnt);

  const [[inspectedRow]] = await pool.query(
    `SELECT COUNT(DISTINCT i.project_id) AS cnt FROM inspections i
     JOIN projects p ON p.id = i.project_id
     WHERE i.inspect_date BETWEEN ? AND ?
       ${districtFilter}`,
    [yearStart, yearEnd, ...districtParam],
  );
  const inspectedCount = Number(inspectedRow.cnt);

  const overdueCount = Math.max(0, dueCount - inspectedCount);
  const timelinessRate = dueCount > 0 ? Math.round((inspectedCount / dueCount) * 10000) / 100 : 0;

  const [[totalInspRow]] = await pool.query(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN result = 'FAIL' THEN 1 ELSE 0 END) AS failed
     FROM inspections i
     JOIN projects p ON p.id = i.project_id
     WHERE i.inspect_date BETWEEN ? AND ?
       ${districtFilter}`,
    [yearStart, yearEnd, ...districtParam],
  );
  const totalInspections = Number(totalInspRow.total);
  const failedInspections = Number(totalInspRow.failed);
  const failRate = totalInspections > 0 ? Math.round((failedInspections / totalInspections) * 10000) / 100 : 0;

  const [byDistrict] = await pool.query(
    `SELECT p.district,
            COUNT(DISTINCT i.project_id) AS inspectedCount
     FROM inspections i
     JOIN projects p ON p.id = i.project_id
     WHERE i.inspect_date BETWEEN ? AND ?
     GROUP BY p.district
     ORDER BY p.district`,
    [yearStart, yearEnd],
  );

  const [dueByDist] = await pool.query(
    `SELECT p.district, COUNT(*) AS cnt FROM projects p
     WHERE p.status IN ('NORMAL','MAINTENANCE')
       AND p.completed_at <= ?
     GROUP BY p.district`,
    [yearEnd],
  );
  const dueMap = {};
  for (const r of dueByDist) dueMap[r.district] = Number(r.cnt);

  const inspMap = {};
  for (const r of byDistrict) inspMap[r.district] = Number(r.inspectedCount);

  const allDistricts = [...new Set([...Object.keys(dueMap), ...Object.keys(inspMap)])];
  const districtBreakdown = allDistricts.map((d) => {
    const dc = dueMap[d] || 0;
    const ic = inspMap[d] || 0;
    return {
      district: d,
      dueCount: dc,
      inspectedCount: ic,
      overdueCount: Math.max(0, dc - ic),
      timelinessRate: dc > 0 ? Math.round((ic / dc) * 10000) / 100 : 0,
    };
  });

  return {
    year: y,
    district: district || null,
    dueCount,
    inspectedCount,
    overdueCount,
    timelinessRate,
    totalInspections,
    failedInspections,
    failRate,
    byDistrict: districtBreakdown,
  };
}

async function computeHazardStats({ year, district } = {}) {
  const y = year || new Date().getFullYear();
  const yearStart = `${y}-01-01`;
  const yearEnd = `${y}-12-31`;

  const districtJoin = district && district !== '' ? 'AND p.district = ?' : '';
  const districtParam = district && district !== '' ? [district] : [];

  const [[summaryRow]] = await pool.query(
    `SELECT COUNT(*) AS totalCount,
            SUM(CASE WHEN h.status = 'OPEN' THEN 1 ELSE 0 END) AS openCount,
            SUM(CASE WHEN h.status IN ('RECTIFIED','CLOSED') THEN 1 ELSE 0 END) AS resolvedCount
     FROM hazards h
     JOIN projects p ON p.id = h.project_id
     WHERE h.discovered_at BETWEEN ? AND ?
       ${districtJoin}`,
    [yearStart, yearEnd, ...districtParam],
  );

  const totalCount = Number(summaryRow.totalCount);
  const openCount = Number(summaryRow.openCount);
  const resolvedCount = Number(summaryRow.resolvedCount);
  const resolveRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 10000) / 100 : 0;

  const [bySeverity] = await pool.query(
    `SELECT h.severity, COUNT(*) AS count
     FROM hazards h
     JOIN projects p ON p.id = h.project_id
     WHERE h.discovered_at BETWEEN ? AND ?
       ${districtJoin}
     GROUP BY h.severity ORDER BY FIELD(h.severity,'CRITICAL','MAJOR','MINOR')`,
    [yearStart, yearEnd, ...districtParam],
  );

  const [byDistrict] = await pool.query(
    `SELECT p.district,
            COUNT(*) AS totalCount,
            SUM(CASE WHEN h.status = 'OPEN' THEN 1 ELSE 0 END) AS openCount,
            SUM(CASE WHEN h.status IN ('RECTIFIED','CLOSED') THEN 1 ELSE 0 END) AS resolvedCount
     FROM hazards h
     JOIN projects p ON p.id = h.project_id
     WHERE h.discovered_at BETWEEN ? AND ?
     GROUP BY p.district ORDER BY p.district`,
    [yearStart, yearEnd],
  );

  return {
    year: y,
    district: district || null,
    totalCount,
    openCount,
    resolvedCount,
    resolveRate,
    bySeverity: bySeverity.map((r) => ({ severity: r.severity, count: Number(r.count) })),
    byDistrict: byDistrict.map((r) => ({
      district: r.district,
      totalCount: Number(r.totalCount),
      openCount: Number(r.openCount),
      resolvedCount: Number(r.resolvedCount),
      resolveRate: Number(r.totalCount) > 0
        ? Math.round((Number(r.resolvedCount) / Number(r.totalCount)) * 10000) / 100
        : 0,
    })),
  };
}

async function computeEquipmentStats({ year, district } = {}) {
  const yearEnd = year ? `${year}-12-31` : null;

  const conditions = [];
  const params = [];
  if (yearEnd) {
    conditions.push('p.completed_at <= ?');
    params.push(yearEnd);
  }
  if (district && district !== '') {
    conditions.push('p.district = ?');
    params.push(district);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [byDistrict] = await pool.query(
    `SELECT p.district,
            COUNT(*) AS totalCount,
            SUM(CASE WHEN e.status = 'NORMAL' THEN 1 ELSE 0 END) AS normalCount
     FROM equipments e
     JOIN projects p ON p.id = e.project_id
     ${where}
     GROUP BY p.district ORDER BY p.district`,
    params,
  );

  const [[totalRow]] = await pool.query(
    `SELECT COUNT(*) AS totalCount,
            SUM(CASE WHEN e.status = 'NORMAL' THEN 1 ELSE 0 END) AS normalCount
     FROM equipments e
     JOIN projects p ON p.id = e.project_id
     ${where}`,
    params,
  );

  const totalEquip = Number(totalRow.totalCount);
  const normalEquip = Number(totalRow.normalCount);
  const overallRate = totalEquip > 0 ? Math.round((normalEquip / totalEquip) * 10000) / 100 : 0;

  return {
    year: year || null,
    district: district || null,
    totalCount: totalEquip,
    normalCount: normalEquip,
    overallRate,
    byDistrict: byDistrict.map((r) => {
      const tc = Number(r.totalCount);
      const nc = Number(r.normalCount);
      return {
        district: r.district,
        totalCount: tc,
        normalCount: nc,
        rate: tc > 0 ? Math.round((nc / tc) * 10000) / 100 : 0,
      };
    }),
  };
}

/* ------------------------ 汇总表管理 ------------------------ */

async function getSummary(statYear, district, metricType) {
  const [rows] = await pool.query(
    'SELECT * FROM stat_summaries WHERE stat_year = ? AND district = ? AND metric_type = ?',
    [statYear, district || '', metricType],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    statYear: r.stat_year,
    district: r.district,
    metricType: r.metric_type,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    stale: !!r.stale,
    computedAt: r.computed_at,
  };
}

async function saveSummary(statYear, district, metricType, payload) {
  await pool.query(
    `INSERT INTO stat_summaries (stat_year, district, metric_type, payload, stale, computed_at)
     VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), stale = 0, computed_at = CURRENT_TIMESTAMP(3)`,
    [statYear, district || '', metricType, JSON.stringify(payload)],
  );
}

async function markSummariesStale(statYear, district) {
  const conditions = ['1=1'];
  const params = [];
  if (statYear !== undefined) { conditions.push('stat_year = ?'); params.push(statYear); }
  if (district !== undefined && district !== '') { conditions.push('district = ?'); params.push(district); }
  await pool.query(
    `UPDATE stat_summaries SET stale = 1 WHERE ${conditions.join(' AND ')}`, params);
}

async function markAllSummariesStale() {
  await pool.query('UPDATE stat_summaries SET stale = 1');
}

async function listStaleSummaries() {
  const [rows] = await pool.query(
    'SELECT * FROM stat_summaries WHERE stale = 1 ORDER BY stat_year, district, metric_type');
  return rows.map((r) => ({
    id: r.id,
    statYear: r.stat_year,
    district: r.district,
    metricType: r.metric_type,
  }));
}

/* ------------------------ 导出任务管理 ------------------------ */

async function createExportTask({ taskKey, metricType, filters, format }) {
  const [r] = await pool.query(
    `INSERT INTO export_tasks (task_key, metric_type, filters, format, status)
     VALUES (?, ?, ?, ?, 'QUEUED')`,
    [taskKey, metricType, JSON.stringify(filters), (format || 'CSV').toUpperCase()],
  );
  return getExportTask(r.insertId);
}

async function getExportTask(id) {
  const [rows] = await pool.query('SELECT * FROM export_tasks WHERE id = ?', [id]);
  return mapExportTask(rows[0]);
}

async function getExportTaskByKey(taskKey) {
  const [rows] = await pool.query('SELECT * FROM export_tasks WHERE task_key = ?', [taskKey]);
  return mapExportTask(rows[0]);
}

async function updateExportTask(id, patch) {
  const colMap = {
    status: 'status', progress: 'progress', filePath: 'file_path', errorMsg: 'error_msg',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(colMap)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); params.push(patch[k]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP(3)');
    params.push(id);
    await pool.query(`UPDATE export_tasks SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getExportTask(id);
}

async function listExportTasks({ status } = {}) {
  const where = [];
  const params = [];
  if (status !== undefined) { where.push('status = ?'); params.push(status); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM export_tasks ${clause} ORDER BY created_at DESC`, params);
  return rows.map(mapExportTask);
}

module.exports = {
  seed, isEmpty,
  findUserByUsername, getUser, listUsers, createUser,
  listProjects, getProject, findProjectByCode, createProject, updateProject, deleteProject,
  listEquipments, createEquipment,
  listInspections, createInspection,
  listHazards, getHazard, createHazard, updateHazard,
  computeInventory, computeAnnualIncrement, computeInspectionCoverage,
  computeHazardStats, computeEquipmentStats,
  getSummary, saveSummary, markSummariesStale, markAllSummariesStale, listStaleSummaries,
  createExportTask, getExportTask, getExportTaskByKey, updateExportTask, listExportTasks,
};
