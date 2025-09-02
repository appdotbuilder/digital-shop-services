import { db } from '../db';
import { productsTable, categoriesTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput, type Product } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createProduct = async (input: CreateProductInput): Promise<Product> => {
  try {
    // Verify that the category exists
    const categoryExists = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, input.category_id))
      .execute();

    if (categoryExists.length === 0) {
      throw new Error('Category not found');
    }

    // Insert product record
    const result = await db.insert(productsTable)
      .values({
        name: input.name,
        description: input.description,
        price: input.price.toString(), // Convert number to string for numeric column
        category_id: input.category_id,
        digital_file_url: input.digital_file_url,
        download_limit: input.download_limit
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Product creation failed:', error);
    throw error;
  }
};

export const getProducts = async (): Promise<Product[]> => {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.is_active, true))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(product => ({
      ...product,
      price: parseFloat(product.price) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch products:', error);
    throw error;
  }
};

export const getProductById = async (id: number): Promise<Product | null> => {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const product = results[0];
    return {
      ...product,
      price: parseFloat(product.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Failed to fetch product by ID:', error);
    throw error;
  }
};

export const getProductsByCategory = async (categoryId: number): Promise<Product[]> => {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.category_id, categoryId),
          eq(productsTable.is_active, true)
        )
      )
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(product => ({
      ...product,
      price: parseFloat(product.price) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch products by category:', error);
    throw error;
  }
};

export const updateProduct = async (input: UpdateProductInput): Promise<Product> => {
  try {
    // Verify that the product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.id))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error('Product not found');
    }

    // If category_id is being updated, verify the new category exists
    if (input.category_id !== undefined) {
      const categoryExists = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, input.category_id))
        .execute();

      if (categoryExists.length === 0) {
        throw new Error('Category not found');
      }
    }

    // Build update object, converting price to string if provided
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.price !== undefined) updateData.price = input.price.toString();
    if (input.category_id !== undefined) updateData.category_id = input.category_id;
    if (input.digital_file_url !== undefined) updateData.digital_file_url = input.digital_file_url;
    if (input.download_limit !== undefined) updateData.download_limit = input.download_limit;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    // Add updated_at timestamp
    updateData.updated_at = new Date();

    const result = await db.update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, input.id))
      .returning()
      .execute();

    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Product update failed:', error);
    throw error;
  }
};

export const deleteProduct = async (id: number): Promise<boolean> => {
  try {
    // Verify that the product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error('Product not found');
    }

    // Soft delete by setting is_active to false
    const result = await db.update(productsTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Product deletion failed:', error);
    throw error;
  }
};