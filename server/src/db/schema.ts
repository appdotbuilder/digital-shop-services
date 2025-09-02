import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  pgEnum,
  foreignKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['customer', 'admin']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'completed', 'cancelled', 'refunded']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'completed', 'failed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull().default('customer'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Categories table
export const categoriesTable = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  slug: text('slug').notNull().unique(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Products table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  category_id: integer('category_id').notNull(),
  digital_file_url: text('digital_file_url'),
  download_limit: integer('download_limit'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  categoryFk: foreignKey({
    columns: [table.category_id],
    foreignColumns: [categoriesTable.id],
  }),
}));

// Coupons table
export const couponsTable = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  discount_percentage: numeric('discount_percentage', { precision: 5, scale: 2 }),
  discount_amount: numeric('discount_amount', { precision: 10, scale: 2 }),
  min_order_amount: numeric('min_order_amount', { precision: 10, scale: 2 }),
  max_uses: integer('max_uses'),
  current_uses: integer('current_uses').notNull().default(0),
  expires_at: timestamp('expires_at'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Orders table
export const ordersTable = pgTable('orders', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  discount_amount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  final_amount: numeric('final_amount', { precision: 10, scale: 2 }).notNull(),
  coupon_id: integer('coupon_id'),
  status: orderStatusEnum('status').notNull().default('pending'),
  payment_status: paymentStatusEnum('payment_status').notNull().default('pending'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userFk: foreignKey({
    columns: [table.user_id],
    foreignColumns: [usersTable.id],
  }),
  couponFk: foreignKey({
    columns: [table.coupon_id],
    foreignColumns: [couponsTable.id],
  }),
}));

// Order Items table
export const orderItemsTable = pgTable('order_items', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull(),
  product_id: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orderFk: foreignKey({
    columns: [table.order_id],
    foreignColumns: [ordersTable.id],
  }),
  productFk: foreignKey({
    columns: [table.product_id],
    foreignColumns: [productsTable.id],
  }),
}));

// Cart Items table
export const cartItemsTable = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  product_id: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userFk: foreignKey({
    columns: [table.user_id],
    foreignColumns: [usersTable.id],
  }),
  productFk: foreignKey({
    columns: [table.product_id],
    foreignColumns: [productsTable.id],
  }),
}));

// Reviews table
export const reviewsTable = pgTable('reviews', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  product_id: integer('product_id').notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  is_approved: boolean('is_approved').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userFk: foreignKey({
    columns: [table.user_id],
    foreignColumns: [usersTable.id],
  }),
  productFk: foreignKey({
    columns: [table.product_id],
    foreignColumns: [productsTable.id],
  }),
}));

// Downloads table
export const downloadsTable = pgTable('downloads', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  product_id: integer('product_id').notNull(),
  order_id: integer('order_id').notNull(),
  download_count: integer('download_count').notNull().default(0),
  expires_at: timestamp('expires_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userFk: foreignKey({
    columns: [table.user_id],
    foreignColumns: [usersTable.id],
  }),
  productFk: foreignKey({
    columns: [table.product_id],
    foreignColumns: [productsTable.id],
  }),
  orderFk: foreignKey({
    columns: [table.order_id],
    foreignColumns: [ordersTable.id],
  }),
}));

// Blog Posts table
export const blogPostsTable = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  slug: text('slug').notNull().unique(),
  author_id: integer('author_id').notNull(),
  is_published: boolean('is_published').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  authorFk: foreignKey({
    columns: [table.author_id],
    foreignColumns: [usersTable.id],
  }),
}));

// Settings table
export const settingsTable = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  orders: many(ordersTable),
  cartItems: many(cartItemsTable),
  reviews: many(reviewsTable),
  downloads: many(downloadsTable),
  blogPosts: many(blogPostsTable),
}));

export const categoriesRelations = relations(categoriesTable, ({ many }) => ({
  products: many(productsTable),
}));

export const productsRelations = relations(productsTable, ({ one, many }) => ({
  category: one(categoriesTable, {
    fields: [productsTable.category_id],
    references: [categoriesTable.id],
  }),
  orderItems: many(orderItemsTable),
  cartItems: many(cartItemsTable),
  reviews: many(reviewsTable),
  downloads: many(downloadsTable),
}));

export const ordersRelations = relations(ordersTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [ordersTable.user_id],
    references: [usersTable.id],
  }),
  coupon: one(couponsTable, {
    fields: [ordersTable.coupon_id],
    references: [couponsTable.id],
  }),
  orderItems: many(orderItemsTable),
  downloads: many(downloadsTable),
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.order_id],
    references: [ordersTable.id],
  }),
  product: one(productsTable, {
    fields: [orderItemsTable.product_id],
    references: [productsTable.id],
  }),
}));

export const cartItemsRelations = relations(cartItemsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [cartItemsTable.user_id],
    references: [usersTable.id],
  }),
  product: one(productsTable, {
    fields: [cartItemsTable.product_id],
    references: [productsTable.id],
  }),
}));

export const reviewsRelations = relations(reviewsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [reviewsTable.user_id],
    references: [usersTable.id],
  }),
  product: one(productsTable, {
    fields: [reviewsTable.product_id],
    references: [productsTable.id],
  }),
}));

export const downloadsRelations = relations(downloadsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [downloadsTable.user_id],
    references: [usersTable.id],
  }),
  product: one(productsTable, {
    fields: [downloadsTable.product_id],
    references: [productsTable.id],
  }),
  order: one(ordersTable, {
    fields: [downloadsTable.order_id],
    references: [ordersTable.id],
  }),
}));

export const blogPostsRelations = relations(blogPostsTable, ({ one }) => ({
  author: one(usersTable, {
    fields: [blogPostsTable.author_id],
    references: [usersTable.id],
  }),
}));

export const couponsRelations = relations(couponsTable, ({ many }) => ({
  orders: many(ordersTable),
}));

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  categories: categoriesTable,
  products: productsTable,
  coupons: couponsTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
  cartItems: cartItemsTable,
  reviews: reviewsTable,
  downloads: downloadsTable,
  blogPosts: blogPostsTable,
  settings: settingsTable,
};