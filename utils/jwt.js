const jwt = require('jsonwebtoken');

/**
 * Gera um access token JWT
 * @param {Object} payload - Dados do usuário
 * @returns {string} - Token JWT
 */
const generateAccessToken = (payload) => {
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: expiresIn
  });
};

/**
 * Gera um refresh token JWT
 * @param {Object} payload - Dados do usuário
 * @returns {string} - Token JWT
 */
const generateRefreshToken = (payload) => {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: expiresIn
  });
};

/**
 * Verifica se um token é válido
 * @param {string} token - Token JWT
 * @returns {Object|null} - Payload decodificado ou null se inválido
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Decodifica um token sem verificar a assinatura
 * @param {string} token - Token JWT
 * @returns {Object|null} - Payload decodificado ou null se inválido
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  decodeToken
};
