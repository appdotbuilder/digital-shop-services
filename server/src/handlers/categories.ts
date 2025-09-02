import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput, type Category } from '../schema';
import { eq } from 'drizzle-orm';

export const createCategory = async (input: CreateCategoryInput): Promise<Category> => {
  try {
    const result = await db.insert(categoriesTable)
      .values({
        name: input.name,
        description: input.description,
        slug: input.slug
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category creation failed:', error);
    throw error;
  }
};

export const getCategories = async (): Promise<Category[]> => {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.is_active, true))
      .execute();

    return result;
  } catch (error) {
    console.error('Categories fetch failed:', error);
    throw error;
  }
};

export const getCategoryById = async (id: number): Promise<Category | null> => {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Category fetch by ID failed:', error);
    throw error;
  }
};

export const updateCategory = async (input: UpdateCategoryInput): Promise<Category> => {
  try {
    const updateData: Partial<typeof categoriesTable.$inferInsert> = {};
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    
    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    const result = await db.update(categoriesTable)
      .set(updateData)
      .where(eq(categoriesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Category with ID ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Category update failed:', error);
    throw error;
  }
};

export const deleteCategory = async (id: number): Promise<boolean> => {
  try {
    // Soft delete by setting is_active to false
    const result = await db.update(categoriesTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(categoriesTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Category deletion failed:', error);
    throw error;
  }
};