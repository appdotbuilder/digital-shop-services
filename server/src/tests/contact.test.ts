import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { type ContactFormInput } from '../schema';
import { 
  submitContactForm, 
  getContactSubmissions, 
  getContactSubmissionById, 
  clearContactSubmissions 
} from '../handlers/contact';

// Test input data
const testContactInput: ContactFormInput = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  subject: 'Test Subject',
  message: 'This is a test message for the contact form.'
};

const secondContactInput: ContactFormInput = {
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  subject: 'Another Subject',
  message: 'Another test message with different content.'
};

describe('Contact Form Handlers', () => {
  beforeEach(() => {
    clearContactSubmissions();
  });

  afterEach(() => {
    clearContactSubmissions();
  });

  describe('submitContactForm', () => {
    it('should submit contact form successfully', async () => {
      const result = await submitContactForm(testContactInput);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Contact form submitted successfully. We will get back to you soon!');
    });

    it('should store submission data correctly', async () => {
      await submitContactForm(testContactInput);

      const submissions = await getContactSubmissions();
      expect(submissions).toHaveLength(1);
      
      const submission = submissions[0];
      expect(submission.name).toBe('John Doe');
      expect(submission.email).toBe('john.doe@example.com');
      expect(submission.subject).toBe('Test Subject');
      expect(submission.message).toBe('This is a test message for the contact form.');
      expect(submission.id).toBeDefined();
      expect(submission.created_at).toBeInstanceOf(Date);
    });

    it('should assign sequential IDs to submissions', async () => {
      await submitContactForm(testContactInput);
      await submitContactForm(secondContactInput);

      const submissions = await getContactSubmissions();
      expect(submissions).toHaveLength(2);
      
      // Find submissions by name since sorting by timestamp might not be deterministic for quick submissions
      const johnSubmission = submissions.find(s => s.name === 'John Doe');
      const janeSubmission = submissions.find(s => s.name === 'Jane Smith');
      
      expect(johnSubmission?.id).toBe(1);
      expect(janeSubmission?.id).toBe(2);
      expect(johnSubmission).toBeDefined();
      expect(janeSubmission).toBeDefined();
    });

    it('should throw error for empty name', async () => {
      const invalidInput = { ...testContactInput, name: '' };
      
      await expect(submitContactForm(invalidInput)).rejects.toThrow(/all fields are required/i);
    });

    it('should throw error for whitespace-only name', async () => {
      const invalidInput = { ...testContactInput, name: '   ' };
      
      await expect(submitContactForm(invalidInput)).rejects.toThrow(/all fields are required/i);
    });

    it('should throw error for empty email', async () => {
      const invalidInput = { ...testContactInput, email: '' };
      
      await expect(submitContactForm(invalidInput)).rejects.toThrow(/all fields are required/i);
    });

    it('should throw error for empty subject', async () => {
      const invalidInput = { ...testContactInput, subject: '' };
      
      await expect(submitContactForm(invalidInput)).rejects.toThrow(/all fields are required/i);
    });

    it('should throw error for empty message', async () => {
      const invalidInput = { ...testContactInput, message: '' };
      
      await expect(submitContactForm(invalidInput)).rejects.toThrow(/all fields are required/i);
    });

    it('should handle multiple submissions correctly', async () => {
      const firstResult = await submitContactForm(testContactInput);
      const secondResult = await submitContactForm(secondContactInput);

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);

      const submissions = await getContactSubmissions();
      expect(submissions).toHaveLength(2);
      
      // Check both submissions are stored with different timestamps
      expect(submissions[0].created_at.getTime()).toBeGreaterThanOrEqual(submissions[1].created_at.getTime());
    });
  });

  describe('getContactSubmissions', () => {
    it('should return empty array when no submissions exist', async () => {
      const submissions = await getContactSubmissions();
      expect(submissions).toHaveLength(0);
      expect(Array.isArray(submissions)).toBe(true);
    });

    it('should return submissions sorted by newest first', async () => {
      // Add submissions with slight delay to ensure different timestamps
      await submitContactForm(testContactInput);
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await submitContactForm(secondContactInput);

      const submissions = await getContactSubmissions();
      expect(submissions).toHaveLength(2);
      
      // Newest should be first
      expect(submissions[0].name).toBe('Jane Smith');
      expect(submissions[1].name).toBe('John Doe');
      expect(submissions[0].created_at.getTime()).toBeGreaterThan(submissions[1].created_at.getTime());
    });

    it('should return all submission fields correctly', async () => {
      await submitContactForm(testContactInput);

      const submissions = await getContactSubmissions();
      const submission = submissions[0];

      // Check all required fields are present
      expect(submission).toHaveProperty('id');
      expect(submission).toHaveProperty('name');
      expect(submission).toHaveProperty('email');
      expect(submission).toHaveProperty('subject');
      expect(submission).toHaveProperty('message');
      expect(submission).toHaveProperty('created_at');

      // Check field values
      expect(submission.id).toBeTypeOf('number');
      expect(submission.name).toBe(testContactInput.name);
      expect(submission.email).toBe(testContactInput.email);
      expect(submission.subject).toBe(testContactInput.subject);
      expect(submission.message).toBe(testContactInput.message);
      expect(submission.created_at).toBeInstanceOf(Date);
    });
  });

  describe('getContactSubmissionById', () => {
    it('should return submission by ID', async () => {
      await submitContactForm(testContactInput);
      
      const submission = await getContactSubmissionById(1);
      expect(submission).not.toBeNull();
      expect(submission?.id).toBe(1);
      expect(submission?.name).toBe('John Doe');
      expect(submission?.email).toBe('john.doe@example.com');
    });

    it('should return null for non-existent ID', async () => {
      const submission = await getContactSubmissionById(999);
      expect(submission).toBeNull();
    });

    it('should return correct submission when multiple exist', async () => {
      await submitContactForm(testContactInput);
      await submitContactForm(secondContactInput);

      const firstSubmission = await getContactSubmissionById(1);
      const secondSubmission = await getContactSubmissionById(2);

      expect(firstSubmission?.name).toBe('John Doe');
      expect(secondSubmission?.name).toBe('Jane Smith');
      expect(firstSubmission?.id).toBe(1);
      expect(secondSubmission?.id).toBe(2);
    });
  });

  describe('clearContactSubmissions', () => {
    it('should clear all submissions', async () => {
      await submitContactForm(testContactInput);
      await submitContactForm(secondContactInput);

      let submissions = await getContactSubmissions();
      expect(submissions).toHaveLength(2);

      clearContactSubmissions();

      submissions = await getContactSubmissions();
      expect(submissions).toHaveLength(0);
    });

    it('should reset ID counter', async () => {
      await submitContactForm(testContactInput);
      
      let submissions = await getContactSubmissions();
      expect(submissions[0].id).toBe(1);

      clearContactSubmissions();

      await submitContactForm(secondContactInput);
      submissions = await getContactSubmissions();
      expect(submissions[0].id).toBe(1); // ID counter should reset
    });
  });

  describe('Error Handling', () => {
    it('should handle submission errors gracefully', async () => {
      // Test with invalid input that would cause validation error
      const invalidInput = { ...testContactInput, name: null as any };
      
      await expect(submitContactForm(invalidInput)).rejects.toThrow();
    });

    it('should maintain data integrity after errors', async () => {
      // Submit valid form
      await submitContactForm(testContactInput);

      // Try to submit invalid form
      try {
        await submitContactForm({ ...testContactInput, name: '' });
      } catch (error) {
        // Expected to fail
      }

      // Check that valid submission is still there
      const submissions = await getContactSubmissions();
      expect(submissions).toHaveLength(1);
      expect(submissions[0].name).toBe('John Doe');
    });
  });

  describe('Data Validation', () => {
    it('should accept valid email formats', async () => {
      const inputs = [
        { ...testContactInput, email: 'test@example.com' },
        { ...testContactInput, email: 'user.name+tag@domain.co.uk' },
        { ...testContactInput, email: 'test123@subdomain.example.org' }
      ];

      for (const input of inputs) {
        const result = await submitContactForm(input);
        expect(result.success).toBe(true);
      }

      const submissions = await getContactSubmissions();
      expect(submissions).toHaveLength(3);
    });

    it('should handle long messages correctly', async () => {
      const longMessage = 'A'.repeat(5000); // 5000 character message
      const inputWithLongMessage = { ...testContactInput, message: longMessage };

      const result = await submitContactForm(inputWithLongMessage);
      expect(result.success).toBe(true);

      const submissions = await getContactSubmissions();
      expect(submissions[0].message).toBe(longMessage);
      expect(submissions[0].message.length).toBe(5000);
    });

    it('should handle special characters in input', async () => {
      const specialInput: ContactFormInput = {
        name: 'José María-González',
        email: 'josé@example.com',
        subject: 'Subject with émojis 🎉 and symbols @#$%',
        message: 'Message with quotes "hello" and apostrophes "it\'s working"'
      };

      const result = await submitContactForm(specialInput);
      expect(result.success).toBe(true);

      const submissions = await getContactSubmissions();
      expect(submissions[0].name).toBe(specialInput.name);
      expect(submissions[0].email).toBe(specialInput.email);
      expect(submissions[0].subject).toBe(specialInput.subject);
      expect(submissions[0].message).toBe(specialInput.message);
    });
  });
});