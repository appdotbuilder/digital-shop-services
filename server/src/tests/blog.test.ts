import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { blogPostsTable, usersTable } from '../db/schema';
import { type CreateBlogPostInput, type UpdateBlogPostInput } from '../schema';
import {
  createBlogPost,
  getBlogPosts,
  getBlogPostById,
  getBlogPostBySlug,
  updateBlogPost,
  deleteBlogPost,
  publishBlogPost
} from '../handlers/blog';
import { eq } from 'drizzle-orm';

// Test data
const testAuthor = {
  email: 'author@example.com',
  password_hash: 'hashedpassword',
  first_name: 'Test',
  last_name: 'Author',
  role: 'admin' as const
};

const testBlogPostInput: CreateBlogPostInput = {
  title: 'Test Blog Post',
  content: 'This is a test blog post content.',
  excerpt: 'This is a test excerpt',
  slug: 'test-blog-post',
  author_id: 1 // Will be updated after author creation
};

describe('Blog Handlers', () => {
  let authorId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test author
    const authorResult = await db.insert(usersTable)
      .values(testAuthor)
      .returning()
      .execute();
    
    authorId = authorResult[0].id;
  });

  afterEach(resetDB);

  describe('createBlogPost', () => {
    it('should create a blog post', async () => {
      const input = { ...testBlogPostInput, author_id: authorId };
      const result = await createBlogPost(input);

      expect(result.title).toEqual('Test Blog Post');
      expect(result.content).toEqual(input.content);
      expect(result.excerpt).toEqual(input.excerpt);
      expect(result.slug).toEqual(input.slug);
      expect(result.author_id).toEqual(authorId);
      expect(result.is_published).toEqual(false); // Default to draft
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save blog post to database', async () => {
      const input = { ...testBlogPostInput, author_id: authorId };
      const result = await createBlogPost(input);

      const blogPosts = await db.select()
        .from(blogPostsTable)
        .where(eq(blogPostsTable.id, result.id))
        .execute();

      expect(blogPosts).toHaveLength(1);
      expect(blogPosts[0].title).toEqual('Test Blog Post');
      expect(blogPosts[0].content).toEqual(input.content);
      expect(blogPosts[0].is_published).toEqual(false);
      expect(blogPosts[0].created_at).toBeInstanceOf(Date);
    });

    it('should create blog post with null excerpt', async () => {
      const input = { ...testBlogPostInput, excerpt: null, author_id: authorId };
      const result = await createBlogPost(input);

      expect(result.excerpt).toBeNull();
    });

    it('should throw error for non-existent author', async () => {
      const input = { ...testBlogPostInput, author_id: 999 };
      
      await expect(createBlogPost(input)).rejects.toThrow(/author not found/i);
    });
  });

  describe('getBlogPosts', () => {
    it('should return only published posts by default', async () => {
      // Create published post
      const publishedInput = { ...testBlogPostInput, author_id: authorId };
      const publishedPost = await createBlogPost(publishedInput);
      await publishBlogPost(publishedPost.id);

      // Create draft post
      const draftInput = { 
        ...testBlogPostInput, 
        title: 'Draft Post',
        slug: 'draft-post',
        author_id: authorId 
      };
      await createBlogPost(draftInput);

      const result = await getBlogPosts();
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toEqual('Test Blog Post');
      expect(result[0].is_published).toEqual(true);
    });

    it('should return all posts when publishedOnly is false', async () => {
      // Create published post
      const publishedInput = { ...testBlogPostInput, author_id: authorId };
      const publishedPost = await createBlogPost(publishedInput);
      await publishBlogPost(publishedPost.id);

      // Create draft post
      const draftInput = { 
        ...testBlogPostInput, 
        title: 'Draft Post',
        slug: 'draft-post',
        author_id: authorId 
      };
      await createBlogPost(draftInput);

      const result = await getBlogPosts(false);
      
      expect(result).toHaveLength(2);
      expect(result.some(post => post.is_published === true)).toBe(true);
      expect(result.some(post => post.is_published === false)).toBe(true);
    });

    it('should return empty array when no posts exist', async () => {
      const result = await getBlogPosts();
      expect(result).toHaveLength(0);
    });
  });

  describe('getBlogPostById', () => {
    it('should return blog post by id', async () => {
      const input = { ...testBlogPostInput, author_id: authorId };
      const createdPost = await createBlogPost(input);

      const result = await getBlogPostById(createdPost.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdPost.id);
      expect(result!.title).toEqual('Test Blog Post');
      expect(result!.author_id).toEqual(authorId);
    });

    it('should return null for non-existent id', async () => {
      const result = await getBlogPostById(999);
      expect(result).toBeNull();
    });
  });

  describe('getBlogPostBySlug', () => {
    it('should return blog post by slug', async () => {
      const input = { ...testBlogPostInput, author_id: authorId };
      const createdPost = await createBlogPost(input);

      const result = await getBlogPostBySlug('test-blog-post');

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdPost.id);
      expect(result!.slug).toEqual('test-blog-post');
      expect(result!.title).toEqual('Test Blog Post');
    });

    it('should return null for non-existent slug', async () => {
      const result = await getBlogPostBySlug('non-existent-slug');
      expect(result).toBeNull();
    });
  });

  describe('updateBlogPost', () => {
    it('should update blog post fields', async () => {
      const input = { ...testBlogPostInput, author_id: authorId };
      const createdPost = await createBlogPost(input);

      const updateInput: UpdateBlogPostInput = {
        id: createdPost.id,
        title: 'Updated Title',
        content: 'Updated content',
        is_published: true
      };

      const result = await updateBlogPost(updateInput);

      expect(result.title).toEqual('Updated Title');
      expect(result.content).toEqual('Updated content');
      expect(result.is_published).toEqual(true);
      expect(result.excerpt).toEqual(createdPost.excerpt); // Should remain unchanged
      expect(result.slug).toEqual(createdPost.slug); // Should remain unchanged
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update only provided fields', async () => {
      const input = { ...testBlogPostInput, author_id: authorId };
      const createdPost = await createBlogPost(input);

      const updateInput: UpdateBlogPostInput = {
        id: createdPost.id,
        title: 'New Title Only'
      };

      const result = await updateBlogPost(updateInput);

      expect(result.title).toEqual('New Title Only');
      expect(result.content).toEqual(createdPost.content); // Should remain unchanged
      expect(result.excerpt).toEqual(createdPost.excerpt); // Should remain unchanged
    });

    it('should persist updates to database', async () => {
      const input = { ...testBlogPostInput, author_id: authorId };
      const createdPost = await createBlogPost(input);

      const updateInput: UpdateBlogPostInput = {
        id: createdPost.id,
        title: 'Updated Title'
      };

      await updateBlogPost(updateInput);

      const blogPosts = await db.select()
        .from(blogPostsTable)
        .where(eq(blogPostsTable.id, createdPost.id))
        .execute();

      expect(blogPosts[0].title).toEqual('Updated Title');
      expect(blogPosts[0].updated_at).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent blog post', async () => {
      const updateInput: UpdateBlogPostInput = {
        id: 999,
        title: 'Updated Title'
      };

      await expect(updateBlogPost(updateInput)).rejects.toThrow(/blog post not found/i);
    });
  });

  describe('deleteBlogPost', () => {
    it('should delete existing blog post', async () => {
      const input = { ...testBlogPostInput, author_id: authorId };
      const createdPost = await createBlogPost(input);

      const result = await deleteBlogPost(createdPost.id);
      expect(result).toBe(true);

      // Verify deletion
      const blogPosts = await db.select()
        .from(blogPostsTable)
        .where(eq(blogPostsTable.id, createdPost.id))
        .execute();

      expect(blogPosts).toHaveLength(0);
    });

    it('should return false for non-existent blog post', async () => {
      const result = await deleteBlogPost(999);
      expect(result).toBe(false);
    });
  });

  describe('publishBlogPost', () => {
    it('should publish a draft blog post', async () => {
      const input = { ...testBlogPostInput, author_id: authorId };
      const createdPost = await createBlogPost(input);

      expect(createdPost.is_published).toBe(false);

      const result = await publishBlogPost(createdPost.id);

      expect(result.is_published).toBe(true);
      expect(result.id).toEqual(createdPost.id);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should persist publication status to database', async () => {
      const input = { ...testBlogPostInput, author_id: authorId };
      const createdPost = await createBlogPost(input);

      await publishBlogPost(createdPost.id);

      const blogPosts = await db.select()
        .from(blogPostsTable)
        .where(eq(blogPostsTable.id, createdPost.id))
        .execute();

      expect(blogPosts[0].is_published).toBe(true);
      expect(blogPosts[0].updated_at).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent blog post', async () => {
      await expect(publishBlogPost(999)).rejects.toThrow(/blog post not found/i);
    });
  });
});