import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { errorHandler } from './middleware/error-handler.js'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import categoryRoutes from './routes/categories.js'
import cartRoutes from './routes/cart.js'
import checkoutRoutes from './routes/checkout.js'
import orderRoutes from './routes/orders.js'
import { Scalar } from '@scalar/hono-api-reference'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:8080'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
app.use('*', secureHeaders())

// Error handler
app.onError(errorHandler)

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Product Store API'
  })
})

// API Routes
app.route('/auth', authRoutes)
app.route('/products', productRoutes)
app.route('/categories', categoryRoutes)
app.route('/cart', cartRoutes)
app.route('/checkout', checkoutRoutes)
app.route('/orders', orderRoutes)

// 404 handler
app.notFound((c) => {
  return c.json({ 
    success: false, 
    error: 'Not Found',
    message: 'The requested resource was not found'
  }, 404)
})

// Scalar Open API
app.get("/scalar", Scalar((c) => {
  return {
    url: "/docs",
    theme: "purple",
  }
}))

export default app
