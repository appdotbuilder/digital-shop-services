import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { settingsTable } from '../db/schema';
import { type UpdateSettingsInput } from '../schema';
import { getSettings, getSetting, updateSetting, getPublicSettings } from '../handlers/settings';
import { eq } from 'drizzle-orm';

describe('Settings Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getSettings', () => {
    it('should return empty array when no settings exist', async () => {
      const result = await getSettings();
      expect(result).toEqual([]);
    });

    it('should return all settings when they exist', async () => {
      // Create test settings
      await db.insert(settingsTable)
        .values([
          { key: 'site_name', value: 'Test Store' },
          { key: 'contact_email', value: 'test@example.com' },
          { key: 'admin_password', value: 'secret123' }
        ])
        .execute();

      const result = await getSettings();

      expect(result).toHaveLength(3);
      expect(result.map(s => s.key)).toContain('site_name');
      expect(result.map(s => s.key)).toContain('contact_email');
      expect(result.map(s => s.key)).toContain('admin_password');
      
      // Verify each setting has proper structure
      result.forEach(setting => {
        expect(setting.id).toBeDefined();
        expect(setting.key).toBeDefined();
        expect(setting.value).toBeDefined();
        expect(setting.created_at).toBeInstanceOf(Date);
        expect(setting.updated_at).toBeInstanceOf(Date);
      });
    });
  });

  describe('getSetting', () => {
    it('should return null when setting does not exist', async () => {
      const result = await getSetting('nonexistent_key');
      expect(result).toBeNull();
    });

    it('should return setting when it exists', async () => {
      // Create test setting
      await db.insert(settingsTable)
        .values({ key: 'site_name', value: 'My Store' })
        .execute();

      const result = await getSetting('site_name');

      expect(result).not.toBeNull();
      expect(result!.key).toEqual('site_name');
      expect(result!.value).toEqual('My Store');
      expect(result!.id).toBeDefined();
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
    });

    it('should be case sensitive for keys', async () => {
      await db.insert(settingsTable)
        .values({ key: 'site_name', value: 'Test Store' })
        .execute();

      const result1 = await getSetting('site_name');
      const result2 = await getSetting('Site_Name');

      expect(result1).not.toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('updateSetting', () => {
    it('should create new setting when key does not exist', async () => {
      const input: UpdateSettingsInput = {
        key: 'new_setting',
        value: 'new_value'
      };

      const result = await updateSetting(input);

      expect(result.key).toEqual('new_setting');
      expect(result.value).toEqual('new_value');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify it was saved to database
      const saved = await db.select()
        .from(settingsTable)
        .where(eq(settingsTable.key, 'new_setting'))
        .execute();

      expect(saved).toHaveLength(1);
      expect(saved[0].value).toEqual('new_value');
    });

    it('should update existing setting when key already exists', async () => {
      // Create existing setting
      const existing = await db.insert(settingsTable)
        .values({ key: 'existing_key', value: 'old_value' })
        .returning()
        .execute();

      const originalUpdatedAt = existing[0].updated_at;

      // Wait a moment to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const input: UpdateSettingsInput = {
        key: 'existing_key',
        value: 'updated_value'
      };

      const result = await updateSetting(input);

      expect(result.id).toEqual(existing[0].id);
      expect(result.key).toEqual('existing_key');
      expect(result.value).toEqual('updated_value');
      expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());

      // Verify database was updated
      const updated = await db.select()
        .from(settingsTable)
        .where(eq(settingsTable.key, 'existing_key'))
        .execute();

      expect(updated).toHaveLength(1);
      expect(updated[0].value).toEqual('updated_value');
    });

    it('should handle special characters in key and value', async () => {
      const input: UpdateSettingsInput = {
        key: 'special-key_with.dots',
        value: 'Value with spaces & symbols: @#$%'
      };

      const result = await updateSetting(input);

      expect(result.key).toEqual('special-key_with.dots');
      expect(result.value).toEqual('Value with spaces & symbols: @#$%');
    });

    it('should handle empty string values', async () => {
      const input: UpdateSettingsInput = {
        key: 'empty_value',
        value: ''
      };

      const result = await updateSetting(input);

      expect(result.key).toEqual('empty_value');
      expect(result.value).toEqual('');
    });
  });

  describe('getPublicSettings', () => {
    it('should return default public settings when no settings exist', async () => {
      const result = await getPublicSettings();

      expect(result).toEqual({
        site_name: 'E-commerce Store',
        contact_email: 'contact@example.com',
        currency: 'USD'
      });
    });

    it('should return only public settings and filter out private ones', async () => {
      // Create mix of public and private settings
      await db.insert(settingsTable)
        .values([
          { key: 'site_name', value: 'My Public Store' },
          { key: 'contact_email', value: 'public@example.com' },
          { key: 'admin_password', value: 'secret123' },
          { key: 'database_url', value: 'postgresql://secret' },
          { key: 'support_phone', value: '+1-555-0123' },
          { key: 'social_facebook', value: 'https://facebook.com/mystore' }
        ])
        .execute();

      const result = await getPublicSettings();

      // Should include public settings
      expect(result['site_name']).toEqual('My Public Store');
      expect(result['contact_email']).toEqual('public@example.com');
      expect(result['support_phone']).toEqual('+1-555-0123');
      expect(result['social_facebook']).toEqual('https://facebook.com/mystore');

      // Should NOT include private settings
      expect(result['admin_password']).toBeUndefined();
      expect(result['database_url']).toBeUndefined();

      // Should still provide defaults for missing public settings
      expect(result['currency']).toEqual('USD');
    });

    it('should override defaults with actual values when they exist', async () => {
      await db.insert(settingsTable)
        .values([
          { key: 'site_name', value: 'Custom Store Name' },
          { key: 'currency', value: 'EUR' },
          { key: 'contact_email', value: 'custom@store.com' }
        ])
        .execute();

      const result = await getPublicSettings();

      expect(result['site_name']).toEqual('Custom Store Name');
      expect(result['currency']).toEqual('EUR');
      expect(result['contact_email']).toEqual('custom@store.com');
    });

    it('should include all defined public setting types', async () => {
      // Create all possible public settings
      await db.insert(settingsTable)
        .values([
          { key: 'site_name', value: 'Test Store' },
          { key: 'site_description', value: 'A test store' },
          { key: 'contact_email', value: 'test@example.com' },
          { key: 'support_phone', value: '+1-555-0123' },
          { key: 'business_address', value: '123 Test St' },
          { key: 'social_facebook', value: 'https://facebook.com/test' },
          { key: 'social_twitter', value: 'https://twitter.com/test' },
          { key: 'social_instagram', value: 'https://instagram.com/test' },
          { key: 'currency', value: 'CAD' },
          { key: 'timezone', value: 'America/Toronto' },
          { key: 'maintenance_mode', value: 'false' }
        ])
        .execute();

      const result = await getPublicSettings();

      expect(result['site_name']).toEqual('Test Store');
      expect(result['site_description']).toEqual('A test store');
      expect(result['contact_email']).toEqual('test@example.com');
      expect(result['support_phone']).toEqual('+1-555-0123');
      expect(result['business_address']).toEqual('123 Test St');
      expect(result['social_facebook']).toEqual('https://facebook.com/test');
      expect(result['social_twitter']).toEqual('https://twitter.com/test');
      expect(result['social_instagram']).toEqual('https://instagram.com/test');
      expect(result['currency']).toEqual('CAD');
      expect(result['timezone']).toEqual('America/Toronto');
      expect(result['maintenance_mode']).toEqual('false');
    });
  });
});