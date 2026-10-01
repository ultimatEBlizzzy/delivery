import type { PublicSettingsDto, SettingDto } from '@hardware-delivery/shared';
import { http } from '@/lib/http';

export const settingsApi = {
  getPublic: () => http.get<PublicSettingsDto>('/settings/public', { skipAuth: true }),
  getAdmin: () => http.get<SettingDto[]>('/admin/settings'),
  update: (settings: Record<string, unknown>) =>
    http.patch<SettingDto[]>('/admin/settings', { settings }),
};
