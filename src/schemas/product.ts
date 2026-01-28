import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  stockQuantity: z.number().int().min(0, 'Stock quantity must be non-negative'),
  categoryId: z.number().int().positive('Category ID is required'),
  slug: z.string().min(1, 'Slug is required'),
});

export const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive').optional(),
  stockQuantity: z.number().int().min(0, 'Stock quantity must be non-negative').optional(),
  categoryId: z.number().int().positive('Category ID is required').optional(),
  slug: z.string().min(1, 'Slug is required').optional(),
});

export const productQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  categoryId: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['price', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const productIdSchema = z.object({
  id: z.string().transform((val) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) {
      throw new Error('Invalid product ID');
    }
    return parsed;
  }),
});

export const categoryIdSchema = z.object({
  categoryId: z.string().transform((val) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) {
      throw new Error('Invalid category ID');
    }
    return parsed;
  }),
});

export const imageIdSchema = z.object({
  imageId: z.string().transform((val) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) {
      throw new Error('Invalid image ID');
    }
    return parsed;
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
