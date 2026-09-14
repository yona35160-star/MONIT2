// ============================================================
// WhatsApp Bridge — GAS Fallback Module
// קובץ: BridgeRouter.gs
//
// הוסף קובץ חדש ב-GAS בשם BridgeRouter.gs והדבק את הכל.
// ============================================================

// --- הגדרות כתובות (Defaults) ---
const DEFAULT_RENDER_URL = 'https://whatsapp-taxi-bridge.onrender.com';
const DEFAULT_LOCAL_URL  = 'http://localhost:3001';

// כמה שניות לזכור שהמקומי לא עובד
const LOCAL_CACHE_SECONDS = 30;

/**
 * getBridgeSettings()
 * שואב את ההגדרות העדכניות מה-Script Properties.
 */
function getBridgeSettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    localUrl:  props.getProperty('WHATSAPP_BRIDGE_URL') || DEFAULT_LOCAL_URL,
    renderUrl: props.getProperty('WHATSAPP_RENDER_URL') || DEFAULT_RENDER_URL,
    mode:      props.getProperty('BRIDGE_MODE') || 'AUTO', // AUTO, LOCAL, RENDER
    apiKey:    props.getProperty('BRIDGE_API_KEY'),
    telegramToken: props.getProperty('TELEGRAM_BOT_TOKEN'),
    telegramChatId: props.getProperty('TELEGRAM_CHAT_ID'),
    alertEmail:     props.getProperty('ALERT_EMAIL')
  };
}

// -------------------------------------------------------
// isLocalBotAvailable()
// בודק האם הבוט המקומי פועל.
// -------------------------------------------------------
function isLocalBotAvailable(localUrl) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('local_bot_status');

  if (cached !== null) {
    return cached === 'true';
  }

  try {
    const response = UrlFetchApp.fetch(localUrl.replace(/\/$/, '') + '/health', {
      method: 'get',
      muteHttpExceptions: true,
      connectTimeout: 2000,
      deadline: 3
    });

    const available = response.getResponseCode() === 200;
    cache.put('local_bot_status', available ? 'true' : 'false', LOCAL_CACHE_SECONDS);

    if (!available) {
        console.warn('☁️ Local bot DOWN (HTTP ' + response.getResponseCode() + ')');
    }

    return available;

  } catch (e) {
    console.warn('☁️ Local bot unreachable (' + e.message + ')');
    cache.put('local_bot_status', 'false', LOCAL_CACHE_SECONDS);
    return false;
  }
}

// -------------------------------------------------------
// getBridgeUrl()
// מחזיר את ה-URL הפעיל לפי מצב העבודה (BRIDGE_MODE).
// -------------------------------------------------------
function getActiveBridgeConfig() {
  const settings = getBridgeSettings();
  
  if (settings.mode === 'LOCAL') {
    return { url: settings.localUrl, name: 'LOCAL (FORCED)' };
  }
  
  if (settings.mode === 'RENDER') {
    return { url: settings.renderUrl, name: 'RENDER (FORCED)' };
  }
  
  // AUTO mode (Default)
  const isLocalUp = isLocalBotAvailable(settings.localUrl);
  return isLocalUp 
    ? { url: settings.localUrl, name: 'LOCAL' }
    : { url: settings.renderUrl, name: 'RENDER (AUTO-FALLBACK)' };
}

