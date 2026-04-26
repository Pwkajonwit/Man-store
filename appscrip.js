/**
 * Google Apps Script trigger for equipment usage LINE notifications.
 *
 * Usage:
 * 1. Open https://script.google.com/
 * 2. Create a new Apps Script project.
 * 3. Paste this file content into Code.gs.
 * 4. Set API_BASE_URL to your deployed web URL.
 * 5. Set TRIGGER_SECRET to the same value as EQUIPMENT_NOTIFICATION_TRIGGER_SECRET in .env.
 * 6. Run setupDailyTriggers() once and approve permissions.
 *
 * The LINE group target is read from the app settings page:
 * settings/notifications.line.groupId
 */

const API_BASE_URL = 'https://YOUR-DOMAIN.com';
const TRIGGER_SECRET = 'store-alert';

function triggerMorningBorrowList() {
  callEquipmentNotificationTrigger('morning');
}

function triggerEveningUnreturnedSummary() {
  callEquipmentNotificationTrigger('evening');
}

function callEquipmentNotificationTrigger(type) {
  const url =
    API_BASE_URL.replace(/\/$/, '') +
    '/api/equipment-usage/notifications/trigger' +
    '?type=' + encodeURIComponent(type) +
    '&secret=' + encodeURIComponent(TRIGGER_SECRET);

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  Logger.log('Trigger type: ' + type);
  Logger.log('Response code: ' + code);
  Logger.log('Response body: ' + body);

  if (code < 200 || code >= 300) {
    throw new Error('Notification trigger failed: ' + code + ' ' + body);
  }
}

function setupDailyTriggers() {
  deleteExistingNotificationTriggers_();

  ScriptApp.newTrigger('triggerMorningBorrowList')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .nearMinute(0)
    .create();

  ScriptApp.newTrigger('triggerEveningUnreturnedSummary')
    .timeBased()
    .everyDays(1)
    .atHour(17)
    .nearMinute(0)
    .create();

  Logger.log('Daily notification triggers created.');
}

function deleteExistingNotificationTriggers_() {
  const handlerNames = [
    'triggerMorningBorrowList',
    'triggerEveningUnreturnedSummary',
  ];

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (handlerNames.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function testMorningTrigger() {
  callEquipmentNotificationTrigger('morning');
}

function testEveningTrigger() {
  callEquipmentNotificationTrigger('evening');
}
