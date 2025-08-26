const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const bcrypt = require('bcrypt');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único do usuário
 *         name:
 *           type: string
 *           description: Nome completo do usuário
 *         email:
 *           type: string
 *           format: email
 *           description: Email único do usuário
 *         password:
 *           type: string
 *           description: Senha criptografada
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data de criação
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data de atualização
 *     
 *     UserLogin:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *     
 *     LoginResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             email:
 *               type: string
 *         tokens:
 *           type: object
 *           properties:
 *             access_token:
 *               type: string
 *             refresh_token:
 *               type: string
 *             expires_in:
 *               type: integer
 *     
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - refresh_token
 *       properties:
 *         refresh_token:
 *           type: string
 *           description: Refresh token para renovar o access token
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Cria um novo usuário
 *     tags: [Users]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Dados inválidos ou email já existe
 *       401:
 *         description: API Key não fornecida
 *       403:
 *         description: API Key inválida
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validação básica
    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Nome, email e senha são obrigatórios' 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'A senha deve ter pelo menos 6 caracteres' 
      });
    }
    
    const pool = await getConnection();
    const existingUser = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM users WHERE email = @email');
    
    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ 
        error: 'Este email já está em uso' 
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .query(`
        INSERT INTO users (name, email, password, created_at, updated_at)
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.created_at, INSERTED.updated_at
        VALUES (@name, @email, @password, GETDATE(), GETDATE())
      `);
    
    const newUser = result.recordset[0];
    
    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at
      }
    });
    
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Faz login do usuário
 *     tags: [Users]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserLogin'
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Email ou senha incorretos ou API Key não fornecida
 *       403:
 *         description: API Key inválida
 *       500:
 *         description: Erro interno do servidor
 */
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
        error: 'Email ou senha incorretos' 
      });
    }
    
    const user = result.recordset[0];
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Email ou senha incorretos' 
      });
    }
    
    const accessToken = generateAccessToken({ 
      id: user.id, 
      email: user.email 
    });
    
    const refreshToken = generateRefreshToken({ 
      id: user.id, 
      email: user.email 
    });
    
    const refreshExpiresIn = parseInt(process.env.JWT_REFRESH_EXPIRES_IN)
    const refreshExpiresAt = new Date(Date.now() + (refreshExpiresIn * 1000));

    await pool.request()
      .input('user_id', sql.Int, user.id)
      .input('refresh_token', sql.NVarChar, refreshToken)
      .input('refresh_token_expires_at', sql.DateTime, refreshExpiresAt)
      .query(`
        UPDATE users 
        SET refresh_token = @refresh_token, 
            refresh_token_expires_at = @refresh_token_expires_at,
            updated_at = GETDATE()
        WHERE id = @user_id
      `);
    
    res.json({
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: parseInt(process.env.JWT_ACCESS_EXPIRES_IN) || 3600
      }
    });
    
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/users/refresh:
 *   post:
 *     summary: Renova o access token usando refresh token
 *     tags: [Users]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 access_token:
 *                   type: string
 *                 expires_in:
 *                   type: integer
 *       400:
 *         description: Refresh token não fornecido
 *       401:
 *         description: Refresh token inválido ou expirado
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/refresh', async (req, res) => {
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
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('user_id', sql.Int, decoded.id)
      .input('refresh_token', sql.NVarChar, refresh_token)
      .query(`
        SELECT id, name, email, refresh_token_expires_at 
        FROM users 
        WHERE id = @user_id 
        AND refresh_token = @refresh_token
        AND refresh_token_expires_at > GETDATE()
      `);
    
    if (result.recordset.length === 0) {
      return res.status(401).json({ 
        error: 'Refresh token inválido ou expirado' 
      });
    }
    
    const user = result.recordset[0];
    
    const newAccessToken = generateAccessToken({ 
      id: user.id, 
      email: user.email 
    });
    
    res.json({
      message: 'Token renovado com sucesso',
      access_token: newAccessToken,
      expires_in: parseInt(process.env.JWT_ACCESS_EXPIRES_IN) || 3600
    });
    
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
