"use client";

import { useState } from "react";
import AudioRecorder from "./components/AudioRecorder";
import TranscriptHistory from "./components/TranscriptHistory";

export default function Home() {
  const [refreshHistory, setRefreshHistory] = useState(0);

  const handleTranscriptionComplete = (transcript: string) => {
    // Trigger refresh of transcript history
    setRefreshHistory((prev) => prev + 1);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Audio Transcriber
          </h1>
          <p className="text-gray-600 text-lg">
            Record audio and transcribe it with Parakeet ASR
          </p>
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
