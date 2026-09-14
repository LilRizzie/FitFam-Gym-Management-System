USE fitfam_gym;

ALTER TABLE workouts MODIFY member_id INT UNSIGNED NULL;

-- Add member_trainers table for tracking trainer-member relationships
CREATE TABLE IF NOT EXISTS member_trainers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NOT NULL,
  trainer_id INT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_member_trainers_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT fk_member_trainers_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_member_trainer (member_id)
);

ALTER TABLE member_trainers DROP INDEX IF EXISTS unique_member_trainer;
ALTER TABLE member_trainers ADD UNIQUE KEY unique_member_trainer (member_id);

-- Add program_enrollments table for tracking program enrollment
CREATE TABLE IF NOT EXISTS program_enrollments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NOT NULL,
  workout_id INT UNSIGNED NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active','completed','dropped') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_program_enrollments_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT fk_program_enrollments_workout FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
  UNIQUE KEY unique_member_program (member_id, workout_id)
);

-- Add years_of_experience and certifications fields to trainers if not exists
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS years_of_experience INT UNSIGNED DEFAULT 0;
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS certifications VARCHAR(255);

-- Add fitness_goal to members if not exists
ALTER TABLE members ADD COLUMN IF NOT EXISTS fitness_goal VARCHAR(160);

-- Trainer adjustments belong to a member's enrollment, not the global program.
ALTER TABLE program_enrollments ADD COLUMN IF NOT EXISTS adjusted_duration VARCHAR(100) NULL;
ALTER TABLE program_enrollments ADD COLUMN IF NOT EXISTS adjusted_difficulty VARCHAR(50) NULL;
ALTER TABLE program_enrollments ADD COLUMN IF NOT EXISTS trainer_notes TEXT NULL;

-- Ensure FitFam Free membership plan is in catalog
INSERT INTO membership_catalog (name, price, duration_days, is_active)
VALUES ('FitFam Free', 0, NULL, 1)
ON DUPLICATE KEY UPDATE is_active = 1;
