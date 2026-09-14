/**
 * TESTING SUITE
 * Consolidated QA, Observability, and Unit tests.
 */

const TestingSuite = {
  runAll: () => {
    const results = {};
    results.observability = TestingSuite.runObservabilityQA();
    results.phone = TestingSuite.testPhoneNormalization();
    results.notification = TestingSuite.testNotificationRetry();
    return results;
  },

  runObservabilityQA: () => {
    const qaResults = [];
    try {
      // Test 1: Utils.updateRow with injected Firebase Error
      let capturedLog = false;
      const originalLog = Utils.log;
      Utils.log = (level, action) => { if (level === 'WARN' && action.includes('Firebase')) capturedLog = true; originalLog(level, action); };
      
      const originalFirebaseSet = Firebase.set;
      Firebase.set = () => { throw new Error('QA_MOCK_ERROR'); };
      
      const sheet = Utils.getSS().getSheetByName('Settings');
      if (sheet) Utils.updateRow(sheet, 'id', 'qa_test', { value: 'test' });
      
      qaResults.push(capturedLog ? '✅ Test 1 Passed: Utils.updateRow logs Firebase errors.' : '❌ Test 1 Failed.');
      
      Utils.log = originalLog;
      Firebase.set = originalFirebaseSet;
    } catch (e) { qaResults.push('❌ Test 1 Crashed: ' + e.toString()); }
    return qaResults;
  },

  testPhoneNormalization: () => {
    const cases = [['0541234567', '0541234567'], ['541234567', '0541234567'], ['+972541234567', '0541234567']];
    let passed = 0;
    cases.forEach(([input, expected]) => {
      if (Utils.normalizePhone(input) === expected) passed++;
    });
    return `Phone Normalization: ${passed}/${cases.length} passed`;
  },

  testNotificationRetry: () => {
    let callCount = 0;
    const result = NotificationService._sendWithRetry('test', () => {
      callCount++;
      if (callCount < 2) throw new Error('Fail');
      return { ok: true };
    }, 3, 10);
    return `Notification Retry: ${result.ok && callCount === 2 ? '✅ Passed' : '❌ Failed'}`;
  }
};

/** Callable from GAS Editor */
function runTestingSuite() {
  const r = TestingSuite.runAll();
  console.log('Testing Results:', JSON.stringify(r, null, 2));
  return r;
}
