import { db } from './src/db/index.js';
import { 
  users, 
  categories, 
  products, 
  productImages,
  userRoleEnum,
  orderStatusEnum
} from './src/db/schema.js';
import { hashPassword } from './src/utils/password.js';

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Create admin user
    console.log('Creating admin user...');
    const adminPassword = await hashPassword('admin123');
    const [admin] = await db.insert(users).values({
      email: 'admin@example.com',
      passwordHash: adminPassword,
      fullName: 'Admin User',
      phone: '+1234567890',
      role: 'admin',
    }).returning();
    console.log('✅ Admin user created:', admin.email);

    // Create customer user
    console.log('Creating customer user...');
    const customerPassword = await hashPassword('customer123');
    const [customer] = await db.insert(users).values({
      email: 'customer@example.com',
      passwordHash: customerPassword,
      fullName: 'John Doe',
      phone: '+0987654321',
      role: 'customer',
    }).returning();
    console.log('✅ Customer user created:', customer.email);

    // Create categories
    console.log('\nCreating categories...');
    const categoriesData = [
      { name: 'Electronics', slug: 'electronics', description: 'Latest gadgets and devices' },
      { name: 'Clothing', slug: 'clothing', description: 'Fashion for everyone' },
      { name: 'Home & Garden', slug: 'home-garden', description: 'Everything for your home' },
      { name: 'Sports', slug: 'sports', description: 'Sports equipment and accessories' },
      { name: 'Books', slug: 'books', description: 'Physical and digital books' },
    ];

    const createdCategories = await db.insert(categories).values(categoriesData).returning();
    console.log('✅ Categories created:', createdCategories.map(c => c.name).join(', '));

    // Create products
    console.log('\nCreating products...');
    const productsData = [
      {
        name: 'Wireless Bluetooth Headphones',
        slug: 'wireless-bluetooth-headphones',
        description: 'High-quality wireless headphones with noise cancellation and 20-hour battery life.',
        price: '79.99',
        stockQuantity: 50,
        categoryId: createdCategories[0].id, // Electronics
      },
      {
        name: 'Smart Watch Pro',
        slug: 'smart-watch-pro',
        description: 'Advanced fitness tracking, heart rate monitor, and smartphone notifications.',
        price: '199.99',
        stockQuantity: 30,
        categoryId: createdCategories[0].id, // Electronics
      },
      {
        name: 'Cotton T-Shirt',
        slug: 'cotton-t-shirt',
        description: 'Comfortable 100% cotton t-shirt available in multiple colors.',
        price: '24.99',
        stockQuantity: 100,
        categoryId: createdCategories[1].id, // Clothing
      },
      {
        name: 'Running Shoes',
        slug: 'running-shoes',
        description: 'Lightweight running shoes with cushioned sole for maximum comfort.',
        price: '89.99',
        stockQuantity: 40,
        categoryId: createdCategories[1].id, // Clothing
      },
      {
        name: 'Ceramic Coffee Mug Set',
        slug: 'ceramic-coffee-mug-set',
        description: 'Set of 4 beautiful ceramic coffee mugs, dishwasher safe.',
        price: '34.99',
        stockQuantity: 25,
        categoryId: createdCategories[2].id, // Home & Garden
      },
      {
        name: 'Yoga Mat',
        slug: 'yoga-mat',
        description: 'Non-slip yoga mat with carrying strap, perfect for home workouts.',
        price: '29.99',
        stockQuantity: 60,
        categoryId: createdCategories[3].id, // Sports
      },
      {
        name: 'Basketball',
        slug: 'basketball',
        description: 'Official size basketball with superior grip and durability.',
        price: '39.99',
        stockQuantity: 35,
        categoryId: createdCategories[3].id, // Sports
      },
      {
        name: 'Programming TypeScript',
        slug: 'programming-typescript',
        description: 'Comprehensive guide to TypeScript programming language.',
        price: '44.99',
        stockQuantity: 20,
        categoryId: createdCategories[4].id, // Books
      },
    ];

    const createdProducts = await db.insert(products).values(productsData).returning();
    console.log('✅ Products created:', createdProducts.map(p => p.name).join(', '));

    // Create product images
    console.log('\nCreating product images...');
    const imagesData = [
      { productId: createdProducts[0].id, url: 'https://placehold.co/600x400?text=Headphones', isPrimary: true },
      { productId: createdProducts[1].id, url: 'https://placehold.co/600x400?text=Smart+Watch', isPrimary: true },
      { productId: createdProducts[2].id, url: 'https://placehold.co/600x400?text=T-Shirt', isPrimary: true },
      { productId: createdProducts[3].id, url: 'https://placehold.co/600x400?text=Running+Shoes', isPrimary: true },
      { productId: createdProducts[4].id, url: 'https://placehold.co/600x400?text=Coffee+Mugs', isPrimary: true },
      { productId: createdProducts[5].id, url: 'https://placehold.co/600x400?text=Yoga+Mat', isPrimary: true },
      { productId: createdProducts[6].id, url: 'https://placehold.co/600x400?text=Basketball', isPrimary: true },
      { productId: createdProducts[7].id, url: 'https://placehold.co/600x400?text=TypeScript+Book', isPrimary: true },
    ];

    await db.insert(productImages).values(imagesData);
    console.log('✅ Product images created');

    console.log('\n✨ Database seed completed successfully!');
    console.log('\nLogin credentials:');
    console.log('  Admin: admin@example.com / admin123');
    console.log('  Customer: customer@example.com / customer123');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
