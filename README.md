# Product Store API

A complete e-commerce API For my learning flutter apps built with Hono, Drizzle ORM, and PostgreSQL (Supabase).

## Features

- **Authentication**: JWT-based auth with role-based access control (customer/admin)
- **Product Catalog**: Browse products with categories, pagination, filtering, and sorting
- **Shopping Cart**: Guest and user cart support with 7-day expiration
- **Checkout**: Mock checkout with inventory management
- **Order History**: Track orders with status updates
- **File Uploads**: Product images stored in Supabase Storage
- **Admin Panel**: Manage products, categories, and view orders

## Tech Stack

- **Framework**: [Hono](https://hono.dev) - Fast, lightweight web framework
- **ORM**: [Drizzle ORM](https://orm.drizzle.team) - Type-safe SQL
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage
- **Validation**: Zod
- **Authentication**: JWT

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database (Supabase recommended)
- Supabase account with Storage bucket

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your credentials:
   ```env
   DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
   SUPABASE_URL=https://[project-ref].supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_BUCKET_NAME=product-images
   JWT_SECRET=your-super-secret-jwt-key
   PORT=3000
   ```

5. Run database migrations:
   ```bash
   bun run db:migrate
   ```

6. Seed the database:
   ```bash
   bun run db:seed
   ```

7. Start the development server:
   ```bash
   bun run dev
   ```

## API Documentation

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login and get JWT | No |
| POST | `/auth/logout` | Logout user | Yes |
| GET | `/auth/me` | Get current user | Yes |

**Register:**
```json
POST /auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "phone": "+1234567890"
}
```

**Login:**
```json
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Products

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/products` | List all products | No |
| GET | `/products/:id` | Get product details | No |
| GET | `/products/category/:categoryId` | Get products by category | No |
| POST | `/admin/products` | Create product | Admin |
| PUT | `/admin/products/:id` | Update product | Admin |
| DELETE | `/admin/products/:id` | Delete product | Admin |
| POST | `/admin/products/:id/images` | Upload product images | Admin |

**Query Parameters for `/products`:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `categoryId` - Filter by category
- `minPrice` - Minimum price
- `maxPrice` - Maximum price
- `search` - Search by name
- `sortBy` - Sort field (price, createdAt)
- `sortOrder` - Sort order (asc, desc)

### Categories

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/categories` | List all categories | No |
| GET | `/categories/:id` | Get category details | No |
| POST | `/admin/categories` | Create category | Admin |

### Cart

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/cart` | Get current cart | No* |
| POST | `/cart/items` | Add item to cart | No* |
| PUT | `/cart/items/:id` | Update item quantity | No* |
| DELETE | `/cart/items/:id` | Remove item from cart | No* |
| DELETE | `/cart` | Clear cart | No* |

*Guest carts use session cookies. User carts require authentication.

**Add to Cart:**
```json
POST /cart/items
{
  "productId": 1,
  "quantity": 2
}
```

### Checkout

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/checkout` | Process checkout | Yes |

**Checkout:**
```json
POST /checkout
{
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "USA"
  },
  "paymentMethod": "mock"
}
```

### Orders

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/orders` | List user orders | Yes |
| GET | `/orders/:id` | Get order details | Yes |
| GET | `/orders/:id/status` | Get order status history | Yes |

## Default Users

After running the seed script, you can log in with:

- **Admin**: `admin@example.com` / `admin123`
- **Customer**: `customer@example.com` / `customer123`

## Database Schema

### Tables

- **users** - User accounts with roles (customer/admin)
- **categories** - Product categories
- **products** - Product catalog with inventory tracking
- **product_images** - Product images stored in Supabase
- **carts** - Shopping carts (guest and user)
- **cart_items** - Items in carts
- **orders** - Completed orders
- **order_items** - Items in orders
- **order_status_history** - Order status timeline

## Cart Expiration

Guest carts expire after 7 days of inactivity. The expiration is reset on every cart operation.

## Development

### Available Scripts

```bash
# Development server with hot reload
bun run dev

# Build for production
bun run build

# Run migrations
bun run db:migrate

# Generate migrations
bun run db:generate

# Seed database
bun run db:seed

# Type check
bun run typecheck
```

### Project Structure

```
src/
├── db/
│   ├── index.ts          # Database connection
│   ├── schema.ts         # Database schema
│   └── schema/           # Individual schema files
├── middleware/
│   ├── auth.ts           # JWT authentication
│   ├── error-handler.ts  # Global error handling
│   └── validation.ts     # Zod validation
├── routes/
│   ├── auth.ts           # Authentication routes
│   ├── products.ts       # Product routes
│   ├── categories.ts     # Category routes
│   ├── cart.ts           # Cart routes
│   ├── checkout.ts       # Checkout routes
│   └── orders.ts         # Order routes
├── utils/
│   ├── jwt.ts            # JWT utilities
│   ├── password.ts       # Password hashing
│   └── storage.ts        # Supabase storage
└── index.ts              # App entry point
```

## Deployment

### Vercel

This project is configured for Vercel deployment:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Environment Variables for Production

Make sure to set these environment variables in your hosting platform:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET_NAME`
- `JWT_SECRET`

## License

MIT
