import { type ContactFormInput } from '../schema';

// In-memory storage for contact submissions (in real app, this would be in database)
const contactSubmissions: Array<ContactFormInput & { id: number; created_at: Date }> = [];
let nextId = 1;

export const submitContactForm = async (input: ContactFormInput): Promise<{ success: boolean; message: string }> => {
  try {
    // Validate input exists and is properly formatted
    if (!input.name?.trim() || !input.email?.trim() || !input.subject?.trim() || !input.message?.trim()) {
      throw new Error('All fields are required and cannot be empty');
    }

    // Store submission (in real app, this would go to database)
    const submission = {
      ...input,
      id: nextId++,
      created_at: new Date()
    };
    
    contactSubmissions.push(submission);

    // Simulate email notification to admin
    // In a real application, you would use a service like SendGrid, AWS SES, etc.
    console.log('New contact form submission received:', {
      id: submission.id,
      name: input.name,
      email: input.email,
      subject: input.subject,
      timestamp: submission.created_at
    });

    // Simulate auto-reply email to user
    console.log('Auto-reply sent to:', input.email);

    return {
      success: true,
      message: 'Contact form submitted successfully. We will get back to you soon!'
    };
  } catch (error) {
    console.error('Contact form submission failed:', error);
    throw error;
  }
};

export const getContactSubmissions = async (): Promise<Array<ContactFormInput & { id: number; created_at: Date }>> => {
  try {
    // Return submissions sorted by most recent first
    return [...contactSubmissions].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  } catch (error) {
    console.error('Failed to fetch contact submissions:', error);
    throw error;
  }
};

// Additional helper function to get a specific submission by ID
export const getContactSubmissionById = async (id: number): Promise<(ContactFormInput & { id: number; created_at: Date }) | null> => {
  try {
    const submission = contactSubmissions.find(s => s.id === id);
    return submission || null;
  } catch (error) {
    console.error('Failed to fetch contact submission by ID:', error);
    throw error;
  }
};

// Helper function to clear submissions (useful for testing)
export const clearContactSubmissions = (): void => {
  contactSubmissions.length = 0;
  nextId = 1;
};