import { z } from 'zod';

// Enums
export const userRoleSchema = z.enum(['customer', 'admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const orderStatusSchema = z.enum(['pending', 'completed', 'cancelled', 'refunded']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paymentStatusSchema = z.enum(['pending', 'completed', 'failed']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

// User schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleSchema,
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: userRoleSchema.optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Category schemas
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  slug: z.string(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

export const createCategoryInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  slug: z.string().min(1)
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const updateCategoryInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  slug: z.string().min(1).optional(),
  is_active: z.boolean().optional()
});

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

// Product schemas
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  category_id: z.number(),
  digital_file_url: z.string().nullable(),
  download_limit: z.number().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

export const createProductInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  price: z.number().positive(),
  category_id: z.number(),
  digital_file_url: z.string().url().nullable(),
  download_limit: z.number().int().positive().nullable()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const updateProductInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  category_id: z.number().optional(),
  digital_file_url: z.string().url().nullable().optional(),
  download_limit: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

// Coupon schemas
export const couponSchema = z.object({
  id: z.number(),
  code: z.string(),
  discount_percentage: z.number().nullable(),
  discount_amount: z.number().nullable(),
  min_order_amount: z.number().nullable(),
  max_uses: z.number().nullable(),
  current_uses: z.number(),
  expires_at: z.coerce.date().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Coupon = z.infer<typeof couponSchema>;

export const createCouponInputSchema = z.object({
  code: z.string().min(1),
  discount_percentage: z.number().min(0).max(100).nullable(),
  discount_amount: z.number().positive().nullable(),
  min_order_amount: z.number().positive().nullable(),
  max_uses: z.number().int().positive().nullable(),
  expires_at: z.coerce.date().nullable()
});

export type CreateCouponInput = z.infer<typeof createCouponInputSchema>;

export const updateCouponInputSchema = z.object({
  id: z.number(),
  code: z.string().min(1).optional(),
  discount_percentage: z.number().min(0).max(100).nullable().optional(),
  discount_amount: z.number().positive().nullable().optional(),
  min_order_amount: z.number().positive().nullable().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
  expires_at: z.coerce.date().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateCouponInput = z.infer<typeof updateCouponInputSchema>;

// Order schemas
export const orderSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  total_amount: z.number(),
  discount_amount: z.number(),
  final_amount: z.number(),
  coupon_id: z.number().nullable(),
  status: orderStatusSchema,
  payment_status: paymentStatusSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Order = z.infer<typeof orderSchema>;

export const createOrderInputSchema = z.object({
  user_id: z.number(),
  coupon_code: z.string().optional(),
  items: z.array(z.object({
    product_id: z.number(),
    quantity: z.number().int().positive(),
    price: z.number().positive()
  }))
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

// Order Item schemas
export const orderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  product_id: z.number(),
  quantity: z.number(),
  price: z.number(),
  created_at: z.coerce.date()
});

export type OrderItem = z.infer<typeof orderItemSchema>;

// Cart schemas
export const cartItemSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_id: z.number(),
  quantity: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const addToCartInputSchema = z.object({
  user_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int().positive()
});

export type AddToCartInput = z.infer<typeof addToCartInputSchema>;

export const updateCartItemInputSchema = z.object({
  id: z.number(),
  quantity: z.number().int().positive()
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>;

// Review schemas
export const reviewSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_id: z.number(),
  rating: z.number(),
  comment: z.string().nullable(),
  is_approved: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Review = z.infer<typeof reviewSchema>;

export const createReviewInputSchema = z.object({
  user_id: z.number(),
  product_id: z.number(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable()
});

export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

export const updateReviewInputSchema = z.object({
  id: z.number(),
  is_approved: z.boolean()
});

export type UpdateReviewInput = z.infer<typeof updateReviewInputSchema>;

// Download schemas
export const downloadSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_id: z.number(),
  order_id: z.number(),
  download_count: z.number(),
  expires_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type Download = z.infer<typeof downloadSchema>;

export const createDownloadInputSchema = z.object({
  user_id: z.number(),
  product_id: z.number(),
  order_id: z.number()
});

export type CreateDownloadInput = z.infer<typeof createDownloadInputSchema>;

// Blog schemas
export const blogPostSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  excerpt: z.string().nullable(),
  slug: z.string(),
  author_id: z.number(),
  is_published: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type BlogPost = z.infer<typeof blogPostSchema>;

export const createBlogPostInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  excerpt: z.string().nullable(),
  slug: z.string().min(1),
  author_id: z.number()
});

export type CreateBlogPostInput = z.infer<typeof createBlogPostInputSchema>;

export const updateBlogPostInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().nullable().optional(),
  slug: z.string().min(1).optional(),
  is_published: z.boolean().optional()
});

export type UpdateBlogPostInput = z.infer<typeof updateBlogPostInputSchema>;

// Contact schemas
export const contactFormInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subject: z.string().min(1),
  message: z.string().min(1)
});

export type ContactFormInput = z.infer<typeof contactFormInputSchema>;

// Settings schemas
export const settingsSchema = z.object({
  id: z.number(),
  key: z.string(),
  value: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Settings = z.infer<typeof settingsSchema>;

export const updateSettingsInputSchema = z.object({
  key: z.string(),
  value: z.string()
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;