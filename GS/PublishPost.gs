/**
 * PublishPost Module
 * Handles publishing posts to multiple platforms: Telegram, Facebook, Blogger, Google Business.
 * 
 * Dependencies: Config.gs (for SETTINGS keys via getCachedSettings)
 */

/**
 * Main dispatcher — routes the payload to each selected platform.
 * @param {object} payload
 * @param {string} payload.text       - Main post text
 * @param {string} [payload.imageUrl] - Optional image URL
 * @param {string} [payload.caption]  - Optional caption/title (used as Blogger post title)
 * @param {string[]} payload.targets  - Array of target platforms: 'telegram', 'facebook', 'blogger', 'gbusiness'
 * @returns {object} results per platform { ok: boolean, error?: string }
 */
function publishPost(payload) {
  const { text, imageUrl, caption, targets } = payload || {};

  if (!text || !targets || !targets.length) {
    return ResponseBuilder.error('publishPost: missing required fields (text, targets)');
  }

  const results = {};

  if (targets.includes('telegram')) {
    try {
      results.telegram = postToTelegram(text, imageUrl);
    } catch (e) {
      results.telegram = { ok: false, error: e.message };
    }
  }

  if (targets.includes('facebook')) {
    try {
      results.facebook = postToFacebook(text, imageUrl);
    } catch (e) {
      results.facebook = { ok: false, error: e.message };
    }
  }

  if (targets.includes('blogger')) {
    try {
      results.blogger = postToBlogger(caption || text.substring(0, 60), text, imageUrl);
    } catch (e) {
      results.blogger = { ok: false, error: e.message };
    }
  }

  if (targets.includes('gbusiness')) {
    try {
      results.gbusiness = postToGoogleBusiness(text, imageUrl);
    } catch (e) {
      results.gbusiness = { ok: false, error: e.message };
    }
  }

  Utils.log('INFO', 'publishPost: done', results);
  return ResponseBuilder.success(results);
}

// ---------------------------------------------------------------------------
// TELEGRAM
// ---------------------------------------------------------------------------

/**
 * Posts a text (+ optional image) to a Telegram channel.
 * Uses Bot API sendMessage or sendPhoto.
 */
function postToTelegram(text, imageUrl) {
  const settings = getCachedSettings();
  const token = settings['PUBLISH_TELEGRAM_BOT_TOKEN'] || settings['TELEGRAM_BOT_TOKEN'];
  const channelId = settings['PUBLISH_TELEGRAM_CHANNEL_ID'] || settings['TELEGRAM_CHAT_ID'];

  if (!token || !channelId) {
    return { ok: false, error: 'חסרים הגדרות טלגרם לפרסום (אין Token או Chat ID)' };
  }

  let url, options;
  if (imageUrl) {
    url = `https://api.telegram.org/bot${token}/sendPhoto`;
    options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: channelId,
        photo: imageUrl,
        caption: text,
        parse_mode: 'Markdown'
      }),
      muteHttpExceptions: true
    };
  } else {
    url = `https://api.telegram.org/bot${token}/sendMessage`;
    options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: channelId,
        text: text,
        parse_mode: 'Markdown'
      }),
      muteHttpExceptions: true
    };
  }

  const resp = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(resp.getContentText());

  if (data.ok) {
    return { ok: true, messageId: data.result && data.result.message_id };
  } else {
    return { ok: false, error: data.description || 'שגיאת Telegram API' };
  }
}

// ---------------------------------------------------------------------------
// FACEBOOK PAGE
// ---------------------------------------------------------------------------

/**
 * Posts to a Facebook Page feed via Graph API.
 * Requires a long-lived Page Access Token.
 */
function postToFacebook(text, imageUrl) {
  const settings = getCachedSettings();
  const pageId = settings['PUBLISH_FACEBOOK_PAGE_ID'];
  const token = settings['PUBLISH_FACEBOOK_PAGE_TOKEN'];

  if (!pageId || !token) {
    return { ok: false, error: 'חסרים PUBLISH_FACEBOOK_PAGE_ID או PUBLISH_FACEBOOK_PAGE_TOKEN בהגדרות' };
  }

  let url, payload;
  if (imageUrl) {
    // Post with photo
    url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
    payload = {
      url: imageUrl,
      caption: text,
      access_token: token
    };
  } else {
    // Plain text post
    url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    payload = {
      message: text,
      access_token: token
    };
  }

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: Object.keys(payload).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(payload[k])}`).join('&'),
    muteHttpExceptions: true
  });

  const data = JSON.parse(resp.getContentText());

  if (data.id) {
    return { ok: true, postId: data.id };
  } else {
    const errMsg = (data.error && data.error.message) || 'שגיאת Facebook API';
    return { ok: false, error: errMsg };
  }
}

// ---------------------------------------------------------------------------
// BLOGGER
// ---------------------------------------------------------------------------

/**
 * Creates a new post on a Blogger blog.
 * Uses OAuth from GAS (the script runs under the owner's Google account).
 */
function postToBlogger(title, content, imageUrl) {
  const settings = getCachedSettings();
  const blogId = settings['PUBLISH_BLOGGER_BLOG_ID'];

  if (!blogId) {
    return { ok: false, error: 'חסר PUBLISH_BLOGGER_BLOG_ID בהגדרות' };
  }

  const fullContent = imageUrl
    ? `<img src="${imageUrl}" style="max-width:100%;border-radius:8px;margin-bottom:16px;" /><br/>${content}`
    : content;

  const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`;
  const body = {
    kind: 'blogger#post',
    title: title,
    content: fullContent
  };

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const data = JSON.parse(resp.getContentText());

  if (data.id) {
    return { ok: true, postId: data.id, url: data.url };
  } else {
    const errMsg = (data.error && data.error.message) || 'שגיאת Blogger API';
    return { ok: false, error: errMsg };
  }
}

// ---------------------------------------------------------------------------
// GOOGLE BUSINESS PROFILE
// ---------------------------------------------------------------------------

/**
 * Creates a local post on Google Business Profile.
 * Uses OAuth from GAS. Requires the account/location to be linked.
 */
function postToGoogleBusiness(text, imageUrl) {
  const settings = getCachedSettings();
  const locationName = settings['PUBLISH_GBUSINESS_LOCATION_NAME'];

  if (!locationName) {
    return { ok: false, error: 'חסר PUBLISH_GBUSINESS_LOCATION_NAME בהגדרות (format: accounts/xxx/locations/yyy)' };
  }

  const url = `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`;

  const body = {
    languageCode: 'he',
    summary: text,
    topicType: 'STANDARD'
  };

  if (imageUrl) {
    body.media = [{
      mediaFormat: 'PHOTO',
      sourceUrl: imageUrl
    }];
  }

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const data = JSON.parse(resp.getContentText());

  if (data.name) {
    return { ok: true, postName: data.name };
  } else {
    const errMsg = (data.error && data.error.message) || 'שגיאת Google Business API';
    return { ok: false, error: errMsg };
  }
}
