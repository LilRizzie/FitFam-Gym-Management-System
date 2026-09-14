USE fitfam_gym;

INSERT INTO users (first_name,last_name,email,password_hash,password,phone,role) VALUES
('Amina','Okafor','admin@fitfam.ng','$2a$10$YqKAuRi70FOJqnGR6kK2N.pcH/EFwnb9YKWzvEvVnCv/xadXj69HC','$2a$10$YqKAuRi70FOJqnGR6kK2N.pcH/EFwnb9YKWzvEvVnCv/xadXj69HC','08030000001','admin');

INSERT INTO membership_catalog (name,price,duration_days) VALUES
('FitFam Free',0,NULL),
('Standard Monthly',18000,30),
('Premium Monthly',30000,30);
INSERT INTO workouts (member_id,trainer_id,title,description,goals,frequency) VALUES
(NULL,NULL,'Beginner Strength','Full-body compound movements with progressive loading.','Build strength and improve mobility.','3 days per week'),
(NULL,NULL,'Fat Loss Circuit','Low-impact circuits and steady-state cardio.','Improve cardiovascular fitness.','4 days per week'),
(NULL,NULL,'Chest and Triceps','Pressing movements and controlled accessory work.','Build upper-body strength.','3 days per week'),
(NULL,NULL,'Back and Biceps','Pulling patterns for strength and posture.','Improve pulling strength.','3 days per week'),
(NULL,NULL,'Leg Day','Squats, hinges, and single-leg exercises.','Build lower-body power.','2 days per week');
