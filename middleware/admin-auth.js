const { getConnection, sql } = require('../config/database');

const authenticateAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        error: 'Token de acesso necessário' 
      });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT is_admin FROM users WHERE id = @userId');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Usuário não encontrado' 
      });
    }
    
    const user = result.recordset[0];
    
    if (!user.is_admin) {
      return res.status(403).json({ 
        error: 'Acesso negado. Apenas administradores podem acessar este recurso.' 
      });
    }
    
    req.user.isAdmin = true;
    next();
    
  } catch (error) {
    console.error('Erro na autenticação de admin:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { authenticateAdmin };
