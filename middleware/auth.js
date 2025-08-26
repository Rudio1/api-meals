/**
 * Middleware de autenticação por API Key
 * Verifica se o header x-api-key está presente e é válido
 */

const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key não fornecida',
      message: 'O header x-api-key é obrigatório para acessar esta API'
    });
  }
  
  const validApiKey = process.env.API_KEY;
  
  if (!validApiKey) {
    console.error('API_KEY não configurada no ambiente');
    return res.status(500).json({
      error: 'Erro de configuração do servidor',
      message: 'API_KEY não configurada'
    });
  }
  
  if (apiKey !== validApiKey) {
    return res.status(403).json({
      error: 'API Key inválida',
      message: 'A API key fornecida não é válida'
    });
  }
  
  next();
};

module.exports = {
  authenticateApiKey
};
