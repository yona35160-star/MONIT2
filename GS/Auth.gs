/**
 * Authentication Service
 * Handles admin authentication with secure token management
 * 
 * Dependencies: Utils.gs (for password hashing, token verification)
 */

const AuthService = {
  loginAdmin: (payload, settings) => {
    const input = String(payload.password || '').trim();
    if (!input) return Utils.error('סיסמה לא סופקה');

    // Read stored password and salt
    const stored = String(settings['ADMIN_PASSWORD'] || '').trim();
    const salt = Utils.getSecret('ADMIN_SALT') || '';

    if (!stored) {
      Utils.log('ERROR', 'AuthService: ADMIN_PASSWORD missing in settings');
      return Utils.error('שגיאת תצורה: סיסמת מנהל לא מוגדרת');
    }

    // [QA FIX DATA-005] try hash first, allow plaintext fallback (for default pw)
    let isMatch = false;
    if (salt && Utils.verifyPassword(input, salt, stored)) {
        isMatch = true;
    } else if (input === stored) {
        // Fallback for legacy plaintext settings value
        isMatch = true;
        Utils.log('WARN', 'Auth: Password match (Plaintext)', { user: 'admin' });
    }

    if (!isMatch) {
       // Hint: if password is still plaintext, run resetAdminPassword('yourpass') from GAS editor
       Utils.log('WARN', 'Auth Failed', { inputLen: input.length, hasSalt: !!salt });
       return Utils.error('אימות שגוי');
    }

    // Issue short-lived token (1 hour)
    try {
      const token = Utils.issueAdminToken(3600);
      return Utils.json({ ok: true, data: { token, expires_in: 3600 } });
    } catch (e) {
      Utils.log('ERROR', 'issueAdminToken failed', e.toString());
      return Utils.error('שגיאה ביצירת טוקן');
    }
  },

  refreshAdminToken: (payload, settings, authToken) => {
    // Allow refresh by valid current token or by providing password
    try {
      if (authToken && Utils.verifyAdminToken(authToken)) {
        const token = Utils.issueAdminToken(3600);
        return Utils.json({ ok: true, data: { token, expires_in: 3600 } });
      }

      // Else, accept password && issue
      const input = String(payload.password || '').trim();
      if (input) {
        const loginRes = AuthService.loginAdmin({ password: input }, settings);
        // loginAdmin returns a ContentService output; extract JSON
        try {
          const parsed = JSON.parse(loginRes.getContent());
          if (parsed && parsed.ok && parsed.data && parsed.data.token) {
            return Utils.json({ ok: true, data: { token: parsed.data.token, expires_in: parsed.data.expires_in || 3600 } });
          }
        } catch (e) { /* fallthrough */ }
      }

      return Utils.error('Unauthorized');
    } catch (e) {
      Utils.log('ERROR', 'refreshAdminToken failed', e.toString());
      return Utils.error('שגיאה ברענון הטוקן');
    }
  },

  checkAuthStatus: (payload, settings, authToken) => {
    // This allows the frontend to verify if its stored token is still valid
    const token = authToken || payload.token || (payload.request && payload.request.authToken);
    if (!token) return Utils.json({ ok: false, error: 'Token missing' });

    // Check if it's an admin token
    if (Utils.checkAuth(token, 'admin', settings)) {
      return Utils.json({ ok: true, data: { type: 'admin', valid: true } });
    }

    // Check if it's a driver token
    if (Utils.checkAuth(token, 'driver', settings)) {
      return Utils.json({ ok: true, data: { type: 'driver', valid: true } });
    }

    return Utils.json({ ok: false, error: 'Invalid Token', valid: false });
  },

  /**
   * Secure Login using Firebase ID Token
   * Verifies the token with Google Identity Toolkit and logs in the driver
   */
  loginWithFirebaseToken: (payload, settings) => {
    const idToken = payload.idToken;
    if (!idToken) return Utils.error('Missing ID Token');

    const apiKey = settings['FIREBASE_API_KEY'] || Utils.getSecret('FIREBASE_API_KEY');
    if (!apiKey) return Utils.error('Server Configuration Error: API Key missing');

    try {
      // 1. Verify Token with Google Identity Toolkit
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ idToken: idToken })
      });
      
      const data = JSON.parse(response.getContentText());
      if (!data.users || data.users.length === 0) {
        return Utils.error('Invalid Token');
      }

      const firebaseUser = data.users[0];
      const phoneNumber = firebaseUser.phoneNumber; // Format: +972501234567

      if (!phoneNumber) {
        return Utils.error('Token does not contain phone number');
      }

      // 2. Normalize Phone for Internal System
      // Remove +972 and add 0
      const localPhone = '0' + phoneNumber.replace('+972', '').replace(/^\+/, '');
      
      Utils.log("AUDIT", "SecureLogin", { phone: localPhone, uid: firebaseUser.localId });

      // 3. Delegate to Internal Login Logic
      // We'll reuse the logic from DriverService.login but trust the input
      // Since DriverService.login calls might be protected or expect raw passwords (which we don't have),
      // we'll implement a 'trustedLogin' or just search and issue token directly here.
      
      const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'phone', { transformKey: k => Utils.normalizePhone(k) });
      const driver = driversMap.get(Utils.normalizePhone(localPhone));
      
      if (!driver) {
         // Optional: Auto-registration or error
         return Utils.error('Driver not found. Please register first.');
      }
      
      if (driver.status !== DriverStatus.ACTIVE) {
         return Utils.error('Driver blocked or pending approval');
      }

      // Update Last Login
      try {
        const ss = Utils.getSS();
        const sheet = ss.getSheetByName(Schema.Sheets.DRIVERS);
        // We know the phone matches, find row by ID or Phone scan
        // Optimization: driver object usually doesn't have row index in getDataMap unless configured.
        // Let's rely on DriverService to update if needed, or just skip it for speed.
        // Actually, let's just issue the token.
      } catch (e) {}

      // Issue Session Token via the existing driver login flow (creates/rotates session_secret)
      return DriverService.login(localPhone);

    } catch (e) {
      Utils.log("ERROR", "Firebase Token Verification Failed", e.toString());
      return Utils.error('Token Verification Failed');
    }
  },

  /**
   * Request Custom OTP (Sent via WhatsApp Bridge)
   * Replaces Firebase SMS Auth
   */
  requestOTP: (payload, settings) => {
    const rawPhone = String(payload.phone || '').trim();
    if (!rawPhone) return Utils.error('Missing phone number');

    const phone = Utils.normalizePhone(rawPhone);
    if (!phone) return Utils.error('Invalid phone number format');

    const type = payload.type || 'passenger'; // driver or passenger

    // Validate driver exists before sending OTP
    if (type === 'driver') {
      const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'phone', { transformKey: k => Utils.normalizePhone(k) });
      const driver = driversMap.get(phone);
      
      if (!driver) {
          // Check if they exist as a customer to provide better feedback
          const customersMap = Utils.getDataMap(Schema.Sheets.CUSTOMERS, 'customer_phone', { transformKey: k => Utils.normalizePhone(k) });
          if (customersMap.has(phone)) {
              return Utils.json({ 
                  ok: false, 
                  error: 'REGISTER_AS_DRIVER', 
                  message: 'אתה רשום כנוסע במערכת. כדי להיכנס כנהג עליך להירשם תחילה בפורטל הנהגים.' 
              });
          }
          return Utils.error('נהג לא נמצא. אנא הירשם תחילה.');
      }
      
      if (driver.status !== DriverStatus.ACTIVE) {
          return Utils.error('חשבון הנהג חסום או ממתין לאישור');
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in CacheService for 5 minutes
    const cache = CacheService.getScriptCache();
    cache.put('otp_' + phone, otp, 300);

    // Format WhatsApp Message
    const isDriver = type === 'driver';
    const msgText = `🚕 *TAXI PRO*\n\nקוד האימות שלך ב${isDriver ? 'פורטל נהגים' : 'אפליקציה'} הוא:\n*${otp}*\n\n_הקוד בתוקף ל-5 דקות._`;

    // Send via WhatsApp Bridge
    const targetUrls = Utils.getWhatsAppUrls(settings);
    const bridgeKeyRaw = Utils.getSecret('BRIDGE_API_KEY') || settings['BRIDGE_API_KEY'];
    
    // SEC-002 FIX: Handle [HIDDEN] placeholder properly
    const bridgeKey = (bridgeKeyRaw && bridgeKeyRaw !== '[HIDDEN]' && bridgeKeyRaw !== '[SECURELY_STORED_IN_PROPS]') ? bridgeKeyRaw : null;

    if (targetUrls.length === 0 || !bridgeKey) {
      Utils.log('ERROR', 'WhatsApp Bridge not configured or key is masked', { phone, hasUrls: targetUrls.length > 0, hasKey: !!bridgeKey });
      return Utils.json({ 
        ok: false, 
        error: 'Messaging gateway not configured. Please ensure WHATSAPP_BRIDGE_URL or WHATSAPP_RENDER_URL is set.',
        error_code: 'GATEWAY_UNCONFIGURED'
      });
    }

    try {
      // 972501234567@s.whatsapp.net
      const toJid = '972' + phone.substring(1) + '@s.whatsapp.net';
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-api-key': bridgeKey },
        payload: JSON.stringify({
          text: msgText,
          jid: toJid,
          targetGroupJid: toJid,
          role: type
        }),
        muteHttpExceptions: true
      };

      let lastError = null;
      for (const baseUrl of targetUrls) {
        try {
          const resp = Utils.fetchWithRetry(`${baseUrl}/new-order`, options);
          const respData = JSON.parse(resp.getContentText());
          if (respData.success || respData.ok) {
            Utils.log('INFO', 'OTP Sent via WhatsApp', { phone, type, url: baseUrl });
            return Utils.json({ ok: true, message: 'OTP sent' });
          }
          lastError = respData;
        } catch (e) {
          lastError = e.toString();
          Utils.log('WARN', 'OTP Bridge attempt failed', { url: baseUrl, error: lastError });
        }
      }
      
      Utils.log('ERROR', 'All bridges failed to send OTP', { lastError });
      return Utils.error('Failed to send WhatsApp message via any bridge. Please check if WhatsApp bridge is online.');
    } catch (err) {
      Utils.log('ERROR', 'Bridge connection failed for OTP', err.message);
      return Utils.error('Messaging gateway offline');
    }
  },

  /**
   * Test Connectivity from GAS to Local Bridge
   * Action: testBridgeConnection
   */
  testBridgeConnection: (payload, settings) => {
    const targetUrls = Utils.getWhatsAppUrls(settings);
    const bridgeKey = Utils.getSecret('BRIDGE_API_KEY') || settings['BRIDGE_API_KEY'];
    
    if (targetUrls.length === 0) return Utils.error('Bridge URL not configured');
    
    const results = [];
    for (const baseUrl of targetUrls) {
      try {
        const options = {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-api-key': bridgeKey },
          payload: JSON.stringify({
            text: '🔔 בדיקת חיבור מערכת (System Ping)',
            jid: (payload.testPhone || '0501234567') + '@s.whatsapp.net'
          }),
          muteHttpExceptions: true
        };

        const resp = UrlFetchApp.fetch(`${baseUrl}/new-order`, options);
        const code = resp.getResponseCode();
        results.push({ url: baseUrl, status: code === 200 ? 'ONLINE ✅' : `ERROR ${code}` });
      } catch (err) {
        results.push({ url: baseUrl, status: `FAILED: ${err.message} ❌` });
      }
    }

    return Utils.json({ ok: true, results });
  },

  /**
   * Verify Custom OTP
   */
  verifyOTP: (payload, settings) => {
    const rawPhone = String(payload.phone || '').trim();
    const providedOtp = String(payload.otp || '').trim();
    const type = payload.type || 'passenger';

    if (!rawPhone || !providedOtp) return Utils.error('Missing phone or OTP');
    
    const phone = Utils.normalizePhone(rawPhone);
    const cache = CacheService.getScriptCache();
    const storedOtp = cache.get('otp_' + phone);

    if (!storedOtp) {
      return Utils.error('הקוד פג תוקף, אנא בקש קוד חדש');
    }

    if (storedOtp !== providedOtp) {
      return Utils.error('קוד אימות שגוי');
    }

    // Verification successful! Remove from cache to prevent replay
    cache.remove('otp_' + phone);

    // Provide access based on type
    if (type === 'driver') {
      Utils.log("AUDIT", "SecureLogin (OTP)", { phone });
      return DriverService.login(phone);
    } else {
      // ISSUE-009 FIX: Persist passenger profile with secure session token
      try {
        const sessionSecret = Utils.generateSalt(16);
        CustomerService.updateProfile({
          customerPhone: phone,
          customer_phone: phone,
          customer_name: payload.name || '', // name may be passed during registration
          session_secret: sessionSecret
        });
        const token = `pas_${phone}_${sessionSecret}`;
        return Utils.json({ ok: true, data: { phone, token } });
      } catch (e) {
        Utils.log('WARN', 'CustomerService.updateProfile failed after OTP verify', e.toString());
        return Utils.error('שגיאה ביצירת התחברות מאובטחת');
      }
    }
  },

  /**
   * Google OAuth Login/Registration
   * Handles user data from Google Identity Services
   */
  loginWithGoogle: (payload, settings) => {
    const type = payload.type || 'passenger'; // 'driver' or 'passenger'
    const profile = payload.profile; // {email, name, given_name, family_name, picture, sub, email_verified}
    
    if (!profile || !profile.sub) return Utils.error('Missing Google Profile');

    const googleId = profile.sub;
    const email = profile.email;
    const name = profile.name;
    
    try {
      if (type === 'driver') {
        const driversMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'google_id');
        let driver = driversMap.get(googleId);

        // Fallback: check by email if google_id not found
        if (!driver && email) {
          const emailMap = Utils.getDataMap(Schema.Sheets.DRIVERS, 'email');
          driver = emailMap.get(email);
        }

        if (driver) {
          // User exists, update Google info and return token
          const sheet = Utils.getSS().getSheetByName(Schema.Sheets.DRIVERS);
          const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
          const idIdx = headers.indexOf('driverid');
          
          let rowIndex = -1;
          const data = sheet.getDataRange().getValues();
          for (let i = 1; i < data.length; i++) {
            if (Utils.compareIds(data[i][idIdx], driver.driver_id)) {
              rowIndex = i + 1;
              break;
            }
          }

          if (rowIndex > -1) {
             Utils.updateRow(sheet, rowIndex, {
               'google_id': googleId,
               'email': email,
               'given_name': profile.given_name,
               'family_name': profile.family_name,
               'profile_picture': profile.picture,
               'email_verified': profile.email_verified,
               'updated_at': Utils.now()
             });
             return DriverService.login(driver.phone);
          }
        } else {
          // New Driver - Register them with PENDING status
          // [FIX BUG-002] Require a real phone number - reject if absent or placeholder
          const driverPhone = payload.phone || '';
          if (!driverPhone || driverPhone === '0000000000') {
            return Utils.error('נדרש מספר טלפון להשלמת ההרשמה. אנא הזן את מספר הטלפון שלך.');
          }
          const newDriverPayload = {
            driver_name: name,
            email: email,
            phone: driverPhone,
            google_id: googleId,
            given_name: profile.given_name,
            family_name: profile.family_name,
            profile_picture: profile.picture,
            email_verified: profile.email_verified
          };
          return DriverService.register(newDriverPayload, DriverStatus.PENDING);
        }
      } else {
        // Passenger logic
        const customersMap = Utils.getDataMap(Schema.Sheets.CUSTOMERS, 'google_id');
        let customer = customersMap.get(googleId);

        if (!customer && email) {
          const emailMap = Utils.getDataMap(Schema.Sheets.CUSTOMERS, 'email');
          customer = emailMap.get(email);
        }

        const sheet = Utils.getSS().getSheetByName(Schema.Sheets.CUSTOMERS);
        if (!sheet) {
          setupSystem();
        }
        
        const now = Utils.now();
        const profileData = {
          'google_id': googleId,
          'email': email,
          'given_name': profile.given_name,
          'family_name': profile.family_name,
          'profile_picture': profile.picture,
          'email_verified': profile.email_verified,
          'customer_name': name,
          'updated_at': now
        };

        if (customer) {
          // Update existing customer
          const data = sheet.getDataRange().getValues();
          const headers = data[0].map(Utils.normalizeHeader);
          const idIdx = headers.indexOf('google_id');
          const emailIdx = headers.indexOf('email');
          
          let rowIndex = -1;
          for (let i = 1; i < data.length; i++) {
            if (data[i][idIdx] === googleId || (email && data[i][emailIdx] === email)) {
              rowIndex = i + 1;
              break;
            }
          }
          
          if (rowIndex > -1) {
            Utils.updateRow(sheet, rowIndex, profileData);
            const phone = data[rowIndex-1][headers.indexOf('customer_phone')];
            return Utils.json({ ok: true, data: { phone, googleId: googleId } });
          }
        } else {
          // Create new customer
          // [FIX BUG-002] Use provided phone or empty string - do NOT use placeholder 0000000000
          const phone = payload.phone || '';
          const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(Utils.normalizeHeader);
          const row = new Array(headers.length).fill('');
          
          const setVal = (h, val) => {
            const idx = headers.indexOf(Utils.normalizeHeader(h));
            if (idx > -1) row[idx] = val;
          };

          setVal('customer_phone', Utils.formatPhoneForSheet(phone));
          setVal('customer_name', name);
          setVal('total_rides', 0);
          setVal('total_spent', 0);
          setVal('created_at', now);
          setVal('last_ride_date', now);
          setVal('google_id', googleId);
          setVal('email', email);
          setVal('given_name', profile.given_name);
          setVal('family_name', profile.family_name);
          setVal('profile_picture', profile.picture);
          setVal('email_verified', profile.email_verified);

          Utils.appendRowWithRetry(sheet, row);
          return Utils.json({ ok: true, data: { phone, googleId: googleId } });
        }
      }
    } catch (e) {
      Utils.log('ERROR', 'loginWithGoogle failed', e.toString());
      return Utils.error('Google login failed: ' + e.toString());
    }
  }
};
