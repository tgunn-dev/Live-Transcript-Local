"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import AudioRecorder from "./components/AudioRecorder";
import TranscriptHistory from "./components/TranscriptHistory";

export default function Home() {
  const router = useRouter();
  const { user, token, isLoading, isAuthenticated, logout } = useAuth();
  const [refreshHistory, setRefreshHistory] = useState(0);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/pages/login");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleTranscriptionComplete = (transcript: string) => {
    // Trigger refresh of transcript history
    setRefreshHistory((prev) => prev + 1);
  };

  const handleLogout = () => {
    logout();
    router.push("/pages/login");
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

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header with User Info and Logout */}
        <div className="flex items-center justify-between mb-8">
          <div className="text-left">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Audio Transcriber
            </h1>
            <p className="text-gray-600 text-lg">
              Record audio and transcribe it with Parakeet ASR
            </p>
            {user && (
              <p className="text-gray-500 text-sm mt-2">
                Logged in as: <span className="font-semibold">{user.email}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Audio Recorder Component */}
        <AudioRecorder onTranscriptionComplete={handleTranscriptionComplete} />

        {/* Transcript History Component */}
        <TranscriptHistory key={refreshHistory} />

        {/* Footer Info */}
        <div className="text-center text-sm text-gray-600 py-4">
          <p>
            Powered by Nvidia Parakeet • Built with Next.js & FastAPI
          </p>
        </div>
      </div>
    </main>
  );
}
