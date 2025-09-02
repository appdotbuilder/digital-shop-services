import { db } from '../db';
import { downloadsTable, productsTable, usersTable, ordersTable } from '../db/schema';
import { type CreateDownloadInput, type Download } from '../schema';
import { eq, and } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

// Token store for download tokens (in production, use Redis or database)
const tokenStore = new Map<string, { downloadId: number; userId: number; expires: Date }>();

export const createDownload = async (input: CreateDownloadInput): Promise<Download> => {
  try {
    // Verify the product exists and get its download_limit
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.product_id))
      .execute();

    if (product.length === 0) {
      throw new Error('Product not found');
    }

    // Verify the order exists and belongs to the user
    const order = await db.select()
      .from(ordersTable)
      .where(and(
        eq(ordersTable.id, input.order_id),
        eq(ordersTable.user_id, input.user_id)
      ))
      .execute();

    if (order.length === 0) {
      throw new Error('Order not found or does not belong to user');
    }

    // Calculate expiry date (30 days from now if no specific limit)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create download record
    const result = await db.insert(downloadsTable)
      .values({
        user_id: input.user_id,
        product_id: input.product_id,
        order_id: input.order_id,
        download_count: 0,
        expires_at: expiresAt
      })
      .returning()
      .execute();

    const download = result[0];
    return {
      ...download,
      download_count: download.download_count || 0
    };
  } catch (error) {
    console.error('Download creation failed:', error);
    throw error;
  }
};

export const getDownloadsByUser = async (userId: number): Promise<Download[]> => {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const results = await db.select()
      .from(downloadsTable)
      .where(eq(downloadsTable.user_id, userId))
      .execute();

    return results.map(download => ({
      ...download,
      download_count: download.download_count || 0
    }));
  } catch (error) {
    console.error('Failed to get downloads by user:', error);
    throw error;
  }
};

export const getDownloadById = async (id: number): Promise<Download | null> => {
  try {
    const results = await db.select()
      .from(downloadsTable)
      .where(eq(downloadsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const download = results[0];
    return {
      ...download,
      download_count: download.download_count || 0
    };
  } catch (error) {
    console.error('Failed to get download by id:', error);
    throw error;
  }
};

export const validateDownload = async (downloadId: number, userId: number): Promise<{ valid: boolean; download?: Download }> => {
  try {
    const results = await db.select()
      .from(downloadsTable)
      .innerJoin(productsTable, eq(downloadsTable.product_id, productsTable.id))
      .where(and(
        eq(downloadsTable.id, downloadId),
        eq(downloadsTable.user_id, userId)
      ))
      .execute();

    if (results.length === 0) {
      return { valid: false };
    }

    const result = results[0];
    const download = result.downloads;
    const product = result.products;

    // Check if download has expired
    if (download.expires_at && new Date() > download.expires_at) {
      return { valid: false };
    }

    // Check download limit if product has one
    const downloadLimit = product.download_limit;
    if (downloadLimit && download.download_count >= downloadLimit) {
      return { valid: false };
    }

    return {
      valid: true,
      download: {
        ...download,
        download_count: download.download_count || 0
      }
    };
  } catch (error) {
    console.error('Download validation failed:', error);
    throw error;
  }
};

export const incrementDownloadCount = async (downloadId: number): Promise<Download> => {
  try {
    // Get current download record with product info for limit checking
    const results = await db.select()
      .from(downloadsTable)
      .innerJoin(productsTable, eq(downloadsTable.product_id, productsTable.id))
      .where(eq(downloadsTable.id, downloadId))
      .execute();

    if (results.length === 0) {
      throw new Error('Download not found');
    }

    const result = results[0];
    const download = result.downloads;
    const product = result.products;

    // Check if we're at the download limit
    const downloadLimit = product.download_limit;
    if (downloadLimit && download.download_count >= downloadLimit) {
      throw new Error('Download limit exceeded');
    }

    // Increment download count
    const updatedResults = await db.update(downloadsTable)
      .set({
        download_count: (download.download_count || 0) + 1
      })
      .where(eq(downloadsTable.id, downloadId))
      .returning()
      .execute();

    const updatedDownload = updatedResults[0];
    return {
      ...updatedDownload,
      download_count: updatedDownload.download_count || 0
    };
  } catch (error) {
    console.error('Failed to increment download count:', error);
    throw error;
  }
};

export const generateDownloadToken = async (downloadId: number, userId: number): Promise<string> => {
  try {
    // Verify download exists and belongs to user
    const validation = await validateDownload(downloadId, userId);
    if (!validation.valid) {
      throw new Error('Invalid download or access denied');
    }

    // Generate secure token
    const tokenData = `${downloadId}-${userId}-${Date.now()}`;
    const token = createHash('sha256')
      .update(tokenData + randomBytes(32).toString('hex'))
      .digest('hex');

    // Store token with expiry (15 minutes)
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);
    
    tokenStore.set(token, {
      downloadId,
      userId,
      expires
    });

    return token;
  } catch (error) {
    console.error('Token generation failed:', error);
    throw error;
  }
};

export const validateDownloadToken = async (token: string): Promise<{ valid: boolean; downloadId?: number; userId?: number }> => {
  try {
    const tokenData = tokenStore.get(token);
    
    if (!tokenData) {
      return { valid: false };
    }

    // Check if token has expired
    if (new Date() > tokenData.expires) {
      tokenStore.delete(token);
      return { valid: false };
    }

    // Verify download is still valid
    const validation = await validateDownload(tokenData.downloadId, tokenData.userId);
    if (!validation.valid) {
      tokenStore.delete(token);
      return { valid: false };
    }

    return {
      valid: true,
      downloadId: tokenData.downloadId,
      userId: tokenData.userId
    };
  } catch (error) {
    console.error('Token validation failed:', error);
    return { valid: false };
  }
};