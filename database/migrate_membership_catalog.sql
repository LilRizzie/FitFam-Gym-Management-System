USE fitfam_gym;

CREATE TABLE IF NOT EXISTS membership_catalog (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration_days INT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE membership_plans MODIFY end_date DATE NULL;
ALTER TABLE membership_plans ADD COLUMN catalog_id INT UNSIGNED NULL;
ALTER TABLE membership_plans
  ADD CONSTRAINT fk_membership_plans_catalog
  FOREIGN KEY (catalog_id) REFERENCES membership_catalog(id) ON DELETE SET NULL;

INSERT INTO membership_catalog (name, price, duration_days)
VALUES ('FitFam Free', 0, NULL), ('Standard Monthly', 15000, 30), ('Premium Monthly', 30000, 30)
ON DUPLICATE KEY UPDATE name = VALUES(name);