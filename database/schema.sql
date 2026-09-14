CREATE DATABASE IF NOT EXISTS fitfam_gym;
USE fitfam_gym;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS program_enrollments;
DROP TABLE IF EXISTS member_trainers;
DROP TABLE IF EXISTS workouts;
DROP TABLE IF EXISTS membership_plans;
DROP TABLE IF EXISTS membership_catalog;
DROP TABLE IF EXISTS workout_plans;
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS trainers;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  full_name VARCHAR(161) GENERATED ALWAYS AS (CONCAT(first_name, ' ', last_name)) STORED,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  password VARCHAR(255) NULL,
  phone VARCHAR(30),
  gender VARCHAR(30),
  role ENUM('admin','trainer','member') NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  date_of_birth DATE,
  address VARCHAR(255),
  fitness_goal VARCHAR(160),
  emergency_contact_name VARCHAR(160),
  emergency_contact_phone VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE trainers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  specialization VARCHAR(160),
  bio TEXT,
  years_of_experience INT UNSIGNED DEFAULT 0,
  certifications VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trainers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE membership_catalog (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration_days INT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE membership_plans (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NULL,
  catalog_id INT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('active','expired','cancelled','pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_membership_plans_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_plans_catalog FOREIGN KEY (catalog_id) REFERENCES membership_catalog(id) ON DELETE SET NULL
);
CREATE TABLE workouts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NULL,
  trainer_id INT UNSIGNED,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  goals TEXT,
  frequency VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_workouts_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT fk_workouts_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
);
CREATE TABLE member_trainers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NOT NULL,
  trainer_id INT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_member_trainers_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT fk_member_trainers_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_member_trainer (member_id)
);
CREATE TABLE program_enrollments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NOT NULL,
  workout_id INT UNSIGNED NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active','completed','dropped') NOT NULL DEFAULT 'active',
  adjusted_duration VARCHAR(100) NULL,
  adjusted_difficulty VARCHAR(50) NULL,
  trainer_notes TEXT NULL,
  CONSTRAINT fk_program_enrollments_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT fk_program_enrollments_workout FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
  UNIQUE KEY unique_member_program (member_id, workout_id)
);
CREATE TABLE attendance (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status ENUM('present','absent','late') NOT NULL DEFAULT 'present',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  UNIQUE KEY unique_member_day (member_id, attendance_date)
);
