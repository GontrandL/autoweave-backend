# E-commerce Backend Example

Complete e-commerce solution built with AutoWeave Backend.

## Overview

This example demonstrates a full e-commerce backend including:
- User management and authentication
- Product catalog service
- Shopping cart functionality
- Order processing pipeline
- Payment integration
- Inventory management
- Analytics and reporting
- Real-time notifications

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   User Service  │
│   (React/Vue)   │◄──►│   (AutoWeave)   │◄──►│   (Auth & User) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
            ┌───────▼──┐ ┌──────▼──┐ ┌─────▼──────┐
            │ Product  │ │ Cart    │ │ Order      │
            │ Service  │ │ Service │ │ Service    │
            └──────────┘ └─────────┘ └────────────┘
                    │           │           │
            ┌───────▼──┐ ┌──────▼──┐ ┌─────▼──────┐
            │ Inventory│ │ Payment │ │ Analytics  │
            │ Service  │ │ Service │ │ Service    │
            └──────────┘ └─────────┘ └────────────┘
```

## Services

### 1. User Service
- User registration/login
- Profile management
- Address management
- Authentication

### 2. Product Service
- Product catalog
- Categories and search
- Reviews and ratings
- Pricing and discounts

### 3. Cart Service
- Shopping cart management
- Cart persistence
- Cart sharing

### 4. Order Service
- Order creation and processing
- Order status tracking
- Order history

### 5. Inventory Service
- Stock management
- Inventory tracking
- Low stock alerts

### 6. Payment Service
- Payment processing
- Payment methods
- Refund handling

### 7. Analytics Service
- Sales analytics
- User behavior tracking
- Performance metrics

## Setup

### Prerequisites

```bash
# Start AutoWeave Backend
npm start

# Start monitoring
npm run monitoring:start
```

### Run the Example

```bash
cd examples/10-ecommerce-backend
npm install
npm start
```

## Implementation

### Service Registration

```javascript
// services/user-service.js
export class UserService {
  async register() {
    const serviceConfig = {
      name: 'user-service',
      description: 'User management and authentication',
      endpoints: [
        { path: '/users', method: 'POST', description: 'Create user' },
        { path: '/users/:id', method: 'GET', description: 'Get user' },
        { path: '/users/:id', method: 'PUT', description: 'Update user' },
        { path: '/auth/login', method: 'POST', description: 'User login' },
        { path: '/auth/logout', method: 'POST', description: 'User logout' }
      ],
      config: {
        port: 3100,
        healthCheck: '/health',
        tags: ['user', 'auth', 'ecommerce']
      }
    };

    return this.autoweave.registerService(serviceConfig);
  }

