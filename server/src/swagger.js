const swaggerJsdoc = require('swagger-jsdoc');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Miis Restaurant OS API',
      version: '1.0.0',
      description: 'API used by the customer-facing ordering flow (QR menu, cart, payment) and by restaurant/admin auth. Intended as the reference for the upcoming mobile app.',
    },
    servers: [{ url: '/api', description: 'Current server' }],
    tags: [
      { name: 'Auth', description: 'Admin and restaurant login' },
      { name: 'Public', description: 'Customer-facing: menu, cart, orders, payment (no login required)' },
    ],
  },
  apis: ['./src/routes/*.js'],
});

module.exports = spec;
