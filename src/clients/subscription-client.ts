// src/clients/subscription-client.ts
import axios, { AxiosInstance } from 'axios';

export type SubscriptionTier = 'open_source' | 'shared_access' | 'teams' | 'dedicated_vps' | 'custom_install';
export type PluginTier = 'free' | 'starter' | 'professional' | 'enterprise';

export interface PluginQuota {
  resource: string;
  used: number;
  limit: number;
}

export interface PluginAccess {
  pluginName: string;
  pluginId: string;
  subscribed: boolean;
  tier: PluginTier;
  quotas: PluginQuota[];
  expiresAt?: string;
  trialEndsAt?: string;
}

export interface UserSubscription {
  companyId: string;
  tier: SubscriptionTier;
  plugins: PluginAccess[];
  trialEndsAt?: string;
}

// Service Addon from billing endpoint
export interface ServiceAddon {
  id: string;
  name: string;
  display_name: string;
  slug: string;
  description: string;
  tagline?: string;
  category: 'vertical' | 'platform' | 'integration';
  price_monthly_cents: number;
  included_in_tiers: string[];
  icon_name: string;
  features: string[];
  is_active: boolean;
  is_public: boolean;
  is_beta: boolean;
}

export interface UserAddon {
  addon_id: string;
  addon_name: string;
  display_name: string;
  status: 'active' | 'disabled' | 'pending';
  enabled_at: string;
  disabled_at?: string;
}

