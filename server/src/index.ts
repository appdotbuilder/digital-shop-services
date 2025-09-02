import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  loginInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  createCouponInputSchema,
  updateCouponInputSchema,
  createOrderInputSchema,
  addToCartInputSchema,
  updateCartItemInputSchema,
  createReviewInputSchema,
  updateReviewInputSchema,
  createDownloadInputSchema,
  createBlogPostInputSchema,
  updateBlogPostInputSchema,
  contactFormInputSchema,
  updateSettingsInputSchema,
} from './schema';

// Import handlers
import { createUser, loginUser, getUserById, getAllUsers } from './handlers/auth';
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from './handlers/categories';
import {
  createProduct,
  getProducts,
  getProductById,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
} from './handlers/products';
import {
  createCoupon,
  getCoupons,
  getCouponByCode,
  validateCoupon,
  updateCoupon,
  deleteCoupon,
} from './handlers/coupons';
import {
  createOrder,
  getOrders,
  getOrderById,
  getOrdersByUser,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderItems,
} from './handlers/orders';
import {
  addToCart,
  getCartItems,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary,
} from './handlers/cart';
import {
  createReview,
  getReviewsByProduct,
  getPendingReviews,
  getAllReviews,
  approveReview,
  deleteReview,
  getProductRating,
} from './handlers/reviews';
import {
  createDownload,
  getDownloadsByUser,
  validateDownload,
  incrementDownloadCount,
  generateDownloadToken,
  validateDownloadToken,
} from './handlers/downloads';
import {
  createBlogPost,
  getBlogPosts,
  getBlogPostById,
  getBlogPostBySlug,
  updateBlogPost,
  deleteBlogPost,
  publishBlogPost,
} from './handlers/blog';
import { submitContactForm, getContactSubmissions } from './handlers/contact';
import {
  getSettings,
  getSetting,
  updateSetting,
  getPublicSettings,
} from './handlers/settings';
import {
  getDashboardStats,
  getDailyVisitorChart,
  getOrderOverview,
  getSalesReport,
} from './handlers/analytics';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    register: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => createUser(input)),
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => loginUser(input)),
    getUserById: publicProcedure
      .input(z.number())
      .query(({ input }) => getUserById(input)),
    getAllUsers: publicProcedure.query(() => getAllUsers()),
  }),

  // Category routes
  categories: router({
    create: publicProcedure
      .input(createCategoryInputSchema)
      .mutation(({ input }) => createCategory(input)),
    getAll: publicProcedure.query(() => getCategories()),
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getCategoryById(input)),
    update: publicProcedure
      .input(updateCategoryInputSchema)
      .mutation(({ input }) => updateCategory(input)),
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteCategory(input)),
  }),

  // Product routes
  products: router({
    create: publicProcedure
      .input(createProductInputSchema)
      .mutation(({ input }) => createProduct(input)),
    getAll: publicProcedure.query(() => getProducts()),
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getProductById(input)),
    getByCategory: publicProcedure
      .input(z.number())
      .query(({ input }) => getProductsByCategory(input)),
    update: publicProcedure
      .input(updateProductInputSchema)
      .mutation(({ input }) => updateProduct(input)),
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteProduct(input)),
  }),

  // Coupon routes
  coupons: router({
    create: publicProcedure
      .input(createCouponInputSchema)
      .mutation(({ input }) => createCoupon(input)),
    getAll: publicProcedure.query(() => getCoupons()),
    getByCode: publicProcedure
      .input(z.string())
      .query(({ input }) => getCouponByCode(input)),
    validate: publicProcedure
      .input(z.object({ code: z.string(), orderAmount: z.number() }))
      .query(({ input }) => validateCoupon(input.code, input.orderAmount)),
    update: publicProcedure
      .input(updateCouponInputSchema)
      .mutation(({ input }) => updateCoupon(input)),
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteCoupon(input)),
  }),

  // Order routes
  orders: router({
    create: publicProcedure
      .input(createOrderInputSchema)
      .mutation(({ input }) => createOrder(input)),
    getAll: publicProcedure.query(() => getOrders()),
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getOrderById(input)),
    getByUser: publicProcedure
      .input(z.number())
      .query(({ input }) => getOrdersByUser(input)),
    updateStatus: publicProcedure
      .input(z.object({ id: z.number(), status: z.enum(['pending', 'completed', 'cancelled', 'refunded']) }))
      .mutation(({ input }) => updateOrderStatus(input.id, input.status)),
    updatePaymentStatus: publicProcedure
      .input(z.object({ id: z.number(), paymentStatus: z.enum(['pending', 'completed', 'failed']) }))
      .mutation(({ input }) => updatePaymentStatus(input.id, input.paymentStatus)),
    getItems: publicProcedure
      .input(z.number())
      .query(({ input }) => getOrderItems(input)),
  }),

  // Cart routes
  cart: router({
    add: publicProcedure
      .input(addToCartInputSchema)
      .mutation(({ input }) => addToCart(input)),
    getItems: publicProcedure
      .input(z.number())
      .query(({ input }) => getCartItems(input)),
    updateItem: publicProcedure
      .input(updateCartItemInputSchema)
      .mutation(({ input }) => updateCartItem(input)),
    removeItem: publicProcedure
      .input(z.number())
      .mutation(({ input }) => removeFromCart(input)),
    clear: publicProcedure
      .input(z.number())
      .mutation(({ input }) => clearCart(input)),
    getSummary: publicProcedure
      .input(z.number())
      .query(({ input }) => getCartSummary(input)),
  }),

  // Review routes
  reviews: router({
    create: publicProcedure
      .input(createReviewInputSchema)
      .mutation(({ input }) => createReview(input)),
    getByProduct: publicProcedure
      .input(z.number())
      .query(({ input }) => getReviewsByProduct(input)),
    getPending: publicProcedure.query(() => getPendingReviews()),
    getAll: publicProcedure.query(() => getAllReviews()),
    approve: publicProcedure
      .input(updateReviewInputSchema)
      .mutation(({ input }) => approveReview(input)),
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteReview(input)),
    getProductRating: publicProcedure
      .input(z.number())
      .query(({ input }) => getProductRating(input)),
  }),

  // Download routes
  downloads: router({
    create: publicProcedure
      .input(createDownloadInputSchema)
      .mutation(({ input }) => createDownload(input)),
    getByUser: publicProcedure
      .input(z.number())
      .query(({ input }) => getDownloadsByUser(input)),
    validate: publicProcedure
      .input(z.object({ downloadId: z.number(), userId: z.number() }))
      .query(({ input }) => validateDownload(input.downloadId, input.userId)),
    incrementCount: publicProcedure
      .input(z.number())
      .mutation(({ input }) => incrementDownloadCount(input)),
    generateToken: publicProcedure
      .input(z.object({ downloadId: z.number(), userId: z.number() }))
      .mutation(({ input }) => generateDownloadToken(input.downloadId, input.userId)),
    validateToken: publicProcedure
      .input(z.string())
      .query(({ input }) => validateDownloadToken(input)),
  }),

  // Blog routes
  blog: router({
    create: publicProcedure
      .input(createBlogPostInputSchema)
      .mutation(({ input }) => createBlogPost(input)),
    getAll: publicProcedure
      .input(z.boolean().optional())
      .query(({ input }) => getBlogPosts(input)),
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getBlogPostById(input)),
    getBySlug: publicProcedure
      .input(z.string())
      .query(({ input }) => getBlogPostBySlug(input)),
    update: publicProcedure
      .input(updateBlogPostInputSchema)
      .mutation(({ input }) => updateBlogPost(input)),
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteBlogPost(input)),
    publish: publicProcedure
      .input(z.number())
      .mutation(({ input }) => publishBlogPost(input)),
  }),

  // Contact routes
  contact: router({
    submit: publicProcedure
      .input(contactFormInputSchema)
      .mutation(({ input }) => submitContactForm(input)),
    getSubmissions: publicProcedure.query(() => getContactSubmissions()),
  }),

  // Settings routes
  settings: router({
    getAll: publicProcedure.query(() => getSettings()),
    get: publicProcedure
      .input(z.string())
      .query(({ input }) => getSetting(input)),
    update: publicProcedure
      .input(updateSettingsInputSchema)
      .mutation(({ input }) => updateSetting(input)),
    getPublic: publicProcedure.query(() => getPublicSettings()),
  }),

  // Analytics routes
  analytics: router({
    getDashboardStats: publicProcedure.query(() => getDashboardStats()),
    getDailyVisitorChart: publicProcedure
      .input(z.number().optional())
      .query(({ input }) => getDailyVisitorChart(input)),
    getOrderOverview: publicProcedure
      .input(z.number().optional())
      .query(({ input }) => getOrderOverview(input)),
    getSalesReport: publicProcedure
      .input(z.object({ startDate: z.coerce.date(), endDate: z.coerce.date() }))
      .query(({ input }) => getSalesReport(input.startDate, input.endDate)),
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();