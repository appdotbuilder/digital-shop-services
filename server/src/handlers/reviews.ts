import { db } from '../db';
import { reviewsTable, usersTable, productsTable } from '../db/schema';
import { type CreateReviewInput, type UpdateReviewInput, type Review } from '../schema';
import { eq, and, avg, count, sql } from 'drizzle-orm';

export const createReview = async (input: CreateReviewInput): Promise<Review> => {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Verify product exists
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.product_id))
      .execute();

    if (product.length === 0) {
      throw new Error(`Product with id ${input.product_id} not found`);
    }

    // Insert review record
    const result = await db.insert(reviewsTable)
      .values({
        user_id: input.user_id,
        product_id: input.product_id,
        rating: input.rating,
        comment: input.comment,
        is_approved: false // Default to pending approval
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Review creation failed:', error);
    throw error;
  }
};

export const getReviewsByProduct = async (productId: number): Promise<Review[]> => {
  try {
    // Fetch only approved reviews for a product
    const results = await db.select()
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.product_id, productId),
          eq(reviewsTable.is_approved, true)
        )
      )
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get reviews by product:', error);
    throw error;
  }
};

export const getPendingReviews = async (): Promise<Review[]> => {
  try {
    // Fetch all pending reviews for admin moderation
    const results = await db.select()
      .from(reviewsTable)
      .where(eq(reviewsTable.is_approved, false))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get pending reviews:', error);
    throw error;
  }
};

export const getAllReviews = async (): Promise<Review[]> => {
  try {
    // Fetch all reviews (approved and pending) for admin management
    const results = await db.select()
      .from(reviewsTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get all reviews:', error);
    throw error;
  }
};

export const approveReview = async (input: UpdateReviewInput): Promise<Review> => {
  try {
    // Update review approval status
    const result = await db.update(reviewsTable)
      .set({
        is_approved: input.is_approved,
        updated_at: new Date()
      })
      .where(eq(reviewsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Review with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Review approval failed:', error);
    throw error;
  }
};

export const deleteReview = async (id: number): Promise<boolean> => {
  try {
    const result = await db.delete(reviewsTable)
      .where(eq(reviewsTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Review deletion failed:', error);
    throw error;
  }
};

export const getProductRating = async (productId: number): Promise<{ averageRating: number; totalReviews: number }> => {
  try {
    // Calculate average rating and total review count for approved reviews only
    const result = await db.select({
      averageRating: avg(reviewsTable.rating),
      totalReviews: count(reviewsTable.id)
    })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.product_id, productId),
          eq(reviewsTable.is_approved, true)
        )
      )
      .execute();

    const stats = result[0];
    
    return {
      averageRating: stats.averageRating ? parseFloat(stats.averageRating.toString()) : 0,
      totalReviews: stats.totalReviews || 0
    };
  } catch (error) {
    console.error('Failed to get product rating:', error);
    throw error;
  }
};