import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { categories, products } from '../db/schema/products.js';

const categoriesRouter = new Hono();

const categoryIdSchema = z.object({
  id: z.string().transform((val) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) {
      throw new Error('Invalid category ID');
    }
    return parsed;
  }),
});

categoriesRouter.get('/', async (c) => {
  const allCategories = await db.query.categories.findMany({
    orderBy: (categories, { asc }) => [asc(categories.name)],
  });

  return c.json({
    success: true,
    data: allCategories,
  });
});

categoriesRouter.get('/:id', zValidator('param', categoryIdSchema), async (c) => {
  const { id } = c.req.valid('param');

  const category = await db.query.categories.findFirst({
    where: eq(categories.id, id),
  });

  if (!category) {
    return c.json(
      {
        success: false,
        error: 'Category not found',
      },
      404
    );
  }

  const productCountResult = await db
    .select({ count: count() })
    .from(products)
    .where(eq(products.categoryId, id));
  const productCount = productCountResult[0]?.count || 0;

  return c.json({
    success: true,
    data: {
      ...category,
      productCount,
    },
  });
});

export default categoriesRouter;
