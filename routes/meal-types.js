const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

/**
 * @swagger
 * components:
 *   schemas:
 *     MealType:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único da categoria
 *         name:
 *           type: string
 *           description: Nome da categoria de refeição
 */

/**
 * @swagger
 * /api/meal-types:
 *   get:
 *     summary: Lista todas as categorias de refeição
 *     tags: [Meal Types]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de categorias retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MealType'
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
      .query('SELECT * FROM meal_types ORDER BY name');
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/meal-types:
 *   post:
 *     summary: Adiciona uma nova categoria de refeição
 *     tags: [Meal Types]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome da nova categoria
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MealType'
 *       400:
 *         description: Nome é obrigatório ou categoria já existe
 *       401:
 *         description: API Key não fornecida
 *       403:
 *         description: API Key inválida
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Nome da categoria é obrigatório' 
      });
    }
    
    const pool = await getConnection();
    const existingCategory = await pool.request()
      .input('name', sql.NVarChar, name.trim())
      .query('SELECT id FROM meal_types WHERE name = @name');
    
    if (existingCategory.recordset.length > 0) {
      return res.status(400).json({ 
        error: 'Esta categoria já existe' 
      });
    }
    
    const result = await pool.request()
      .input('name', sql.NVarChar, name.trim())
      .query(`
        INSERT INTO meal_types (name)
        OUTPUT INSERTED.*
        VALUES (@name)
      `);
    
    res.status(201).json(result.recordset[0]);
    
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/meal-types/{id}:
 *   delete:
 *     summary: Remove uma categoria de refeição
 *     tags: [Meal Types]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da categoria
 *     responses:
 *       200:
 *         description: Categoria removida com sucesso
 *       400:
 *         description: Não é possível remover categoria que está em uso
 *       401:
 *         description: API Key não fornecida
 *       403:
 *         description: API Key inválida
 *       404:
 *         description: Categoria não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getConnection();
    
    const categoryExists = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT id FROM meal_types WHERE id = @id');
    
    if (categoryExists.recordset.length === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    
    const mealsUsingCategory = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT COUNT(*) as count FROM meals WHERE type_id = @id');
    
    if (mealsUsingCategory.recordset[0].count > 0) {
      return res.status(400).json({ 
        error: 'Não é possível remover uma categoria que está sendo usada por refeições' 
      });
    }
    
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM meal_types WHERE id = @id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    
    res.json({ message: 'Categoria removida com sucesso' });
    
  } catch (error) {
    console.error('Erro ao remover categoria:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
