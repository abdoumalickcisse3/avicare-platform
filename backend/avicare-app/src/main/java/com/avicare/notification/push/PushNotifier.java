package com.avicare.notification.push;

import com.avicare.notification.domain.Notification;

/**
 * Port called right after a notification is materialized, to push it to the phones of the members
 * who want it (the sibling of {@link com.avicare.notification.whatsapp.OutboxEnqueuer}). The bell
 * stays the source of truth; a push is only a nudge to go and look.
 */
public interface PushNotifier {

  /** Never throws: a push that cannot leave must not cost the scan its other notifications. */
  void notifyFor(Notification notification);
}
