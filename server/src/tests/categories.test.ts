import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput } from '../schema';
import { 
  createCategory, 
  getCategories, 
  getCategoryById, 
  updateCategory, 
  deleteCategory 
} from '../handlers/categories';
import { eq } from 'drizzle-orm';

const testInput: CreateCategoryInput = {
  name: 'Electronics',
  description: 'Electronic products and gadgets',
  slug: 'electronics'
};

const testInputMinimal: CreateCategoryInput = {
  name: 'Books',
  description: null,
  slug: 'books'
};

describe('createCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a category with all fields', async () => {
    const result = await createCategory(testInput);

    expect(result.name).toEqual('Electronics');
    expect(result.description).toEqual('Electronic products and gadgets');
    expect(result.slug).toEqual('electronics');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a category with null description', async () => {
    const result = await createCategory(testInputMinimal);

    expect(result.name).toEqual('Books');
    expect(result.description).toBeNull();
    expect(result.slug).toEqual('books');
    expect(result.is_active).toEqual(true);
  });

  it('should save category to database', async () => {
    const result = await createCategory(testInput);

    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, result.id))
      .execute();

    expect(categories).toHaveLength(1);
    expect(categories[0].name).toEqual('Electronics');
    expect(categories[0].description).toEqual('Electronic products and gadgets');
    expect(categories[0].slug).toEqual('electronics');
    expect(categories[0].is_active).toEqual(true);
  });

  it('should throw error for duplicate slug', async () => {
    await createCategory(testInput);
    
    expect(createCategory(testInput)).rejects.toThrow(/duplicate/i);
  });
});

describe('getCategories', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no categories exist', async () => {
    const result = await getCategories();
    expect(result).toEqual([]);
  });

  it('should return all active categories', async () => {
    await createCategory(testInput);
    await createCategory(testInputMinimal);

    const result = await getCategories();

    expect(result).toHaveLength(2);
    expect(result.map(c => c.name)).toContain('Electronics');
    expect(result.map(c => c.name)).toContain('Books');
  });

  it('should not return inactive categories', async () => {
    const category = await createCategory(testInput);
    
    // Deactivate the category
    await db.update(categoriesTable)
      .set({ is_active: false })
      .where(eq(categoriesTable.id, category.id))
      .execute();

    const result = await getCategories();
    expect(result).toHaveLength(0);
  });
});

describe('getCategoryById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return category by ID', async () => {
    const created = await createCategory(testInput);
    const result = await getCategoryById(created.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(created.id);
    expect(result!.name).toEqual('Electronics');
    expect(result!.description).toEqual('Electronic products and gadgets');
    expect(result!.slug).toEqual('electronics');
  });

  it('should return null for non-existent ID', async () => {
    const result = await getCategoryById(999);
    expect(result).toBeNull();
  });

  it('should return inactive categories', async () => {
    const category = await createCategory(testInput);
    
    // Deactivate the category
    await db.update(categoriesTable)
      .set({ is_active: false })
      .where(eq(categoriesTable.id, category.id))
      .execute();

    const result = await getCategoryById(category.id);
    expect(result).not.toBeNull();
    expect(result!.is_active).toEqual(false);
  });
});

describe('updateCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update category name', async () => {
    const category = await createCategory(testInput);
    
    const updateInput: UpdateCategoryInput = {
      id: category.id,
      name: 'Updated Electronics'
    };

    const result = await updateCategory(updateInput);

    expect(result.name).toEqual('Updated Electronics');
    expect(result.description).toEqual(testInput.description);
    expect(result.slug).toEqual(testInput.slug);
    expect(result.updated_at > category.updated_at).toBe(true);
  });

  it('should update multiple fields', async () => {
    const category = await createCategory(testInput);
    
    const updateInput: UpdateCategoryInput = {
      id: category.id,
      name: 'Tech Gadgets',
      description: 'Latest technology gadgets',
      slug: 'tech-gadgets',
      is_active: false
    };

    const result = await updateCategory(updateInput);

    expect(result.name).toEqual('Tech Gadgets');
    expect(result.description).toEqual('Latest technology gadgets');
    expect(result.slug).toEqual('tech-gadgets');
    expect(result.is_active).toEqual(false);
  });

  it('should update category with null description', async () => {
    const category = await createCategory(testInput);
    
    const updateInput: UpdateCategoryInput = {
      id: category.id,
      description: null
    };

    const result = await updateCategory(updateInput);

    expect(result.description).toBeNull();
    expect(result.name).toEqual(testInput.name); // Unchanged
  });

  it('should persist updates to database', async () => {
    const category = await createCategory(testInput);
    
    const updateInput: UpdateCategoryInput = {
      id: category.id,
      name: 'Updated Electronics'
    };

    await updateCategory(updateInput);

    const dbCategory = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, category.id))
      .execute();

    expect(dbCategory[0].name).toEqual('Updated Electronics');
  });

  it('should throw error for non-existent category', async () => {
    const updateInput: UpdateCategoryInput = {
      id: 999,
      name: 'Non-existent'
    };

    expect(updateCategory(updateInput)).rejects.toThrow(/not found/i);
  });
});

describe('deleteCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should soft delete category', async () => {
    const category = await createCategory(testInput);
    
    const result = await deleteCategory(category.id);

    expect(result).toBe(true);

    // Check that category is marked as inactive
    const dbCategory = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, category.id))
      .execute();

    expect(dbCategory[0].is_active).toBe(false);
    expect(dbCategory[0].updated_at > category.updated_at).toBe(true);
  });

  it('should not appear in getCategories after deletion', async () => {
    const category = await createCategory(testInput);
    
    await deleteCategory(category.id);
    
    const categories = await getCategories();
    expect(categories).toHaveLength(0);
  });

  it('should return false for non-existent category', async () => {
    const result = await deleteCategory(999);
    expect(result).toBe(false);
  });

  it('should be able to delete already deleted category', async () => {
    const category = await createCategory(testInput);
    
    await deleteCategory(category.id);
    const result = await deleteCategory(category.id);
    
    expect(result).toBe(true);
  });
});