require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const pool = require('./config/db');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((value) => value.trim()) : true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 5000;
if (require.main === module) {
	app.listen(port, '0.0.0.0', async () => {
		try {
			const connection = await pool.getConnection();
			await connection.query('SELECT 1');
			connection.release();
			console.log(`FitFam API listening on port ${port}`);
			console.log(`Connected to MySQL database: ${process.env.DB_NAME || 'fitfam_gym'}`);
		} catch (error) {
			console.error('MySQL connection failed. Check backend/.env and confirm MySQL is running.');
			console.error(error.code || error.message);
		}
	});
}
module.exports = app;
