const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const cleanUser = (user) => ({ id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role, phone: user.phone, gender: user.gender });
const tokenFor = (user) => jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
const required = (body, fields) => fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
const optional = (value) => value === undefined ? null : value;

router.get('/health', (req, res) => res.json({ success: true, message: 'FitFam API is running' }));

router.post('/auth/register', asyncRoute(async (req, res) => {
  const missing = required(req.body, ['firstName', 'lastName', 'email', 'password', 'role']);
  if (missing.length) return res.status(400).json({ success: false, message: `Missing fields: ${missing.join(', ')}` });
  const { firstName, lastName, email, password, phone, gender, role, dateOfBirth, fitnessGoal, specialization, yearsOfExperience, bio, certifications } = req.body;
  if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  if (!['member', 'trainer'].includes(role)) return res.status(400).json({ success: false, message: 'Role must be member or trainer' });
  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing.length) return res.status(409).json({ success: false, message: 'Email is already registered' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const hash = await bcrypt.hash(password, 10);
    const [result] = await connection.execute('INSERT INTO users (first_name, last_name, email, password_hash, phone, gender, role) VALUES (?, ?, ?, ?, ?, ?, ?)', [firstName, lastName, email.toLowerCase(), hash, phone || null, gender || null, role]);
    
    if (role === 'member') {
      const [member] = await connection.execute('INSERT INTO members (user_id, date_of_birth, fitness_goal, emergency_contact_name, emergency_contact_phone) VALUES (?, ?, ?, ?, ?)', [result.insertId, dateOfBirth || null, fitnessGoal || null, req.body.emergencyContactName || null, req.body.emergencyContactPhone || null]);
      const [freePlan] = await connection.execute('SELECT id, name, price FROM membership_catalog WHERE name = ? AND is_active = 1', ['FitFam Free']);
      if (!freePlan.length) throw Object.assign(new Error('FitFam Free membership is not configured'), { statusCode: 500 });
      await connection.execute('INSERT INTO membership_plans (member_id, catalog_id, name, start_date, end_date, price, status) VALUES (?, ?, ?, CURDATE(), NULL, ?, ?)', [member.insertId, freePlan[0].id, freePlan[0].name, freePlan[0].price, 'active']);
    } else if (role === 'trainer') {
      await connection.execute('INSERT INTO trainers (user_id, specialization, bio, years_of_experience, certifications) VALUES (?, ?, ?, ?, ?)', [result.insertId, specialization || null, bio || null, yearsOfExperience || 0, certifications || null]);
    }
    
    await connection.commit();
    const [rows] = await connection.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const user = rows[0];
    return res.status(201).json({ success: true, token: tokenFor(user), user: cleanUser(user) });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get('/users', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT id, first_name, last_name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC');
  res.json({ success: true, data: rows });
}));
router.get('/admin/members', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(`SELECT m.id, u.first_name, u.last_name, u.email, u.is_active, m.fitness_goal,
    COALESCE(ms.name, 'No membership') AS membership_name, COALESCE(CONCAT(tu.first_name, ' ', tu.last_name), 'No trainer') AS trainer_name
    FROM members m JOIN users u ON u.id=m.user_id LEFT JOIN member_trainers mt ON mt.member_id=m.id
    LEFT JOIN trainers t ON t.id=mt.trainer_id LEFT JOIN users tu ON tu.id=t.user_id
    LEFT JOIN membership_plans ms ON ms.member_id=m.id AND ms.status='active'
    ORDER BY u.first_name, u.last_name`);
  res.json({ success: true, data: rows });
}));
router.get('/admin/trainers', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(`SELECT t.id, u.first_name, u.last_name, u.email, u.is_active, t.specialization,
    t.years_of_experience, t.certifications, COUNT(mt.member_id) AS managed_members
    FROM trainers t JOIN users u ON u.id=t.user_id LEFT JOIN member_trainers mt ON mt.trainer_id=t.id
    GROUP BY t.id, u.id ORDER BY u.first_name, u.last_name`);
  res.json({ success: true, data: rows });
}));
router.get('/admin/programs', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(`SELECT w.id, w.title, w.description, w.goals, w.frequency, w.created_at,
     COUNT(pe.id) AS enrollment_count
    FROM workouts w
    LEFT JOIN program_enrollments pe ON pe.workout_id=w.id AND pe.status='active'
    GROUP BY w.id ORDER BY w.created_at DESC`);
  res.json({ success: true, data: rows });
}));
router.get('/admin/attendance', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(`SELECT a.id, a.member_id, a.attendance_date, a.check_in, a.check_out, a.status,
    CONCAT(mu.first_name, ' ', mu.last_name) AS member_name, COALESCE(CONCAT(tu.first_name, ' ', tu.last_name), 'No trainer') AS trainer_name
    FROM attendance a JOIN members m ON m.id=a.member_id JOIN users mu ON mu.id=m.user_id
    LEFT JOIN member_trainers mt ON mt.member_id=m.id LEFT JOIN trainers t ON t.id=mt.trainer_id LEFT JOIN users tu ON tu.id=t.user_id
    ORDER BY a.attendance_date DESC, a.id DESC`);
  res.json({ success: true, data: rows });
}));
router.patch('/users/:id/status', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ success: false, message: 'The designated admin cannot be deactivated' });
  const [result] = await pool.execute('UPDATE users SET is_active=? WHERE id=?', [req.body.isActive ? 1 : 0, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Account not found' });
  res.json({ success: true, message: 'Account status updated' });
}));
router.patch('/users/:id/role', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  if (!['member', 'trainer'].includes(req.body.role) || Number(req.params.id) === req.user.id) return res.status(400).json({ success: false, message: 'Invalid role change' });
  const [result] = await pool.execute("UPDATE users SET role=? WHERE id=? AND role<>'admin'", [req.body.role, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Account not found or cannot be changed' });
  res.json({ success: true, message: 'Role updated' });
}));

