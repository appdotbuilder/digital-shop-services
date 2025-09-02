import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  categoriesTable, 
  productsTable, 
  ordersTable, 
  orderItemsTable 
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { 
  getDashboardStats, 
  getDailyVisitorChart, 
  getOrderOverview, 
  getSalesReport 
} from '../handlers/analytics';

describe('Analytics Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getDashboardStats', () => {
    it('should return dashboard stats with zero values for empty database', async () => {
      const stats = await getDashboardStats();

      expect(stats.totalCategories).toBe(0);
      expect(stats.totalProducts).toBe(0);
      expect(stats.totalCustomers).toBe(0);
      expect(stats.totalOrders).toBe(0);
      expect(stats.totalRevenue).toBe(0);
      expect(stats.pendingOrders).toBe(0);
    });

    it('should calculate correct dashboard stats with data', async () => {
      // Create test users
      const users = await db.insert(usersTable).values([
        {
          email: 'customer1@test.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Doe',
          role: 'customer'
        },
        {
          email: 'customer2@test.com',
          password_hash: 'hash2',
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'customer'
        },
        {
          email: 'admin@test.com',
          password_hash: 'hash3',
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin'
        }
      ]).returning().execute();

      // Create test categories
      const categories = await db.insert(categoriesTable).values([
        {
          name: 'Category 1',
          description: 'Test category 1',
          slug: 'category-1'
        },
        {
          name: 'Category 2',
          description: 'Test category 2',
          slug: 'category-2'
        }
      ]).returning().execute();

      // Create test products
      await db.insert(productsTable).values([
        {
          name: 'Product 1',
          description: 'Test product 1',
          price: '19.99',
          category_id: categories[0].id
        },
        {
          name: 'Product 2',
          description: 'Test product 2',
          price: '29.99',
          category_id: categories[1].id
        }
      ]).returning().execute();

      // Create test orders
      await db.insert(ordersTable).values([
        {
          user_id: users[0].id,
          total_amount: '100.00',
          discount_amount: '0.00',
          final_amount: '100.00',
          status: 'completed'
        },
        {
          user_id: users[1].id,
          total_amount: '50.00',
          discount_amount: '0.00',
          final_amount: '50.00',
          status: 'pending'
        },
        {
          user_id: users[0].id,
          total_amount: '75.00',
          discount_amount: '0.00',
          final_amount: '75.00',
          status: 'completed'
        }
      ]).returning().execute();

      const stats = await getDashboardStats();

      expect(stats.totalCategories).toBe(2);
      expect(stats.totalProducts).toBe(2);
      expect(stats.totalCustomers).toBe(2); // Only customers, not admin
      expect(stats.totalOrders).toBe(3);
      expect(stats.totalRevenue).toBe(175.00); // Sum of completed orders
      expect(stats.pendingOrders).toBe(1);
    });

    it('should only count active categories and products', async () => {
      // Create active and inactive categories
      await db.insert(categoriesTable).values([
        {
          name: 'Active Category',
          description: 'Active',
          slug: 'active-category',
          is_active: true
        },
        {
          name: 'Inactive Category',
          description: 'Inactive',
          slug: 'inactive-category',
          is_active: false
        }
      ]).returning().execute();

      const activeCategory = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.slug, 'active-category'))
        .execute();

      // Create active and inactive products
      await db.insert(productsTable).values([
        {
          name: 'Active Product',
          description: 'Active',
          price: '19.99',
          category_id: activeCategory[0].id,
          is_active: true
        },
        {
          name: 'Inactive Product',
          description: 'Inactive',
          price: '29.99',
          category_id: activeCategory[0].id,
          is_active: false
        }
      ]).returning().execute();

      const stats = await getDashboardStats();

      expect(stats.totalCategories).toBe(1); // Only active category
      expect(stats.totalProducts).toBe(1); // Only active product
    });
  });

  describe('getDailyVisitorChart', () => {
    it('should return empty array for specified days when no data exists', async () => {
      const visitorData = await getDailyVisitorChart(7);

      expect(visitorData).toHaveLength(7);
      visitorData.forEach(day => {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
        expect(day.visitors).toBeGreaterThanOrEqual(0);
        expect(typeof day.visitors).toBe('number');
      });
    });

    it('should generate visitor data based on orders', async () => {
      // Create a test user
      const user = await db.insert(usersTable).values({
        email: 'test@test.com',
        password_hash: 'hash',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      }).returning().execute();

      // Create an order from yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await db.insert(ordersTable).values({
        user_id: user[0].id,
        total_amount: '50.00',
        discount_amount: '0.00',
        final_amount: '50.00',
        created_at: yesterday
      }).returning().execute();

      const visitorData = await getDailyVisitorChart(3);

      expect(visitorData).toHaveLength(3);
      
      // Check that all dates are in proper format
      visitorData.forEach(day => {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof day.visitors).toBe('number');
        expect(day.visitors).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle custom day ranges', async () => {
      const visitorData = await getDailyVisitorChart(14);
      expect(visitorData).toHaveLength(14);
    });
  });

  describe('getOrderOverview', () => {
    it('should return empty array when no orders exist', async () => {
      const overview = await getOrderOverview();
      expect(overview).toHaveLength(0);
    });

    it('should return recent orders with user information', async () => {
      // Create test user
      const user = await db.insert(usersTable).values({
        email: 'test@test.com',
        password_hash: 'hash',
        first_name: 'John',
        last_name: 'Doe',
        role: 'customer'
      }).returning().execute();

      // Create test orders with explicit timestamps
      const now = new Date();
      const earlier = new Date(now.getTime() - 1000); // 1 second earlier
      
      const orders = await db.insert(ordersTable).values([
        {
          user_id: user[0].id,
          total_amount: '100.00',
          discount_amount: '0.00',
          final_amount: '100.00',
          status: 'completed',
          created_at: earlier
        },
        {
          user_id: user[0].id,
          total_amount: '50.00',
          discount_amount: '0.00',
          final_amount: '50.00',
          status: 'pending',
          created_at: now // More recent
        }
      ]).returning().execute();

      const overview = await getOrderOverview(5);

      expect(overview).toHaveLength(2);
      expect(overview[0].user_name).toBe('John Doe');
      expect(overview[0].total_amount).toBe(50.00); // Most recent order first
      expect(overview[0].status).toBe('pending');
      expect(overview[0].created_at).toBeInstanceOf(Date);
      expect(overview[0].id).toBe(orders[1].id);

      expect(overview[1].user_name).toBe('John Doe');
      expect(overview[1].total_amount).toBe(100.00);
      expect(overview[1].status).toBe('completed');
      expect(overview[1].id).toBe(orders[0].id);
    });

    it('should limit results correctly', async () => {
      // Create test user
      const user = await db.insert(usersTable).values({
        email: 'test@test.com',
        password_hash: 'hash',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      }).returning().execute();

      // Create 5 test orders
      for (let i = 0; i < 5; i++) {
        await db.insert(ordersTable).values({
          user_id: user[0].id,
          total_amount: `${(i + 1) * 10}.00`,
          discount_amount: '0.00',
          final_amount: `${(i + 1) * 10}.00`,
          status: 'completed'
        }).execute();
      }

      const overview = await getOrderOverview(3);
      expect(overview).toHaveLength(3);
      
      // Should be in descending order by creation time
      expect(overview[0].total_amount).toBe(50.00); // Most recent
      expect(overview[1].total_amount).toBe(40.00);
      expect(overview[2].total_amount).toBe(30.00);
    });
  });

  describe('getSalesReport', () => {
    it('should return zero values when no sales exist', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await getSalesReport(startDate, endDate);

      expect(report.totalSales).toBe(0);
      expect(report.totalOrders).toBe(0);
      expect(report.avgOrderValue).toBe(0);
      expect(report.topProducts).toHaveLength(0);
    });

    it('should generate comprehensive sales report', async () => {
      // Create test data
      const user = await db.insert(usersTable).values({
        email: 'test@test.com',
        password_hash: 'hash',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      }).returning().execute();

      const category = await db.insert(categoriesTable).values({
        name: 'Test Category',
        description: 'Test',
        slug: 'test-category'
      }).returning().execute();

      const products = await db.insert(productsTable).values([
        {
          name: 'Product A',
          description: 'Test Product A',
          price: '25.00',
          category_id: category[0].id
        },
        {
          name: 'Product B',
          description: 'Test Product B',
          price: '50.00',
          category_id: category[0].id
        }
      ]).returning().execute();

      const reportDate = new Date('2024-06-15');
      
      // Create completed orders
      const orders = await db.insert(ordersTable).values([
        {
          user_id: user[0].id,
          total_amount: '100.00',
          discount_amount: '0.00',
          final_amount: '100.00',
          status: 'completed',
          created_at: reportDate
        },
        {
          user_id: user[0].id,
          total_amount: '150.00',
          discount_amount: '0.00',
          final_amount: '150.00',
          status: 'completed',
          created_at: reportDate
        }
      ]).returning().execute();

      // Create order items
      await db.insert(orderItemsTable).values([
        {
          order_id: orders[0].id,
          product_id: products[0].id,
          quantity: 2,
          price: '50.00' // 2 * 25.00
        },
        {
          order_id: orders[0].id,
          product_id: products[1].id,
          quantity: 1,
          price: '50.00'
        },
        {
          order_id: orders[1].id,
          product_id: products[1].id,
          quantity: 3,
          price: '150.00' // 3 * 50.00
        }
      ]).execute();

      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-30');

      const report = await getSalesReport(startDate, endDate);

      expect(report.totalSales).toBe(250.00);
      expect(report.totalOrders).toBe(2);
      expect(report.avgOrderValue).toBe(125.00);
      expect(report.topProducts).toHaveLength(2);
      
      // Check top products are sorted by revenue
      expect(report.topProducts[0].productName).toBe('Product B');
      expect(report.topProducts[0].revenue).toBe(200.00); // 50 + 150
      expect(report.topProducts[0].quantity).toBe(4); // 1 + 3

      expect(report.topProducts[1].productName).toBe('Product A');
      expect(report.topProducts[1].revenue).toBe(50.00);
      expect(report.topProducts[1].quantity).toBe(2);
    });

    it('should only include completed orders in date range', async () => {
      // Create test data
      const user = await db.insert(usersTable).values({
        email: 'test@test.com',
        password_hash: 'hash',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      }).returning().execute();

      const insideDate = new Date('2024-06-15');
      const outsideDate = new Date('2024-07-15');

      await db.insert(ordersTable).values([
        {
          user_id: user[0].id,
          total_amount: '100.00',
          discount_amount: '0.00',
          final_amount: '100.00',
          status: 'completed',
          created_at: insideDate
        },
        {
          user_id: user[0].id,
          total_amount: '50.00',
          discount_amount: '0.00',
          final_amount: '50.00',
          status: 'pending', // Not completed
          created_at: insideDate
        },
        {
          user_id: user[0].id,
          total_amount: '75.00',
          discount_amount: '0.00',
          final_amount: '75.00',
          status: 'completed',
          created_at: outsideDate // Outside date range
        }
      ]).execute();

      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-30');

      const report = await getSalesReport(startDate, endDate);

      expect(report.totalSales).toBe(100.00); // Only the completed order in range
      expect(report.totalOrders).toBe(1);
      expect(report.avgOrderValue).toBe(100.00);
    });
  });
});