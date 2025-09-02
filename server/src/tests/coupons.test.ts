import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { couponsTable } from '../db/schema';
import { type CreateCouponInput } from '../schema';
import { 
  createCoupon, 
  getCoupons, 
  getCouponByCode, 
  validateCoupon, 
  updateCoupon, 
  deleteCoupon 
} from '../handlers/coupons';
import { eq } from 'drizzle-orm';

// Test inputs
const futureDate = new Date();
futureDate.setFullYear(futureDate.getFullYear() + 1); // One year in the future

const percentageCouponInput: CreateCouponInput = {
  code: 'SAVE10',
  discount_percentage: 10,
  discount_amount: null,
  min_order_amount: 50.00,
  max_uses: 100,
  expires_at: futureDate
};

const fixedAmountCouponInput: CreateCouponInput = {
  code: 'FIXED20',
  discount_percentage: null,
  discount_amount: 20.00,
  min_order_amount: null,
  max_uses: null,
  expires_at: null
};

describe('createCoupon', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a percentage-based coupon', async () => {
    const result = await createCoupon(percentageCouponInput);

    expect(result.code).toEqual('SAVE10');
    expect(result.discount_percentage).toEqual(10);
    expect(result.discount_amount).toBeNull();
    expect(result.min_order_amount).toEqual(50.00);
    expect(result.max_uses).toEqual(100);
    expect(result.current_uses).toEqual(0);
    expect(result.expires_at).toEqual(futureDate);
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(typeof result.discount_percentage).toBe('number');
  });

  it('should create a fixed amount coupon', async () => {
    const result = await createCoupon(fixedAmountCouponInput);

    expect(result.code).toEqual('FIXED20');
    expect(result.discount_percentage).toBeNull();
    expect(result.discount_amount).toEqual(20.00);
    expect(result.min_order_amount).toBeNull();
    expect(result.max_uses).toBeNull();
    expect(result.expires_at).toBeNull();
    expect(result.is_active).toBe(true);
    expect(typeof result.discount_amount).toBe('number');
  });

  it('should save coupon to database', async () => {
    const result = await createCoupon(percentageCouponInput);

    const coupons = await db.select()
      .from(couponsTable)
      .where(eq(couponsTable.id, result.id))
      .execute();

    expect(coupons).toHaveLength(1);
    expect(coupons[0].code).toEqual('SAVE10');
    expect(parseFloat(coupons[0].discount_percentage!)).toEqual(10);
    expect(coupons[0].is_active).toBe(true);
  });

  it('should reject coupon without discount values', async () => {
    const invalidInput: CreateCouponInput = {
      code: 'INVALID',
      discount_percentage: null,
      discount_amount: null,
      min_order_amount: null,
      max_uses: null,
      expires_at: null
    };

    await expect(createCoupon(invalidInput)).rejects.toThrow(/must have either discount_percentage or discount_amount/i);
  });

  it('should reject coupon with both discount types', async () => {
    const invalidInput: CreateCouponInput = {
      code: 'INVALID',
      discount_percentage: 10,
      discount_amount: 20.00,
      min_order_amount: null,
      max_uses: null,
      expires_at: null
    };

    await expect(createCoupon(invalidInput)).rejects.toThrow(/cannot have both discount_percentage and discount_amount/i);
  });
});

describe('getCoupons', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no coupons exist', async () => {
    const result = await getCoupons();
    expect(result).toEqual([]);
  });

  it('should return all coupons with proper numeric conversions', async () => {
    await createCoupon(percentageCouponInput);
    await createCoupon(fixedAmountCouponInput);

    const result = await getCoupons();

    expect(result).toHaveLength(2);
    
    const percentageCoupon = result.find(c => c.code === 'SAVE10');
    const fixedCoupon = result.find(c => c.code === 'FIXED20');

    expect(percentageCoupon?.discount_percentage).toEqual(10);
    expect(percentageCoupon?.min_order_amount).toEqual(50.00);
    expect(typeof percentageCoupon?.discount_percentage).toBe('number');
    expect(typeof percentageCoupon?.min_order_amount).toBe('number');

    expect(fixedCoupon?.discount_amount).toEqual(20.00);
    expect(typeof fixedCoupon?.discount_amount).toBe('number');
  });
});

describe('getCouponByCode', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent code', async () => {
    const result = await getCouponByCode('NONEXISTENT');
    expect(result).toBeNull();
  });

  it('should return coupon by code with numeric conversions', async () => {
    await createCoupon(percentageCouponInput);

    const result = await getCouponByCode('SAVE10');

    expect(result).not.toBeNull();
    expect(result!.code).toEqual('SAVE10');
    expect(result!.discount_percentage).toEqual(10);
    expect(result!.min_order_amount).toEqual(50.00);
    expect(typeof result!.discount_percentage).toBe('number');
    expect(typeof result!.min_order_amount).toBe('number');
  });
});

