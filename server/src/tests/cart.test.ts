import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, productsTable, cartItemsTable } from '../db/schema';
import { type AddToCartInput, type UpdateCartItemInput } from '../schema';
import {
  addToCart,
  getCartItems,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary
} from '../handlers/cart';
import { eq } from 'drizzle-orm';

describe('Cart Handlers', () => {
  let testUserId: number;
  let testProductId: number;
  let testProductId2: number;
  let testCategoryId: number;

  beforeEach(async () => {
    await createDB();

    // Create test category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A test category',
        slug: 'test-category'
      })
      .returning()
      .execute();
    
    testCategoryId = categoryResult[0].id;

    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();
    
    testUserId = userResult[0].id;

    // Create test products
    const productResults = await db.insert(productsTable)
      .values([
        {
          name: 'Test Product 1',
          description: 'A test product',
          price: '19.99',
          category_id: testCategoryId
        },
        {
          name: 'Test Product 2',
          description: 'Another test product',
          price: '29.99',
          category_id: testCategoryId
        }
      ])
      .returning()
      .execute();
    
    testProductId = productResults[0].id;
    testProductId2 = productResults[1].id;
  });

  afterEach(resetDB);

  describe('addToCart', () => {
    const testInput: AddToCartInput = {
      user_id: 0, // Will be set dynamically
      product_id: 0, // Will be set dynamically
      quantity: 2
    };

    it('should add new item to cart', async () => {
      testInput.user_id = testUserId;
      testInput.product_id = testProductId;

      const result = await addToCart(testInput);

      expect(result.user_id).toEqual(testUserId);
      expect(result.product_id).toEqual(testProductId);
      expect(result.quantity).toEqual(2);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update quantity when item already exists', async () => {
      testInput.user_id = testUserId;
      testInput.product_id = testProductId;

      // Add item first time
      await addToCart(testInput);

      // Add same item again
      const result = await addToCart(testInput);

      expect(result.quantity).toEqual(4); // 2 + 2
      expect(result.user_id).toEqual(testUserId);
      expect(result.product_id).toEqual(testProductId);
    });

    it('should save item to database', async () => {
      testInput.user_id = testUserId;
      testInput.product_id = testProductId;

      const result = await addToCart(testInput);

      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, result.id))
        .execute();

      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].user_id).toEqual(testUserId);
      expect(cartItems[0].product_id).toEqual(testProductId);
      expect(cartItems[0].quantity).toEqual(2);
    });
  });

  describe('getCartItems', () => {
    it('should return empty array for user with no cart items', async () => {
      const result = await getCartItems(testUserId);
      expect(result).toEqual([]);
    });

    it('should return cart items for user', async () => {
      // Add items to cart first
      await addToCart({
        user_id: testUserId,
        product_id: testProductId,
        quantity: 2
      });
      await addToCart({
        user_id: testUserId,
        product_id: testProductId2,
        quantity: 1
      });

      const result = await getCartItems(testUserId);

      expect(result).toHaveLength(2);
      expect(result[0].user_id).toEqual(testUserId);
      expect(result[1].user_id).toEqual(testUserId);
      expect(result.some(item => item.product_id === testProductId)).toBe(true);
      expect(result.some(item => item.product_id === testProductId2)).toBe(true);
    });
  });

  describe('updateCartItem', () => {
    it('should update cart item quantity', async () => {
      // Add item first
      const addResult = await addToCart({
        user_id: testUserId,
        product_id: testProductId,
        quantity: 2
      });

      const updateInput: UpdateCartItemInput = {
        id: addResult.id,
        quantity: 5
      };

      const result = await updateCartItem(updateInput);

      expect(result.id).toEqual(addResult.id);
      expect(result.quantity).toEqual(5);
      expect(result.user_id).toEqual(testUserId);
      expect(result.product_id).toEqual(testProductId);
    });

    it('should throw error for non-existent cart item', async () => {
      const updateInput: UpdateCartItemInput = {
        id: 999999,
        quantity: 5
      };

      await expect(updateCartItem(updateInput)).rejects.toThrow(/cart item not found/i);
    });

    it('should save updated quantity to database', async () => {
      // Add item first
      const addResult = await addToCart({
        user_id: testUserId,
        product_id: testProductId,
        quantity: 2
      });

      await updateCartItem({
        id: addResult.id,
        quantity: 8
      });

      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, addResult.id))
        .execute();

      expect(cartItems[0].quantity).toEqual(8);
    });
  });

  describe('removeFromCart', () => {
    it('should remove item from cart', async () => {
      // Add item first
      const addResult = await addToCart({
        user_id: testUserId,
        product_id: testProductId,
        quantity: 2
      });

      const result = await removeFromCart(addResult.id);
      expect(result).toBe(true);

      // Verify item is removed from database
      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, addResult.id))
        .execute();

      expect(cartItems).toHaveLength(0);
    });

    it('should return true even for non-existent item', async () => {
      const result = await removeFromCart(999999);
      expect(result).toBe(true);
    });
  });

  describe('clearCart', () => {
    it('should remove all items from user cart', async () => {
      // Add multiple items
      await addToCart({
        user_id: testUserId,
        product_id: testProductId,
        quantity: 2
      });
      await addToCart({
        user_id: testUserId,
        product_id: testProductId2,
        quantity: 1
      });

      const result = await clearCart(testUserId);
      expect(result).toBe(true);

      // Verify all items are removed
      const cartItems = await getCartItems(testUserId);
      expect(cartItems).toHaveLength(0);
    });

    it('should return true for user with empty cart', async () => {
      const result = await clearCart(testUserId);
      expect(result).toBe(true);
    });
  });

  describe('getCartSummary', () => {
    it('should return empty summary for user with no cart items', async () => {
      const result = await getCartSummary(testUserId);

      expect(result.items).toEqual([]);
      expect(result.total).toEqual(0);
      expect(result.itemCount).toEqual(0);
    });

    it('should calculate cart summary correctly', async () => {
      // Add items to cart
      await addToCart({
        user_id: testUserId,
        product_id: testProductId, // $19.99
        quantity: 2
      });
      await addToCart({
        user_id: testUserId,
        product_id: testProductId2, // $29.99
        quantity: 1
      });

      const result = await getCartSummary(testUserId);

      expect(result.items).toHaveLength(2);
      expect(result.total).toEqual(69.97); // (19.99 * 2) + (29.99 * 1)
      expect(result.itemCount).toEqual(3); // 2 + 1
    });

    it('should handle multiple quantities correctly', async () => {
      await addToCart({
        user_id: testUserId,
        product_id: testProductId, // $19.99
        quantity: 3
      });

      const result = await getCartSummary(testUserId);

      expect(result.items).toHaveLength(1);
      expect(result.total).toEqual(59.97); // 19.99 * 3
      expect(result.itemCount).toEqual(3);
    });
  });
});