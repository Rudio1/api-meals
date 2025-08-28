const express = require('express');
const router = express.Router();
const { getConnection } = require('../config/database');
const sql = require('mssql');

// Lista todas as unidades de medida
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    
    const result = await pool.request()
      .query(`
        SELECT id, name, abbreviation
        FROM measurement_units 
        ORDER BY name
      `);
    
    res.json({
      message: 'Unidades de medida encontradas',
      total: result.recordset.length,
      data: result.recordset
    });
    
  } catch (error) {
    console.error('Erro ao buscar unidades de medida:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
