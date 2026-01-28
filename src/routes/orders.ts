import { Hono } from 'hono';
import { eq, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { orders, orderItems, orderStatusHistory, products } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery, validateParams } from '../middleware/validation.js';
import type { JWTPayload, Variables } from '../middleware/auth.js';

const orderQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
});

const orderIdParamsSchema = z.object({
  id: z.coerce.number().min(1),
});

const app = new Hono<{ Variables: Variables }>();

app.get('/', requireAuth, validateQuery(orderQuerySchema), async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const userId = parseInt(payload.sub);
  const query = c.req.valid('query' as never) as z.infer<typeof orderQuerySchema>;
  const { page, limit, status } = query;
  const offset = (page - 1) * limit;

  let whereClause = eq(orders.userId, userId);
  if (status) {
    whereClause = and(eq(orders.userId, userId), eq(orders.status, status)) as typeof whereClause;
  }

  const ordersResult = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalAmount: orders.totalAmount,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(whereClause);

  const total = Number(countResult[0]?.count || 0);

  const ordersWithItemCount = await Promise.all(
    ordersResult.map(async (order) => {
      const itemCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        itemCount: Number(itemCountResult[0]?.count || 0),
        createdAt: order.createdAt,
      };
    })
  );

  return c.json({
    success: true,
    data: {
      orders: ordersWithItemCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

app.get('/:id', requireAuth, validateParams(orderIdParamsSchema), async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const userId = parseInt(payload.sub);
  const { id } = c.req.valid('param' as never) as z.infer<typeof orderIdParamsSchema>;

  const orderResult = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (orderResult.length === 0) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  const order = orderResult[0];

  if (order.userId !== userId) {
    return c.json({ success: false, error: 'Forbidden: Access denied' }, 403);
  }

  const orderItemsResult = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productName: orderItems.productName,
      quantity: orderItems.quantity,
      priceAtTime: orderItems.priceAtTime,
      productIdJoin: products.id,
      productNameJoin: products.name,
      productSlug: products.slug,
      productDescription: products.description,
      productPrice: products.price,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, id));

  const statusHistoryResult = await db
    .select({
      id: orderStatusHistory.id,
      status: orderStatusHistory.status,
      notes: orderStatusHistory.notes,
      createdAt: orderStatusHistory.createdAt,
    })
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, id))
    .orderBy(orderStatusHistory.createdAt);

  return c.json({
    success: true,
    data: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : null,
      items: orderItemsResult.map((item) => ({
        id: item.id,
        product: item.productIdJoin
          ? {
              id: item.productIdJoin,
              name: item.productNameJoin,
              slug: item.productSlug,
              description: item.productDescription,
              price: Number(item.productPrice),
            }
          : {
              id: item.productId,
              name: item.productName || 'Unknown Product',
            },
        quantity: item.quantity,
        priceAtTime: Number(item.priceAtTime),
      })),
      statusHistory: statusHistoryResult,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
  });
});

app.get('/:id/status', requireAuth, validateParams(orderIdParamsSchema), async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const userId = parseInt(payload.sub);
  const { id } = c.req.valid('param' as never) as z.infer<typeof orderIdParamsSchema>;

  const orderResult = await db
    .select({ id: orders.id, userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (orderResult.length === 0) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  const order = orderResult[0];

  if (order.userId !== userId) {
    return c.json({ success: false, error: 'Forbidden: Access denied' }, 403);
  }

  const statusHistoryResult = await db
    .select({
      id: orderStatusHistory.id,
      status: orderStatusHistory.status,
      notes: orderStatusHistory.notes,
      createdAt: orderStatusHistory.createdAt,
    })
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, id))
    .orderBy(orderStatusHistory.createdAt);

  return c.json({
    success: true,
    data: {
      orderId: id,
      timeline: statusHistoryResult,
    },
  });
});

function and<T>(...conditions: T[]): T {
  return conditions.reduce((acc, curr) => {
    if (acc === undefined) return curr;
    return sql`${acc} AND ${curr}` as unknown as T;
  }, undefined as unknown as T);
}

export default app;
