const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Blog Platform API',
        version: '1.0.0',
        description: 'A blog/content platform with nested comments, tag filtering, full-text search, and an aggregation-based trending endpoint.',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    apis: ['./src/routes/*.js'],
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/api/auth', authRoutes);
  app.use('/api/posts', postRoutes);

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Must be registered last -- Express routes errors here from any
  // earlier middleware/handler that calls next(err).
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
