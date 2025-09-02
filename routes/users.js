const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const bcrypt = require('bcrypt');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt');

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Nome, email e senha são obrigatórios' 
      });
    }
    
    const pool = await getConnection();
    const existingUser = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM users WHERE email = @email');
    
    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ 
        error: 'Email já está em uso' 
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('hashedPassword', sql.NVarChar, hashedPassword)
      .query(`
        INSERT INTO users (name, email, password, themeSelected, created_at, updated_at)
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.themeSelected, INSERTED.created_at
        VALUES (@name, @email, @hashedPassword, 'light', GETDATE(), GETDATE())
      `);
    
    const newUser = result.recordset[0];
    
    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        themeSelected: newUser.themeSelected
      }
    });
    
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email e senha são obrigatórios' 
      });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM users WHERE email = @email');
    
    if (result.recordset.length === 0) {
      return res.status(401).json({ 
        error: 'Email ou senha inválidos' 
      });
    }
    
    const user = result.recordset[0];
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Email ou senha inválidos' 
      });
    }
    
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    
    res.json({
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        themeSelected: user.themeSelected
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600 // 1 hora
      }
    });
    
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/refresh-token', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ 
        error: 'Refresh token é obrigatório' 
      });
    }
    
    const decoded = verifyToken(refresh_token);
    
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Refresh token inválido' 
      });
    }
    
    const newAccessToken = generateAccessToken(decoded.userId);
    
    res.json({
      message: 'Token renovado com sucesso',
      access_token: newAccessToken,
      expires_in: 3600
    });
    
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT id, name, email, themeSelected, created_at, updated_at
        FROM users 
        WHERE id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(result.recordset[0]);
    
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/edit', async (req, res) => {
  try {
    const { name, themeSelected } = req.body;
    
    if (!name && !themeSelected) {
      return res.status(400).json({ 
        error: 'Pelo menos um campo deve ser fornecido (name ou themeSelected)' 
      });
    }
    
  
    if (name && name.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Nome deve ter pelo menos 2 caracteres' 
      });
    }
    
    const pool = await getConnection();
    
    const userId = req.query.user_id || req.body.user_id;
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'user_id é obrigatório' 
      });
    }
    
    const userExists = await pool.request()
      .input('user_id', sql.Int, userId)
      .query('SELECT id, name, email, themeSelected FROM users WHERE id = @user_id');
    
    if (userExists.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }  
    
    let updateFields = [];
    let inputs = [];
    
    if (name !== undefined) {
      updateFields.push('name = @name');
      inputs.push({ name: 'name', type: sql.NVarChar, value: name.trim() });
    }
    
    if (themeSelected !== undefined) {
      updateFields.push('themeSelected = @themeSelected');
      inputs.push({ name: 'themeSelected', type: sql.NVarChar, value: themeSelected });
    }
    
    inputs.push({ name: 'user_id', type: sql.Int, value: userId });
    
    const request = pool.request();
    inputs.forEach(input => {
      request.input(input.name, input.type, input.value);
    });
    
    const result = await request.query(`
      UPDATE users 
      SET ${updateFields.join(', ')}, updated_at = GETDATE()
      OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.themeSelected, INSERTED.updated_at
      WHERE id = @user_id
    `);
    
    const updatedUser = result.recordset[0];
    
    res.json({
      message: 'Usuário atualizado com sucesso',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        themeSelected: updatedUser.themeSelected,
        updated_at: updatedUser.updated_at
      }
    });
    
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:id/change-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Senha atual e nova senha são obrigatórias' 
      });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT password FROM users WHERE id = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const user = result.recordset[0];
    
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Senha atual incorreta' 
      });
    }
    
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    await pool.request()
      .input('id', sql.Int, id)
      .input('hashedPassword', sql.NVarChar, hashedNewPassword)
      .query(`
        UPDATE users 
        SET password = @hashedPassword, updated_at = GETDATE()
        WHERE id = @id
      `);
    
    res.json({ message: 'Senha alterada com sucesso' });
    
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    
    const result = await pool.request()
      .query(`
        SELECT id, name, email, themeSelected, created_at, updated_at
        FROM users 
        ORDER BY name
      `);
    
    res.json(result.recordset);
    
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM users WHERE id = @id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json({ message: 'Usuário removido com sucesso' });
    
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/contacts', async (req, res) => {
  try {
    const { name, telephone } = req.body;
    
    // Validação básica
    if (!name || !telephone) {
      return res.status(400).json({ 
        error: 'Nome e telefone são obrigatórios' 
      });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('name', sql.VarChar, name.trim())
      .input('telephone', sql.VarChar, telephone.trim())
      .query(`
        INSERT INTO Contacts (Name, Telephone, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Telephone, INSERTED.CreatedAt
        VALUES (@name, @telephone, GETDATE())
      `);
    
    const newContact = result.recordset[0];
    
    res.status(201).json({
      message: 'Contato criado com sucesso',
      contact: {
        id: newContact.Id,
        name: newContact.Name,
        telephone: newContact.Telephone,
        createdAt: newContact.CreatedAt
      }
    });
    
  } catch (error) {
    console.error('Erro ao criar contato:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