describe('validateCoupon', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return invalid for non-existent coupon', async () => {
    const result = await validateCoupon('NONEXISTENT', 100);
    
    expect(result.valid).toBe(false);
    expect(result.discount).toEqual(0);
    expect(result.coupon).toBeUndefined();
  });

  it('should validate percentage coupon correctly', async () => {
    await createCoupon(percentageCouponInput);

    const result = await validateCoupon('SAVE10', 100.00);

    expect(result.valid).toBe(true);
    expect(result.discount).toEqual(10.00); // 10% of 100
    expect(result.coupon).toBeDefined();
    expect(result.coupon!.code).toEqual('SAVE10');
  });

  it('should validate fixed amount coupon correctly', async () => {
    await createCoupon(fixedAmountCouponInput);

    const result = await validateCoupon('FIXED20', 100.00);

    expect(result.valid).toBe(true);
    expect(result.discount).toEqual(20.00);
    expect(result.coupon!.code).toEqual('FIXED20');
  });

  it('should reject coupon below minimum order amount', async () => {
    await createCoupon(percentageCouponInput); // min_order_amount: 50

    const result = await validateCoupon('SAVE10', 30.00);

    expect(result.valid).toBe(false);
    expect(result.discount).toEqual(0);
  });

  it('should reject inactive coupon', async () => {
    const createdCoupon = await createCoupon(percentageCouponInput);
    
    // Deactivate the coupon
    await db.update(couponsTable)
      .set({ is_active: false })
      .where(eq(couponsTable.id, createdCoupon.id))
      .execute();

    const result = await validateCoupon('SAVE10', 100.00);

    expect(result.valid).toBe(false);
    expect(result.discount).toEqual(0);
  });

  it('should reject expired coupon', async () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1); // One year in the past
    
    const expiredInput: CreateCouponInput = {
      ...percentageCouponInput,
      code: 'EXPIRED',
      expires_at: pastDate
    };

    await createCoupon(expiredInput);

    const result = await validateCoupon('EXPIRED', 100.00);

    expect(result.valid).toBe(false);
    expect(result.discount).toEqual(0);
  });

  it('should reject coupon that exceeded usage limits', async () => {
    const limitedInput: CreateCouponInput = {
      ...percentageCouponInput,
      code: 'LIMITED',
      max_uses: 1
    };

    const createdCoupon = await createCoupon(limitedInput);
    
    // Set current_uses to max_uses
    await db.update(couponsTable)
      .set({ current_uses: 1 })
      .where(eq(couponsTable.id, createdCoupon.id))
      .execute();

    const result = await validateCoupon('LIMITED', 100.00);

    expect(result.valid).toBe(false);
    expect(result.discount).toEqual(0);
  });

  it('should cap discount at order amount for fixed coupons', async () => {
    const highFixedInput: CreateCouponInput = {
      code: 'HIGH50',
      discount_percentage: null,
      discount_amount: 50.00,
      min_order_amount: null,
      max_uses: null,
      expires_at: null
    };

    await createCoupon(highFixedInput);

    const result = await validateCoupon('HIGH50', 30.00); // Order less than discount

    expect(result.valid).toBe(true);
    expect(result.discount).toEqual(30.00); // Capped at order amount
  });
});

describe('updateCoupon', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update coupon fields', async () => {
    const createdCoupon = await createCoupon(percentageCouponInput);

    const updateInput = {
      id: createdCoupon.id,
      code: 'UPDATED10',
      discount_percentage: 15,
      is_active: false
    };

    const result = await updateCoupon(updateInput);

    expect(result.id).toEqual(createdCoupon.id);
    expect(result.code).toEqual('UPDATED10');
    expect(result.discount_percentage).toEqual(15);
    expect(result.is_active).toBe(false);
    expect(result.updated_at.getTime()).toBeGreaterThan(createdCoupon.updated_at.getTime());
    expect(typeof result.discount_percentage).toBe('number');
  });

  it('should update coupon in database', async () => {
    const createdCoupon = await createCoupon(percentageCouponInput);

    const updateInput = {
      id: createdCoupon.id,
      code: 'UPDATED10'
    };

    await updateCoupon(updateInput);

    const coupons = await db.select()
      .from(couponsTable)
      .where(eq(couponsTable.id, createdCoupon.id))
      .execute();

    expect(coupons).toHaveLength(1);
    expect(coupons[0].code).toEqual('UPDATED10');
  });

  it('should reject update with both discount types', async () => {
    const createdCoupon = await createCoupon(percentageCouponInput);

    const invalidUpdate = {
      id: createdCoupon.id,
      discount_percentage: 10,
      discount_amount: 20.00
    };

    await expect(updateCoupon(invalidUpdate)).rejects.toThrow(/cannot have both discount_percentage and discount_amount/i);
  });

  it('should throw error for non-existent coupon', async () => {
    const updateInput = {
      id: 999999,
      code: 'NONEXISTENT'
    };

    await expect(updateCoupon(updateInput)).rejects.toThrow(/coupon not found/i);
  });
});

describe('deleteCoupon', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should soft delete coupon by setting is_active to false', async () => {
    const createdCoupon = await createCoupon(percentageCouponInput);

    const result = await deleteCoupon(createdCoupon.id);

    expect(result).toBe(true);

    // Verify the coupon is deactivated but still exists
    const coupons = await db.select()
      .from(couponsTable)
      .where(eq(couponsTable.id, createdCoupon.id))
      .execute();

    expect(coupons).toHaveLength(1);
    expect(coupons[0].is_active).toBe(false);
  });

  it('should return false for non-existent coupon', async () => {
    const result = await deleteCoupon(999999);
    expect(result).toBe(false);
  });
});