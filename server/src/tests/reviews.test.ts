import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, productsTable, reviewsTable } from '../db/schema';
import { type CreateReviewInput, type UpdateReviewInput } from '../schema';
import { 
  createReview, 
  getReviewsByProduct, 
  getPendingReviews, 
  getAllReviews, 
  approveReview, 
  deleteReview, 
  getProductRating 
} from '../handlers/reviews';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'reviewer@test.com',
  password_hash: 'hashed_password',
  first_name: 'Review',
  last_name: 'User',
  role: 'customer' as const
};

const testCategory = {
  name: 'Test Category',
  description: 'A category for testing',
  slug: 'test-category'
};

const testProduct = {
  name: 'Test Product',
  description: 'A product for testing',
  price: '29.99',
  digital_file_url: 'https://example.com/file.pdf',
  download_limit: 5
};

const testReviewInput: CreateReviewInput = {
  user_id: 0, // Will be set in tests
  product_id: 0, // Will be set in tests
  rating: 5,
  comment: 'Excellent product!'
};

describe('Reviews Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let productId: number;
  let categoryId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test category
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    categoryId = categoryResult[0].id;

    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        ...testProduct,
        category_id: categoryId
      })
      .returning()
      .execute();
    productId = productResult[0].id;
  });

  describe('createReview', () => {
    it('should create a review successfully', async () => {
      const input = {
        ...testReviewInput,
        user_id: userId,
        product_id: productId
      };

      const result = await createReview(input);

      expect(result.id).toBeDefined();
      expect(result.user_id).toEqual(userId);
      expect(result.product_id).toEqual(productId);
      expect(result.rating).toEqual(5);
      expect(result.comment).toEqual('Excellent product!');
      expect(result.is_approved).toBe(false); // Default to pending
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create review without comment', async () => {
      const input = {
        user_id: userId,
        product_id: productId,
        rating: 4,
        comment: null
      };

      const result = await createReview(input);

      expect(result.rating).toEqual(4);
      expect(result.comment).toBeNull();
      expect(result.is_approved).toBe(false);
    });

    it('should save review to database', async () => {
      const input = {
        ...testReviewInput,
        user_id: userId,
        product_id: productId
      };

      const result = await createReview(input);

      const reviews = await db.select()
        .from(reviewsTable)
        .where(eq(reviewsTable.id, result.id))
        .execute();

      expect(reviews).toHaveLength(1);
      expect(reviews[0].user_id).toEqual(userId);
      expect(reviews[0].product_id).toEqual(productId);
      expect(reviews[0].rating).toEqual(5);
      expect(reviews[0].is_approved).toBe(false);
    });

    it('should throw error for non-existent user', async () => {
      const input = {
        ...testReviewInput,
        user_id: 9999,
        product_id: productId
      };

      await expect(createReview(input)).rejects.toThrow(/user.*not found/i);
    });

    it('should throw error for non-existent product', async () => {
      const input = {
        ...testReviewInput,
        user_id: userId,
        product_id: 9999
      };

      await expect(createReview(input)).rejects.toThrow(/product.*not found/i);
    });
  });

  describe('getReviewsByProduct', () => {
    it('should return approved reviews for product', async () => {
      // Create approved review
      const approvedReview = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 5,
          comment: 'Great product!',
          is_approved: true
        })
        .returning()
        .execute();

      // Create pending review
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 3,
          comment: 'Average product',
          is_approved: false
        })
        .execute();

      const results = await getReviewsByProduct(productId);

      expect(results).toHaveLength(1);
      expect(results[0].id).toEqual(approvedReview[0].id);
      expect(results[0].is_approved).toBe(true);
      expect(results[0].rating).toEqual(5);
    });

    it('should return empty array for product with no approved reviews', async () => {
      // Create only pending review
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 4,
          comment: 'Pending review',
          is_approved: false
        })
        .execute();

      const results = await getReviewsByProduct(productId);

      expect(results).toHaveLength(0);
    });

    it('should return empty array for non-existent product', async () => {
      const results = await getReviewsByProduct(9999);
      expect(results).toHaveLength(0);
    });
  });

  describe('getPendingReviews', () => {
    it('should return only pending reviews', async () => {
      // Create approved review
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 5,
          comment: 'Approved review',
          is_approved: true
        })
        .execute();

      // Create pending review
      const pendingReview = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 3,
          comment: 'Pending review',
          is_approved: false
        })
        .returning()
        .execute();

      const results = await getPendingReviews();

      expect(results).toHaveLength(1);
      expect(results[0].id).toEqual(pendingReview[0].id);
      expect(results[0].is_approved).toBe(false);
    });

    it('should return empty array when no pending reviews', async () => {
      // Create only approved review
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 5,
          comment: 'Approved review',
          is_approved: true
        })
        .execute();

      const results = await getPendingReviews();
      expect(results).toHaveLength(0);
    });
  });

  describe('getAllReviews', () => {
    it('should return all reviews regardless of approval status', async () => {
      // Create approved review
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 5,
          comment: 'Approved review',
          is_approved: true
        })
        .execute();

      // Create pending review
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 3,
          comment: 'Pending review',
          is_approved: false
        })
        .execute();

      const results = await getAllReviews();

      expect(results).toHaveLength(2);
      expect(results.some(r => r.is_approved === true)).toBe(true);
      expect(results.some(r => r.is_approved === false)).toBe(true);
    });

    it('should return empty array when no reviews exist', async () => {
      const results = await getAllReviews();
      expect(results).toHaveLength(0);
    });
  });

  describe('approveReview', () => {
    it('should approve a review successfully', async () => {
      // Create pending review
      const pendingReview = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 4,
          comment: 'Pending review',
          is_approved: false
        })
        .returning()
        .execute();

      const input: UpdateReviewInput = {
        id: pendingReview[0].id,
        is_approved: true
      };

      const result = await approveReview(input);

      expect(result.id).toEqual(pendingReview[0].id);
      expect(result.is_approved).toBe(true);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should reject a review successfully', async () => {
      // Create approved review
      const approvedReview = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 4,
          comment: 'Approved review',
          is_approved: true
        })
        .returning()
        .execute();

      const input: UpdateReviewInput = {
        id: approvedReview[0].id,
        is_approved: false
      };

      const result = await approveReview(input);

      expect(result.is_approved).toBe(false);
    });

    it('should update review in database', async () => {
      const pendingReview = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 4,
          comment: 'Test review',
          is_approved: false
        })
        .returning()
        .execute();

      const input: UpdateReviewInput = {
        id: pendingReview[0].id,
        is_approved: true
      };

      await approveReview(input);

      const reviews = await db.select()
        .from(reviewsTable)
        .where(eq(reviewsTable.id, pendingReview[0].id))
        .execute();

      expect(reviews[0].is_approved).toBe(true);
    });

    it('should throw error for non-existent review', async () => {
      const input: UpdateReviewInput = {
        id: 9999,
        is_approved: true
      };

      await expect(approveReview(input)).rejects.toThrow(/review.*not found/i);
    });
  });

  describe('deleteReview', () => {
    it('should delete review successfully', async () => {
      const review = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 3,
          comment: 'To be deleted',
          is_approved: false
        })
        .returning()
        .execute();

      const result = await deleteReview(review[0].id);

      expect(result).toBe(true);

      // Verify review is deleted
      const reviews = await db.select()
        .from(reviewsTable)
        .where(eq(reviewsTable.id, review[0].id))
        .execute();

      expect(reviews).toHaveLength(0);
    });

    it('should return false for non-existent review', async () => {
      const result = await deleteReview(9999);
      expect(result).toBe(false);
    });
  });

  describe('getProductRating', () => {
    it('should calculate average rating and count for approved reviews', async () => {
      // Create approved reviews
      await db.insert(reviewsTable)
        .values([
          {
            user_id: userId,
            product_id: productId,
            rating: 5,
            comment: 'Excellent!',
            is_approved: true
          },
          {
            user_id: userId,
            product_id: productId,
            rating: 4,
            comment: 'Good!',
            is_approved: true
          },
          {
            user_id: userId,
            product_id: productId,
            rating: 3,
            comment: 'Average',
            is_approved: true
          }
        ])
        .execute();

      // Create pending review (should not be counted)
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 1,
          comment: 'Pending review',
          is_approved: false
        })
        .execute();

      const result = await getProductRating(productId);

      expect(result.averageRating).toEqual(4); // (5+4+3)/3 = 4
      expect(result.totalReviews).toEqual(3);
    });

    it('should return zero values for product with no approved reviews', async () => {
      // Create only pending review
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 5,
          comment: 'Pending review',
          is_approved: false
        })
        .execute();

      const result = await getProductRating(productId);

      expect(result.averageRating).toEqual(0);
      expect(result.totalReviews).toEqual(0);
    });

    it('should return zero values for non-existent product', async () => {
      const result = await getProductRating(9999);

      expect(result.averageRating).toEqual(0);
      expect(result.totalReviews).toEqual(0);
    });

    it('should handle single review correctly', async () => {
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          product_id: productId,
          rating: 3,
          comment: 'Single review',
          is_approved: true
        })
        .execute();

      const result = await getProductRating(productId);

      expect(result.averageRating).toEqual(3);
      expect(result.totalReviews).toEqual(1);
    });
  });
});