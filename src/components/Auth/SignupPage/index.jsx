import React, { useState } from 'react';
import { Form, Input, Button, Card, Alert, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './scoped.css';

const { Title, Text } = Typography;

const SignupPage = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { signup } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    setSuccess(false);

    const result = await signup(values.username, values.email, values.password);

    if (result.success) {
      setSuccess(true);
      // Redirect to login page after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div className="signup-container">
      <Card className="signup-card">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div className="signup-header">
            <Title level={2}>Create Account</Title>
            <Text type="secondary">Join GLKB to get started.</Text>
          </div>

          {error && (
            <Alert
              message="Signup Failed"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError('')}
            />
          )}

          {success && (
            <Alert
              message="Account Created Successfully!"
              description="Redirecting to login page..."
              type="success"
              showIcon
            />
          )}

          <Form
            form={form}
            name="signup"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            size="large"
            disabled={success}
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: 'Please input your username!' },
                { min: 3, message: 'Username must be at least 3 characters!' },
                { max: 50, message: 'Username must be less than 50 characters!' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Username (3-50 characters)"
              />
            </Form.Item>

            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="Email"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: 'Please input your password!' },
                { min: 8, message: 'Password must be at least 8 characters!' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Password (minimum 8 characters)"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your password!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match!'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Confirm Password"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
              >
                Sign Up
              </Button>
            </Form.Item>

            <div className="signup-footer">
              <Text type="secondary">
                Already have an account? <Link to="/login">Login</Link>
              </Text>
            </div>
          </Form>
        </Space>
      </Card>
    </div>
  );
};

export default SignupPage;