router.post('/auth/login', asyncRoute(async (req, res) => {
  const missing = required(req.body, ['email', 'password']);
  if (missing.length) return res.status(400).json({ success: false, message: `Missing fields: ${missing.join(', ')}` });
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? AND is_active = 1', [req.body.email.toLowerCase()]);
  if (!rows.length || !(await bcrypt.compare(req.body.password, rows[0].password_hash))) return res.status(401).json({ success: false, message: 'Invalid email or password' });
  res.json({ success: true, token: tokenFor(rows[0]), user: cleanUser(rows[0]) });
}));
router.get('/auth/me', authenticate, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user: cleanUser(rows[0]) });
}));

router.get('/profile', authenticate, asyncRoute(async (req, res) => {
  const table = req.user.role === 'trainer' ? 'trainers' : req.user.role === 'member' ? 'members' : null;
  if (!table) return res.status(403).json({ success: false, message: 'Admin profile is managed through user accounts' });
  const [rows] = await pool.execute(`SELECT p.*, u.first_name, u.last_name, u.email, u.phone, u.gender FROM ${table} p JOIN users u ON u.id=p.user_id WHERE p.user_id=?`, [req.user.id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Profile not found' });
  res.json({ success: true, data: rows[0] });
}));
router.put('/profile', authenticate, asyncRoute(async (req, res) => {
  const values = req.user.role === 'trainer'
    ? [req.body.specialization ?? null, req.body.bio ?? null, req.body.yearsOfExperience ?? 0, req.body.certifications ?? null, req.user.id]
    : req.user.role === 'member'
      ? [req.body.dateOfBirth ?? null, req.body.address ?? null, req.body.emergencyContactName ?? null, req.body.emergencyContactPhone ?? null, req.body.fitnessGoal ?? null, req.user.id]
      : null;
  if (!values) return res.status(403).json({ success: false, message: 'Admin profile is managed through user accounts' });
  const query = req.user.role === 'trainer'
    ? 'UPDATE trainers SET specialization=?, bio=?, years_of_experience=?, certifications=? WHERE user_id=?'
    : 'UPDATE members SET date_of_birth=?, address=?, emergency_contact_name=?, emergency_contact_phone=?, fitness_goal=? WHERE user_id=?';
  const [result] = await pool.execute(query, values);
  if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Profile not found' });
  res.json({ success: true, message: 'Profile updated' });
}));

router.get('/members', authenticate, asyncRoute(async (req, res) => {
  if (req.user.role === 'trainer') {
    const [rows] = await pool.execute(`SELECT m.*, u.first_name, u.last_name, u.email, u.phone, u.is_active,
      ms.name AS membership_name, ms.end_date AS membership_end_date
      FROM members m JOIN users u ON u.id=m.user_id
      JOIN member_trainers mt ON mt.member_id=m.id
      LEFT JOIN membership_plans ms ON ms.member_id=m.id AND ms.status='active'
      WHERE mt.trainer_id=(SELECT id FROM trainers WHERE user_id=?) ORDER BY m.created_at DESC`, [req.user.id]);
    return res.json({ success: true, data: rows });
  }
  const [rows] = await pool.execute(`SELECT m.*, u.first_name, u.last_name, u.email, u.phone, u.is_active,
    ms.name AS membership_name, ms.end_date AS membership_end_date
    FROM members m JOIN users u ON u.id = m.user_id
    LEFT JOIN membership_plans ms ON ms.member_id = m.id AND ms.status = 'active'
    WHERE (? = 'member' AND m.user_id = ?) OR ? <> 'member' ORDER BY m.created_at DESC`, [req.user.role, req.user.id, req.user.role]);
  res.json({ success: true, data: rows });
}));
router.get('/memberships/:id', authenticate, asyncRoute(async(req,res)=>{const [rows]=await pool.execute("SELECT ms.* FROM membership_plans ms JOIN members m ON m.id=ms.member_id WHERE ms.id=? AND (? <> 'member' OR m.user_id=?)",[req.params.id,req.user.role,req.user.id]);if(!rows.length)return res.status(404).json({success:false,message:'Membership not found'});res.json({success:true,data:rows[0]});}));
router.get('/members/:id', authenticate, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(`SELECT m.*, u.first_name, u.last_name, u.email, u.phone, u.is_active FROM members m JOIN users u ON u.id=m.user_id WHERE m.id=?`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Member not found' });
  if (req.user.role === 'member' && rows[0].user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });
  res.json({ success: true, data: rows[0] });
}));
router.post('/members', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  const missing = required(req.body, ['firstName', 'lastName', 'email', 'password']);
  if (missing.length) return res.status(400).json({ success: false, message: `Missing fields: ${missing.join(', ')}` });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const hash = await bcrypt.hash(req.body.password, 10);
    const [user] = await connection.execute('INSERT INTO users (first_name,last_name,email,password_hash,phone,role) VALUES (?,?,?,?,?,?)', [req.body.firstName, req.body.lastName, req.body.email.toLowerCase(), hash, req.body.phone || null, 'member']);
    const [member] = await connection.execute('INSERT INTO members (user_id,emergency_contact_name,emergency_contact_phone) VALUES (?,?,?)', [user.insertId, req.body.emergencyContactName || null, req.body.emergencyContactPhone || null]);
    const [freePlan] = await connection.execute('SELECT id, name, price FROM membership_catalog WHERE name = ? AND is_active = 1', ['FitFam Free']);
    if (!freePlan.length) throw Object.assign(new Error('FitFam Free membership is not configured'), { statusCode: 500 });
    await connection.execute('INSERT INTO membership_plans (member_id,catalog_id,name,start_date,end_date,price,status) VALUES (?, ?, ?, CURDATE(), NULL, ?, ?)', [member.insertId, freePlan[0].id, freePlan[0].name, freePlan[0].price, 'active']);
    await connection.commit(); res.status(201).json({ success: true, id: member.insertId });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}));
