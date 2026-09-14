/**
 * NOTIFICATION & BOT SERVICE
 * Consolidated WhatsApp, Telegram, and Bot logic.
 */

const ArchitectureSwitch = {
  ENABLE_FIREBASE_SYNC: false,
  USE_FIREBASE_REALTIME_DB: false,
  ENABLE_AUTO_ARCHIVE: false,
  ENABLE_BATCH_WRITES: true,

  isEnabled: (feature) => {
    try {
      const propKey = `ARCH_${feature}`;
      const propVal = PropertiesService.getScriptProperties().getProperty(propKey);
      if (propVal !== null) return propVal === 'true';
    } catch(e) {}
    return ArchitectureSwitch[feature] === true;
  },

  getActiveOrderSource: () => {
    return ArchitectureSwitch.isEnabled('USE_FIREBASE_REALTIME_DB') ? 'FIREBASE' : 'SHEETS';
  }
};

const NotificationService = {
  _sendWithRetry: (notificationName, notificationFn, maxAttempts = 3, baseDelayMs = 300) => {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = notificationFn();
        if (!result || result.ok === false) throw new Error(result?.error || 'Failed');
        return result;
      } catch (e) {
        lastError = e;
        if (attempt < maxAttempts) Utilities.sleep(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
    return { ok: false, error: lastError.toString() };
  },

  sendNewOrder: (order, settings, channels, prefixText = '') => {
    const activeChannels = channels || ['whatsapp', 'telegram'];
    let appUrl = (settings['DRIVER_APP_URL'] || 'http://localhost:5274/driver.html').split('#')[0];
    if (!appUrl.endsWith('/')) appUrl += '/';
    const baseAcceptLink = `${appUrl}#/accept-ride?orderId=${order.order_id}`;
    const formattedDate = Utils.formatDateTime(order.pickup_datetime);

    const groupMessage = (prefixText ? prefixText + "\n" : "") + MessageTemplates.NEW_RIDE_GROUP(
      order.order_id, order.pickup_address, order.destination_address, order.price, formattedDate, baseAcceptLink, order.notes
    );

    let whatsappRes = activeChannels.includes('whatsapp') ? NotificationService._sendToWhatsApp(groupMessage, settings, null, order.order_id) : null;
    let telegramRes = null;
    if (activeChannels.includes('telegram')) {
        const inlineKeyboard = [[{ text: '🚖 לחץ לקבלת נסיעה', web_app: { url: baseAcceptLink } }]];
        telegramRes = NotificationService._sendToTelegramGroup(groupMessage, settings, inlineKeyboard);
    }
    Utils.clearCache('Orders');
    return { ok: (whatsappRes?.ok || telegramRes?.ok), whatsapp: whatsappRes, telegram: telegramRes };
  },

  sendDriverAssignment: (driver, order, settings) => {
    let appUrl = (settings['DRIVER_APP_URL'] || 'http://localhost:5274/driver.html').split('#')[0];
    if (!appUrl.endsWith('/')) appUrl += '/';
    const rideLink = `${appUrl}#/ride/${order.order_id}?phone=${encodeURIComponent(Utils.normalizePhone(driver.phone))}`;
    const message = MessageTemplates.RIDE_APPROVED_MASKED(order.order_id, order.customer_name, order.pickup_address, order.destination_address, order.price, 0, Utils.formatDateTime(order.pickup_datetime));

    let whatsappRes = driver.phone ? NotificationService._sendToWhatsApp(message + `\n\n👇 *פרטים ותשלום:*\n${rideLink}`, settings, driver.phone, order.order_id, 'driver') : { ok: false };
    let telegramRes = driver.telegram_id ? NotificationService._sendToTelegramChatWithButtons(driver.telegram_id, message, [[{ text: '🚙 פרטי נסיעה', web_app: { url: rideLink } }]], settings) : { ok: false };

    if (Firebase.isEnabled()) {
        Firebase.push(`notifications/${driver.driver_id}`, { type: 'driver_assignment', title: 'נסיעה חדשה! 🚖', body: `איסוף: ${order.pickup_address}`, order_id: order.order_id, created_at: Date.now() });
    }
    return { ok: whatsappRes.ok || telegramRes.ok, whatsapp: whatsappRes, telegram: telegramRes };
  },

  _sendToWhatsApp: (text, settings, targetJid = null, orderId = null, role = 'dispatcher') => {
      const targetUrls = Utils.getWhatsAppUrls(settings);
      const bridgeKey = Utils.getSecret('BRIDGE_API_KEY') || settings['BRIDGE_API_KEY'];
      if (targetUrls.length === 0 || !bridgeKey || bridgeKey.length < 5) return { ok: false, error: 'BRIDGE_NOT_CONFIGURED' };
      
      let finalJid = targetJid || settings['TARGET_GROUP_JID'];
      if (finalJid && !String(finalJid).includes('@')) {
        finalJid = Utils.PhoneFormatter.toWhatsappJid(finalJid);
      }
      const payload = { jid: finalJid, text, role, requestId: `req_${Date.now()}` };

      for (const bridgeUrl of targetUrls) {
          try {
              const resp = UrlFetchApp.fetch(`${bridgeUrl}/new-order`, { method: 'post', contentType: 'application/json', headers: { 'x-api-key': bridgeKey }, payload: JSON.stringify(payload), muteHttpExceptions: true });
              if (resp.getResponseCode() === 200) {
                  const data = JSON.parse(resp.getContentText());
                  if (data.success !== undefined) {
                      const firstResult = (data.details && data.details.length > 0) ? data.details[0] : null;
                      const sentOk = data.success && (!firstResult || firstResult.ok !== false);
                      if (sentOk) {
                          return { ok: true, bridgeMessageId: firstResult ? firstResult.id : null };
                      }
                      Utils.log("WARN", "WhatsApp send rejected, trying next bridge", { url: bridgeUrl, error: firstResult ? firstResult.error : data.error });
                      continue;
                  }
                  if (data.ok !== false) return data;
              }
          } catch (e) {
              Utils.log("WARN", "WhatsApp bridge request failed", { url: bridgeUrl, error: e.toString() });
          }
      }

      // --- FALLBACK LOGIC ---
      Utils.log("ERROR", "All WhatsApp bridges failed. Triggering fallback channels.", { jid: finalJid });
      const alertText = `🚨 *שגיאת שליחה בוואטסאפ!*\n\n*מיועד ל:* ${finalJid}\n*תוכן:* ${text}`;
      
      const tgRes = NotificationService._sendTelegramBackup(alertText, settings);
      if (!tgRes) {
          NotificationService._sendEmailBackup(alertText, settings);
      }

      return { ok: false, error: 'All bridges failed. Fallback triggered.' };
  },

  _sendTelegramBackup: (text, settings) => {
    const tgToken = Utils.getSecret('TELEGRAM_BOT_TOKEN') || settings['TELEGRAM_BOT_TOKEN'];
    const chatId = settings['TELEGRAM_CHAT_ID'];
    if (!tgToken || !chatId) {
      Utils.log("WARN", "Telegram backup skipped: Token or ChatID missing.");
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        }),
        muteHttpExceptions: true
      });
      return res.getResponseCode() === 200;
    } catch (e) {
      Utils.log("ERROR", "Telegram backup failed", e.toString());
      return false;
    }
  },

  _sendEmailBackup: (text, settings) => {
    const alertEmail = settings['ALERT_EMAIL'];
    if (!alertEmail) {
      Utils.log("WARN", "Email backup skipped: ALERT_EMAIL missing.");
      return;
    }

    try {
      MailApp.sendEmail({
        to: alertEmail,
        subject: '🚨 שגיאה קריטית במערכת המוניות - גיבוי הודעה',
        body: text.replace(/\*/g, '') // Remove markdown for email
      });
      Utils.log("AUDIT", "Email backup sent", { to: alertEmail });
    } catch (e) {
      Utils.log("ERROR", "Email backup failed", e.toString());
    }
  },

  _sendToTelegramGroup: (text, settings, inlineKeyboard = null) => {
      const tgToken = Utils.getSecret('TELEGRAM_BOT_TOKEN') || settings['TELEGRAM_BOT_TOKEN'];
      if (!tgToken || !settings['TELEGRAM_CHAT_ID']) return { ok: false };
      const payload = { chat_id: settings['TELEGRAM_CHAT_ID'], text, parse_mode: 'Markdown', reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : null };
      const resp = UrlFetchApp.fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
      return { ok: resp.getResponseCode() === 200 };
  },

  _sendToTelegramChatWithButtons: (chatId, text, inlineKeyboard, settings) => {
      const tgToken = Utils.getSecret('TELEGRAM_BOT_TOKEN') || settings['TELEGRAM_BOT_TOKEN'];
      const payload = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: inlineKeyboard } };
      const resp = UrlFetchApp.fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
      return { ok: resp.getResponseCode() === 200 };
  },

  _escapeMarkdown: (text) => (text || '').replace(/[_*`\[]/g, '\\$&'),
  
  sendToCustomer: (order, driver, settings) => {
    if (!order.customer_phone) return { ok: false, error: 'Missing customer phone' };
    
    const message = MessageTemplates.CUSTOMER_CONFIRMATION(
      order.order_id,
      driver.driver_name,
      driver.phone,
      '5-10', // Default ETA
      order.pickup_address,
      order.destination_address,
      order.price
    );
    
    return NotificationService._sendToWhatsApp(message, settings, order.customer_phone, order.order_id, 'passenger');
  },
  
  sendOrderTakenInGroup: (driver, order, settings) => {
    const message = MessageTemplates.RIDE_TAKEN(order.order_id, driver.driver_name);
    return NotificationService._sendToWhatsApp(message, settings, null, order.order_id, 'dispatcher');
  }
};

const BotService = {
  handleMessage: (msg, settings) => {
    if (String(settings['ENABLE_AUTO_BOT']) !== 'true') return;
    const chatId = String(msg.chat.id);
    const text = (msg.text || '').trim();
    const stateKey = `bot_state_${chatId}`;
    const cache = CacheService.getScriptCache();
    const stateData = JSON.parse(cache.get(stateKey) || '{"state":"IDLE","data":{}}');
    BotService._processState(chatId, text, stateData.state, stateData.data, settings, msg.from);
  },

  _processState: (chatId, text, state, data, settings, user) => {
      let nextState = state;
      let reply = '';
      if (text === '/cancel' || text === 'ביטול') {
          CacheService.getScriptCache().remove(`bot_state_${chatId}`);
          NotificationService._sendToTelegramGroup("❌ בוטל", settings);
          return;
      }
      // Simple State Logic
      if (state === 'IDLE') {
          reply = "📍 מאיפה אוספים?";
          nextState = 'AWAITING_PICKUP';
      } else if (state === 'AWAITING_PICKUP') {
          data.pickup = text;
          reply = "🏁 לאן נוסעים?";
          nextState = 'AWAITING_DESTINATION';
      } else if (state === 'AWAITING_DESTINATION') {
          data.destination = text;
          reply = `✅ הזמנה ל- ${text}. אשר ע"י כתיבת 'כן'`;
          nextState = 'AWAITING_CONFIRMATION';
      }
      if (reply) NotificationService._sendToTelegramGroup(reply, settings);
      CacheService.getScriptCache().put(`bot_state_${chatId}`, JSON.stringify({ state: nextState, data }), 600);
  }
};
