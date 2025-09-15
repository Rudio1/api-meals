const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const { authenticateApiKey } = require('../middleware/auth');

router.post('/', authenticateApiKey, async (req, res) => {
  try {
    const { name, email, phone, assunto } = req.body;
    console.log(req.body);
    
    if (!name || !email || !phone || !assunto) {
      return res.status(400).json({ 
        error: 'Nome, email, telefone e assunto são obrigatórios' 
      });
    }
    
    if (name.length > 100) {
      return res.status(400).json({ 
        error: 'Nome deve ter no máximo 100 caracteres' 
      });
    }
    
    if (email.length > 100) {
      return res.status(400).json({ 
        error: 'Email deve ter no máximo 100 caracteres' 
      });
    }
    
    if (phone.length > 20) {
      return res.status(400).json({ 
        error: 'Telefone deve ter no máximo 20 caracteres' 
      });
    }
    
    if (assunto.length > 200) {
      return res.status(400).json({ 
        error: 'Assunto deve ter no máximo 200 caracteres' 
      });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Formato de email inválido' 
      });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('name', sql.VarChar(100), name.trim())
      .input('email', sql.VarChar(100), email.trim().toLowerCase())
      .input('phone', sql.VarChar(20), phone.trim())
      .input('assunto', sql.VarChar(200), assunto.trim())
      .query(`
        INSERT INTO contactsAG (name, email, phone, assunto) 
        OUTPUT INSERTED.Id, INSERTED.name, INSERTED.email, INSERTED.phone, INSERTED.assunto
        VALUES (@name, @email, @phone, @assunto)
      `);
    
    const newContact = result.recordset[0];
    
    res.status(201).json({
      message: 'Contato criado com sucesso',
      data: newContact
    });
    
  } catch (error) {
    console.error('Erro ao criar contato:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível criar o contato'
    });
  }
});

module.exports = router;
