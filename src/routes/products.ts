import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, gte, lte, like, desc, asc, sql, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, categories, productImages } from '../db/schema/products.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  productIdSchema,
  categoryIdSchema,
  imageIdSchema,
} from '../schemas/product.js';
import { createSupabaseClient } from '../utils/supabase.js';

const productsRouter = new Hono();

const buildProductQuery = (query: {
  page: string;
  limit: string;
  categoryId?: string;
  minPrice?: string;
  maxPrice?: string;
  search?: string;
  sortBy: 'price' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (query.categoryId) {
    conditions.push(eq(products.categoryId, parseInt(query.categoryId, 10)));
  }

  if (query.minPrice) {
    conditions.push(gte(products.price, parseFloat(query.minPrice)));
  }

  if (query.maxPrice) {
    conditions.push(lte(products.price, parseFloat(query.maxPrice)));
  }

  if (query.search) {
    conditions.push(like(products.name, `%${query.search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy =
    query.sortBy === 'price'
      ? query.sortOrder === 'asc'
        ? asc(products.price)
        : desc(products.price)
      : query.sortOrder === 'asc'
        ? asc(products.createdAt)
        : desc(products.createdAt);

  return { whereClause, orderBy, page, limit, offset };
};

productsRouter.get('/', zValidator('query', productQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const { whereClause, orderBy, page, limit, offset } = buildProductQuery(query);

  const totalResult = await db
    .select({ count: count() })
    .from(products)
    .where(whereClause);
  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  const productsList = await db.query.products.findMany({
    where: whereClause,
    orderBy: [orderBy],
    limit,
    offset,
    with: {
      category: true,
      images: true,
    },
  });

  return c.json({
    success: true,
    data: {
      products: productsList,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
  });
});

productsRouter.get('/:id', zValidator('param', productIdSchema), async (c) => {
  const { id } = c.req.valid('param');

  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      category: true,
      images: true,
    },
  });

  if (!product) {
    return c.json(
      {
        success: false,
        error: 'Product not found',
      },
      404
    );
  }

  return c.json({
    success: true,
    data: product,
  });
});

productsRouter.get(
  '/category/:categoryId',
  zValidator('param', categoryIdSchema),
  zValidator('query', productQuerySchema),
  async (c) => {
    const { categoryId } = c.req.valid('param');
    const query = c.req.valid('query');

    const queryWithCategory = {
      ...query,
      categoryId: categoryId.toString(),
    };

    const { whereClause, orderBy, page, limit, offset } =
      buildProductQuery(queryWithCategory);

    const totalResult = await db
      .select({ count: count() })
      .from(products)
      .where(whereClause);
    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const productsList = await db.query.products.findMany({
      where: whereClause,
      orderBy: [orderBy],
      limit,
      offset,
      with: {
        category: true,
        images: true,
      },
    });

    return c.json({
      success: true,
      data: {
        products: productsList,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });
  }
);

productsRouter.post(
  '/admin/products',
  requireAuth,
  requireRole(['admin']),
  zValidator('json', createProductSchema),
  async (c) => {
    const data = c.req.valid('json');

    const existingProduct = await db.query.products.findFirst({
      where: eq(products.slug, data.slug),
    });

    if (existingProduct) {
      return c.json(
        {
          success: false,
          error: 'Product with this slug already exists',
        },
        409
      );
    }

    const category = await db.query.categories.findFirst({
      where: eq(categories.id, data.categoryId),
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

    const [newProduct] = await db
      .insert(products)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    return c.json(
      {
        success: true,
        data: newProduct,
      },
      201
    );
  }
);

productsRouter.put(
  '/admin/products/:id',
  requireAuth,
  requireRole(['admin']),
  zValidator('param', productIdSchema),
  zValidator('json', updateProductSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');

    const existingProduct = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!existingProduct) {
      return c.json(
        {
          success: false,
          error: 'Product not found',
        },
        404
      );
    }

    if (data.slug && data.slug !== existingProduct.slug) {
      const slugExists = await db.query.products.findFirst({
        where: eq(products.slug, data.slug),
      });

      if (slugExists) {
        return c.json(
          {
            success: false,
            error: 'Product with this slug already exists',
          },
          409
        );
      }
    }

    if (data.categoryId) {
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, data.categoryId),
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
    }

    const [updatedProduct] = await db
      .update(products)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    return c.json({
      success: true,
      data: updatedProduct,
    });
  }
);

productsRouter.delete(
  '/admin/products/:id',
  requireAuth,
  requireRole(['admin']),
  zValidator('param', productIdSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const existingProduct = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!existingProduct) {
      return c.json(
        {
          success: false,
          error: 'Product not found',
        },
        404
      );
    }

    await db.delete(products).where(eq(products.id, id));

    return c.json({
      success: true,
      message: 'Product deleted successfully',
    });
  }
);

productsRouter.post(
  '/admin/products/:id/images',
  requireAuth,
  requireRole(['admin']),
  zValidator('param', productIdSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!product) {
      return c.json(
        {
          success: false,
          error: 'Product not found',
        },
        404
      );
    }

    const body = await c.req.parseBody();
    const files = body['images'];

    if (!files) {
      return c.json(
        {
          success: false,
          error: 'No images provided',
        },
        400
      );
    }

    const supabase = createSupabaseClient(c);
    const uploadedImages: { url: string; storagePath: string; isPrimary: boolean }[] = [];

    const fileArray = Array.isArray(files) ? files : [files];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];

      if (!(file instanceof File)) {
        continue;
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const storagePath = `products/${id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(storagePath, file, {
          contentType: file.type,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('product-images').getPublicUrl(storagePath);

      uploadedImages.push({
        url: publicUrl,
        storagePath,
        isPrimary: i === 0 && uploadedImages.length === 0,
      });
    }

    if (uploadedImages.length === 0) {
      return c.json(
        {
          success: false,
          error: 'Failed to upload images',
        },
        500
      );
    }

    const imageRecords = await db
      .insert(productImages)
      .values(
        uploadedImages.map((img) => ({
          productId: id,
          url: img.url,
          storagePath: img.storagePath,
          isPrimary: img.isPrimary,
        }))
      )
      .returning();

    return c.json(
      {
        success: true,
        data: imageRecords,
      },
      201
    );
  }
);

productsRouter.delete(
  '/admin/products/:id/images/:imageId',
  requireAuth,
  requireRole(['admin']),
  zValidator('param', productIdSchema.merge(imageIdSchema)),
  async (c) => {
    const { id, imageId } = c.req.valid('param');

    const image = await db.query.productImages.findFirst({
      where: and(eq(productImages.id, imageId), eq(productImages.productId, id)),
    });

    if (!image) {
      return c.json(
        {
          success: false,
          error: 'Image not found',
        },
        404
      );
    }

    const supabase = createSupabaseClient(c);

    if (image.storagePath) {
      const { error: deleteError } = await supabase.storage
        .from('product-images')
        .remove([image.storagePath]);

      if (deleteError) {
        console.error('Storage delete error:', deleteError);
      }
    }

    await db.delete(productImages).where(eq(productImages.id, imageId));

    return c.json({
      success: true,
      message: 'Image deleted successfully',
    });
  }
);

export default productsRouter;
