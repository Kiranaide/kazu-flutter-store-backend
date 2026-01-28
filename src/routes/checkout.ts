import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { carts, cartItems, orders, orderItems, orderStatusHistory, products } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import type { JWTPayload, Variables } from '../middleware/auth.js';

const checkoutSchema = z.object({
  shippingAddress: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zip: z.string().min(1, 'Zip is required'),
    country: z.string().min(1, 'Country is required'),
  }),
  paymentMethod: z.literal('mock'),
});

const app = new Hono<{ Variables: Variables }>();

function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${random}`;
}

app.post('/', requireAuth, validateBody(checkoutSchema), async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const userId = parseInt(payload.sub);
  const body = c.req.valid('json' as never) as z.infer<typeof checkoutSchema>;

  const cartResult = await db
    .select()
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1);

  if (cartResult.length === 0) {
    return c.json({ success: false, error: 'Cart not found' }, 400);
  }

  const cart = cartResult[0];

  const cartItemsResult = await db
    .select({
      cartItem: cartItems,
      product: products,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cart.id));

  if (cartItemsResult.length === 0) {
    return c.json({ success: false, error: 'Cart is empty' }, 400);
  }

  for (const item of cartItemsResult) {
    if (item.product.stockQuantity < item.cartItem.quantity) {
      return c.json(
        {
          success: false,
          error: `Insufficient stock for ${item.product.name}. Available: ${item.product.stockQuantity}, Requested: ${item.cartItem.quantity}`,
        },
        400
      );
    }
  }

  let totalAmount = 0;
  for (const item of cartItemsResult) {
    totalAmount += Number(item.product.price) * item.cartItem.quantity;
  }

  const orderNumber = generateOrderNumber();

  const [order] = await db
    .insert(orders)
    .values({
      userId,
      orderNumber,
      totalAmount: totalAmount.toFixed(2),
      status: 'pending',
      shippingAddress: JSON.stringify(body.shippingAddress),
    })
    .returning();

  const orderItemsData = cartItemsResult.map((item) => ({
    orderId: order.id,
    productId: item.product.id,
    quantity: item.cartItem.quantity,
    priceAtTime: item.product.price,
    productName: item.product.name,
  }));

  await db.insert(orderItems).values(orderItemsData);

  for (const item of cartItemsResult) {
    await db
      .update(products)
      .set({
        stockQuantity: item.product.stockQuantity - item.cartItem.quantity,
      })
      .where(eq(products.id, item.product.id));
  }

  await db.insert(orderStatusHistory).values({
    orderId: order.id,
    status: 'pending',
    notes: 'Order created',
  });

  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));

  const orderItemsResult = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productName: orderItems.productName,
      quantity: orderItems.quantity,
      priceAtTime: orderItems.priceAtTime,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  const statusHistoryResult = await db
    .select({
      id: orderStatusHistory.id,
      status: orderStatusHistory.status,
      notes: orderStatusHistory.notes,
      createdAt: orderStatusHistory.createdAt,
    })
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, order.id))
    .orderBy(orderStatusHistory.createdAt);

  return c.json({
    success: true,
    data: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      shippingAddress: body.shippingAddress,
      items: orderItemsResult.map((item) => ({
        id: item.id,
        product: {
          id: item.productId,
          name: item.productName,
        },
        quantity: item.quantity,
        priceAtTime: Number(item.priceAtTime),
      })),
      statusHistory: statusHistoryResult,
      createdAt: order.createdAt,
    },
  }, 201);
});

export default app;
