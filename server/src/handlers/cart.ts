import { db } from '../db';
import { cartItemsTable, productsTable } from '../db/schema';
import { type AddToCartInput, type UpdateCartItemInput, type CartItem } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export const addToCart = async (input: AddToCartInput): Promise<CartItem> => {
  try {
    // Check if item already exists in cart
    const existingItem = await db.select()
      .from(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.user_id, input.user_id),
          eq(cartItemsTable.product_id, input.product_id)
        )
      )
      .execute();

    if (existingItem.length > 0) {
      // Update existing item quantity
      const updated = await db.update(cartItemsTable)
        .set({
          quantity: existingItem[0].quantity + input.quantity,
          updated_at: new Date()
        })
        .where(eq(cartItemsTable.id, existingItem[0].id))
        .returning()
        .execute();

      return updated[0];
    } else {
      // Insert new item
      const result = await db.insert(cartItemsTable)
        .values({
          user_id: input.user_id,
          product_id: input.product_id,
          quantity: input.quantity
        })
        .returning()
        .execute();

      return result[0];
    }
  } catch (error) {
    console.error('Add to cart failed:', error);
    throw error;
  }
};

export const getCartItems = async (userId: number): Promise<CartItem[]> => {
  try {
    const result = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.user_id, userId))
      .execute();

    return result;
  } catch (error) {
    console.error('Get cart items failed:', error);
    throw error;
  }
};

export const updateCartItem = async (input: UpdateCartItemInput): Promise<CartItem> => {
  try {
    const result = await db.update(cartItemsTable)
      .set({
        quantity: input.quantity,
        updated_at: new Date()
      })
      .where(eq(cartItemsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Cart item not found');
    }

    return result[0];
  } catch (error) {
    console.error('Update cart item failed:', error);
    throw error;
  }
};

export const removeFromCart = async (id: number): Promise<boolean> => {
  try {
    const result = await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Remove from cart failed:', error);
    throw error;
  }
};

export const clearCart = async (userId: number): Promise<boolean> => {
  try {
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.user_id, userId))
      .execute();

    return true;
  } catch (error) {
    console.error('Clear cart failed:', error);
    throw error;
  }
};

export const getCartSummary = async (userId: number): Promise<{ items: CartItem[]; total: number; itemCount: number }> => {
  try {
    // Get cart items with product details for price calculation
    const cartWithProducts = await db.select({
      cart_item: cartItemsTable,
      product: productsTable
    })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(cartItemsTable.product_id, productsTable.id))
      .where(eq(cartItemsTable.user_id, userId))
      .execute();

    const items = cartWithProducts.map(result => result.cart_item);
    
    // Calculate total price
    const total = cartWithProducts.reduce((sum, result) => {
      const price = parseFloat(result.product.price);
      return sum + (price * result.cart_item.quantity);
    }, 0);

    // Calculate item count
    const itemCount = items.reduce((count, item) => count + item.quantity, 0);

    return {
      items,
      total,
      itemCount
    };
  } catch (error) {
    console.error('Get cart summary failed:', error);
    throw error;
  }
};