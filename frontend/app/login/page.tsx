"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, login, isLoading } = useAuth();
  const [error, setError] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleGoogleLogin = async (credentialResponse: any) => {
    try {
      setIsLoggingIn(true);
      setError("");
      await login(credentialResponse.credential);
      router.push("/");
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Login failed. Please try again."
      );
      console.error("Google login error:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <h1 className="text-3xl font-bold text-red-600 mb-4">⚠️ Configuration Error</h1>
          <p className="text-gray-700 mb-4">
            Google OAuth is not configured. Please set the <code className="bg-gray-100 px-2 py-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> environment variable.
          </p>
          <p className="text-sm text-gray-600">
            See the <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a> to create a Google OAuth client ID.
          </p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 px-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">🎙️ Audio Transcriber</h1>
            <p className="text-gray-600">Record and transcribe audio with AI</p>
          </div>

          <div className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleLogin}
                onError={() => setError("Google login failed")}
                text="signin_with"
                size="large"
                theme="outline"
              />
            </div>

            {isLoggingIn && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-600 text-sm mt-2">Logging in...</p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
