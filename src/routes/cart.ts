import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { getCookie, setCookie } from 'hono/cookie';
import { verifyJWT } from '../utils/jwt.js';
import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import { carts, cartItems, products, productImages } from '../db/schema.js';

// Zod schemas
export const addToCartSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1),
});

export const cartItemIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

// Types
type CartItemWithProduct = {
  id: number;
  product: {
    id: number;
    name: string;
    price: number;
    image: string | null;
  };
  quantity: number;
  subtotal: number;
};

type CartResponse = {
  id: number;
  items: CartItemWithProduct[];
  itemCount: number;
  total: number;
};

// Helper function to get expiration date (7 days from now)
const getExpirationDate = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
};

// Helper function to get or create session_id
const getOrCreateSessionId = (c: Context): string => {
  let sessionId = getCookie(c, 'session_id');
  if (!sessionId) {
    sessionId = uuidv4();
    setCookie(c, 'session_id', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }
  return sessionId;
};

// Helper function to get user ID from JWT token
const getUserIdFromToken = async (c: Context): Promise<number | null> => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return null;
    }
    
    const payload = await verifyJWT(token, secret);
    if (payload && typeof payload === 'object' && 'sub' in payload) {
      return parseInt(payload.sub as string, 10);
    }
    return null;
  } catch {
    return null;
  }
};

// Helper function to get or create cart
const getOrCreateCart = async (c: Context): Promise<{ id: number; userId: number | null }> => {
  const userId = await getUserIdFromToken(c);
  const sessionId = userId ? null : getOrCreateSessionId(c);
  const expiresAt = getExpirationDate();

  // Try to find existing cart
  let cart;
  if (userId) {
    [cart] = await db.select().from(carts).where(eq(carts.userId, userId));
  } else if (sessionId) {
    [cart] = await db.select().from(carts).where(eq(carts.sessionId, sessionId));
  }

  if (cart) {
    // Update expiration date
    await db.update(carts).set({ expiresAt, updatedAt: new Date() }).where(eq(carts.id, cart.id));
    return { id: cart.id, userId: cart.userId };
  }

  // Create new cart
  const [newCart] = await db.insert(carts).values({
    userId,
    sessionId,
    expiresAt,
  }).returning();

  return { id: newCart.id, userId: newCart.userId };
};

// Helper function to build cart response
const buildCartResponse = async (cartId: number): Promise<CartResponse> => {
  const items = await db
    .select({
      cartItemId: cartItems.id,
      quantity: cartItems.quantity,
      productId: products.id,
      productName: products.name,
      productPrice: products.price,
      productImage: productImages.url,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.isPrimary, true)
      )
    )
    .where(eq(cartItems.cartId, cartId));

  const formattedItems: CartItemWithProduct[] = items.map((item) => ({
    id: item.cartItemId,
    product: {
      id: item.productId,
      name: item.productName,
      price: parseFloat(item.productPrice as unknown as string),
      image: item.productImage || null,
    },
    quantity: item.quantity,
    subtotal: parseFloat(item.productPrice as unknown as string) * item.quantity,
  }));

  const itemCount = formattedItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = formattedItems.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    id: cartId,
    items: formattedItems,
    itemCount,
    total,
  };
};

// Create router
const cartRoutes = new Hono();

// GET /cart - Get current cart
cartRoutes.get('/', async (c) => {
  try {
    const userId = await getUserIdFromToken(c);
    const sessionId = userId ? null : getOrCreateSessionId(c);

    // Find cart
    let cart;
    if (userId) {
      [cart] = await db.select().from(carts).where(eq(carts.userId, userId));
    } else if (sessionId) {
      [cart] = await db.select().from(carts).where(eq(carts.sessionId, sessionId));
    }

    if (!cart) {
      return c.json({
        id: null,
        items: [],
        itemCount: 0,
        total: 0,
      });
    }

    // Update expiration
    await db.update(carts).set({ expiresAt: getExpirationDate(), updatedAt: new Date() }).where(eq(carts.id, cart.id));

    const cartResponse = await buildCartResponse(cart.id);
    return c.json(cartResponse);
  } catch (error) {
    console.error('Error fetching cart:', error);
    return c.json({ success: false, error: 'Failed to fetch cart' }, 500);
  }
});

