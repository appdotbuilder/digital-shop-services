import { db } from '../db';
import { settingsTable } from '../db/schema';
import { type UpdateSettingsInput, type Settings } from '../schema';
import { eq } from 'drizzle-orm';

export const getSettings = async (): Promise<Settings[]> => {
  try {
    const results = await db.select()
      .from(settingsTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    throw error;
  }
};

export const getSetting = async (key: string): Promise<Settings | null> => {
  try {
    const results = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.key, key))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch setting:', error);
    throw error;
  }
};

export const updateSetting = async (input: UpdateSettingsInput): Promise<Settings> => {
  try {
    // First try to update existing setting
    const updateResult = await db.update(settingsTable)
      .set({ 
        value: input.value,
        updated_at: new Date()
      })
      .where(eq(settingsTable.key, input.key))
      .returning()
      .execute();

    if (updateResult.length > 0) {
      return updateResult[0];
    }

    // If no existing setting found, create new one
    const insertResult = await db.insert(settingsTable)
      .values({
        key: input.key,
        value: input.value
      })
      .returning()
      .execute();

    return insertResult[0];
  } catch (error) {
    console.error('Failed to update setting:', error);
    throw error;
  }
};

export const getPublicSettings = async (): Promise<Record<string, string>> => {
  try {
    // Define which settings are considered public/safe to expose
    const publicKeys = [
      'site_name',
      'site_description', 
      'contact_email',
      'support_phone',
      'business_address',
      'social_facebook',
      'social_twitter',
      'social_instagram',
      'currency',
      'timezone',
      'maintenance_mode'
    ];

    const results = await db.select()
      .from(settingsTable)
      .execute();

    // Filter to only include public settings and convert to key-value object
    const publicSettings: Record<string, string> = {};
    
    results.forEach(setting => {
      if (publicKeys.includes(setting.key)) {
        publicSettings[setting.key] = setting.value;
      }
    });

    // Provide defaults for essential public settings if they don't exist
    if (!publicSettings['site_name']) {
      publicSettings['site_name'] = 'E-commerce Store';
    }
    if (!publicSettings['contact_email']) {
      publicSettings['contact_email'] = 'contact@example.com';
    }
    if (!publicSettings['currency']) {
      publicSettings['currency'] = 'USD';
    }

    return publicSettings;
  } catch (error) {
    console.error('Failed to fetch public settings:', error);
    throw error;
  }
};