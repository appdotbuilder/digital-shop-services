import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, categoriesTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput } from '../schema';
import { 
  createProduct, 
  getProducts, 
  getProductById, 
  getProductsByCategory,
  updateProduct,
  deleteProduct
} from '../handlers/products';
import { eq } from 'drizzle-orm';

// Test data
const testCategory = {
  name: 'Digital Downloads',
  description: 'Digital products for download',
  slug: 'digital-downloads'
};

const testProductInput: CreateProductInput = {
  name: 'Test Digital Product',
  description: 'A digital product for testing',
  price: 29.99,
  category_id: 1, // Will be set after creating category
  digital_file_url: 'https://example.com/file.zip',
  download_limit: 5
};

describe('Products Handlers', () => {
  let categoryId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test category first
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    
    categoryId = categoryResult[0].id;
    testProductInput.category_id = categoryId;
  });

  afterEach(resetDB);

  describe('createProduct', () => {
    it('should create a product', async () => {
      const result = await createProduct(testProductInput);

      // Basic field validation
      expect(result.name).toEqual('Test Digital Product');
      expect(result.description).toEqual(testProductInput.description);
      expect(result.price).toEqual(29.99);
      expect(typeof result.price).toBe('number');
      expect(result.category_id).toEqual(categoryId);
      expect(result.digital_file_url).toEqual('https://example.com/file.zip');
      expect(result.download_limit).toEqual(5);
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save product to database', async () => {
      const result = await createProduct(testProductInput);

      // Query database to verify product was saved
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, result.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].name).toEqual('Test Digital Product');
      expect(products[0].description).toEqual(testProductInput.description);
      expect(parseFloat(products[0].price)).toEqual(29.99);
      expect(products[0].category_id).toEqual(categoryId);
      expect(products[0].digital_file_url).toEqual('https://example.com/file.zip');
      expect(products[0].download_limit).toEqual(5);
      expect(products[0].is_active).toBe(true);
    });

    it('should handle null description and optional fields', async () => {
      const minimalInput: CreateProductInput = {
        name: 'Minimal Product',
        description: null,
        price: 15.50,
        category_id: categoryId,
        digital_file_url: null,
        download_limit: null
      };

      const result = await createProduct(minimalInput);

      expect(result.name).toEqual('Minimal Product');
      expect(result.description).toBeNull();
      expect(result.price).toEqual(15.50);
      expect(result.digital_file_url).toBeNull();
      expect(result.download_limit).toBeNull();
    });

    it('should throw error for non-existent category', async () => {
      const invalidInput = {
        ...testProductInput,
        category_id: 999
      };

      await expect(createProduct(invalidInput)).rejects.toThrow(/category not found/i);
    });
  });

  describe('getProducts', () => {
    it('should return empty array when no products exist', async () => {
      const result = await getProducts();
      expect(result).toEqual([]);
    });

    it('should return all active products', async () => {
      // Create multiple products
      await createProduct(testProductInput);
      await createProduct({
        ...testProductInput,
        name: 'Second Product',
        price: 39.99
      });

      const result = await getProducts();

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Test Digital Product');
      expect(result[0].price).toEqual(29.99);
      expect(typeof result[0].price).toBe('number');
      expect(result[1].name).toEqual('Second Product');
      expect(result[1].price).toEqual(39.99);
      expect(typeof result[1].price).toBe('number');
    });

    it('should not return inactive products', async () => {
      // Create active product
      const activeProduct = await createProduct(testProductInput);

      // Create inactive product by soft deleting
      await deleteProduct(activeProduct.id);

      const result = await getProducts();
      expect(result).toHaveLength(0);
    });
  });

  describe('getProductById', () => {
    it('should return null for non-existent product', async () => {
      const result = await getProductById(999);
      expect(result).toBeNull();
    });

    it('should return product by id', async () => {
      const createdProduct = await createProduct(testProductInput);
      const result = await getProductById(createdProduct.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdProduct.id);
      expect(result!.name).toEqual('Test Digital Product');
      expect(result!.price).toEqual(29.99);
      expect(typeof result!.price).toBe('number');
    });

    it('should return inactive products', async () => {
      const createdProduct = await createProduct(testProductInput);
      await deleteProduct(createdProduct.id); // Soft delete

      const result = await getProductById(createdProduct.id);

      expect(result).not.toBeNull();
      expect(result!.is_active).toBe(false);
    });
  });

  describe('getProductsByCategory', () => {
    it('should return empty array for non-existent category', async () => {
      const result = await getProductsByCategory(999);
      expect(result).toEqual([]);
    });

    it('should return products filtered by category', async () => {
      // Create another category
      const secondCategoryResult = await db.insert(categoriesTable)
        .values({
          name: 'Software',
          description: 'Software products',
          slug: 'software'
        })
        .returning()
        .execute();
      
      const secondCategoryId = secondCategoryResult[0].id;

      // Create products in different categories
      await createProduct(testProductInput); // First category
      await createProduct({
        ...testProductInput,
        name: 'Software Product',
        category_id: secondCategoryId
      }); // Second category

      const firstCategoryProducts = await getProductsByCategory(categoryId);
      const secondCategoryProducts = await getProductsByCategory(secondCategoryId);

      expect(firstCategoryProducts).toHaveLength(1);
      expect(firstCategoryProducts[0].name).toEqual('Test Digital Product');
      expect(firstCategoryProducts[0].category_id).toEqual(categoryId);

      expect(secondCategoryProducts).toHaveLength(1);
      expect(secondCategoryProducts[0].name).toEqual('Software Product');
      expect(secondCategoryProducts[0].category_id).toEqual(secondCategoryId);
    });

    it('should not return inactive products', async () => {
      const createdProduct = await createProduct(testProductInput);
      await deleteProduct(createdProduct.id); // Soft delete

      const result = await getProductsByCategory(categoryId);
      expect(result).toHaveLength(0);
    });
  });

  describe('updateProduct', () => {
    it('should update product fields', async () => {
      const createdProduct = await createProduct(testProductInput);
      
      const updateInput: UpdateProductInput = {
        id: createdProduct.id,
        name: 'Updated Product Name',
        price: 49.99,
        description: 'Updated description',
        is_active: false
      };

      const result = await updateProduct(updateInput);

      expect(result.id).toEqual(createdProduct.id);
      expect(result.name).toEqual('Updated Product Name');
      expect(result.price).toEqual(49.99);
      expect(typeof result.price).toBe('number');
      expect(result.description).toEqual('Updated description');
      expect(result.is_active).toBe(false);
      expect(result.category_id).toEqual(categoryId); // Unchanged
    });

    it('should update only provided fields', async () => {
      const createdProduct = await createProduct(testProductInput);
      
      const updateInput: UpdateProductInput = {
        id: createdProduct.id,
        price: 99.99
      };

      const result = await updateProduct(updateInput);

      expect(result.id).toEqual(createdProduct.id);
      expect(result.name).toEqual('Test Digital Product'); // Unchanged
      expect(result.price).toEqual(99.99);
      expect(result.description).toEqual(testProductInput.description); // Unchanged
    });

    it('should throw error for non-existent product', async () => {
      const updateInput: UpdateProductInput = {
        id: 999,
        name: 'Updated Name'
      };

      await expect(updateProduct(updateInput)).rejects.toThrow(/product not found/i);
    });

    it('should throw error for non-existent category', async () => {
      const createdProduct = await createProduct(testProductInput);
      
      const updateInput: UpdateProductInput = {
        id: createdProduct.id,
        category_id: 999
      };

      await expect(updateProduct(updateInput)).rejects.toThrow(/category not found/i);
    });

    it('should update product in database', async () => {
      const createdProduct = await createProduct(testProductInput);
      
      const updateInput: UpdateProductInput = {
        id: createdProduct.id,
        name: 'Database Updated Name',
        price: 79.99
      };

      await updateProduct(updateInput);

      // Verify in database
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, createdProduct.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].name).toEqual('Database Updated Name');
      expect(parseFloat(products[0].price)).toEqual(79.99);
    });
  });

  describe('deleteProduct', () => {
    it('should soft delete product', async () => {
      const createdProduct = await createProduct(testProductInput);
      
      const result = await deleteProduct(createdProduct.id);
      expect(result).toBe(true);

      // Verify product still exists but is inactive
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, createdProduct.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].is_active).toBe(false);
    });

    it('should throw error for non-existent product', async () => {
      await expect(deleteProduct(999)).rejects.toThrow(/product not found/i);
    });

    it('should not appear in active product listings after deletion', async () => {
      const createdProduct = await createProduct(testProductInput);
      
      // Verify product appears in active listings
      let activeProducts = await getProducts();
      expect(activeProducts).toHaveLength(1);

      await deleteProduct(createdProduct.id);

      // Verify product no longer appears in active listings
      activeProducts = await getProducts();
      expect(activeProducts).toHaveLength(0);
    });
  });
});