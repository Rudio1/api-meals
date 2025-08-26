const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

/**
 * @swagger
 * components:
 *   schemas:
 *     Meal:
 *       type: object
 *       required:
 *         - user_id
 *         - type_id
 *         - description
 *         - date_time
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único da refeição
 *         user_id:
 *           type: integer
 *           description: ID do usuário que criou a refeição
 *         type_id:
 *           type: integer
 *           description: ID da categoria da refeição
 *         description:
 *           type: string
 *           description: Descrição da refeição
 *         date_time:
 *           type: string
 *           format: date-time
 *           description: Data e hora da refeição
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data de criação do registro
 *     
 *     MealWithDetails:
 *       allOf:
 *         - $ref: '#/components/schemas/Meal'
 *         - type: object
 *           properties:
 *             user_name:
 *               type: string
 *               description: Nome do usuário
 *             type_name:
 *               type: string
 *               description: Nome da categoria
 *     
 *     DashboardMeal:
 *       type: object
 *       properties:
 *         Usuario:
 *           type: string
 *           description: Nome do usuário
 *         Refeicao:
 *           type: string
 *           description: Descrição da refeição
 *         Data:
 *           type: string
 *           description: Data e hora formatada (DD/MM/YYYY HH:MM:SS)
 *         Tipo:
 *           type: string
 *           description: Nome da categoria da refeição
 */

/**
 * @swagger
 * /api/meals/dashboard:
 *   get:
 *     summary: Dashboard com todas as refeições formatadas
 *     tags: [Meals]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Dashboard retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DashboardMeal'
 *       401:
 *         description: API Key não fornecida
 *       403:
 *         description: API Key inválida
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/dashboard', async (req, res) => {
  try {
    const pool = await getConnection();
    
    const result = await pool.request()
      .query(`
        SELECT 
          b.name as Usuario, 
          a.description as Refeicao,    
          CONVERT(VARCHAR(10), a.date_time, 103) + ' ' + 
          CONVERT(VARCHAR(8), a.date_time, 108) AS Data,
          c.name as Tipo 
        FROM meals a
        JOIN users b ON a.user_id = b.id
        JOIN meal_types c ON a.type_id = c.id
        ORDER BY a.date_time DESC
      `);
    
    res.json({
      message: 'Dashboard carregado com sucesso',
      total_refeicoes: result.recordset.length,
      data: result.recordset
    });
    
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/meals:
 *   get:
 *     summary: Lista todas as refeições com detalhes
 *     tags: [Meals]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de refeições retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MealWithDetails'
 *       401:
 *         description: API Key não fornecida
 *       403:
 *         description: API Key inválida
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT 
          m.*,
          u.name as user_name,
          mt.name as type_name
        FROM meals m
        INNER JOIN users u ON m.user_id = u.id
        INNER JOIN meal_types mt ON m.type_id = mt.id
        ORDER BY m.date_time DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Erro ao buscar refeições:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/meals/{id}:
 *   get:
 *     summary: Busca uma refeição por ID
 *     tags: [Meals]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da refeição
 *     responses:
 *       200:
 *         description: Refeição encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MealWithDetails'
 *       401:
 *         description: API Key não fornecida
 *       403:
 *         description: API Key inválida
 *       404:
 *         description: Refeição não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          m.*,
          u.name as user_name,
          mt.name as type_name
        FROM meals m
        INNER JOIN users u ON m.user_id = u.id
        INNER JOIN meal_types mt ON m.type_id = mt.id
        WHERE m.id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Refeição não encontrada' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Erro ao buscar refeição:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/meals:
 *   post:
 *     summary: Cria uma nova refeição
 *     tags: [Meals]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - type_id
 *               - description
 *               - date_time
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: ID do usuário
 *               type_id:
 *                 type: integer
 *                 description: ID da categoria
 *               description:
 *                 type: string
 *                 description: Descrição da refeição
 *               date_time:
 *                 type: string
 *                 format: date-time
 *                 description: Data e hora da refeição
 *     responses:
 *       201:
 *         description: Refeição criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Meal'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: API Key não fornecida
 *       403:
 *         description: API Key inválida
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, type_id, description, date_time } = req.body;
    
    if (!user_id || !type_id || !description || !date_time) {
      return res.status(400).json({ 
        error: 'user_id, type_id, description e date_time são obrigatórios' 
      });
    }
    
    const pool = await getConnection();
    
    const userExists = await pool.request()
      .input('user_id', sql.Int, user_id)
      .query('SELECT id FROM users WHERE id = @user_id');
    
    if (userExists.recordset.length === 0) {
      return res.status(400).json({ error: 'Usuário não encontrado' });
    }
    
    const typeExists = await pool.request()
      .input('type_id', sql.Int, type_id)
      .query('SELECT id FROM meal_types WHERE id = @type_id');
    
    if (typeExists.recordset.length === 0) {
      return res.status(400).json({ error: 'Categoria não encontrada' });
    }
    
    const result = await pool.request()
      .input('user_id', sql.Int, user_id)
      .input('type_id', sql.Int, type_id)
      .input('description', sql.NVarChar, description)
      .input('date_time', sql.DateTime, new Date(date_time))
      .query(`
        INSERT INTO meals (user_id, type_id, description, date_time, created_at)
        OUTPUT INSERTED.*
        VALUES (@user_id, @type_id, @description, @date_time, GETDATE())
      `);
    
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Erro ao criar refeição:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/meals/{id}:
 *   put:
 *     summary: Atualiza uma refeição existente
 *     tags: [Meals]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da refeição
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type_id:
 *                 type: integer
 *               description:
 *                 type: string
 *               date_time:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Refeição atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Meal'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: API Key não fornecida
 *       403:
 *         description: API Key inválida
 *       404:
 *         description: Refeição não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type_id, description, date_time } = req.body;
    
    const pool = await getConnection();
    
    const mealExists = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT id FROM meals WHERE id = @id');
    
    if (mealExists.recordset.length === 0) {
      return res.status(404).json({ error: 'Refeição não encontrada' });
    }
    
    if (type_id) {
      const typeExists = await pool.request()
        .input('type_id', sql.Int, type_id)
        .query('SELECT id FROM meal_types WHERE id = @type_id');
      
      if (typeExists.recordset.length === 0) {
        return res.status(400).json({ error: 'Categoria não encontrada' });
      }
    }
    
    let updateFields = [];
    let inputs = [];
    
    if (type_id !== undefined) {
      updateFields.push('type_id = @type_id');
      inputs.push({ name: 'type_id', type: sql.Int, value: type_id });
    }
    
    if (description !== undefined) {
      updateFields.push('description = @description');
      inputs.push({ name: 'description', type: sql.NVarChar, value: description });
    }
    
    if (date_time !== undefined) {
      updateFields.push('date_time = @date_time');
      inputs.push({ name: 'date_time', type: sql.DateTime, value: new Date(date_time) });
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }
    
    inputs.push({ name: 'id', type: sql.Int, value: id });
    
    const request = pool.request();
    inputs.forEach(input => {
      request.input(input.name, input.type, input.value);
    });
    
    const result = await request.query(`
      UPDATE meals 
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Erro ao atualizar refeição:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/meals/{id}:
 *   delete:
 *     summary: Remove uma refeição
 *     tags: [Meals]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da refeição
 *     responses:
 *       200:
 *         description: Refeição removida com sucesso
 *       401:
 *         description: API Key não fornecida
 *       403:
 *         description: API Key inválida
 *       404:
 *         description: Refeição não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM meals WHERE id = @id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Refeição não encontrada' });
    }
    
    res.json({ message: 'Refeição removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover refeição:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
