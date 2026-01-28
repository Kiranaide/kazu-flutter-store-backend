import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, carts, cartItems } from '../db/schema.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signJWT } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import type { Variables } from '../middleware/auth.js';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

interface Env {
  JWT_SECRET: string;
}

const auth = new Hono<{ Variables: Variables; Bindings: Env }>();

auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, fullName, phone } = c.req.valid('json');

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    return c.json(
      { success: false, error: 'User with this email already exists' },
      409
    );
  }

  const passwordHash = await hashPassword(password);

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      fullName,
      phone: phone || null,
      role: 'customer',
    })
    .returning({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  return c.json(
    {
      success: true,
      data: {
        user: newUser,
      },
    },
    201
  );
});

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const sessionId = c.req.header('x-session-id') || c.req.query('session_id');

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return c.json(
      { success: false, error: 'Invalid email or password' },
      401
    );
  }

  const isValidPassword = await comparePassword(password, user.passwordHash);

  if (!isValidPassword) {
    return c.json(
      { success: false, error: 'Invalid email or password' },
      401
    );
  }

  // Handle cart migration for guest users
  if (sessionId) {
    const guestCart = await db.query.carts.findFirst({
      where: and(
        eq(carts.sessionId, sessionId),
        isNull(carts.userId)
      ),
    });

    if (guestCart) {
      // Get guest cart items
      const guestCartItems = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.cartId, guestCart.id));

      if (guestCartItems.length > 0) {
        // Find or create user cart
        let userCart = await db.query.carts.findFirst({
          where: eq(carts.userId, user.id),
        });

        if (!userCart) {
          const [newCart] = await db
            .insert(carts)
            .values({
              userId: user.id,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            })
            .returning();
          userCart = newCart;
        }

        // Merge cart items
        for (const item of guestCartItems) {
          const existingItem = await db.query.cartItems.findFirst({
            where: and(
              eq(cartItems.cartId, userCart!.id),
              eq(cartItems.productId, item.productId)
            ),
          });

          if (existingItem) {
            // Update quantity if item exists
            await db
              .update(cartItems)
              .set({ quantity: existingItem.quantity + item.quantity })
              .where(eq(cartItems.id, existingItem.id));
          } else {
            // Insert new item
            await db.insert(cartItems).values({
              cartId: userCart!.id,
              productId: item.productId,
              quantity: item.quantity,
            });
          }
        }

        // Delete guest cart and its items
        await db.delete(cartItems).where(eq(cartItems.cartId, guestCart.id));
        await db.delete(carts).where(eq(carts.id, guestCart.id));
      }
    }
  }

  const token = await signJWT(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
    },
    c.env.JWT_SECRET
  );

  const { passwordHash: _, ...userWithoutPassword } = user;

  return c.json({
    success: true,
    data: {
      token,
      user: userWithoutPassword,
    },
  });
});

auth.post('/logout', async (c) => {
  // Token removal is handled client-side
  return c.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

auth.get('/me', requireAuth, async (c) => {
  const payload = c.get('jwtPayload');
  const userId = parseInt(payload.sub);

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return c.json(
      { success: false, error: 'User not found' },
      404
    );
  }

  return c.json({
    success: true,
    data: { user },
  });
});

export default auth;
