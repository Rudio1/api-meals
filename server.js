const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config();

const { authenticateApiKey } = require('./middleware/auth');
const usersRouter = require('./routes/users');
const mealTypesRouter = require('./routes/meal-types');
const mealsRouter = require('./routes/meals');
const measurementUnitsRouter = require('./routes/measurement-units');
const postsRouter = require('./routes/blogs');
  
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Meals - Sistema de Gerenciamento de Refeições',
      version: '1.0.0',
      description: 'API completa para gerenciamento de usuários, categorias e refeições',
      contact: {
        name: 'Desenvolvedor',
        email: 'dev@example.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Servidor de Desenvolvimento'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API Key para autenticação'
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ]
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    message: 'Bem-vindo à API Meals!',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      mealTypes: '/api/meal-types',
      meals: '/api/meals',
      measurementUnits: '/api/measurement-units',
      posts: '/api/posts',
      swagger: '/api-docs'
    },
    note: 'Todas as rotas da API requerem o header x-api-key'
  });
});

// Aplicar middleware de autenticação em todas as rotas da API
app.use('/api', authenticateApiKey);
app.use('/api/users', usersRouter);
app.use('/api/meal-types', mealTypesRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/measurement-units', measurementUnitsRouter);
app.use('/api/posts', postsRouter);

app.use('/api-docs', authenticateApiKey, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Algo deu errado!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Documentação Swagger disponível em: http://localhost:${PORT}/api-docs`);
  console.log(`Usuários: http://localhost:${PORT}/api/users`);
  console.log(`Categorias: http://localhost:${PORT}/api/meal-types`);
  console.log(`Refeições: http://localhost:${PORT}/api/meals`);
  console.log(`Posts: http://localhost:${PORT}/api/posts`);
  console.log(`Todas as rotas da API requerem o header x-api-key`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Encerrando servidor...');
  process.exit(0);
});
