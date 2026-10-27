// Replaces lib/push in the mobile build. Browser web-push does not exist in
// the native webview; device push (FCM / APNs) is a separate, later piece.
export function pushSupported(): boolean {
  return false;
}

export async function subscribeToPush(): Promise<boolean> {
  return false;
}

export async function unsubscribeFromPush(): Promise<void> {}
