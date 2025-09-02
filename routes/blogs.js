const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');


router.post('/', async (req, res) => {
  try {
    const { title, slug, content, cover_image, author_id, status = 'draft' } = req.body;
    
    if (!title || !slug || !content || !author_id) {
      return res.status(400).json({ 
        error: 'Título, slug, conteúdo e author_id são obrigatórios' 
      });
    }
    
    if (status && !['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ 
        error: 'Status deve ser: draft, published ou archived' 
      });
    }
    
    const pool = await getConnection();
    
    const existingSlug = await pool.request()
      .input('slug', sql.NVarChar, slug)
      .query('SELECT id FROM posts WHERE slug = @slug');
    
    if (existingSlug.recordset.length > 0) {
      return res.status(400).json({ 
        error: 'Este slug já está em uso' 
      });
    }
    
    const result = await pool.request()
      .input('title', sql.NVarChar, title.trim())
      .input('slug', sql.NVarChar, slug.trim())
      .input('content', sql.NVarChar, content.trim())
      .input('cover_image', sql.NVarChar, cover_image ? cover_image.trim() : null)
      .input('author_id', sql.BigInt, author_id)
      .input('status', sql.NVarChar, status)
      .query(`
        INSERT INTO posts (title, slug, content, cover_image, author_id, status, created_at, updated_at)
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.slug, INSERTED.content, INSERTED.cover_image, 
               INSERTED.author_id, INSERTED.status, INSERTED.created_at, INSERTED.updated_at
        VALUES (@title, @slug, @content, @cover_image, @author_id, @status, SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time', SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time')
      `);
    
    const newPost = result.recordset[0];
    
    res.status(201).json(newPost);
    
  } catch (error) {
    console.error('Erro ao criar post:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, author_id, limit = 10, offset = 0 } = req.query;
    
    const pool = await getConnection();
    
    let whereClause = '';
    let inputs = [];
    
    if (status) {
      whereClause += ' WHERE status = @status';
      inputs.push({ name: 'status', type: sql.NVarChar, value: status });
    }
    
    if (author_id) {
      whereClause += whereClause ? ' AND author_id = @author_id' : ' WHERE author_id = @author_id';
      inputs.push({ name: 'author_id', type: sql.BigInt, value: author_id });
    }
    
    const request = pool.request();
    inputs.forEach(input => {
      request.input(input.name, input.type, input.value);
    });
    
    const result = await request
      .input('limit', sql.Int, parseInt(limit))
      .input('offset', sql.Int, parseInt(offset))
      .query(`
        SELECT id, title, slug, content, cover_image, author_id, status, created_at, updated_at
        FROM posts
        ${whereClause}
        ORDER BY created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);
    
    const countRequest = pool.request();
    inputs.forEach(input => {
      countRequest.input(input.name, input.type, input.value);
    });
    
    const countResult = await countRequest
      .query(`SELECT COUNT(*) as total FROM posts ${whereClause}`);
    
    res.json({
      posts: result.recordset,
      total: countResult.recordset[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Erro ao listar posts:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('slug', sql.NVarChar, slug)
      .query(`
        SELECT id, title, slug, content, cover_image, author_id, status, created_at, updated_at
        FROM posts
        WHERE slug = @slug
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }
    
    res.json(result.recordset[0]);
    
  } catch (error) {
    console.error('Erro ao buscar post:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/id/:id', async (req, res) => {
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
        SELECT id, title, slug, content, cover_image, author_id, status, created_at, updated_at
        FROM posts
        WHERE id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }
    
    res.json(result.recordset[0]);
    
  } catch (error) {
    console.error('Erro ao buscar post por ID:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, content, cover_image, author_id, status } = req.body;
    
    if (!title && !slug && !content && !cover_image && !author_id && !status) {
      return res.status(400).json({ 
        error: 'Pelo menos um campo deve ser fornecido para atualização' 
      });
    }
    
    if (status && !['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ 
        error: 'Status deve ser: draft, published ou archived' 
      });
    }
    
    const pool = await getConnection();
    
    const postExists = await pool.request()
      .input('id', sql.BigInt, id)
      .query('SELECT id FROM posts WHERE id = @id');
    
    if (postExists.recordset.length === 0) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }
    
    if (slug) {
      const existingSlug = await pool.request()
        .input('slug', sql.NVarChar, slug)
        .input('id', sql.BigInt, id)
        .query('SELECT id FROM posts WHERE slug = @slug AND id != @id');
      
      if (existingSlug.recordset.length > 0) {
        return res.status(400).json({ 
          error: 'Este slug já está em uso' 
        });
      }
    }
    
    let updateFields = [];
    let inputs = [];
    
    if (title) {
      updateFields.push('title = @title');
      inputs.push({ name: 'title', type: sql.NVarChar, value: title.trim() });
    }
    
    if (slug) {
      updateFields.push('slug = @slug');
      inputs.push({ name: 'slug', type: sql.NVarChar, value: slug.trim() });
    }
    
    if (content) {
      updateFields.push('content = @content');
      inputs.push({ name: 'content', type: sql.NVarChar, value: content.trim() });
    }
    
    if (cover_image !== undefined) {
      updateFields.push('cover_image = @cover_image');
      inputs.push({ name: 'cover_image', type: sql.NVarChar, value: cover_image ? cover_image.trim() : null });
    }
    
    if (author_id) {
      updateFields.push('author_id = @author_id');
      inputs.push({ name: 'author_id', type: sql.BigInt, value: author_id });
    }
    
    if (status) {
      updateFields.push('status = @status');
      inputs.push({ name: 'status', type: sql.NVarChar, value: status });
    }
    
    updateFields.push('updated_at = SYSDATETIME()');
    
    inputs.push({ name: 'id', type: sql.BigInt, value: id });
    
    const request = pool.request();
    inputs.forEach(input => {
      request.input(input.name, input.type, input.value);
    });
    
    const result = await request
      .query(`
        UPDATE posts 
        SET ${updateFields.join(', ')}
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.slug, INSERTED.content, INSERTED.cover_image,
               INSERTED.author_id, INSERTED.status, INSERTED.created_at, INSERTED.updated_at
        WHERE id = @id
      `);
    
    res.json(result.recordset[0]);
    
  } catch (error) {
    console.error('Erro ao atualizar post:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.patch('/:id/change-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        error: 'Status é obrigatório' 
      });
    }
    
    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ 
        error: 'Status deve ser: draft, published ou archived' 
      });
    }
    
    const pool = await getConnection();
    
    const postExists = await pool.request()
      .input('id', sql.BigInt, id)
      .query('SELECT id, status FROM posts WHERE id = @id');
    
    if (postExists.recordset.length === 0) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }
    
    const currentPost = postExists.recordset[0];
    
    if (currentPost.status === status) {
      return res.status(400).json({ 
        error: `O post já está com status '${status}'` 
      });
    }
    
    const result = await pool.request()
      .input('id', sql.BigInt, id)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE posts 
        SET status = @status, updated_at = SYSDATETIME()
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.slug, INSERTED.content, INSERTED.cover_image,
               INSERTED.author_id, INSERTED.status, INSERTED.created_at, INSERTED.updated_at
        WHERE id = @id
      `);
    
    const updatedPost = result.recordset[0];
    
    res.json({
      message: `Status alterado de '${currentPost.status}' para '${status}' com sucesso`,
      post: updatedPost
    });
    
  } catch (error) {
    console.error('Erro ao alterar status do post:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
