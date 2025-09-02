import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, productsTable, ordersTable, downloadsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type CreateDownloadInput } from '../schema';
import {
  createDownload,
  getDownloadsByUser,
  getDownloadById,
  validateDownload,
  incrementDownloadCount,
  generateDownloadToken,
  validateDownloadToken
} from '../handlers/downloads';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashedpassword',
  first_name: 'John',
  last_name: 'Doe',
  role: 'customer' as const
};

const testCategory = {
  name: 'Digital Products',
  description: 'Test category',
  slug: 'digital-products'
};

const testProduct = {
  name: 'Test Digital Product',
  description: 'A test digital product',
  price: '29.99',
  digital_file_url: 'https://example.com/file.pdf',
  download_limit: 5
};

const testProductUnlimited = {
  name: 'Unlimited Product',
  description: 'Product with no download limit',
  price: '49.99',
  digital_file_url: 'https://example.com/unlimited.pdf',
  download_limit: null
};

const testOrder = {
  total_amount: '29.99',
  discount_amount: '0.00',
  final_amount: '29.99',
  status: 'completed' as const,
  payment_status: 'completed' as const
};

describe('Downloads', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let categoryId: number;
  let productId: number;
  let productUnlimitedId: number;
  let orderId: number;

  beforeEach(async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    categoryId = categoryResult[0].id;

    const productResult = await db.insert(productsTable)
      .values({
        ...testProduct,
        category_id: categoryId
      })
      .returning()
      .execute();
    productId = productResult[0].id;

    const productUnlimitedResult = await db.insert(productsTable)
      .values({
        ...testProductUnlimited,
        category_id: categoryId
      })
      .returning()
      .execute();
    productUnlimitedId = productUnlimitedResult[0].id;

    const orderResult = await db.insert(ordersTable)
      .values({
        ...testOrder,
        user_id: userId
      })
      .returning()
      .execute();
    orderId = orderResult[0].id;
  });

  describe('createDownload', () => {
    const testInput: CreateDownloadInput = {
      user_id: 0, // Will be set in test
      product_id: 0, // Will be set in test
      order_id: 0 // Will be set in test
    };

    it('should create a download record', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        product_id: productId,
        order_id: orderId
      };

      const result = await createDownload(input);

      expect(result.user_id).toEqual(userId);
      expect(result.product_id).toEqual(productId);
      expect(result.order_id).toEqual(orderId);
      expect(result.download_count).toEqual(0);
      expect(result.id).toBeDefined();
      expect(result.expires_at).toBeInstanceOf(Date);
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save download to database', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        product_id: productId,
        order_id: orderId
      };

      const result = await createDownload(input);

      const downloads = await db.select()
        .from(downloadsTable)
        .where(eq(downloadsTable.id, result.id))
        .execute();

      expect(downloads).toHaveLength(1);
      expect(downloads[0].user_id).toEqual(userId);
      expect(downloads[0].product_id).toEqual(productId);
      expect(downloads[0].download_count).toEqual(0);
    });

    it('should reject invalid product', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        product_id: 99999, // Non-existent product
        order_id: orderId
      };

      expect(createDownload(input)).rejects.toThrow(/product not found/i);
    });

    it('should reject invalid order', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        product_id: productId,
        order_id: 99999 // Non-existent order
      };

      expect(createDownload(input)).rejects.toThrow(/order not found/i);
    });

    it('should reject order that does not belong to user', async () => {
      // Create another user
      const anotherUser = await db.insert(usersTable)
        .values({
          ...testUser,
          email: 'another@example.com'
        })
        .returning()
        .execute();

      const input = {
        ...testInput,
        user_id: anotherUser[0].id, // Different user
        product_id: productId,
        order_id: orderId // Order belongs to original user
      };

      expect(createDownload(input)).rejects.toThrow(/order not found/i);
    });
  });

  describe('getDownloadsByUser', () => {
    it('should return downloads for user', async () => {
      // Create test downloads
      await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      await createDownload({
        user_id: userId,
        product_id: productUnlimitedId,
        order_id: orderId
      });

      const results = await getDownloadsByUser(userId);

      expect(results).toHaveLength(2);
      results.forEach(download => {
        expect(download.user_id).toEqual(userId);
        expect(download.download_count).toEqual(0);
        expect(download.created_at).toBeInstanceOf(Date);
      });
    });

    it('should return empty array for user with no downloads', async () => {
      const results = await getDownloadsByUser(userId);
      expect(results).toHaveLength(0);
    });

    it('should reject invalid user', async () => {
      expect(getDownloadsByUser(99999)).rejects.toThrow(/user not found/i);
    });
  });

  describe('getDownloadById', () => {
    it('should return download by id', async () => {
      const created = await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      const result = await getDownloadById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.user_id).toEqual(userId);
      expect(result!.download_count).toEqual(0);
    });

    it('should return null for non-existent download', async () => {
      const result = await getDownloadById(99999);
      expect(result).toBeNull();
    });
  });

  describe('validateDownload', () => {
    it('should validate active download', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      const result = await validateDownload(download.id, userId);

      expect(result.valid).toBe(true);
      expect(result.download).toBeDefined();
      expect(result.download!.id).toEqual(download.id);
    });

    it('should reject download for wrong user', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      const result = await validateDownload(download.id, 99999);
      expect(result.valid).toBe(false);
      expect(result.download).toBeUndefined();
    });

    it('should reject expired download', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      // Manually set expiry to past date
      await db.update(downloadsTable)
        .set({
          expires_at: new Date('2020-01-01')
        })
        .where(eq(downloadsTable.id, download.id))
        .execute();

      const result = await validateDownload(download.id, userId);
      expect(result.valid).toBe(false);
    });

    it('should reject download at limit', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      // Set download count to limit (5)
      await db.update(downloadsTable)
        .set({
          download_count: 5
        })
        .where(eq(downloadsTable.id, download.id))
        .execute();

      const result = await validateDownload(download.id, userId);
      expect(result.valid).toBe(false);
    });

    it('should validate unlimited downloads', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productUnlimitedId,
        order_id: orderId
      });

      // Set high download count
      await db.update(downloadsTable)
        .set({
          download_count: 100
        })
        .where(eq(downloadsTable.id, download.id))
        .execute();

      const result = await validateDownload(download.id, userId);
      expect(result.valid).toBe(true);
    });
  });

  describe('incrementDownloadCount', () => {
    it('should increment download count', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      const result = await incrementDownloadCount(download.id);

      expect(result.download_count).toEqual(1);
      expect(result.id).toEqual(download.id);
    });

    it('should reject increment at limit', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      // Set download count to limit
      await db.update(downloadsTable)
        .set({
          download_count: 5
        })
        .where(eq(downloadsTable.id, download.id))
        .execute();

      expect(incrementDownloadCount(download.id))
        .rejects.toThrow(/download limit exceeded/i);
    });

    it('should increment unlimited downloads', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productUnlimitedId,
        order_id: orderId
      });

      // Set high count and increment
      await db.update(downloadsTable)
        .set({
          download_count: 100
        })
        .where(eq(downloadsTable.id, download.id))
        .execute();

      const result = await incrementDownloadCount(download.id);
      expect(result.download_count).toEqual(101);
    });

    it('should reject invalid download', async () => {
      expect(incrementDownloadCount(99999))
        .rejects.toThrow(/download not found/i);
    });
  });

  describe('generateDownloadToken', () => {
    it('should generate token for valid download', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      const token = await generateDownloadToken(download.id, userId);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should reject invalid download', async () => {
      expect(generateDownloadToken(99999, userId))
        .rejects.toThrow(/invalid download/i);
    });

    it('should reject wrong user', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      expect(generateDownloadToken(download.id, 99999))
        .rejects.toThrow(/invalid download/i);
    });
  });

  describe('validateDownloadToken', () => {
    it('should validate valid token', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      const token = await generateDownloadToken(download.id, userId);
      const result = await validateDownloadToken(token);

      expect(result.valid).toBe(true);
      expect(result.downloadId).toEqual(download.id);
      expect(result.userId).toEqual(userId);
    });

    it('should reject invalid token', async () => {
      const result = await validateDownloadToken('invalid_token');

      expect(result.valid).toBe(false);
      expect(result.downloadId).toBeUndefined();
      expect(result.userId).toBeUndefined();
    });

    it('should reject token for expired download', async () => {
      const download = await createDownload({
        user_id: userId,
        product_id: productId,
        order_id: orderId
      });

      const token = await generateDownloadToken(download.id, userId);

      // Expire the download
      await db.update(downloadsTable)
        .set({
          expires_at: new Date('2020-01-01')
        })
        .where(eq(downloadsTable.id, download.id))
        .execute();

      const result = await validateDownloadToken(token);
      expect(result.valid).toBe(false);
    });
  });
});