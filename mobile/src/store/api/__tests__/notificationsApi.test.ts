import { notificationsApi } from '../notificationsApi';

describe('notificationsApi', () => {
  it('exposes the feed, unread-count and preference endpoints with hooks', () => {
    expect(notificationsApi.endpoints.getNotifications.name).toBe('getNotifications');
    expect(notificationsApi.endpoints.getUnreadCount.name).toBe('getUnreadCount');
    expect(typeof notificationsApi.useGetNotificationsQuery).toBe('function');
    expect(typeof notificationsApi.useGetUnreadCountQuery).toBe('function');
    expect(typeof notificationsApi.useMarkNotificationReadMutation).toBe('function');
    expect(typeof notificationsApi.useMarkAllNotificationsReadMutation).toBe('function');
    expect(typeof notificationsApi.useGetNotificationPreferencesQuery).toBe('function');
    expect(typeof notificationsApi.useUpdateNotificationPreferencesMutation).toBe('function');
  });
});
