// Firebase has been removed. These are no-op stubs kept for backward compatibility
// with any imports that weren't fully cleaned up.
export const requestNotificationPermission = async (..._args: any[]) =>
  ({ success: false, message: 'Firebase removed. Use webPushService instead.' });

export const onForegroundMessage = (_cb: any, ..._args: any[]) => undefined;
