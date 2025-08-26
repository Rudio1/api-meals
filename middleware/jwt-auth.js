const { verifyToken } = require('../utils/jwt');

/**
 * Middleware de autenticação por JWT Token
 * Verifica se o token de acesso é válido
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Token de acesso não fornecido',
      message: 'O header Authorization é obrigatório'
    });
  }
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      error: 'Formato de token inválido',
      message: 'Use o formato: Bearer <token>'
    });
  }
  
  try {
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'O token fornecido não é válido'
      });
    }
    req.user = decoded;
    next();
    
  } catch (error) {
    return res.status(401).json({
      error: 'Token inválido',
      message: 'O token fornecido não é válido'
    });
  }
};

module.exports = {
  authenticateJWT
};
