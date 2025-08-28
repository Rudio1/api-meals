const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

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

// router.post('/', async (req, res) => {
//   try {
//     const { name } = req.body;
    
//     if (!name || name.trim() === '') {
//       return res.status(400).json({ 
//         error: 'Nome da categoria é obrigatório' 
//       });
//     }
    
//     const pool = await getConnection();
    
//     const existingCategory = await pool.request()
//       .input('name', sql.NVarChar, name.trim())
//       .query('SELECT id FROM meal_types WHERE name = @name');
    
//     if (existingCategory.recordset.length > 0) {
//       return res.status(400).json({ 
//         error: 'Categoria com este nome já existe' 
//       });
//     }
    
//     const result = await pool.request()
//       .input('name', sql.NVarChar, name.trim())
//       .query(`
//         INSERT INTO meal_types (name)
//         OUTPUT INSERTED.*
//         VALUES (@name)
//       `);
    
//     res.status(201).json(result.recordset[0]);
    
//   } catch (error) {
//     console.error('Erro ao criar categoria:', error);
//     res.status(500).json({ error: 'Erro interno do servidor' });
//   }
// });

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const categoryId = parseInt(id);
    if (isNaN(categoryId) || categoryId <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.Int, categoryId)
      .query('SELECT * FROM meal_types WHERE id = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    
    res.json(result.recordset[0]);
    
  } catch (error) {
    console.error('Erro ao buscar categoria:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// router.put('/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name } = req.body;
    
//     const categoryId = parseInt(id);
//     if (isNaN(categoryId) || categoryId <= 0) {
//       return res.status(400).json({ error: 'ID inválido' });
//     }
    
//     if (!name || name.trim() === '') {
//       return res.status(400).json({ 
//         error: 'Nome da categoria é obrigatório' 
//       });
//     }
    
//     const pool = await getConnection();
    
//     const categoryExists = await pool.request()
//       .input('id', sql.Int, categoryId)
//       .query('SELECT id FROM meal_types WHERE id = @id');
    
//     if (categoryExists.recordset.length === 0) {
//       return res.status(404).json({ error: 'Categoria não encontrada' });
//     }
    
//     const existingCategory = await pool.request()
//       .input('name', sql.NVarChar, name.trim())
//       .input('id', sql.Int, categoryId)
//       .query('SELECT id FROM meal_types WHERE name = @name AND id != @id');
    
//     if (existingCategory.recordset.length > 0) {
//       return res.status(400).json({ 
//         error: 'Categoria com este nome já existe' 
//       });
//     }
    
//     const result = await pool.request()
//       .input('id', sql.Int, categoryId)
//       .input('name', sql.NVarChar, name.trim())
//       .query(`
//         UPDATE meal_types 
//         SET name = @name
//         OUTPUT INSERTED.*
//         WHERE id = @id
//       `);
    
//     res.json(result.recordset[0]);
    
//   } catch (error) {
//     console.error('Erro ao atualizar categoria:', error);
//     res.status(500).json({ error: 'Erro interno do servidor' });
//   }
// });

// router.delete('/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const categoryId = parseInt(id);
//     if (isNaN(categoryId) || categoryId <= 0) {
//       return res.status(400).json({ error: 'ID inválido' });
//     }
    
//     const pool = await getConnection();
    
//     const mealsUsingCategory = await pool.request()
//       .input('id', sql.Int, categoryId)
//       .query('SELECT COUNT(*) as count FROM meals WHERE type_id = @id');
    
//     if (mealsUsingCategory.recordset[0].count > 0) {
//       return res.status(400).json({ 
//         error: 'Não é possível remover uma categoria que está sendo usada em refeições' 
//       });
//     }
    
//     const result = await pool.request()
//       .input('id', sql.Int, categoryId)
//       .query('DELETE FROM meal_types WHERE id = @id');
    
//     if (result.rowsAffected[0] === 0) {
//       return res.status(404).json({ error: 'Categoria não encontrada' });
//     }
    
//     res.json({ message: 'Categoria removida com sucesso' });
    
//   } catch (error) {
//     console.error('Erro ao remover categoria:', error);
//     res.status(500).json({ error: 'Erro interno do servidor' });
//   }
// });

module.exports = router;
