"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // TODO: Sentry 연동 시 Sentry.captureException(error) 호출
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh w-full flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">오류가 발생했습니다</h2>
              <p className="text-gray-500 text-sm">
                예기치 않은 시스템 오류로 인해 화면을 표시할 수 없습니다.<br/>
                지속적인 문제 발생 시 관리자에게 문의해 주세요.
              </p>
            </div>

            <div className="bg-gray-100 p-3 rounded-lg text-left overflow-auto max-h-32 text-xs text-red-800 font-mono">
              {this.state.error?.message || "Unknown Error"}
            </div>

            <Button
              onClick={() => window.location.reload()}
              className="w-full h-12 text-base"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              새로고침 (복구 시도)
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