router.put('/members/:id', authenticate, asyncRoute(async (req, res) => {
  const [memberRows] = await pool.execute('SELECT user_id FROM members WHERE id=?', [req.params.id]);
  if (!memberRows.length) return res.status(404).json({ success: false, message: 'Member not found' });
  if (req.user.role === 'member' && memberRows[0].user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });
  await pool.execute('UPDATE members SET emergency_contact_name=COALESCE(?,emergency_contact_name), emergency_contact_phone=COALESCE(?,emergency_contact_phone), date_of_birth=COALESCE(?,date_of_birth), address=COALESCE(?,address), fitness_goal=COALESCE(?,fitness_goal) WHERE id=?', [optional(req.body.emergencyContactName), optional(req.body.emergencyContactPhone), optional(req.body.dateOfBirth), optional(req.body.address), optional(req.body.fitnessGoal), req.params.id]);
  await pool.execute('UPDATE users SET first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name), phone=COALESCE(?,phone) WHERE id=?', [optional(req.body.firstName), optional(req.body.lastName), optional(req.body.phone), memberRows[0].user_id]);
  res.json({ success: true, message: 'Member updated' });
}));
router.delete('/members/:id', authenticate, authorize('admin'), asyncRoute(async (req, res) => { const [result] = await pool.execute('UPDATE users u JOIN members m ON m.user_id=u.id SET u.is_active=0 WHERE m.id=?', [req.params.id]); if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Member not found' }); res.json({ success: true, message: 'Member deactivated' }); }));

router.get('/trainers', authenticate, authorize('admin','trainer'), asyncRoute(async (req, res) => { const [rows] = await pool.execute('SELECT t.*,u.first_name,u.last_name,u.email,u.phone FROM trainers t JOIN users u ON u.id=t.user_id WHERE u.is_active=1 ORDER BY u.first_name'); res.json({ success: true, data: rows }); }));
router.get('/trainers/:id', authenticate, authorize('admin','trainer'), asyncRoute(async (req, res) => { const [rows] = await pool.execute('SELECT t.*,u.first_name,u.last_name,u.email,u.phone FROM trainers t JOIN users u ON u.id=t.user_id WHERE t.id=? AND u.is_active=1', [req.params.id]); if (!rows.length) return res.status(404).json({ success: false, message: 'Trainer not found' }); res.json({ success: true, data: rows[0] }); }));
router.post('/trainers', authenticate, authorize('admin'), asyncRoute(async (req, res) => { const missing = required(req.body, ['firstName','lastName','email','password']); if (missing.length) return res.status(400).json({ success:false,message:`Missing fields: ${missing.join(', ')}` }); const hash=await bcrypt.hash(req.body.password,10); const [user]=await pool.execute('INSERT INTO users (first_name,last_name,email,password_hash,phone,role) VALUES (?,?,?,?,?,?)',[req.body.firstName,req.body.lastName,req.body.email.toLowerCase(),hash,req.body.phone||null,'trainer']); const [trainer]=await pool.execute('INSERT INTO trainers (user_id,specialization,bio) VALUES (?,?,?)',[user.insertId,req.body.specialization||null,req.body.bio||null]); res.status(201).json({success:true,id:trainer.insertId}); }));
router.put('/trainers/:id', authenticate, authorize('admin'), asyncRoute(async (req,res)=>{ await pool.execute('UPDATE trainers SET specialization=COALESCE(?,specialization), bio=COALESCE(?,bio) WHERE id=?',[optional(req.body.specialization),optional(req.body.bio),req.params.id]); res.json({success:true,message:'Trainer updated'}); }));
router.delete('/trainers/:id', authenticate, authorize('admin'), asyncRoute(async (req,res)=>{ const [result]=await pool.execute('UPDATE users u JOIN trainers t ON t.user_id=u.id SET u.is_active=0 WHERE t.id=?',[req.params.id]); if(!result.affectedRows)return res.status(404).json({success:false,message:'Trainer not found'}); res.json({success:true,message:'Trainer deactivated'}); }));

router.get('/memberships', authenticate, asyncRoute(async (req,res)=>{ const [rows]=await pool.execute(`SELECT ms.*,m.id AS member_id,u.first_name,u.last_name FROM membership_plans ms JOIN members m ON m.id=ms.member_id JOIN users u ON u.id=m.user_id ${req.user.role==='member'?'WHERE m.user_id = ?':''} ORDER BY ms.start_date DESC`,req.user.role==='member'?[req.user.id]:[]); res.json({success:true,data:rows}); }));
router.post('/memberships', authenticate, authorize('admin'), asyncRoute(async(req,res)=>{ const missing=required(req.body,['memberId','name','startDate','endDate']); if(missing.length)return res.status(400).json({success:false,message:`Missing fields: ${missing.join(', ')}`}); const [result]=await pool.execute('INSERT INTO membership_plans (member_id,name,start_date,end_date,price,status) VALUES (?,?,?,?,?,?)',[req.body.memberId,req.body.name,req.body.startDate,req.body.endDate,req.body.price||0,req.body.status||'active']); res.status(201).json({success:true,id:result.insertId}); }));
router.put('/memberships/:id', authenticate, authorize('admin'), asyncRoute(async(req,res)=>{await pool.execute('UPDATE membership_plans SET name=COALESCE(?,name),end_date=COALESCE(?,end_date),price=COALESCE(?,price),status=COALESCE(?,status) WHERE id=?',[optional(req.body.name),optional(req.body.endDate),optional(req.body.price),optional(req.body.status),req.params.id]);res.json({success:true,message:'Membership updated'});}));
router.delete('/memberships/:id', authenticate, authorize('admin'), asyncRoute(async(req,res)=>{const [rows]=await pool.execute('SELECT name FROM membership_plans WHERE id=?',[req.params.id]);if(!rows.length)return res.status(404).json({success:false,message:'Membership not found'});if(rows[0].name==='FitFam Free')return res.status(409).json({success:false,message:'FitFam Free cannot be deleted while it is assigned to a member'});await pool.execute('DELETE FROM membership_plans WHERE id=?',[req.params.id]);res.json({success:true,message:'Membership deleted'});}));

router.get('/workouts', authenticate, authorize('admin','member'), asyncRoute(async(req,res)=>{const [rows]=await pool.execute('SELECT w.* FROM workouts w ORDER BY w.created_at DESC');res.json({success:true,data:rows});}));
router.get('/workouts/:id', authenticate, authorize('admin','member'), asyncRoute(async(req,res)=>{const [rows]=await pool.execute('SELECT w.* FROM workouts w WHERE w.id=?',[req.params.id]);if(!rows.length)return res.status(404).json({success:false,message:'Program not found'});res.json({success:true,data:rows[0]});}));
router.post('/workouts', authenticate, authorize('admin'), asyncRoute(async(req,res)=>{
  const missing=required(req.body, ['title']);
  if(missing.length)return res.status(400).json({success:false,message:`Missing fields: ${missing.join(', ')}`});
  
  const [result]=await pool.execute('INSERT INTO workouts (member_id,trainer_id,title,description,goals,frequency) VALUES (NULL,NULL,?,?,?,?)',[req.body.title,req.body.description||null,req.body.goals||null,req.body.frequency||null]);
  res.status(201).json({success:true,id:result.insertId});
}));
router.put('/workouts/:id', authenticate, authorize('admin'), asyncRoute(async(req,res)=>{const [result]=await pool.execute('UPDATE workouts SET title=COALESCE(?,title),description=COALESCE(?,description),goals=COALESCE(?,goals),frequency=COALESCE(?,frequency),member_id=NULL,trainer_id=NULL WHERE id=?',[optional(req.body.title),optional(req.body.description),optional(req.body.goals),optional(req.body.frequency),req.params.id]);if(!result.affectedRows)return res.status(404).json({success:false,message:'Program not found'});res.json({success:true,message:'Program updated'});}));
router.delete('/workouts/:id', authenticate, authorize('admin'), asyncRoute(async(req,res)=>{const [result]=await pool.execute('DELETE FROM workouts WHERE id=?',[req.params.id]);if(!result.affectedRows)return res.status(404).json({success:false,message:'Program not found'});res.json({success:true,message:'Program deleted'});}));

router.get('/attendance', authenticate, asyncRoute(async(req,res)=>{let filter='';let params=[];if(req.user.role==='member'){filter='WHERE m.user_id=?';params=[req.user.id];}else if(req.user.role==='trainer'){filter='WHERE EXISTS (SELECT 1 FROM member_trainers mt WHERE mt.member_id=m.id AND mt.trainer_id=(SELECT id FROM trainers WHERE user_id=?))';params=[req.user.id];}const [rows]=await pool.execute(`SELECT a.*,u.first_name,u.last_name FROM attendance a JOIN members m ON m.id=a.member_id JOIN users u ON u.id=m.user_id ${filter} ORDER BY a.attendance_date DESC`,params);res.json({success:true,data:rows});}));
router.get('/attendance/:id', authenticate, asyncRoute(async(req,res)=>{const [rows]=await pool.execute("SELECT a.* FROM attendance a WHERE a.id=? AND (? <> 'member' OR a.member_id=(SELECT id FROM members WHERE user_id=?))",[req.params.id,req.user.role,req.user.id]);if(!rows.length)return res.status(404).json({success:false,message:'Attendance record not found'});res.json({success:true,data:rows[0]});}));
router.post('/attendance', authenticate, authorize('admin','trainer'), asyncRoute(async(req,res)=>{const missing=required(req.body,['memberId','attendanceDate']);if(missing.length)return res.status(400).json({success:false,message:`Missing fields: ${missing.join(', ')}`});if(req.user.role==='trainer'){const [allowed]=await pool.execute('SELECT 1 FROM member_trainers WHERE member_id=? AND trainer_id=(SELECT id FROM trainers WHERE user_id=?)',[req.body.memberId,req.user.id]);if(!allowed.length)return res.status(403).json({success:false,message:'Member is not assigned to this trainer'});}const [result]=await pool.execute('INSERT INTO attendance (member_id,attendance_date,check_in,check_out,status) VALUES (?,?,?,?,?)',[req.body.memberId,req.body.attendanceDate,req.body.checkIn||null,req.body.checkOut||null,req.body.status||'present']);res.status(201).json({success:true,id:result.insertId});}));
router.put('/attendance/:id', authenticate, authorize('admin','trainer'), asyncRoute(async(req,res)=>{const ownership=req.user.role==='trainer'?'AND EXISTS (SELECT 1 FROM member_trainers mt WHERE mt.member_id=attendance.member_id AND mt.trainer_id=(SELECT id FROM trainers WHERE user_id=?))':'';const params=req.user.role==='trainer'?[optional(req.body.checkIn),optional(req.body.checkOut),optional(req.body.status),req.params.id,req.user.id]:[optional(req.body.checkIn),optional(req.body.checkOut),optional(req.body.status),req.params.id];const [result]=await pool.execute(`UPDATE attendance SET check_in=COALESCE(?,check_in),check_out=COALESCE(?,check_out),status=COALESCE(?,status) WHERE id=? ${ownership}`,params);if(!result.affectedRows)return res.status(404).json({success:false,message:'Attendance record not found or not assigned to trainer'});res.json({success:true,message:'Attendance updated'});}));
router.delete('/attendance/:id', authenticate, authorize('admin','trainer'), asyncRoute(async(req,res)=>{const ownership=req.user.role==='trainer'?'AND EXISTS (SELECT 1 FROM member_trainers mt WHERE mt.member_id=attendance.member_id AND mt.trainer_id=(SELECT id FROM trainers WHERE user_id=?))':'';const params=req.user.role==='trainer'?[req.params.id,req.user.id]:[req.params.id];const [result]=await pool.execute(`DELETE FROM attendance WHERE id=? ${ownership}`,params);if(!result.affectedRows)return res.status(404).json({success:false,message:'Attendance record not found or not assigned to trainer'});res.json({success:true,message:'Attendance deleted'});}));

// Member-Trainer Relationship Endpoints
router.get('/member-trainer', authenticate, asyncRoute(async(req,res)=>{
  if(req.user.role !== 'member') return res.status(403).json({success:false,message:'Only members can access this'});
  const [rows]=await pool.execute('SELECT mt.*, t.id AS trainer_id, u.first_name, u.last_name, u.email, t.specialization, t.bio FROM member_trainers mt JOIN trainers t ON t.id=mt.trainer_id JOIN users u ON u.id=t.user_id WHERE mt.member_id=(SELECT id FROM members WHERE user_id=?)', [req.user.id]);
  res.json({success:true,data:rows[0]||null});
}));

router.post('/member-trainer', authenticate, asyncRoute(async(req,res)=>{
  if(req.user.role !== 'member') return res.status(403).json({success:false,message:'Only members can select a trainer'});
  const missing=required(req.body, ['trainerId']);
  if(missing.length) return res.status(400).json({success:false, message:`Missing fields: ${missing.join(', ')}`});
  const [member]=await pool.execute('SELECT id FROM members WHERE user_id=?', [req.user.id]);
  if(!member.length) return res.status(404).json({success:false, message:'Member profile not found'});
  const [trainer] = await pool.execute('SELECT t.id FROM trainers t JOIN users u ON u.id=t.user_id WHERE t.id=? AND u.is_active=1', [req.body.trainerId]);
  if(!trainer.length) return res.status(404).json({success:false,message:'Trainer not found'});
  try{
    await pool.execute('INSERT INTO member_trainers (member_id, trainer_id) VALUES (?,?) ON DUPLICATE KEY UPDATE trainer_id=VALUES(trainer_id)', [member[0].id, req.body.trainerId]);
    res.json({success:true, message:'Trainer selected'});
  }catch(e){
    res.status(400).json({success:false, message:'Failed to select trainer'});
  }
}));

router.delete('/member-trainer', authenticate, asyncRoute(async(req,res)=>{
  const [member]=await pool.execute('SELECT id FROM members WHERE user_id=?', [req.user.id]);
  if(!member.length) return res.status(404).json({success:false, message:'Member profile not found'});
  await pool.execute('DELETE FROM member_trainers WHERE member_id=?', [member[0].id]);
  res.json({success:true, message:'Trainer unselected'});
}));

// Trainers visible to members
router.get('/trainers-for-members', authenticate, asyncRoute(async(req,res)=>{
  const [rows]=await pool.execute('SELECT t.*, u.first_name, u.last_name, u.email, u.phone FROM trainers t JOIN users u ON u.id=t.user_id WHERE u.is_active=1 ORDER BY u.first_name');
  res.json({success:true, data:rows});
}));

// Trainer's members
router.get('/trainer-members', authenticate, asyncRoute(async(req,res)=>{
  if(req.user.role !== 'trainer') return res.status(403).json({success:false, message:'Only trainers can access this'});
  const [rows]=await pool.execute('SELECT DISTINCT m.*, u.first_name, u.last_name, u.email, u.phone, u.is_active, mt.assigned_at, COUNT(DISTINCT pe.id) AS enrollment_count FROM members m JOIN users u ON u.id=m.user_id JOIN member_trainers mt ON mt.member_id=m.id LEFT JOIN program_enrollments pe ON pe.member_id=m.id AND pe.status="active" WHERE mt.trainer_id=(SELECT id FROM trainers WHERE user_id=?) GROUP BY m.id, u.id, mt.assigned_at ORDER BY u.first_name', [req.user.id]);
  res.json({success:true, data:rows});
}));

// Program Enrollment Endpoints
router.get('/programs', authenticate, authorize('admin','member'), asyncRoute(async(req,res)=>{
  let query;
  let params = [];
  if(req.user.role === 'member'){
    query = `SELECT w.*,
             CASE WHEN EXISTS(SELECT 1 FROM program_enrollments WHERE member_id=(SELECT id FROM members WHERE user_id=?) AND workout_id=w.id AND status='active') THEN 1 ELSE 0 END AS enrolled
             FROM workouts w 
             ORDER BY w.created_at DESC`;
    params = [req.user.id];
  } else {
    query = 'SELECT w.* FROM workouts w ORDER BY w.created_at DESC';
  }
  const [rows]=await pool.execute(query, params);
  res.json({success:true, data:rows});
}));

router.post('/program-enroll', authenticate, authorize('member'), asyncRoute(async(req,res)=>{
  const missing=required(req.body, ['programId']);
  if(missing.length) return res.status(400).json({success:false, message:`Missing fields: ${missing.join(', ')}`});
  const [member]=await pool.execute('SELECT id FROM members WHERE user_id=?', [req.user.id]);
  if(!member.length) return res.status(404).json({success:false, message:'Member profile not found'});
  const [program]=await pool.execute('SELECT id FROM workouts WHERE id=?', [req.body.programId]);
  if(!program.length) return res.status(404).json({success:false,message:'Program not found'});
  try{
    await pool.execute('INSERT INTO program_enrollments (member_id, workout_id, status) VALUES (?,?, "active") ON DUPLICATE KEY UPDATE status="active"', [member[0].id, req.body.programId]);
    res.status(201).json({success:true, message:'Enrolled in program'});
  }catch(e){
    res.status(400).json({success:false, message:'Failed to enroll in program'});
  }
}));

router.post('/program-unenroll/:programId', authenticate, authorize('member'), asyncRoute(async(req,res)=>{
  const [member]=await pool.execute('SELECT id FROM members WHERE user_id=?', [req.user.id]);
  if(!member.length) return res.status(404).json({success:false, message:'Member profile not found'});
  await pool.execute('UPDATE program_enrollments SET status="dropped" WHERE member_id=? AND workout_id=?', [member[0].id, req.params.programId]);
  res.json({success:true, message:'Unenrolled from program'});
}));

router.get('/my-programs', authenticate, authorize('member'), asyncRoute(async(req,res)=>{
  const [rows]=await pool.execute(`SELECT DISTINCT w.*, pe.status AS enrollment_status, pe.enrolled_at,
           pe.adjusted_duration, pe.adjusted_difficulty, pe.trainer_notes
           FROM program_enrollments pe 
           JOIN workouts w ON w.id=pe.workout_id
           WHERE pe.member_id=(SELECT id FROM members WHERE user_id=?) AND pe.status='active'
           ORDER BY pe.enrolled_at DESC`, [req.user.id]);
  res.json({success:true, data:rows});
}));

router.get('/trainer/programs', authenticate, authorize('trainer'), asyncRoute(async(req,res)=>{
  const [rows] = await pool.execute(`SELECT pe.id AS enrollment_id, pe.member_id, pe.workout_id, pe.enrolled_at, pe.status,
    pe.adjusted_duration, pe.adjusted_difficulty, pe.trainer_notes, w.title, w.description, w.goals, w.frequency,
    u.first_name, u.last_name, u.email
    FROM program_enrollments pe JOIN workouts w ON w.id=pe.workout_id
    JOIN members m ON m.id=pe.member_id JOIN users u ON u.id=m.user_id
    JOIN member_trainers mt ON mt.member_id=pe.member_id
    WHERE mt.trainer_id=(SELECT id FROM trainers WHERE user_id=?) AND pe.status='active'
    ORDER BY pe.enrolled_at DESC`, [req.user.id]);
  res.json({ success: true, data: rows });
}));

router.patch('/trainer/programs/:enrollmentId', authenticate, authorize('trainer'), asyncRoute(async(req,res)=>{
  const allowedFields = ['adjustedDuration', 'adjustedDifficulty', 'trainerNotes'];
  const unknown = Object.keys(req.body || {}).filter((field) => !allowedFields.includes(field));
  if (unknown.length) return res.status(400).json({ success: false, message: `Unsupported fields: ${unknown.join(', ')}` });
  if (req.body.adjustedDuration !== undefined && (typeof req.body.adjustedDuration !== 'string' || req.body.adjustedDuration.length > 100)) return res.status(400).json({ success: false, message: 'Duration must be 100 characters or fewer' });
  if (req.body.adjustedDifficulty !== undefined && (typeof req.body.adjustedDifficulty !== 'string' || req.body.adjustedDifficulty.length > 50)) return res.status(400).json({ success: false, message: 'Difficulty must be 50 characters or fewer' });
  if (req.body.trainerNotes !== undefined && (typeof req.body.trainerNotes !== 'string' || req.body.trainerNotes.length > 2000)) return res.status(400).json({ success: false, message: 'Trainer notes must be 2000 characters or fewer' });
  const [result] = await pool.execute(`UPDATE program_enrollments pe JOIN member_trainers mt ON mt.member_id=pe.member_id
    SET pe.adjusted_duration=COALESCE(?, pe.adjusted_duration), pe.adjusted_difficulty=COALESCE(?, pe.adjusted_difficulty), pe.trainer_notes=COALESCE(?, pe.trainer_notes)
    WHERE pe.id=? AND pe.status='active' AND mt.trainer_id=(SELECT id FROM trainers WHERE user_id=?)`,
    [req.body.adjustedDuration ?? null, req.body.adjustedDifficulty ?? null, req.body.trainerNotes ?? null, req.params.enrollmentId, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Enrolled program not found for this trainer' });
  res.json({ success: true, message: 'Member program updated' });
}));

router.get('/program-enrollments', authenticate, asyncRoute(async(req,res)=>{
  if(req.user.role === 'trainer'){
    const [rows]=await pool.execute(`SELECT pe.*, w.title, w.description, m.id AS member_id, u.first_name, u.last_name, u.email
             FROM program_enrollments pe
             JOIN workouts w ON w.id=pe.workout_id
             JOIN members m ON m.id=pe.member_id
             JOIN users u ON u.id=m.user_id
             WHERE EXISTS (SELECT 1 FROM member_trainers mt WHERE mt.member_id=pe.member_id AND mt.trainer_id=(SELECT id FROM trainers WHERE user_id=?)) AND pe.status='active'
             ORDER BY pe.enrolled_at DESC`, [req.user.id]);
    return res.json({success:true, data:rows});
  }
  if(req.user.role === 'admin'){
    const [rows]=await pool.execute(`SELECT pe.*, w.title, m.id AS member_id, u.first_name, u.last_name
             FROM program_enrollments pe
             JOIN workouts w ON w.id=pe.workout_id
             JOIN members m ON m.id=pe.member_id
             JOIN users u ON u.id=m.user_id
             WHERE pe.status='active'
             ORDER BY pe.enrolled_at DESC`);
    return res.json({success:true, data:rows});
  }
  res.status(403).json({success:false, message:'Access denied'});
}));

router.get('/dashboard/stats', authenticate, asyncRoute(async(req,res)=>{
  if (req.user.role === 'admin') {
    const [[userStats],[memberStats],[trainerStats],[programStats],[membershipStats],[attendanceStats]] = await Promise.all([
      pool.execute('SELECT COUNT(*) AS totalUsers FROM users'),
      pool.execute("SELECT COUNT(*) AS totalMembers, SUM(u.is_active=1) AS activeMembers FROM members m JOIN users u ON u.id=m.user_id"),
      pool.execute("SELECT COUNT(*) AS totalTrainers FROM trainers t JOIN users u ON u.id=t.user_id WHERE u.is_active=1"),
      pool.execute('SELECT COUNT(*) AS totalPrograms FROM workouts'),
      pool.execute("SELECT COUNT(*) AS activeMemberships FROM membership_plans WHERE status='active' AND (end_date IS NULL OR end_date >= CURDATE())"),
      pool.execute('SELECT COUNT(*) AS todayAttendance FROM attendance WHERE attendance_date=CURDATE()')
    ]);
    const data={totalUsers:Number(userStats[0].totalUsers),totalMembers:Number(memberStats[0].totalMembers),activeMembers:Number(memberStats[0].activeMembers||0),totalTrainers:Number(trainerStats[0].totalTrainers),totalPrograms:Number(programStats[0].totalPrograms),todayAttendance:Number(attendanceStats[0].todayAttendance),activeMemberships:Number(membershipStats[0].activeMemberships)};
    return res.json({success:true,data:{...data,members:data.totalMembers,trainers:data.totalTrainers}});
  }
  if (req.user.role === 'trainer') {
    const [[enrollments],[members],[attendance],[recentAttendance]] = await Promise.all([
      pool.execute('SELECT COUNT(*) AS activeEnrollments FROM program_enrollments pe WHERE pe.status="active" AND EXISTS (SELECT 1 FROM member_trainers mt WHERE mt.member_id=pe.member_id AND mt.trainer_id=(SELECT id FROM trainers WHERE user_id=?))',[req.user.id]),
      pool.execute('SELECT COUNT(*) AS managedMembers FROM member_trainers WHERE trainer_id=(SELECT id FROM trainers WHERE user_id=?)',[req.user.id]),
      pool.execute('SELECT COUNT(*) AS todayAttendance FROM attendance a WHERE a.attendance_date=CURDATE() AND EXISTS (SELECT 1 FROM member_trainers mt WHERE mt.member_id=a.member_id AND mt.trainer_id=(SELECT id FROM trainers WHERE user_id=?))',[req.user.id]),
      pool.execute('SELECT a.*,u.first_name,u.last_name FROM attendance a JOIN members m ON m.id=a.member_id JOIN users u ON u.id=m.user_id WHERE EXISTS (SELECT 1 FROM member_trainers mt WHERE mt.member_id=a.member_id AND mt.trainer_id=(SELECT id FROM trainers WHERE user_id=?)) ORDER BY a.attendance_date DESC,a.id DESC LIMIT 10',[req.user.id])
    ]);
    return res.json({success:true,data:{activeEnrollments:Number(enrollments[0].activeEnrollments),managedMembers:Number(members[0].managedMembers),todayAttendance:Number(attendance[0].todayAttendance),recentAttendance}});
  }
  const [[member],[attendanceCount],[currentMembership],[assignedWorkouts],[recentAttendance]] = await Promise.all([
    pool.execute('SELECT id, fitness_goal FROM members WHERE user_id=?',[req.user.id]),
    pool.execute('SELECT COUNT(*) AS attendanceCount FROM attendance WHERE member_id=(SELECT id FROM members WHERE user_id=?)',[req.user.id]),
    pool.execute("SELECT * FROM membership_plans WHERE member_id=(SELECT id FROM members WHERE user_id=?) AND status='active' AND (end_date IS NULL OR end_date >= CURDATE()) ORDER BY start_date DESC LIMIT 1",[req.user.id]),
    pool.execute("SELECT COUNT(*) AS assignedWorkouts FROM program_enrollments WHERE member_id=(SELECT id FROM members WHERE user_id=?) AND status='active'",[req.user.id]),
    pool.execute('SELECT a.*,u.first_name AS trainer_first_name,u.last_name AS trainer_last_name FROM attendance a LEFT JOIN member_trainers mt ON mt.member_id=a.member_id LEFT JOIN trainers t ON t.id=mt.trainer_id LEFT JOIN users u ON u.id=t.user_id WHERE a.member_id=(SELECT id FROM members WHERE user_id=?) ORDER BY a.attendance_date DESC,a.id DESC LIMIT 10',[req.user.id])
  ]);
  if (!member.length) return res.status(404).json({success:false,message:'Member profile not found'});
  const [currentTrainer]=await pool.execute('SELECT t.id,t.specialization,t.bio,t.years_of_experience,t.certifications,u.first_name,u.last_name FROM member_trainers mt JOIN trainers t ON t.id=mt.trainer_id JOIN users u ON u.id=t.user_id WHERE mt.member_id=?',[member[0].id]);
  res.json({success:true,data:{attendanceCount:Number(attendanceCount[0].attendanceCount),currentMembership:currentMembership[0]||null,assignedWorkouts:Number(assignedWorkouts[0].assignedWorkouts),recentAttendance,currentTrainer:currentTrainer[0]||null,fitnessGoal:member[0].fitness_goal||null}});
}));

module.exports = router;
