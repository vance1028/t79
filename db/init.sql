CREATE TABLE IF NOT EXISTS users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    username      VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(64)  NOT NULL DEFAULT '',
    role          VARCHAR(16)  NOT NULL DEFAULT 'INSPECTOR',
    department    VARCHAR(128) NOT NULL DEFAULT '',
    status        VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    code            VARCHAR(48)  NOT NULL,
    name            VARCHAR(128) NOT NULL,
    type            VARCHAR(32)  NOT NULL DEFAULT 'COMBINED',
    protection_level VARCHAR(16) NOT NULL DEFAULT '6',
    area_sqm        DECIMAL(12,2) NOT NULL DEFAULT 0,
    address         VARCHAR(255) NOT NULL DEFAULT '',
    district        VARCHAR(64)  NOT NULL DEFAULT '',
    peacetime_use   VARCHAR(128) NOT NULL DEFAULT '',
    status          VARCHAR(16)  NOT NULL DEFAULT 'NORMAL',
    completed_at    DATE         NULL,
    created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_projects_code (code),
    KEY idx_projects_status (status),
    KEY idx_projects_district (district),
    KEY idx_projects_completed_at (completed_at),
    KEY idx_projects_district_completed (district, completed_at),
    KEY idx_projects_type (type),
    KEY idx_projects_protection_level (protection_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipments (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    project_id  BIGINT       NOT NULL,
    name        VARCHAR(128) NOT NULL,
    category    VARCHAR(32)  NOT NULL DEFAULT 'OTHER',
    model       VARCHAR(64)  NOT NULL DEFAULT '',
    install_date DATE        NULL,
    status      VARCHAR(16)  NOT NULL DEFAULT 'NORMAL',
    created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_equip_project (project_id),
    KEY idx_equip_status (status),
    CONSTRAINT fk_equip_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspections (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    project_id   BIGINT       NOT NULL,
    inspector_id BIGINT       NULL,
    inspect_date DATE         NOT NULL,
    type         VARCHAR(16)  NOT NULL DEFAULT 'ROUTINE',
    result       VARCHAR(16)  NOT NULL DEFAULT 'PASS',
    issues       VARCHAR(1000) NOT NULL DEFAULT '',
    created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_insp_project (project_id),
    KEY idx_insp_date (inspect_date),
    KEY idx_insp_result (result),
    KEY idx_insp_project_date (project_id, inspect_date),
    KEY idx_insp_date_result (inspect_date, result),
    CONSTRAINT fk_insp_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_insp_user FOREIGN KEY (inspector_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hazards (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    project_id    BIGINT        NOT NULL,
    inspection_id BIGINT        NULL,
    severity      VARCHAR(16)   NOT NULL DEFAULT 'MINOR',
    description   VARCHAR(500)  NOT NULL DEFAULT '',
    status        VARCHAR(16)   NOT NULL DEFAULT 'OPEN',
    discovered_at DATE          NOT NULL,
    rectified_at  DATE          NULL,
    created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_hazard_project (project_id),
    KEY idx_hazard_severity (severity),
    KEY idx_hazard_status (status),
    KEY idx_hazard_discovered (discovered_at),
    KEY idx_hazard_discovered_status (discovered_at, status),
    KEY idx_hazard_inspection (inspection_id),
    CONSTRAINT fk_hazard_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stat_summaries (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    stat_year    SMALLINT     NOT NULL,
    district     VARCHAR(64)  NOT NULL DEFAULT '',
    metric_type  VARCHAR(32)  NOT NULL,
    payload      JSON         NOT NULL,
    stale        TINYINT(1)   NOT NULL DEFAULT 0,
    computed_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_summary (stat_year, district, metric_type),
    KEY idx_summary_stale (stale),
    KEY idx_summary_year_metric (stat_year, metric_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS export_tasks (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    task_key     VARCHAR(64)  NOT NULL,
    metric_type  VARCHAR(32)  NOT NULL,
    filters      JSON         NOT NULL,
    format       VARCHAR(8)   NOT NULL DEFAULT 'CSV',
    status       VARCHAR(16)  NOT NULL DEFAULT 'QUEUED',
    progress     TINYINT      NOT NULL DEFAULT 0,
    file_path    VARCHAR(512) NULL,
    error_msg    VARCHAR(500) NULL,
    created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_task_key (task_key),
    KEY idx_task_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
