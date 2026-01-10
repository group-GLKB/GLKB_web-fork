import React, { useEffect } from 'react';
import * as Auth from '../../service/Auth';

const TestAuth = () => {
  useEffect(() => {
    const runTests = async () => {
      console.log('\n🧪 ========== AUTH SERVICE TESTS ==========\n');

      // Test 1: Signup - New User
      console.log('📝 Test 1: Signup with new user');
      const username1 = 'testuser_' + Date.now();
      const result1 = await Auth.signup(username1, 'test@example.com', 'password123');
      console.log('✓ Result:', result1);
      console.log('✓ Expected: success=true, message exists');
      console.log('✓ Actual:', { success: result1.success, hasMessage: !!result1.message });
      console.log('');

      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test 2: Signup - Duplicate Username
      console.log('📝 Test 2: Signup with duplicate username');
      const result2 = await Auth.signup(username1, 'test2@example.com', 'password456');
      console.log('✓ Result:', result2);
      console.log('✓ Expected: success=false, message exists');
      console.log('✓ Actual:', { success: result2.success, hasMessage: !!result2.message });
      console.log('');

      // Test 3: Login - Valid Credentials
      console.log('📝 Test 3: Login with valid credentials');
      const result3 = await Auth.login(username1, 'password123');
      console.log('✓ Result:', result3);
      console.log('✓ Expected: success=true, token exists, user exists');
      console.log('✓ Actual:', { success: result3.success, hasToken: !!result3.token, hasUser: !!result3.user });
      console.log('');

      // Test 4: Check Authentication
      console.log('📝 Test 4: Check if authenticated');
      const isAuth = Auth.isAuthenticated();
      const currentUser = Auth.getCurrentUser();
      const token = Auth.getToken();
      console.log('✓ isAuthenticated:', isAuth);
      console.log('✓ Current User:', currentUser);
      console.log('✓ Token exists:', !!token);
      console.log('');

      // Test 5: Logout
      console.log('📝 Test 5: Logout');
      const result5 = await Auth.logout();
      console.log('✓ Result:', result5);
      console.log('✓ Expected: success=true');
      console.log('✓ Actual:', { success: result5.success });
      console.log('');

      // Test 6: Check Authentication After Logout
      console.log('📝 Test 6: Check if authenticated after logout');
      const isAuthAfter = Auth.isAuthenticated();
      console.log('✓ isAuthenticated:', isAuthAfter);
      console.log('✓ Expected: false');

      console.log('\n🧪 ========== TESTS COMPLETE ==========\n');
    };

    runTests();
  }, []);

  return <div style={{ padding: '20px' }}>Check Console (F12) for test results...</div>;
};

export default TestAuth;
