import { db } from '../db';
import { blogPostsTable, usersTable } from '../db/schema';
import { type CreateBlogPostInput, type UpdateBlogPostInput, type BlogPost } from '../schema';
import { eq } from 'drizzle-orm';

export const createBlogPost = async (input: CreateBlogPostInput): Promise<BlogPost> => {
  try {
    // Verify that the author exists
    const author = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.author_id))
      .execute();

    if (author.length === 0) {
      throw new Error('Author not found');
    }

    // Insert blog post record
    const result = await db.insert(blogPostsTable)
      .values({
        title: input.title,
        content: input.content,
        excerpt: input.excerpt,
        slug: input.slug,
        author_id: input.author_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Blog post creation failed:', error);
    throw error;
  }
};

export const getBlogPosts = async (publishedOnly: boolean = true): Promise<BlogPost[]> => {
  try {
    const baseQuery = db.select()
      .from(blogPostsTable);

    const results = publishedOnly
      ? await baseQuery.where(eq(blogPostsTable.is_published, true)).execute()
      : await baseQuery.execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch blog posts:', error);
    throw error;
  }
};

export const getBlogPostById = async (id: number): Promise<BlogPost | null> => {
  try {
    const results = await db.select()
      .from(blogPostsTable)
      .where(eq(blogPostsTable.id, id))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch blog post by ID:', error);
    throw error;
  }
};

export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    const results = await db.select()
      .from(blogPostsTable)
      .where(eq(blogPostsTable.slug, slug))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch blog post by slug:', error);
    throw error;
  }
};

export const updateBlogPost = async (input: UpdateBlogPostInput): Promise<BlogPost> => {
  try {
    // Check if blog post exists
    const existing = await getBlogPostById(input.id);
    if (!existing) {
      throw new Error('Blog post not found');
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof blogPostsTable.$inferInsert> = {
      updated_at: new Date()
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.content !== undefined) updateData.content = input.content;
    if (input.excerpt !== undefined) updateData.excerpt = input.excerpt;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.is_published !== undefined) updateData.is_published = input.is_published;

    const result = await db.update(blogPostsTable)
      .set(updateData)
      .where(eq(blogPostsTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Blog post update failed:', error);
    throw error;
  }
};

export const deleteBlogPost = async (id: number): Promise<boolean> => {
  try {
    // Check if blog post exists
    const existing = await getBlogPostById(id);
    if (!existing) {
      return false;
    }

    await db.delete(blogPostsTable)
      .where(eq(blogPostsTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Blog post deletion failed:', error);
    throw error;
  }
};

export const publishBlogPost = async (id: number): Promise<BlogPost> => {
  try {
    // Check if blog post exists
    const existing = await getBlogPostById(id);
    if (!existing) {
      throw new Error('Blog post not found');
    }

    const result = await db.update(blogPostsTable)
      .set({
        is_published: true,
        updated_at: new Date()
      })
      .where(eq(blogPostsTable.id, id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Blog post publishing failed:', error);
    throw error;
  }
};