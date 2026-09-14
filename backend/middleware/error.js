function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.statusCode || (err.code === 'ER_DUP_ENTRY' ? 409 : err.code === 'ER_NO_REFERENCED_ROW_2' ? 400 : 500);
  const message = err.statusCode && err.statusCode < 500
    ? err.message
    : err.code === 'ER_DUP_ENTRY'
      ? 'The request conflicts with existing data'
      : err.code === 'ER_NO_REFERENCED_ROW_2'
        ? 'The referenced record does not exist'
        : 'An unexpected server error occurred';
  res.status(status).json({
    success: false,
    message
  });
}

module.exports = { notFound, errorHandler };