export interface AddonsResponse {
  addons: ServiceAddon[];
  user_addons: UserAddon[];
  user_tier: string;
}

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  category: string;
  tiers: {
    tier: PluginTier;
    price: number;
    billing: 'monthly' | 'yearly' | 'one_time';
    features: string[];
  }[];
  icon?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: 'not_subscribed' | 'quota_exceeded' | 'trial_expired' | 'tier_insufficient';
  pluginAccess?: PluginAccess;
  requiredTier?: PluginTier;
  message?: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  tier: SubscriptionTier;
  companyId?: string;
  createdAt?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;  // First 8 chars for display (e.g., "brain_abc1...")
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export class SubscriptionClient {
  private client: AxiosInstance;

  constructor(endpoint: string, apiKey: string, companyId?: string) {
    this.client = axios.create({
      baseURL: endpoint,
      headers: {
        // Use X-API-Key header for the auth service
        'X-API-Key': apiKey,
        // Also include Bearer for other services that expect it
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Company-ID': companyId || 'adverant',
      },
      timeout: 15000,
    });
  }

  /**
   * Get user's subscription info including enabled addons
   * Uses the /billing/addons endpoint which returns user_addons
   */
  async getUserSubscription(): Promise<UserSubscription> {
    try {
      // Call the billing/addons endpoint which returns user's enabled addons
      const response = await this.client.get('/billing/addons');
      const data: AddonsResponse = response.data;

      // Convert addons response to UserSubscription format
      const plugins: PluginAccess[] = data.user_addons
        .filter(ua => ua.status === 'active')
        .map(ua => ({
          pluginName: ua.addon_name,
          pluginId: ua.addon_id,
          subscribed: true,
          tier: 'professional' as PluginTier, // Default tier for enabled addons
          quotas: [],
        }));

      return {
        companyId: 'adverant',
        tier: (data.user_tier || 'open_source') as SubscriptionTier,
        plugins,
      };
    } catch (error) {
      console.error('[SubscriptionClient] getUserSubscription failed:', error);
      // Return default open_source tier if not subscribed
      return {
        companyId: 'unknown',
        tier: 'open_source',
        plugins: [],
      };
    }
  }

  /**
   * Get all available addons and user's enabled addons
   */
  async getAddonsWithStatus(): Promise<AddonsResponse> {
    try {
      const response = await this.client.get('/billing/addons');
      return response.data;
    } catch (error) {
      console.error('[SubscriptionClient] getAddonsWithStatus failed:', error);
      return {
        addons: [],
        user_addons: [],
        user_tier: 'open_source',
      };
    }
  }

  async getPluginAccess(pluginName: string): Promise<PluginAccess> {
    try {
      // Check if the addon is enabled for the user
      const addonsResponse = await this.getAddonsWithStatus();
      const userAddon = addonsResponse.user_addons.find(
        ua => ua.addon_name === pluginName && ua.status === 'active'
      );

      if (userAddon) {
        return {
          pluginName,
          pluginId: userAddon.addon_id,
          subscribed: true,
          tier: 'professional',
          quotas: [],
        };
      }

      return {
        pluginName,
        pluginId: pluginName,
        subscribed: false,
        tier: 'free',
        quotas: [],
      };
    } catch (error) {
      return {
        pluginName,
        pluginId: pluginName,
        subscribed: false,
        tier: 'free',
        quotas: [],
      };
    }
  }

  async checkPluginAccess(pluginName: string, _action?: string): Promise<AccessCheckResult> {
    try {
      const access = await this.getPluginAccess(pluginName);
      return {
        allowed: access.subscribed,
        pluginAccess: access,
        message: access.subscribed ? 'Access granted' : 'Plugin not subscribed',
      };
    } catch (error: any) {
      // Network or server error - allow by default for graceful degradation
      return {
        allowed: true,
        message: 'Access check failed, allowing by default',
      };
    }
  }

  async getMarketplacePlugins(category?: string): Promise<MarketplacePlugin[]> {
    try {
      const params = category ? { category } : {};
      const response = await this.client.get('/api/v1/marketplace/plugins', { params });
      return response.data.data?.plugins || response.data.plugins || [];
    } catch (error) {
      return [];
    }
  }

  async subscribeToPlugin(pluginId: string, tier: PluginTier): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> {
    try {
      const response = await this.client.post(`/api/v1/plugins/${pluginId}/subscribe`, {
        tier,
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Subscription failed',
      };
    }
  }

  async getUsageStats(pluginName: string): Promise<{ current: number; limit: number; resetDate: string }> {
    try {
      const response = await this.client.get(`/api/v1/plugins/${pluginName}/usage`);
      return response.data;
    } catch (error) {
      return {
        current: 0,
        limit: 0,
        resetDate: new Date().toISOString(),
      };
    }
  }

  /**
   * Get current user info from API key
   * The backend looks up the user associated with the API key
   */
  async getCurrentUser(): Promise<CurrentUser | null> {
    try {
      // Try the addons endpoint to get user tier info
      const addonsResponse = await this.getAddonsWithStatus();

      // Extract user info from addons response
      return {
        id: 'current-user',
        email: '', // Not available from this endpoint
        tier: (addonsResponse.user_tier || 'open_source') as SubscriptionTier,
      };
    } catch (error) {
      console.error('[SubscriptionClient] getCurrentUser failed:', error);
      return null;
    }
  }

  /**
   * List all API keys for the current user
   */
  async getApiKeys(): Promise<ApiKey[]> {
    try {
      const response = await this.client.get('/api/v1/user/api-keys');
      return response.data.keys || [];
    } catch (error) {
      console.error('[SubscriptionClient] getApiKeys failed:', error);
      return [];
    }
  }

  /**
   * Create a new API key
   */
  async createApiKey(name: string, expiresInDays?: number): Promise<{ key: string; keyData: ApiKey } | null> {
    try {
      const response = await this.client.post('/api/v1/user/api-keys', {
        name,
        expiresInDays,
      });
      return response.data;
    } catch (error) {
      console.error('[SubscriptionClient] createApiKey failed:', error);
      return null;
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<boolean> {
    try {
      await this.client.delete(`/api/v1/user/api-keys/${keyId}`);
      return true;
    } catch (error) {
      console.error('[SubscriptionClient] revokeApiKey failed:', error);
      return false;
    }
  }
}