  async createUser(userData) {
    // Validate user data
    const validatedData = await this.validateUserData(userData);
    
    // Hash password
    const hashedPassword = await this.hashPassword(validatedData.password);
    
    // Create user in database
    const user = await this.db.users.create({
      ...validatedData,
      password: hashedPassword,
      createdAt: new Date()
    });

    // Track analytics
    await this.analytics.track({
      event: 'user_created',
      userId: user.id,
      properties: {
        registrationMethod: 'email',
        userAgent: userData.userAgent
      }
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user);

    return user;
  }
}
```

### Product Service

```javascript
// services/product-service.js
export class ProductService {
  async getProducts(filters = {}) {
    const { category, minPrice, maxPrice, search, page = 1, limit = 20 } = filters;
    
    // Build query
    let query = this.db.products.find();
    
    if (category) query = query.where('category', category);
    if (minPrice) query = query.where('price', '>=', minPrice);
    if (maxPrice) query = query.where('price', '<=', maxPrice);
    if (search) {
      query = query.where({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Execute with pagination
    const products = await query
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Track search analytics
    if (search) {
      await this.analytics.track({
        event: 'product_search',
        properties: { search, resultsCount: products.length }
      });
    }

    return products;
  }

  async updateInventory(productId, quantity) {
    // Update product inventory
    const product = await this.db.products.findByIdAndUpdate(
      productId,
      { $inc: { inventory: -quantity } },
      { new: true }
    );

    // Check for low stock
    if (product.inventory < product.lowStockThreshold) {
      await this.eventBus.publish('inventory.low_stock', {
        productId: product.id,
        currentStock: product.inventory,
        threshold: product.lowStockThreshold
      });
    }

    return product;
  }
}
```

### Order Processing Pipeline

```javascript
// pipelines/order-processing.js
export class OrderProcessingPipeline {
  async setup() {
    const pipelineConfig = {
      name: 'order-processing',
      description: 'Process customer orders from cart to fulfillment',
      steps: [
        { name: 'validate-order', function: 'validateOrder' },
        { name: 'check-inventory', function: 'checkInventory' },
        { name: 'process-payment', function: 'processPayment' },
        { name: 'create-order', function: 'createOrder' },
        { name: 'update-inventory', function: 'updateInventory' },
        { name: 'send-confirmation', function: 'sendConfirmation' },
        { name: 'queue-fulfillment', function: 'queueFulfillment' }
      ],
      config: {
        retryAttempts: 3,
        timeout: 30000,
        parallelSteps: ['send-confirmation', 'queue-fulfillment']
      }
    };

    return this.dataPipeline.createPipeline(pipelineConfig);
  }

  async validateOrder(data) {
    const { cartId, userId, shippingAddress, paymentMethod } = data;

    // Validate cart exists and belongs to user
    const cart = await this.cartService.getCart(cartId, userId);
    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty or invalid');
    }

    // Validate shipping address
    if (!shippingAddress || !shippingAddress.street || !shippingAddress.city) {
      throw new Error('Invalid shipping address');
    }

    // Validate payment method
    if (!paymentMethod || !paymentMethod.type) {
      throw new Error('Invalid payment method');
    }

    return { cart, shippingAddress, paymentMethod };
  }

  async checkInventory(data) {
    const { cart } = data;
    const unavailableItems = [];

    for (const item of cart.items) {
      const product = await this.productService.getProduct(item.productId);
      if (product.inventory < item.quantity) {
        unavailableItems.push({
          productId: item.productId,
          requested: item.quantity,
          available: product.inventory
        });
      }
    }

    if (unavailableItems.length > 0) {
      throw new Error(`Insufficient inventory: ${JSON.stringify(unavailableItems)}`);
    }

    return data;
  }

  async processPayment(data) {
    const { cart, paymentMethod } = data;
    
    const paymentRequest = {
      amount: cart.total,
      currency: 'USD',
      paymentMethod: paymentMethod,
      description: `Order for user ${cart.userId}`
    };

    const paymentResult = await this.paymentService.processPayment(paymentRequest);
    
    if (!paymentResult.success) {
      throw new Error(`Payment failed: ${paymentResult.error}`);
    }

    return { ...data, paymentResult };
  }

  async createOrder(data) {
    const { cart, shippingAddress, paymentResult } = data;

    const order = await this.orderService.createOrder({
      userId: cart.userId,
      items: cart.items,
      shippingAddress,
      paymentId: paymentResult.paymentId,
      total: cart.total,
      status: 'confirmed',
      createdAt: new Date()
    });

    // Track order analytics
    await this.analytics.track({
      event: 'order_created',
      userId: cart.userId,
      properties: {
        orderId: order.id,
        total: order.total,
        itemCount: order.items.length
      }
    });

    return { ...data, order };
  }

  async updateInventory(data) {
    const { order } = data;

    for (const item of order.items) {
      await this.productService.updateInventory(item.productId, item.quantity);
    }

    return data;
  }

  async sendConfirmation(data) {
    const { order } = data;
    
    await this.emailService.sendOrderConfirmation({
      userId: order.userId,
      orderId: order.id,
      items: order.items,
      total: order.total
    });

    return data;
  }

  async queueFulfillment(data) {
    const { order } = data;
    
    await this.eventBus.publish('fulfillment.order_ready', {
      orderId: order.id,
      items: order.items,
      shippingAddress: order.shippingAddress,
      priority: this.calculatePriority(order)
    });

    return data;
  }
}
```

### Analytics Dashboard

```javascript
// analytics/ecommerce-analytics.js
export class EcommerceAnalytics {
  async getDashboardData(timeRange = '7d') {
    const [
      salesMetrics,
      userMetrics,
      productMetrics,
      conversionMetrics
    ] = await Promise.all([
      this.getSalesMetrics(timeRange),
      this.getUserMetrics(timeRange),
      this.getProductMetrics(timeRange),
      this.getConversionMetrics(timeRange)
    ]);

    return {
      sales: salesMetrics,
      users: userMetrics,
      products: productMetrics,
      conversion: conversionMetrics,
      timestamp: new Date().toISOString()
    };
  }

  async getSalesMetrics(timeRange) {
    const timeFilter = this.buildTimeFilter(timeRange);
    
    const [revenue, orders, avgOrderValue] = await Promise.all([
      this.analyticsEngine.getMetric('order_total_sum', timeFilter),
      this.analyticsEngine.getMetric('order_count', timeFilter),
      this.analyticsEngine.getMetric('order_average_value', timeFilter)
    ]);

    return {
      revenue: revenue.value,
      orders: orders.value,
      avgOrderValue: avgOrderValue.value,
      revenueGrowth: await this.calculateGrowth('revenue', timeRange),
      ordersGrowth: await this.calculateGrowth('orders', timeRange)
    };
  }

  async getUserMetrics(timeRange) {
    const timeFilter = this.buildTimeFilter(timeRange);
    
    const [newUsers, activeUsers, retention] = await Promise.all([
      this.analyticsEngine.getMetric('user_registrations', timeFilter),
      this.analyticsEngine.getMetric('active_users', timeFilter),
      this.calculateRetentionRate(timeRange)
    ]);

    return {
      newUsers: newUsers.value,
      activeUsers: activeUsers.value,
      retentionRate: retention,
      userGrowth: await this.calculateGrowth('users', timeRange)
    };
  }

  async getConversionFunnel() {
    const funnelSteps = [
      'product_view',
      'add_to_cart',
      'checkout_start',
      'payment_start',
      'order_complete'
    ];

    const funnelData = await this.analyticsEngine.analyzeFunnel({
      steps: funnelSteps,
      timeRange: '7d'
    });

    return funnelData;
  }
}
```

## Event-Driven Architecture

### Event Handlers

```javascript
// events/order-events.js
export class OrderEventHandlers {
  constructor(eventBus, services) {
    this.eventBus = eventBus;
    this.services = services;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Order events
    this.eventBus.subscribe('order.created', this.handleOrderCreated.bind(this));
    this.eventBus.subscribe('order.cancelled', this.handleOrderCancelled.bind(this));
    
    // Inventory events
    this.eventBus.subscribe('inventory.low_stock', this.handleLowStock.bind(this));
    
    // Payment events
    this.eventBus.subscribe('payment.failed', this.handlePaymentFailed.bind(this));
    this.eventBus.subscribe('payment.refunded', this.handlePaymentRefunded.bind(this));
  }

  async handleOrderCreated(event) {
    const { orderId, userId, total } = event.data;

    // Update user lifetime value
    await this.services.user.updateLifetimeValue(userId, total);

    // Send to CRM
    await this.services.crm.createOrder({
      orderId,
      userId,
      total,
      timestamp: event.timestamp
    });

    // Trigger marketing automation
    await this.services.marketing.triggerOrderConfirmation(userId, orderId);
  }

  async handleLowStock(event) {
    const { productId, currentStock, threshold } = event.data;

    // Notify inventory team
    await this.services.notification.send({
      to: 'inventory@company.com',
      subject: 'Low Stock Alert',
      template: 'low-stock',
      data: { productId, currentStock, threshold }
    });

    // Auto-reorder if configured
    const product = await this.services.product.getProduct(productId);
    if (product.autoReorder) {
      await this.services.procurement.createPurchaseOrder({
        productId,
        quantity: product.reorderQuantity
      });
    }
  }
}
```

## API Examples

### Creating an Order

```bash
# 1. Add items to cart
curl -X POST http://localhost:3001/api/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod_123",
    "quantity": 2,
    "userId": "user_456"
  }'

# 2. Process order
curl -X POST http://localhost:3001/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cartId": "cart_789",
    "shippingAddress": {
      "street": "123 Main St",
      "city": "Boston",
      "state": "MA",
      "zip": "02101"
    },
    "paymentMethod": {
      "type": "credit_card",
      "token": "card_token_123"
    }
  }'
```

### Analytics Queries

```bash
# Get sales dashboard
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/analytics/dashboard?timeRange=7d

# Get conversion funnel
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/analytics/funnel

# Track custom event
curl -X POST http://localhost:3001/api/analytics/track \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "product_view",
    "userId": "user_123",
    "properties": {
      "productId": "prod_456",
      "category": "electronics",
      "price": 99.99
    }
  }'
```

## Monitoring

### Business Metrics

The example includes comprehensive monitoring:

- **Sales Metrics**: Revenue, orders, conversion rates
- **Performance Metrics**: Response times, error rates
- **System Metrics**: Resource usage, database performance
- **Custom Alerts**: Low stock, payment failures, system errors

### Grafana Dashboards

Custom dashboards for:
- E-commerce Overview
- Sales Performance
- User Analytics
- System Health

## Testing

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Load tests
npm run test:load
```

### Test Data

```javascript
// Generate test data
npm run seed:data

// This creates:
// - 1000 test products
// - 100 test users
// - 500 test orders
// - Analytics events
```

## Deployment

### Production Setup

```bash
# Build for production
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Set up monitoring
npm run monitoring:start
```

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ecommerce

# Redis
REDIS_URL=redis://localhost:6379

# Payment
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
SENDGRID_API_KEY=SG...

# Analytics
ANALYTICS_ENABLED=true
```

## Next Steps

1. Add more payment providers
2. Implement advanced analytics
3. Add machine learning recommendations
4. Set up multi-region deployment
5. Implement advanced security features

This example demonstrates how AutoWeave Backend can power a complete e-commerce solution with microservices, event-driven architecture, and comprehensive monitoring.