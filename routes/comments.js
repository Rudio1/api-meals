const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const { authenticateJWT } = require('../middleware/jwt-auth');

router.post('/', authenticateJWT, async (req, res) => {
  try {
    const { post_id, comment, rating } = req.body;
    const user_id = req.user.userId;
    
    if (!post_id || !comment) {
      return res.status(400).json({ 
        error: 'post_id e comment são obrigatórios' 
      });
    }
    
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ 
        error: 'Rating deve ser um valor entre 1 e 5' 
      });
    }
    
    if (comment.trim().length < 3) {
      return res.status(400).json({ 
        error: 'Comentário deve ter pelo menos 3 caracteres' 
      });
    }
    
    if (comment.trim().length > 2000) {
      return res.status(400).json({ 
        error: 'Comentário deve ter no máximo 2000 caracteres' 
      });
    }
    
    const pool = await getConnection();
    
    const postExists = await pool.request()
      .input('post_id', sql.BigInt, post_id)
      .query('SELECT id, status FROM posts WHERE id = @post_id');
    
    if (postExists.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Post não encontrado' 
      });
    }
    
    if (postExists.recordset[0].status !== 'published') {
      return res.status(400).json({ 
        error: 'Apenas posts publicados podem receber comentários' 
      });
    }
    
    const existingComment = await pool.request()
      .input('post_id', sql.BigInt, post_id)
      .input('user_id', sql.BigInt, user_id)
      .query(`
        SELECT id FROM post_comments 
        WHERE post_id = @post_id AND user_id = @user_id AND status != 'deleted'
      `);
    
    if (existingComment.recordset.length > 0) {
      return res.status(400).json({ 
        error: 'Você já comentou neste post. Apenas um comentário por usuário é permitido.' 
      });
    }
    
    const result = await pool.request()
      .input('post_id', sql.BigInt, post_id)
      .input('user_id', sql.BigInt, user_id)
      .input('comment', sql.NVarChar, comment.trim())
      .input('rating', sql.TinyInt, rating || null)
      .query(`
        INSERT INTO post_comments (post_id, user_id, comment, rating, created_at, updated_at)
        OUTPUT INSERTED.id, INSERTED.post_id, INSERTED.user_id, INSERTED.comment, 
               INSERTED.rating, INSERTED.status, INSERTED.created_at, INSERTED.updated_at
        VALUES (@post_id, @user_id, @comment, @rating, 
                SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time',
                SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time')
      `);
    
    const newComment = result.recordset[0];
    
    res.status(201).json({
      message: 'Comentário criado com sucesso',
      comment: newComment
    });
    
  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/post/:post_id', async (req, res) => {
  try {
    const { post_id } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    if (!post_id || isNaN(post_id)) {
      return res.status(400).json({ 
        error: 'post_id deve ser um número válido' 
      });
    }
    
    const pool = await getConnection();
    
    const postExists = await pool.request()
      .input('post_id', sql.BigInt, post_id)
      .query('SELECT id, status FROM posts WHERE id = @post_id');
    
    if (postExists.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Post não encontrado' 
      });
    }
    
    const result = await pool.request()
      .input('post_id', sql.BigInt, post_id)
      .input('limit', sql.Int, parseInt(limit))
      .input('offset', sql.Int, parseInt(offset))
      .query(`
        SELECT 
          c.id,
          c.post_id,
          c.user_id,
          c.comment,
          c.rating,
          c.status,
          c.created_at,
          c.updated_at,
          u.name as user_name,
          u.email as user_email
        FROM post_comments c
        INNER JOIN users u ON c.user_id = u.id
        WHERE c.post_id = @post_id 
          AND c.status = 'active'
        ORDER BY c.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);
    
    const countResult = await pool.request()
      .input('post_id', sql.BigInt, post_id)
      .query(`
        SELECT COUNT(*) as total 
        FROM post_comments 
        WHERE post_id = @post_id AND status = 'active'
      `);
    
    res.json({
      comments: result.recordset,
      total: countResult.recordset[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Erro ao listar comentários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        error: 'ID deve ser um número válido' 
      });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.BigInt, id)
      .query(`
        SELECT 
          c.id,
          c.post_id,
          c.user_id,
          c.comment,
          c.rating,
          c.status,
          c.created_at,
          c.updated_at,
          u.name as user_name,
          u.email as user_email
        FROM post_comments c
        INNER JOIN users u ON c.user_id = u.id
        WHERE c.id = @id AND c.status != 'deleted'
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Comentário não encontrado' 
      });
    }
    
    res.json(result.recordset[0]);
    
  } catch (error) {
    console.error('Erro ao buscar comentário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, rating } = req.body;
    const user_id = req.user.userId;
    
    if (!comment && rating === undefined) {
      return res.status(400).json({ 
        error: 'Pelo menos um campo deve ser fornecido (comment ou rating)' 
      });
    }
    
    // Validação do rating se fornecido
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({ 
        error: 'Rating deve ser um valor entre 1 e 5' 
      });
    }
    
    // Validação do comentário se fornecido
    if (comment) {
      if (comment.trim().length < 3) {
        return res.status(400).json({ 
          error: 'Comentário deve ter pelo menos 3 caracteres' 
        });
      }
      
      if (comment.trim().length > 2000) {
        return res.status(400).json({ 
          error: 'Comentário deve ter no máximo 2000 caracteres' 
        });
      }
    }
    
    const pool = await getConnection();
    
    // Verificar se o comentário existe e pertence ao usuário
    const commentExists = await pool.request()
      .input('id', sql.BigInt, id)
      .query(`
        SELECT id, user_id, status, comment, rating 
        FROM post_comments 
        WHERE id = @id AND status != 'deleted'
      `);
    
    if (commentExists.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Comentário não encontrado' 
      });
    }
    
    const currentComment = commentExists.recordset[0];
    
    if (currentComment.user_id !== user_id) {
      return res.status(403).json({ 
        error: 'Acesso negado. Você só pode editar seus próprios comentários.' 
      });
    }
    
    let updateFields = [];
    let inputs = [];
    
    if (comment) {
      updateFields.push('comment = @comment');
      inputs.push({ name: 'comment', type: sql.NVarChar, value: comment.trim() });
    }
    
    if (rating !== undefined) {
      updateFields.push('rating = @rating');
      inputs.push({ name: 'rating', type: sql.TinyInt, value: rating });
    }
    
    updateFields.push('updated_at = SYSDATETIMEOFFSET() AT TIME ZONE \'E. South America Standard Time\'');
    inputs.push({ name: 'id', type: sql.BigInt, value: id });
    
    const request = pool.request();
    inputs.forEach(input => {
      request.input(input.name, input.type, input.value);
    });
    
    const result = await request.query(`
      UPDATE post_comments 
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.id, INSERTED.post_id, INSERTED.user_id, INSERTED.comment, 
             INSERTED.rating, INSERTED.status, INSERTED.created_at, INSERTED.updated_at
      WHERE id = @id
    `);
    
    res.json({
      message: 'Comentário atualizado com sucesso',
      comment: result.recordset[0]
    });
    
  } catch (error) {
    console.error('Erro ao atualizar comentário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.userId;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        error: 'ID deve ser um número válido' 
      });
    }
    
    const pool = await getConnection();
    
    // Verificar se o comentário existe e pertence ao usuário
    const commentExists = await pool.request()
      .input('id', sql.BigInt, id)
      .query(`
        SELECT id, user_id, status 
        FROM post_comments 
        WHERE id = @id AND status != 'deleted'
      `);
    
    if (commentExists.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Comentário não encontrado' 
      });
    }
    
    const currentComment = commentExists.recordset[0];
    
    if (currentComment.user_id !== user_id) {
      return res.status(403).json({ 
        error: 'Acesso negado. Você só pode deletar seus próprios comentários.' 
      });
    }
    
    await pool.request()
      .input('id', sql.BigInt, id)
      .query(`
        UPDATE post_comments 
        SET status = 'deleted', 
            deleted_at = SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time',
            updated_at = SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time'
        WHERE id = @id
      `);
    
    res.json({ 
      message: 'Comentário deletado com sucesso' 
    });
    
  } catch (error) {
    console.error('Erro ao deletar comentário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
