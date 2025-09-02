import { db } from '../db';
import { couponsTable } from '../db/schema';
import { type CreateCouponInput, type UpdateCouponInput, type Coupon } from '../schema';
import { eq } from 'drizzle-orm';

export const createCoupon = async (input: CreateCouponInput): Promise<Coupon> => {
  try {
    // Validate discount rules - must have either discount_percentage OR discount_amount
    if (!input.discount_percentage && !input.discount_amount) {
      throw new Error('Coupon must have either discount_percentage or discount_amount');
    }

    if (input.discount_percentage && input.discount_amount) {
      throw new Error('Coupon cannot have both discount_percentage and discount_amount');
    }

    // Insert coupon record
    const result = await db.insert(couponsTable)
      .values({
        code: input.code,
        discount_percentage: input.discount_percentage ? input.discount_percentage.toString() : null,
        discount_amount: input.discount_amount ? input.discount_amount.toString() : null,
        min_order_amount: input.min_order_amount ? input.min_order_amount.toString() : null,
        max_uses: input.max_uses,
        expires_at: input.expires_at
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const coupon = result[0];
    return {
      ...coupon,
      discount_percentage: coupon.discount_percentage ? parseFloat(coupon.discount_percentage) : null,
      discount_amount: coupon.discount_amount ? parseFloat(coupon.discount_amount) : null,
      min_order_amount: coupon.min_order_amount ? parseFloat(coupon.min_order_amount) : null
    };
  } catch (error) {
    console.error('Coupon creation failed:', error);
    throw error;
  }
};

export const getCoupons = async (): Promise<Coupon[]> => {
  try {
    const results = await db.select()
      .from(couponsTable)
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(coupon => ({
      ...coupon,
      discount_percentage: coupon.discount_percentage ? parseFloat(coupon.discount_percentage) : null,
      discount_amount: coupon.discount_amount ? parseFloat(coupon.discount_amount) : null,
      min_order_amount: coupon.min_order_amount ? parseFloat(coupon.min_order_amount) : null
    }));
  } catch (error) {
    console.error('Failed to fetch coupons:', error);
    throw error;
  }
};

export const getCouponByCode = async (code: string): Promise<Coupon | null> => {
  try {
    const results = await db.select()
      .from(couponsTable)
      .where(eq(couponsTable.code, code))
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers before returning
    const coupon = results[0];
    return {
      ...coupon,
      discount_percentage: coupon.discount_percentage ? parseFloat(coupon.discount_percentage) : null,
      discount_amount: coupon.discount_amount ? parseFloat(coupon.discount_amount) : null,
      min_order_amount: coupon.min_order_amount ? parseFloat(coupon.min_order_amount) : null
    };
  } catch (error) {
    console.error('Failed to fetch coupon by code:', error);
    throw error;
  }
};

export const validateCoupon = async (code: string, orderAmount: number): Promise<{ valid: boolean; discount: number; coupon?: Coupon }> => {
  try {
    const coupon = await getCouponByCode(code);

    if (!coupon) {
      return { valid: false, discount: 0 };
    }

    // Check if coupon is active
    if (!coupon.is_active) {
      return { valid: false, discount: 0 };
    }

    // Check if coupon has expired
    if (coupon.expires_at && coupon.expires_at < new Date()) {
      return { valid: false, discount: 0 };
    }

    // Check usage limits
    if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
      return { valid: false, discount: 0 };
    }

    // Check minimum order amount
    if (coupon.min_order_amount !== null && orderAmount < coupon.min_order_amount) {
      return { valid: false, discount: 0 };
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discount_percentage !== null) {
      discount = (orderAmount * coupon.discount_percentage) / 100;
    } else if (coupon.discount_amount !== null) {
      discount = coupon.discount_amount;
    }

    // Ensure discount doesn't exceed order amount
    discount = Math.min(discount, orderAmount);

    return {
      valid: true,
      discount,
      coupon
    };
  } catch (error) {
    console.error('Coupon validation failed:', error);
    throw error;
  }
};

export const updateCoupon = async (input: UpdateCouponInput): Promise<Coupon> => {
  try {
    // Validate discount rules if both fields are being updated
    if (input.discount_percentage !== undefined && input.discount_amount !== undefined) {
      if (input.discount_percentage && input.discount_amount) {
        throw new Error('Coupon cannot have both discount_percentage and discount_amount');
      }
    }

    // Prepare update values, converting numbers to strings for numeric columns
    const updateValues: any = {};
    if (input.code !== undefined) updateValues.code = input.code;
    if (input.discount_percentage !== undefined) {
      updateValues.discount_percentage = input.discount_percentage ? input.discount_percentage.toString() : null;
    }
    if (input.discount_amount !== undefined) {
      updateValues.discount_amount = input.discount_amount ? input.discount_amount.toString() : null;
    }
    if (input.min_order_amount !== undefined) {
      updateValues.min_order_amount = input.min_order_amount ? input.min_order_amount.toString() : null;
    }
    if (input.max_uses !== undefined) updateValues.max_uses = input.max_uses;
    if (input.expires_at !== undefined) updateValues.expires_at = input.expires_at;
    if (input.is_active !== undefined) updateValues.is_active = input.is_active;

    // Always update the updated_at timestamp
    updateValues.updated_at = new Date();

    const result = await db.update(couponsTable)
      .set(updateValues)
      .where(eq(couponsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Coupon not found');
    }

    // Convert numeric fields back to numbers before returning
    const coupon = result[0];
    return {
      ...coupon,
      discount_percentage: coupon.discount_percentage ? parseFloat(coupon.discount_percentage) : null,
      discount_amount: coupon.discount_amount ? parseFloat(coupon.discount_amount) : null,
      min_order_amount: coupon.min_order_amount ? parseFloat(coupon.min_order_amount) : null
    };
  } catch (error) {
    console.error('Coupon update failed:', error);
    throw error;
  }
};

export const deleteCoupon = async (id: number): Promise<boolean> => {
  try {
    const result = await db.update(couponsTable)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(couponsTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Coupon deletion failed:', error);
    throw error;
  }
};