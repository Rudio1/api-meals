const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

const parseDateTime = (dateTimeString) => {
  if (dateTimeString.endsWith('Z')) {
    return new Date(dateTimeString);
  }
  return new Date(dateTimeString + 'Z');
};

router.get('/dashboard', async (req, res) => {
  try {
    const pool = await getConnection();
    
    const result = await pool.request()
      .query(`        
        SELECT
          a.id as Id,
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
          a.id as Id,
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

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const mealId = parseInt(id);
    if (isNaN(mealId) || mealId <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.Int, mealId)
      .query(`        
        SELECT 
          a.id as Id,
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
        WHERE a.id = @id
        ORDER BY a.date_time DESC
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Refeição não encontrada' });
    }
    
    res.json({
      message: 'Refeição encontrada com sucesso',
      total_items: result.recordset.length,
      data: result.recordset
    });
    
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
        .input('date_time', sql.DateTime, parseDateTime(date_time))
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
    const { user_id, type_id, description, date_time, items } = req.body;
    
    // TODO: Implementar autenticação JWT para pegar o usuário logado
    // Por enquanto, vamos assumir que o usuário logado está em req.user.id
    // const currentUserId = req.user?.id;
    
    if (!user_id) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    
    const pool = await getConnection();
    
    const mealExists = await pool.request()
      .input('id', sql.Int, id)
      .input('user_id', sql.Int, user_id)
      .query('SELECT id, user_id FROM meals WHERE id = @id AND user_id = @user_id');
    
    if (mealExists.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Refeição não encontrada ou você não tem permissão para editá-la' 
      });
    }
    
      if (user_id !== undefined && user_id !== user_id) {
      return res.status(403).json({ 
        error: 'Você não pode transferir uma refeição para outro usuário' 
      });
    }
    
    if (user_id !== undefined) {
      const userExists = await pool.request()
        .input('user_id', sql.Int, user_id)
        .query('SELECT id FROM users WHERE id = @user_id');
      
      if (userExists.recordset.length === 0) {
        return res.status(400).json({ error: 'Usuário não encontrado' });
      }
    }
    
    if (type_id !== undefined) {
      const typeExists = await pool.request()
        .input('type_id', sql.Int, type_id)
        .query('SELECT id FROM meal_types WHERE id = @type_id');
      
      if (typeExists.recordset.length === 0) {
        return res.status(400).json({ error: 'Categoria não encontrada' });
      }
    }
    
    if (items !== undefined) {
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Items deve ser um array' });
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
    }
    
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      let updateFields = [];
      let inputs = [];
      
      if (user_id !== undefined) {
        updateFields.push('user_id = @user_id');
        inputs.push({ name: 'user_id', type: sql.Int, value: user_id });
      }
      
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
        inputs.push({ name: 'date_time', type: sql.DateTime, value: parseDateTime(date_time) });
      }
      
      if (updateFields.length > 0) {
        inputs.push({ name: 'id', type: sql.Int, value: id });
        
        const request = transaction.request();
        inputs.forEach(input => {
          request.input(input.name, input.type, input.value);
        });
        
        await request.query(`
          UPDATE meals 
          SET ${updateFields.join(', ')}
          WHERE id = @id
        `);
      }
      
      if (items !== undefined) {
        await transaction.request()
          .input('meal_id', sql.Int, id)
          .query('DELETE FROM meal_items WHERE meal_id = @meal_id');
        
        for (const item of items) {
          await transaction.request()
            .input('meal_id', sql.Int, id)
            .input('item_name', sql.NVarChar, item.item_name)
            .input('quantity', sql.Decimal(10, 2), item.quantity)
            .input('unit_id', sql.Int, item.unit_id)
            .query(`
              INSERT INTO meal_items (meal_id, item_name, quantity, unit_id, created_at)
              VALUES (@meal_id, @item_name, @quantity, @unit_id, GETDATE())
            `);
        }
      }
      
      await transaction.commit();
      
      const completeMeal = await pool.request()
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
      
      const completeItems = await pool.request()
        .input('meal_id', sql.Int, id)
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
      
      res.json(response);
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
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
