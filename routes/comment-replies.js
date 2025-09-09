const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const { authenticateJWT } = require('../middleware/jwt-auth');

router.post('/', authenticateJWT, async (req, res) => {
  try {
    const { comment_id, reply } = req.body;
    const user_id = req.user.userId;
    
    if (!comment_id || !reply) {
      return res.status(400).json({ 
        error: 'comment_id e reply são obrigatórios' 
      });
    }
    
    if (reply.trim().length < 3) {
      return res.status(400).json({ 
        error: 'Resposta deve ter pelo menos 3 caracteres' 
      });
    }
    
    if (reply.trim().length > 1000) {
      return res.status(400).json({ 
        error: 'Resposta deve ter no máximo 1000 caracteres' 
      });
    }
    
    const pool = await getConnection();
    
    const commentExists = await pool.request()
      .input('comment_id', sql.BigInt, comment_id)
      .query(`
        SELECT c.id, c.status, p.status as post_status
        FROM post_comments c
        INNER JOIN posts p ON c.post_id = p.id
        WHERE c.id = @comment_id AND c.status != 'deleted'
      `);
    
    if (commentExists.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Comentário não encontrado' 
      });
    }
    
    const comment = commentExists.recordset[0];
    
    if (comment.status !== 'active') {
      return res.status(400).json({ 
        error: 'Não é possível responder a comentários inativos' 
      });
    }
    
    if (comment.post_status !== 'published') {
      return res.status(400).json({ 
        error: 'Não é possível responder a comentários de posts não publicados' 
      });
    }
    
    const result = await pool.request()
      .input('comment_id', sql.BigInt, comment_id)
      .input('user_id', sql.BigInt, user_id)
      .input('reply', sql.NVarChar, reply.trim())
      .query(`
        INSERT INTO post_comment_replies (comment_id, user_id, reply, created_at, updated_at)
        OUTPUT INSERTED.id, INSERTED.comment_id, INSERTED.user_id, INSERTED.reply, 
               INSERTED.status, INSERTED.created_at, INSERTED.updated_at
        VALUES (@comment_id, @user_id, @reply,
                SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time',
                SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time')
      `);
    
    const newReply = result.recordset[0];
    
    res.status(201).json({
      message: 'Resposta criada com sucesso',
      reply: newReply
    });
    
  } catch (error) {
    console.error('Erro ao criar resposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/comment/:comment_id', async (req, res) => {
  try {
    const { comment_id } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    if (!comment_id || isNaN(comment_id)) {
      return res.status(400).json({ 
        error: 'comment_id deve ser um número válido' 
      });
    }
    
    const pool = await getConnection();
    
    const commentExists = await pool.request()
      .input('comment_id', sql.BigInt, comment_id)
      .query(`
        SELECT c.id, c.status, p.status as post_status
        FROM post_comments c
        INNER JOIN posts p ON c.post_id = p.id
        WHERE c.id = @comment_id AND c.status != 'deleted'
      `);
    
    if (commentExists.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Comentário não encontrado' 
      });
    }
    
    const result = await pool.request()
      .input('comment_id', sql.BigInt, comment_id)
      .input('limit', sql.Int, parseInt(limit))
      .input('offset', sql.Int, parseInt(offset))
      .query(`
        SELECT 
          r.id,
          r.comment_id,
          r.user_id,
          r.reply,
          r.status,
          r.created_at,
          r.updated_at,
          u.name as user_name,
          u.email as user_email
        FROM post_comment_replies r
        INNER JOIN users u ON r.user_id = u.id
        WHERE r.comment_id = @comment_id 
          AND r.status = 'active'
        ORDER BY r.created_at ASC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);
    
    const countResult = await pool.request()
      .input('comment_id', sql.BigInt, comment_id)
      .query(`
        SELECT COUNT(*) as total 
        FROM post_comment_replies 
        WHERE comment_id = @comment_id AND status = 'active'
      `);
    
    res.json({
      replies: result.recordset,
      total: countResult.recordset[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Erro ao listar respostas:', error);
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
          r.id,
          r.comment_id,
          r.user_id,
          r.reply,
          r.status,
          r.created_at,
          r.updated_at,
          u.name as user_name,
          u.email as user_email
        FROM post_comment_replies r
        INNER JOIN users u ON r.user_id = u.id
        WHERE r.id = @id AND r.status != 'deleted'
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Resposta não encontrada' 
      });
    }
    
    res.json(result.recordset[0]);
    
  } catch (error) {
    console.error('Erro ao buscar resposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;
    const user_id = req.user.userId;
    
    if (!reply) {
      return res.status(400).json({ 
        error: 'reply é obrigatório' 
      });
    }
    
    if (reply.trim().length < 3) {
      return res.status(400).json({ 
        error: 'Resposta deve ter pelo menos 3 caracteres' 
      });
    }
    
    if (reply.trim().length > 1000) {
      return res.status(400).json({ 
        error: 'Resposta deve ter no máximo 1000 caracteres' 
      });
    }
    
    const pool = await getConnection();
    
    const replyExists = await pool.request()
      .input('id', sql.BigInt, id)
      .query(`
        SELECT id, user_id, status, reply 
        FROM post_comment_replies 
        WHERE id = @id AND status != 'deleted'
      `);
    
    if (replyExists.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Resposta não encontrada' 
      });
    }
    
    const currentReply = replyExists.recordset[0];
    
    if (currentReply.user_id !== user_id) {
      return res.status(403).json({ 
        error: 'Acesso negado. Você só pode editar suas próprias respostas.' 
      });
    }
    
    const result = await pool.request()
      .input('id', sql.BigInt, id)
      .input('reply', sql.NVarChar, reply.trim())
      .query(`
        UPDATE post_comment_replies 
        SET reply = @reply, 
            updated_at = SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time'
        OUTPUT INSERTED.id, INSERTED.comment_id, INSERTED.user_id, INSERTED.reply, 
               INSERTED.status, INSERTED.created_at, INSERTED.updated_at
        WHERE id = @id
      `);
    
    res.json({
      message: 'Resposta atualizada com sucesso',
      reply: result.recordset[0]
    });
    
  } catch (error) {
    console.error('Erro ao atualizar resposta:', error);
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
    
    const replyExists = await pool.request()
      .input('id', sql.BigInt, id)
      .query(`
        SELECT id, user_id, status 
        FROM post_comment_replies 
        WHERE id = @id AND status != 'deleted'
      `);
    
    if (replyExists.recordset.length === 0) {
      return res.status(404).json({ 
        error: 'Resposta não encontrada' 
      });
    }
    
    const currentReply = replyExists.recordset[0];
    
    if (currentReply.user_id !== user_id) {
      return res.status(403).json({ 
        error: 'Acesso negado. Você só pode deletar suas próprias respostas.' 
      });
    }
    
    await pool.request()
      .input('id', sql.BigInt, id)
      .query(`
        UPDATE post_comment_replies 
        SET status = 'deleted', 
            deleted_at = SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time',
            updated_at = SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time'
        WHERE id = @id
      `);
    
    res.json({ 
      message: 'Resposta deletada com sucesso' 
    });
    
  } catch (error) {
    console.error('Erro ao deletar resposta:', error);
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
          c.comment_id,
          c.user_id,
          c.reply,
          c.status,
          c.created_at,
          c.updated_at,
          u.name,
          u.email
        FROM post_comment_replies c
        JOIN post_comments b ON b.id = c.comment_id
        JOIN users u ON u.id = c.user_id
        WHERE b.post_id = @post_id 
          AND c.status = 'active'
        ORDER BY c.created_at ASC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);
    
    const countResult = await pool.request()
      .input('post_id', sql.BigInt, post_id)
      .query(`
        SELECT COUNT(*) as total 
        FROM post_comment_replies c
        JOIN post_comments b ON b.id = c.comment_id
        WHERE b.post_id = @post_id AND c.status = 'active'
      `);
    
    res.json({
      replies: result.recordset,
      total: countResult.recordset[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Erro ao listar respostas do post:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