// -------------------------------------------------------
// sendWhatsAppMessage(jid, text, role)
// שולח הודעת WhatsApp עם לוגיקת מצב עבודה ו-fallback.
// -------------------------------------------------------
function sendWhatsAppMessage(jid, text, role) {
  const settings = getBridgeSettings();
  if (!settings.apiKey) {
    throw new Error('BRIDGE_API_KEY לא מוגדר ב-Script Properties!');
  }

  role = role || 'dispatcher';
  const config = getActiveBridgeConfig();
  const payload = JSON.stringify({ jid: jid, text: text, role: role });

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': settings.apiKey },
    payload: payload,
    muteHttpExceptions: true
  };

  try {
    console.log('🚀 Attempting send via ' + config.name + ' to ' + jid);
    let response = UrlFetchApp.fetch(config.url.replace(/\/$/, '') + '/new-order', options);
    let code = response.getResponseCode();

    // FALLBACK: אם המקומי נכשל ב-AUTO mode — נסה את ה-Render
    if (code !== 200 && settings.mode === 'AUTO' && config.url === settings.localUrl) {
      console.warn('⚠️ Local responded ' + code + ', falling back to Render...');
      CacheService.getScriptCache().remove('local_bot_status');
      response = UrlFetchApp.fetch(settings.renderUrl.replace(/\/$/, '') + '/new-order', options);
      code = response.getResponseCode();
      console.log('✅ Fallback send via RENDER returned HTTP ' + code);
    }

    let result;
    try {
      result = JSON.parse(response.getContentText());
    } catch (parseErr) {
      result = { raw: response.getContentText(), statusCode: code };
    }

    if (code === 200) {
        console.log('✅ Success! Message sent.');
    } else {
        console.error('❌ Failed! StatusCode: ' + code + ' | Body: ' + response.getContentText());
    }

    return result;

  } catch (e) {
    console.error('❌ sendWhatsAppMessage CRITICAL error: ' + e.message);
    
    // ניסיון הצלה אחרון אם נכשל בגלל שגיאת תקשורת במצב AUTO
    if (settings.mode === 'AUTO' && config.url === settings.localUrl) {
       try {
           const backupRes = UrlFetchApp.fetch(settings.renderUrl.replace(/\/$/, '') + '/new-order', options);
           return JSON.parse(backupRes.getContentText());
       } catch(innerE) { 
           console.error('❌ Render Fallback also failed.');
       }
    }

    // --- הוספת Fallback לטלגרם ומייל במידה והכל נכשל ---
    console.warn('📢 Triggering multi-channel fallback (Telegram/Email)...');
    const alertText = '⚠️ שגיאת שליחה בוואטסאפ!\nהודעה מיועדת ל: ' + jid + '\nתוכן: ' + text;
    
    const tgRes = sendTelegramBackup(alertText);
    if (!tgRes) {
      sendEmailBackup(alertText);
    }

    throw e;
  }
}

/**
 * שליחה לטלגרם כגיבוי ראשוני
 */
function sendTelegramBackup(text) {
  const settings = getBridgeSettings();
  if (!settings.telegramToken || !settings.telegramChatId) {
    console.warn('Telegram backup skipped: Token or ChatID missing.');
    return false;
  }

  try {
    const url = 'https://api.telegram.org/bot' + settings.telegramToken + '/sendMessage';
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: settings.telegramChatId,
        text: text,
        parse_mode: 'HTML'
      }),
      muteHttpExceptions: true
    });
    return res.getResponseCode() === 200;
  } catch (e) {
    console.error('Telegram backup failed: ' + e.message);
    return false;
  }
}

/**
 * שליחה למייל כגיבוי אחרון
 */
function sendEmailBackup(text) {
  const settings = getBridgeSettings();
  if (!settings.alertEmail) {
    console.warn('Email backup skipped: Target email missing.');
    return;
  }

  try {
    MailApp.sendEmail({
      to: settings.alertEmail,
      subject: '🚨 שגיאה קריטית במערכת המוניות - גיבוי הודעה',
      body: text
    });
    console.log('✅ Email backup sent to ' + settings.alertEmail);
  } catch (e) {
    console.error('Email backup failed: ' + e.message);
  }
}

// -------------------------------------------------------
// Helper functions
// -------------------------------------------------------
function sendWhatsAppToGroup(groupJid, text) {
  return sendWhatsAppMessage(groupJid, text, 'dispatcher');
}

function sendWhatsAppToDriver(driverPhone, text) {
  const jid = driverPhone.replace(/\D/g, '') + '@s.whatsapp.net';
  return sendWhatsAppMessage(jid, text, 'driver');
}

function sendWhatsAppToPassenger(passengerPhone, text) {
  const jid = passengerPhone.replace(/\D/g, '') + '@s.whatsapp.net';
  return sendWhatsAppMessage(jid, text, 'passenger');
}

// -------------------------------------------------------
// getBridgeStatus()
// -------------------------------------------------------
function getBridgeStatus() {
  const settings = getBridgeSettings();
  const results = { settings: settings };

  // Local
  try {
    const r = UrlFetchApp.fetch(settings.localUrl.replace(/\/$/, '') + '/health', {
      muteHttpExceptions: true, connectTimeout: 1500, deadline: 2
    });
    results.local = { available: r.getResponseCode() === 200, status: r.getResponseCode() };
  } catch (e) {
    results.local = { available: false, error: e.message };
  }

  // Render
  try {
    const r = UrlFetchApp.fetch(settings.renderUrl.replace(/\/$/, '') + '/health', {
      muteHttpExceptions: true, deadline: 5
    });
    results.render = { available: r.getResponseCode() === 200, status: r.getResponseCode() };
  } catch (e) {
    results.render = { available: false, error: e.message };
  }

  const active = getActiveBridgeConfig();
  results.activeConfig = active;
  
  console.log('Bridge Diagnostic:', JSON.stringify(results));
  return results;
}