// POST /cart/items - Add item to cart
cartRoutes.post('/items', zValidator('json', addToCartSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const { productId, quantity } = body;

    // Validate product exists and has stock
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    if (product.stockQuantity < quantity) {
      return c.json({ success: false, error: 'Insufficient stock' }, 400);
    }

    // Get or create cart
    const cart = await getOrCreateCart(c);

    // Check if item already exists in cart
    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId)));

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stockQuantity) {
        return c.json({ success: false, error: 'Insufficient stock for updated quantity' }, 400);
      }

      await db
        .update(cartItems)
        .set({ quantity: newQuantity, updatedAt: new Date() })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      // Create new cart item
      await db.insert(cartItems).values({
        cartId: cart.id,
        productId,
        quantity,
      });
    }

    const cartResponse = await buildCartResponse(cart.id);
    return c.json(cartResponse);
  } catch (error) {
    console.error('Error adding item to cart:', error);
    return c.json({ success: false, error: 'Failed to add item to cart' }, 500);
  }
});

// PUT /cart/items/:id - Update cart item quantity
cartRoutes.put('/items/:id', zValidator('json', updateCartItemSchema), async (c) => {
  try {
    const itemId = parseInt(c.req.param('id'), 10);
    if (isNaN(itemId)) {
      return c.json({ success: false, error: 'Invalid item ID' }, 400);
    }

    const body = c.req.valid('json');
    const { quantity } = body;

    // Get user's cart
    const cart = await getOrCreateCart(c);

    // Find cart item
    const [cartItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));

    if (!cartItem) {
      return c.json({ success: false, error: 'Cart item not found' }, 404);
    }

    // Validate stock
    const [product] = await db.select().from(products).where(eq(products.id, cartItem.productId));
    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    if (quantity > product.stockQuantity) {
      return c.json({ success: false, error: 'Insufficient stock' }, 400);
    }

    // Update quantity
    await db
      .update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, itemId));

    const cartResponse = await buildCartResponse(cart.id);
    return c.json(cartResponse);
  } catch (error) {
    console.error('Error updating cart item:', error);
    return c.json({ success: false, error: 'Failed to update cart item' }, 500);
  }
});

// DELETE /cart/items/:id - Remove item from cart
cartRoutes.delete('/items/:id', async (c) => {
  try {
    const itemId = parseInt(c.req.param('id'), 10);
    if (isNaN(itemId)) {
      return c.json({ success: false, error: 'Invalid item ID' }, 400);
    }

    // Get user's cart
    const cart = await getOrCreateCart(c);

    // Find and delete cart item
    const [cartItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));

    if (!cartItem) {
      return c.json({ success: false, error: 'Cart item not found' }, 404);
    }

    await db.delete(cartItems).where(eq(cartItems.id, itemId));

    const cartResponse = await buildCartResponse(cart.id);
    return c.json(cartResponse);
  } catch (error) {
    console.error('Error removing cart item:', error);
    return c.json({ success: false, error: 'Failed to remove cart item' }, 500);
  }
});

// DELETE /cart - Clear cart
cartRoutes.delete('/', async (c) => {
  try {
    const userId = await getUserIdFromToken(c);
    const sessionId = userId ? null : getOrCreateSessionId(c);

    // Find cart
    let cart;
    if (userId) {
      [cart] = await db.select().from(carts).where(eq(carts.userId, userId));
    } else if (sessionId) {
      [cart] = await db.select().from(carts).where(eq(carts.sessionId, sessionId));
    }

    if (cart) {
      // Delete all cart items
      await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));

      // Delete the cart itself
      await db.delete(carts).where(eq(carts.id, cart.id));
    }

    return c.json({
      id: null,
      items: [],
      itemCount: 0,
      total: 0,
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    return c.json({ success: false, error: 'Failed to clear cart' }, 500);
  }
});

export default cartRoutes;
