import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, productsTable, couponsTable, ordersTable, orderItemsTable, downloadsTable } from '../db/schema';
import { type CreateOrderInput } from '../schema';
import { 
  createOrder, 
  getOrders, 
  getOrderById, 
  getOrdersByUser, 
  updateOrderStatus, 
  updatePaymentStatus, 
  getOrderItems 
} from '../handlers/orders';
import { eq, and } from 'drizzle-orm';

describe('Order Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testCategoryId: number;
  let testProductId: number;
  let testDigitalProductId: number;
  let testCouponId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        role: 'customer'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Electronics',
        description: 'Electronic products',
        slug: 'electronics'
      })
      .returning()
      .execute();
    testCategoryId = categoryResult[0].id;

    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A test product',
        price: '29.99',
        category_id: testCategoryId
      })
      .returning()
      .execute();
    testProductId = productResult[0].id;

    // Create test digital product
    const digitalProductResult = await db.insert(productsTable)
      .values({
        name: 'Digital Product',
        description: 'A digital product',
        price: '19.99',
        category_id: testCategoryId,
        digital_file_url: 'https://example.com/download/file.pdf',
        download_limit: 5
      })
      .returning()
      .execute();
    testDigitalProductId = digitalProductResult[0].id;

    // Create test coupon
    const couponResult = await db.insert(couponsTable)
      .values({
        code: 'SAVE10',
        discount_percentage: '10.00',
        min_order_amount: '20.00',
        max_uses: 100
      })
      .returning()
      .execute();
    testCouponId = couponResult[0].id;
  });

  describe('createOrder', () => {
    const testInput: CreateOrderInput = {
      user_id: 0, // Will be set in beforeEach
      items: [
        {
          product_id: 0, // Will be set in beforeEach
          quantity: 2,
          price: 29.99
        }
      ]
    };

    beforeEach(() => {
      testInput.user_id = testUserId;
      testInput.items[0].product_id = testProductId;
    });

    it('should create an order successfully', async () => {
      const result = await createOrder(testInput);

      expect(result.user_id).toEqual(testUserId);
      expect(result.total_amount).toEqual(59.98);
      expect(result.discount_amount).toEqual(0);
      expect(result.final_amount).toEqual(59.98);
      expect(result.status).toEqual('pending');
      expect(result.payment_status).toEqual('pending');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create order with coupon discount', async () => {
      const inputWithCoupon: CreateOrderInput = {
        ...testInput,
        coupon_code: 'SAVE10'
      };

      const result = await createOrder(inputWithCoupon);

      expect(result.total_amount).toEqual(59.98);
      expect(result.discount_amount).toEqual(6);
      expect(result.final_amount).toEqual(53.98);
      expect(result.coupon_id).toEqual(testCouponId);
    });

    it('should create order items in database', async () => {
      const result = await createOrder(testInput);

      const orderItems = await db.select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.order_id, result.id))
        .execute();

      expect(orderItems).toHaveLength(1);
      expect(orderItems[0].product_id).toEqual(testProductId);
      expect(orderItems[0].quantity).toEqual(2);
      expect(parseFloat(orderItems[0].price)).toEqual(29.99);
    });

    it('should reject order for non-existent user', async () => {
      const invalidInput: CreateOrderInput = {
        ...testInput,
        user_id: 99999
      };

      await expect(createOrder(invalidInput)).rejects.toThrow(/User with id 99999 not found/);
    });

    it('should reject order for non-existent product', async () => {
      const invalidInput: CreateOrderInput = {
        ...testInput,
        items: [{
          product_id: 99999,
          quantity: 1,
          price: 10.00
        }]
      };

      await expect(createOrder(invalidInput)).rejects.toThrow(/Product with id 99999 not found/);
    });

    it('should reject expired coupon', async () => {
      // Create expired coupon
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      await db.insert(couponsTable)
        .values({
          code: 'EXPIRED',
          discount_percentage: '20.00',
          expires_at: expiredDate
        })
        .execute();

      const inputWithExpiredCoupon: CreateOrderInput = {
        ...testInput,
        coupon_code: 'EXPIRED'
      };

      await expect(createOrder(inputWithExpiredCoupon)).rejects.toThrow(/Coupon has expired/);
    });

    it('should reject coupon when minimum order not met', async () => {
      const inputWithSmallOrder: CreateOrderInput = {
        ...testInput,
        items: [{
          product_id: testProductId,
          quantity: 1,
          price: 10.00
        }],
        coupon_code: 'SAVE10'
      };

      await expect(createOrder(inputWithSmallOrder)).rejects.toThrow(/Minimum order amount of 20.00 required/);
    });
  });

  describe('getOrders', () => {
    it('should return all orders', async () => {
      // Create test orders
      await createOrder({
        user_id: testUserId,
        items: [{
          product_id: testProductId,
          quantity: 1,
          price: 29.99
        }]
      });

      await createOrder({
        user_id: testUserId,
        items: [{
          product_id: testProductId,
          quantity: 2,
          price: 29.99
        }]
      });

      const orders = await getOrders();

      expect(orders).toHaveLength(2);
      expect(orders[0].total_amount).toEqual(29.99);
      expect(orders[1].total_amount).toEqual(59.98);
    });

    it('should return empty array when no orders exist', async () => {
      const orders = await getOrders();
      expect(orders).toHaveLength(0);
    });
  });

  describe('getOrderById', () => {
    it('should return order by id', async () => {
      const createdOrder = await createOrder({
        user_id: testUserId,
        items: [{
          product_id: testProductId,
          quantity: 1,
          price: 29.99
        }]
      });

      const order = await getOrderById(createdOrder.id);

      expect(order).toBeDefined();
      expect(order!.id).toEqual(createdOrder.id);
      expect(order!.total_amount).toEqual(29.99);
    });

    it('should return null for non-existent order', async () => {
      const order = await getOrderById(99999);
      expect(order).toBeNull();
    });
  });

  describe('getOrdersByUser', () => {
    it('should return orders for specific user', async () => {
      // Create another user
      const user2Result = await db.insert(usersTable)
        .values({
          email: 'user2@example.com',
          password_hash: 'hashedpassword',
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'customer'
        })
        .returning()
        .execute();
      const user2Id = user2Result[0].id;

      // Create orders for different users
      await createOrder({
        user_id: testUserId,
        items: [{
          product_id: testProductId,
          quantity: 1,
          price: 29.99
        }]
      });

      await createOrder({
        user_id: user2Id,
        items: [{
          product_id: testProductId,
          quantity: 2,
          price: 29.99
        }]
      });

      const user1Orders = await getOrdersByUser(testUserId);
      const user2Orders = await getOrdersByUser(user2Id);

      expect(user1Orders).toHaveLength(1);
      expect(user2Orders).toHaveLength(1);
      expect(user1Orders[0].user_id).toEqual(testUserId);
      expect(user2Orders[0].user_id).toEqual(user2Id);
    });

    it('should reject for non-existent user', async () => {
      await expect(getOrdersByUser(99999)).rejects.toThrow(/User with id 99999 not found/);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const createdOrder = await createOrder({
        user_id: testUserId,
        items: [{
          product_id: testProductId,
          quantity: 1,
          price: 29.99
        }]
      });

      const updatedOrder = await updateOrderStatus(createdOrder.id, 'completed');

      expect(updatedOrder.status).toEqual('completed');
      expect(updatedOrder.updated_at).toBeInstanceOf(Date);
    });

    it('should create download records when order is completed and payment is completed', async () => {
      const createdOrder = await createOrder({
        user_id: testUserId,
        items: [{
          product_id: testDigitalProductId,
          quantity: 1,
          price: 19.99
        }]
      });

      // First complete payment
      await updatePaymentStatus(createdOrder.id, 'completed');
      
      // Then complete order (should trigger download creation)
      await updateOrderStatus(createdOrder.id, 'completed');

      const downloads = await db.select()
        .from(downloadsTable)
        .where(and(
          eq(downloadsTable.order_id, createdOrder.id),
          eq(downloadsTable.product_id, testDigitalProductId)
        ))
        .execute();

      expect(downloads).toHaveLength(1);
      expect(downloads[0].user_id).toEqual(testUserId);
      expect(downloads[0].download_count).toEqual(0);
      expect(downloads[0].expires_at).toBeInstanceOf(Date);
    });

    it('should reject update for non-existent order', async () => {
      await expect(updateOrderStatus(99999, 'completed')).rejects.toThrow(/Order with id 99999 not found/);
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status', async () => {
      const createdOrder = await createOrder({
        user_id: testUserId,
        items: [{
          product_id: testProductId,
          quantity: 1,
          price: 29.99
        }]
      });

      const updatedOrder = await updatePaymentStatus(createdOrder.id, 'completed');

      expect(updatedOrder.payment_status).toEqual('completed');
      expect(updatedOrder.updated_at).toBeInstanceOf(Date);
    });

    it('should reject update for non-existent order', async () => {
      await expect(updatePaymentStatus(99999, 'completed')).rejects.toThrow(/Order with id 99999 not found/);
    });
  });

  describe('getOrderItems', () => {
    it('should return order items', async () => {
      const createdOrder = await createOrder({
        user_id: testUserId,
        items: [
          {
            product_id: testProductId,
            quantity: 2,
            price: 29.99
          },
          {
            product_id: testDigitalProductId,
            quantity: 1,
            price: 19.99
          }
        ]
      });

      const orderItems = await getOrderItems(createdOrder.id);

      expect(orderItems).toHaveLength(2);
      expect(orderItems[0].order_id).toEqual(createdOrder.id);
      expect(typeof orderItems[0].price).toEqual('number');
      
      // Verify both products are included
      const productIds = orderItems.map(item => item.product_id);
      expect(productIds).toContain(testProductId);
      expect(productIds).toContain(testDigitalProductId);
    });

    it('should reject for non-existent order', async () => {
      await expect(getOrderItems(99999)).rejects.toThrow(/Order with id 99999 not found/);
    });

    it('should return empty array for order with no items', async () => {
      // Create order directly in database without items
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: testUserId,
          total_amount: '0.00',
          discount_amount: '0.00',
          final_amount: '0.00'
        })
        .returning()
        .execute();

      const orderItems = await getOrderItems(orderResult[0].id);
      expect(orderItems).toHaveLength(0);
    });
  });

  describe('coupon usage limits', () => {
    it('should reject coupon when usage limit exceeded', async () => {
      // Create coupon with max_uses = 1
      const limitedCouponResult = await db.insert(couponsTable)
        .values({
          code: 'LIMITED',
          discount_percentage: '15.00',
          max_uses: 1,
          current_uses: 0
        })
        .returning()
        .execute();

      // First order should succeed
      await createOrder({
        user_id: testUserId,
        items: [{
          product_id: testProductId,
          quantity: 1,
          price: 29.99
        }],
        coupon_code: 'LIMITED'
      });

      // Second order should fail
      await expect(createOrder({
        user_id: testUserId,
        items: [{
          product_id: testProductId,
          quantity: 1,
          price: 29.99
        }],
        coupon_code: 'LIMITED'
      })).rejects.toThrow(/Coupon usage limit exceeded/);
    });
  });
});