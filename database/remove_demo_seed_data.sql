USE fitfam_gym;

-- =========================================================
-- Remove demo/seed accounts and all related records
-- KEEP:
--   1  admin@fitfam.ng
--   13 jacksongreg2302@gmail.com
--   21 kyllbuoy@gmail.com
--   22 tinykidx@gmail.com
-- =========================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Remove enrollments belonging to demo members
DELETE FROM program_enrollments
WHERE member_id IN (
    SELECT id FROM members
    WHERE user_id NOT IN (1, 13, 21, 22)
);

-- Remove trainer relationships involving demo members/trainers
DELETE FROM member_trainers
WHERE member_id IN (
    SELECT id FROM members
    WHERE user_id NOT IN (1, 13, 21, 22)
)
OR trainer_id IN (
    SELECT id FROM trainers
    WHERE user_id NOT IN (1, 13, 21, 22)
);

-- Remove attendance belonging to demo members/trainers
DELETE FROM attendance
WHERE member_id IN (
    SELECT id FROM members
    WHERE user_id NOT IN (1, 13, 21, 22)
)
OR trainer_id IN (
    SELECT id FROM trainers
    WHERE user_id NOT IN (1, 13, 21, 22)
);

-- Remove workouts belonging to demo members
DELETE FROM workouts
WHERE member_id IN (
    SELECT id FROM members
    WHERE user_id NOT IN (1, 13, 21, 22)
);

-- Remove demo member profiles
DELETE FROM members
WHERE user_id NOT IN (1, 13, 21, 22);

-- Remove demo trainer profiles
DELETE FROM trainers
WHERE user_id NOT IN (1, 13, 21, 22);

-- Finally remove demo users
DELETE FROM users
WHERE id NOT IN (1, 13, 21, 22);

SET FOREIGN_KEY_CHECKS = 1;