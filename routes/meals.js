const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

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
          c.name as Tipo,
          d.item_name as NomeItem,
          d.quantity as Quantidade,
          e.name as Medida
        FROM meals a
        JOIN users b ON a.user_id = b.id
        JOIN meal_types c ON a.type_id = c.id
        JOIN meal_items d ON a.id = d.meal_id
        JOIN measurement_units e ON d.unit_id = e.id
        WHERE cast(a.date_time as date) = cast(GETDATE() as date)
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

router.get('/filter-by-date', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ 
        error: 'Parâmetro "date" é obrigatório. Use o formato YYYY-MM-DD' 
      });
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ 
        error: 'Formato de data inválido. Use o formato YYYY-MM-DD' 
      });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('date', sql.Date, date)
      .query(`        
        SELECT 
          b.name as Usuario, 
          a.description as Refeicao,    
          CONVERT(VARCHAR(10), a.date_time, 103) + ' ' + 
          CONVERT(VARCHAR(8), a.date_time, 108) AS Data,
          c.name as Tipo,
          d.item_name as NomeItem,
          d.quantity as Quantidade,
          e.name as Medida
        FROM meals a
        JOIN users b ON a.user_id = b.id
        JOIN meal_types c ON a.type_id = c.id
        JOIN meal_items d ON a.id = d.meal_id
        JOIN measurement_units e ON d.unit_id = e.id
        WHERE cast(a.date_time as date) = @date
        ORDER BY a.date_time DESC
      `);
    
    res.json({
      message: `Refeições encontradas para a data ${date}`,
      total_refeicoes: result.recordset.length,
      data: result.recordset
    });
    
  } catch (error) {
    console.error('Erro ao filtrar refeições por data:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    
    const mealsResult = await pool.request()
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
    
    const mealsWithItems = [];
    for (const meal of mealsResult.recordset) {
      const itemsResult = await pool.request()
        .input('meal_id', sql.Int, meal.id)
        .query(`
          SELECT 
            mi.*,
            mu.name as unit_name
          FROM meal_items mi
          INNER JOIN measurement_units mu ON mi.unit_id = mu.id
          WHERE mi.meal_id = @meal_id
          ORDER BY mi.id
        `);
      
      mealsWithItems.push({
        ...meal,
        items: itemsResult.recordset
      });
    }
    
    res.json(mealsWithItems);
  } catch (error) {
    console.error('Erro ao buscar refeições:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getConnection();
    
    const mealResult = await pool.request()
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
    
    if (mealResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Refeição não encontrada' });
    }
    
    const itemsResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          mi.*,
          mu.name as unit_name
        FROM meal_items mi
        INNER JOIN measurement_units mu ON mi.unit_id = mu.id
        WHERE mi.meal_id = @id
        ORDER BY mi.id
        `);
    
    const meal = mealResult.recordset[0];
    meal.items = itemsResult.recordset;
    
    res.json(meal);
  } catch (error) {
    console.error('Erro ao buscar refeição:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { user_id, type_id, description, date_time, items } = req.body;
    
    if (!user_id || !type_id || !description || !date_time || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'user_id, type_id, description, date_time e items (array não vazio) são obrigatórios' 
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
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.item_name || item.quantity === undefined || !item.unit_id) {
        return res.status(400).json({ 
          error: `Item ${i + 1} deve ter item_name, quantity e unit_id` 
        });
      }
      
      const unitExists = await pool.request()
        .input('unit_id', sql.Int, item.unit_id)
        .query('SELECT id FROM measurement_units WHERE id = @unit_id');
      
      if (unitExists.recordset.length === 0) {
        return res.status(400).json({ 
          error: `Unidade de medida com ID ${item.unit_id} não encontrada` 
        });
      }
    }
    
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      const mealResult = await transaction.request()
        .input('user_id', sql.Int, user_id)
        .input('type_id', sql.Int, type_id)
        .input('description', sql.NVarChar, description)
        .input('date_time', sql.DateTime, new Date(date_time))
        .query(`
          INSERT INTO meals (user_id, type_id, description, date_time, created_at)
          OUTPUT INSERTED.*
          VALUES (@user_id, @type_id, @description, @date_time, GETDATE())
        `);
      
      const meal = mealResult.recordset[0];
      
      const mealItems = [];
      for (const item of items) {
        const itemResult = await transaction.request()
          .input('meal_id', sql.Int, meal.id)
          .input('item_name', sql.NVarChar, item.item_name)
          .input('quantity', sql.Decimal(10, 2), item.quantity)
          .input('unit_id', sql.Int, item.unit_id)
          .query(`
            INSERT INTO meal_items (meal_id, item_name, quantity, unit_id, created_at)
            OUTPUT INSERTED.*
            VALUES (@meal_id, @item_name, @quantity, @unit_id, GETDATE())
          `);
        
        mealItems.push(itemResult.recordset[0]);
      }
      
      await transaction.commit();
      
      const completeMeal = await pool.request()
        .input('id', sql.Int, meal.id)
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
      
      const completeItems = await pool.request()
        .input('meal_id', sql.Int, meal.id)
        .query(`
          SELECT 
            mi.*,
            mu.name as unit_name
          FROM meal_items mi
          INNER JOIN measurement_units mu ON mi.unit_id = mu.id
          WHERE mi.meal_id = @meal_id
          ORDER BY mi.id
        `);
      
      const response = {
        ...completeMeal.recordset[0],
        items: completeItems.recordset
      };
      
      res.status(201).json(response);
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Erro ao criar refeição:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

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

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar e converter o ID para número
    const mealId = parseInt(id);
    if (isNaN(mealId) || mealId <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.Int, mealId)
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
