import React from 'react';
import axios from '../../utils/axiosConfig';

const TestStatus = () => {
  const testSentry = async () => {
    await axios.get('/api/v1/test-500');
  };

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={testSentry}>Test 500</button>
    </div>
  );
};

export default TestStatus;
