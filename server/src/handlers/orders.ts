import { db } from '../db';
import { ordersTable, orderItemsTable, usersTable, couponsTable, productsTable, downloadsTable } from '../db/schema';
import { type CreateOrderInput, type Order, type OrderItem } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

export const createOrder = async (input: CreateOrderInput): Promise<Order> => {
  try {
    // Verify user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Verify all products exist and calculate total
    let totalAmount = 0;
    for (const item of input.items) {
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, item.product_id))
        .execute();

      if (products.length === 0) {
        throw new Error(`Product with id ${item.product_id} not found`);
      }

      totalAmount += item.price * item.quantity;
    }

    // Handle coupon if provided
    let couponId: number | null = null;
    let discountAmount = 0;

    if (input.coupon_code) {
      const coupons = await db.select()
        .from(couponsTable)
        .where(and(
          eq(couponsTable.code, input.coupon_code),
          eq(couponsTable.is_active, true)
        ))
        .execute();

      if (coupons.length > 0) {
        const coupon = coupons[0];
        
        // Check if coupon is expired
        if (coupon.expires_at && new Date() > coupon.expires_at) {
          throw new Error('Coupon has expired');
        }

        // Check usage limit
        if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
          throw new Error('Coupon usage limit exceeded');
        }

        // Check minimum order amount
        if (coupon.min_order_amount && totalAmount < parseFloat(coupon.min_order_amount)) {
          throw new Error(`Minimum order amount of ${coupon.min_order_amount} required for this coupon`);
        }

        couponId = coupon.id;

        // Calculate discount
        if (coupon.discount_percentage) {
          discountAmount = Math.round((totalAmount * (parseFloat(coupon.discount_percentage) / 100)) * 1000) / 1000;
        } else if (coupon.discount_amount) {
          discountAmount = parseFloat(coupon.discount_amount);
        }

        // Update coupon usage
        await db.update(couponsTable)
          .set({ current_uses: coupon.current_uses + 1 })
          .where(eq(couponsTable.id, coupon.id))
          .execute();
      }
    }

    const finalAmount = totalAmount - discountAmount;

    // Create order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: input.user_id,
        total_amount: totalAmount.toString(),
        discount_amount: discountAmount.toString(),
        final_amount: finalAmount.toString(),
        coupon_id: couponId,
        status: 'pending',
        payment_status: 'pending'
      })
      .returning()
      .execute();

    const order = orderResult[0];

    // Create order items
    for (const item of input.items) {
      await db.insert(orderItemsTable)
        .values({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price.toString()
        })
        .execute();
    }

    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      discount_amount: parseFloat(order.discount_amount),
      final_amount: parseFloat(order.final_amount)
    };
  } catch (error) {
    console.error('Order creation failed:', error);
    throw error;
  }
};

export const getOrders = async (): Promise<Order[]> => {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .execute();

    return orders.map(order => ({
      ...order,
      total_amount: parseFloat(order.total_amount),
      discount_amount: parseFloat(order.discount_amount),
      final_amount: parseFloat(order.final_amount)
    }));
  } catch (error) {
    console.error('Fetching orders failed:', error);
    throw error;
  }
};

export const getOrderById = async (id: number): Promise<Order | null> => {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .execute();

    if (orders.length === 0) {
      return null;
    }

    const order = orders[0];
    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      discount_amount: parseFloat(order.discount_amount),
      final_amount: parseFloat(order.final_amount)
    };
  } catch (error) {
    console.error('Fetching order by id failed:', error);
    throw error;
  }
};

export const getOrdersByUser = async (userId: number): Promise<Order[]> => {
  try {
    // Verify user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.user_id, userId))
      .execute();

    return orders.map(order => ({
      ...order,
      total_amount: parseFloat(order.total_amount),
      discount_amount: parseFloat(order.discount_amount),
      final_amount: parseFloat(order.final_amount)
    }));
  } catch (error) {
    console.error('Fetching orders by user failed:', error);
    throw error;
  }
};

