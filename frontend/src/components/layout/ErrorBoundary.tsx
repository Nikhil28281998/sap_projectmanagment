import React, { Component, ErrorInfo } from 'react';
import { Result, Button, Typography } from 'antd';

const { Text } = Typography;

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches rendering errors and prevents blank screen.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-wrapper">
          <Result
            status="error"
            title="Something went wrong"
            subTitle={
              <Text type="secondary">
                {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
              </Text>
            }
            extra={[
              <Button type="primary" key="home" onClick={this.handleReset}>
                Go to Dashboard
              </Button>,
              <Button key="reload" onClick={() => window.location.reload()}>
                Reload Page
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