export const updateOrderStatus = async (id: number, status: 'pending' | 'completed' | 'cancelled' | 'refunded'): Promise<Order> => {
  try {
    // Verify order exists
    const existingOrders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .execute();

    if (existingOrders.length === 0) {
      throw new Error(`Order with id ${id} not found`);
    }

    const updatedOrders = await db.update(ordersTable)
      .set({ 
        status,
        updated_at: new Date()
      })
      .where(eq(ordersTable.id, id))
      .returning()
      .execute();

    const order = updatedOrders[0];

    // If order is completed and payment is also completed, create download records for digital products
    if (status === 'completed' && order.payment_status === 'completed') {
      await createDownloadRecords(id);
    }

    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      discount_amount: parseFloat(order.discount_amount),
      final_amount: parseFloat(order.final_amount)
    };
  } catch (error) {
    console.error('Updating order status failed:', error);
    throw error;
  }
};

export const updatePaymentStatus = async (id: number, paymentStatus: 'pending' | 'completed' | 'failed'): Promise<Order> => {
  try {
    // Verify order exists
    const existingOrders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .execute();

    if (existingOrders.length === 0) {
      throw new Error(`Order with id ${id} not found`);
    }

    const updatedOrders = await db.update(ordersTable)
      .set({ 
        payment_status: paymentStatus,
        updated_at: new Date()
      })
      .where(eq(ordersTable.id, id))
      .returning()
      .execute();

    const order = updatedOrders[0];

    // If payment is completed and order is also completed, create download records for digital products
    if (paymentStatus === 'completed' && order.status === 'completed') {
      await createDownloadRecords(id);
    }

    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      discount_amount: parseFloat(order.discount_amount),
      final_amount: parseFloat(order.final_amount)
    };
  } catch (error) {
    console.error('Updating payment status failed:', error);
    throw error;
  }
};

export const getOrderItems = async (orderId: number): Promise<OrderItem[]> => {
  try {
    // Verify order exists
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .execute();

    if (orders.length === 0) {
      throw new Error(`Order with id ${orderId} not found`);
    }

    const orderItems = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.order_id, orderId))
      .execute();

    return orderItems.map(item => ({
      ...item,
      price: parseFloat(item.price)
    }));
  } catch (error) {
    console.error('Fetching order items failed:', error);
    throw error;
  }
};

// Helper function to create download records for digital products
const createDownloadRecords = async (orderId: number): Promise<void> => {
  try {
    const orderItems = await db.select({
      order_id: orderItemsTable.order_id,
      product_id: orderItemsTable.product_id,
      user_id: ordersTable.user_id,
      digital_file_url: productsTable.digital_file_url,
      download_limit: productsTable.download_limit
    })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.order_id, ordersTable.id))
      .innerJoin(productsTable, eq(orderItemsTable.product_id, productsTable.id))
      .where(eq(orderItemsTable.order_id, orderId))
      .execute();

    for (const item of orderItems) {
      // Only create download records for digital products (products with digital_file_url)
      if (item.digital_file_url) {
        // Check if download record already exists
        const existingDownloads = await db.select()
          .from(downloadsTable)
          .where(and(
            eq(downloadsTable.order_id, orderId),
            eq(downloadsTable.product_id, item.product_id),
            eq(downloadsTable.user_id, item.user_id)
          ))
          .execute();

        if (existingDownloads.length === 0) {
          // Set expiration date (30 days from now) if download limit is set
          let expiresAt: Date | null = null;
          if (item.download_limit) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
          }

          await db.insert(downloadsTable)
            .values({
              user_id: item.user_id,
              product_id: item.product_id,
              order_id: orderId,
              download_count: 0,
              expires_at: expiresAt
            })
            .execute();
        }
      }
    }
  } catch (error) {
    console.error('Creating download records failed:', error);
    // Don't throw error here as it shouldn't prevent order completion
  }
};