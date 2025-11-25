"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import TranscriptMessages from "./TranscriptMessages";

interface AudioRecorderProps {
  onTranscriptionComplete: (transcript: string) => void;
}

interface TranscriptMessage {
  id: string;
  text: string;
  timestamp: Date;
  isPartial?: boolean;
  isError?: boolean;
  speaker?: string;
}

export default function AudioRecorder({
  onTranscriptionComplete,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [accumulatedTranscript, setAccumulatedTranscript] = useState("");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [useLiveTranscription, setUseLiveTranscription] = useState(true);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("default");
  const [captureSystemAudio, setCaptureSystemAudio] = useState(false);
  const [captureMicWithSystem, setCaptureMicWithSystem] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>("parakeet-tdt-0.6b-v3");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const recordingTitleRef = useRef<string>("");
  const accumulatedTranscriptRef = useRef<string>("");

  // Load available audio devices on mount
  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((device) => device.kind === "audioinput");
        setAudioDevices(audioInputs);
        console.log("📻 Available audio devices:", audioInputs);
      } catch (error) {
        console.error("Error enumerating audio devices:", error);
      }
    };

    loadAudioDevices();
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      // DON'T clear transcripts - keep meeting transcript visible throughout
      // Only clear if user explicitly wants a new meeting
      // setTranscript("");
      // setAccumulatedTranscript("");

      let stream: MediaStream;
      let systemAudioStream: MediaStream | null = null;
      let micStream: MediaStream | null = null;

      if (captureSystemAudio) {
        try {
          // Check if browser supports getDisplayMedia
          if (!navigator.mediaDevices.getDisplayMedia) {
            throw new Error("Your browser doesn't support system audio capture. Use microphone instead.");
          }

          // Prompt user before showing browser dialog
          console.log("📺 Requesting permission to capture system audio...");
          const userConfirmed = confirm("Your browser will show a 'Share your screen' dialog.\n\n✓ Select your screen or window\n✓ Make sure AUDIO is enabled in the dialog\n✓ Click Share\n\nCancel to use microphone instead.");

          if (!userConfirmed) {
            console.log("User cancelled system audio, using microphone");
            stream = null as any;
            // Fall through to microphone capture below
          } else {
            // Use screen/system audio capture (works on macOS, Windows, Linux, Brave)
            console.log("📺 Requesting system audio via screen share (like Zoom/Teams)...");

            // Try with both audio and video options for compatibility with Brave
            const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: "system",
                },
              } as any,
              video: {
                mandatory: {
                  chromeMediaSource: "screen",
                },
              } as any,
            }).catch(async () => {
              // Fallback to simpler constraint if above fails
              console.log("Trying simpler audio constraint...");
              return await (navigator.mediaDevices as any).getDisplayMedia({
                audio: true,
                video: true,
              });
            });

            console.log("✓ Stream received:", displayStream);
            console.log("Audio tracks:", displayStream.getAudioTracks().length);
            console.log("Video tracks:", displayStream.getVideoTracks().length);

            // Remove video track if we only want audio
            displayStream.getVideoTracks().forEach((track: MediaStreamTrack) => {
              console.log("Stopping video track...");
              track.stop();
            });

            if (displayStream.getAudioTracks().length > 0) {
              systemAudioStream = displayStream;
              console.log("✓ System audio captured successfully!");
            } else {
              console.warn("⚠️ No audio in screen share - try again and check the dialog");
              throw new Error("No audio captured - make sure audio is enabled in the share dialog");
            }
          }
        } catch (error: any) {
          console.error("System audio capture error:", error);
          console.error("Error name:", error.name);
          console.error("Error message:", error.message);

          if (error.name === "NotAllowedError") {
            console.warn("User cancelled screen capture, falling back to microphone");
            stream = null as any;
          } else {
            console.warn("System audio failed, will use microphone:", error.message);
            stream = null as any;
          }
        }
      }

      // If we have system audio and want to mix with mic, get microphone too
      if (systemAudioStream && captureMicWithSystem) {
        try {
          console.log("🎤 Also capturing microphone to mix with system audio...");
          const audioConstraints: any = { audio: true };
          if (selectedAudioDevice && selectedAudioDevice !== "default") {
            audioConstraints.audio = {
              deviceId: { exact: selectedAudioDevice },
            };
          }
          micStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
          console.log("✓ Microphone captured, will mix with system audio");
        } catch (error) {
          console.warn("Could not get microphone, using system audio only:", error);
        }
      }

      // If we don't have system audio, use microphone
      if (!systemAudioStream) {
        console.log("Using microphone...");
        const audioConstraints: any = { audio: true };
        if (selectedAudioDevice && selectedAudioDevice !== "default") {
          audioConstraints.audio = {
            deviceId: { exact: selectedAudioDevice },
          };
        }

        micStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        console.log("🎤 Microphone audio captured");
      }

      // Determine which stream to use
      if (systemAudioStream && micStream) {
        // Mix both streams
        console.log("🎙️ Mixing system audio + microphone...");
        stream = new MediaStream();
        // Add system audio tracks
        systemAudioStream.getAudioTracks().forEach(track => {
          stream.addTrack(track);
        });
        // Add microphone tracks
        micStream.getAudioTracks().forEach(track => {
          stream.addTrack(track);
        });
      } else if (systemAudioStream) {
        stream = systemAudioStream;
      } else if (micStream) {
        stream = micStream;
      } else {
        throw new Error("No audio source available");
      }

      if (useLiveTranscription) {
        startLiveTranscription(stream);
      } else {
        startStandardRecording(stream);
      }
    } catch (error: any) {
      console.error("❌ Error accessing audio:", error);
      console.error("Error type:", error?.name);
      console.error("Error message:", error?.message);
      console.error("Full error:", JSON.stringify(error, null, 2));
      alert(`Unable to access audio.\n\nError: ${error?.message || "Unknown error"}\n\nTry:\n1. Check browser permissions\n2. Uncheck system audio if enabled\n3. Refresh the page`);
    }
  };

  const startLiveTranscription = (stream: MediaStream) => {
    try {
      // Set the recording title for later saving
      recordingTitleRef.current = `Recording - ${new Date().toLocaleString()}`;

      // Connect to WebSocket
      const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = `${wsProtocol}://${window.location.host.replace(":3001", ":8000")}/ws/transcribe`;

      console.log("Attempting to connect to WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log("✓ WebSocket connected for live transcription");
        // Don't clear the transcript - add to it
        setTranscript((prev) => {
          const indicator = "\n\n🎤 [Listening...]";
          return prev ? prev + indicator : indicator;
        });

        // Send sample rate and model info as first message
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const sampleRate = audioContext.sampleRate;
        ws.send(JSON.stringify({
          type: "config",
          sampleRate,
          model: selectedModel
        }));
        console.log("Sent config to server:", { sampleRate, model: selectedModel });
      };

      // Track previous session text so we don't lose it between pauses
      let sessionStartText = "";

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received from server:", data.type, data.text?.substring(0, 50));

          if (data.type === "partial") {
            // Update the full accumulated transcript
            const latestText = data.text.trim();
            const chunk = data.chunk?.trim() || "";

            if (latestText && latestText.length > 0) {
              accumulatedTranscriptRef.current = latestText;
              setAccumulatedTranscript(latestText);

              // Add new chunk as a message if it exists and is new
              if (chunk && chunk.length > 0) {
                const newMessage: TranscriptMessage = {
                  id: `msg-${Date.now()}-${Math.random()}`,
                  text: chunk,
                  timestamp: new Date(),
                  isPartial: false,
                  speaker: data.speaker || "Speaker 1",
                };

                setMessages((prev) => [...prev, newMessage]);
                console.log("📨 Added new message:", newMessage.text.substring(0, 50));
              }

              // Update full transcript for fallback
              setTranscript(latestText);
            }
          } else if (data.type === "final") {
            // Final result - ensure all is saved
            const finalText = data.text.trim();
            accumulatedTranscriptRef.current = finalText;
            setAccumulatedTranscript(finalText);
            setTranscript(finalText);
            setIsProcessing(false);
            onTranscriptionComplete(finalText);
            console.log("✓ Transcription complete");
          } else if (data.type === "error") {
            console.error("Transcription error:", data.message);

            const errorMessage: TranscriptMessage = {
              id: `error-${Date.now()}`,
              text: `Error: ${data.message}`,
              timestamp: new Date(),
              isError: true,
            };

            setMessages((prev) => [...prev, errorMessage]);
            setIsProcessing(false);
          }
        } catch (e) {
          console.error("Error parsing server message:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("✗ WebSocket error:", error);
        setTranscript("Connection error. Try Standard Mode instead.");
        setIsProcessing(false);
      };

      ws.onclose = async () => {
        console.log("✓ WebSocket closed");
        const finalTranscript = accumulatedTranscriptRef.current;
        console.log("Final transcript:", finalTranscript);

        // CRITICAL: Ensure transcript stays on screen by setting state
        if (finalTranscript && finalTranscript.trim().length > 0) {
          console.log("Displaying final transcript on screen");
          setTranscript(finalTranscript);
        } else {
          console.log("⚠ No transcript to display or save");
        }
      };

      // Use Web Audio API to capture raw PCM data
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      console.log("🎙️ Audio context sample rate:", audioContext.sampleRate);

      let chunksSent = 0;
      let totalSamplesProcessed = 0;
      let audioBuffer = new Float32Array(0);

      // Improved VAD parameters
      let silenceFrames = 0;
      let pauseFrames = 0; // Frames of pause (detected silence with low VAD probability)
      let isCurrentlySpeaking = false;
      let lastDebugLog = 0;
      let lastSentTranscriptionTime = Date.now();
      let minPauseFramesForTranscription = 8; // ~0.33 seconds for natural pauses
      let maxAudioDurationBeforeForceSend = 15 * audioContext.sampleRate; // Force send after 15 seconds of audio
      let hasSentInitialGreeting = false;

      // Load VAD model
      let vadModel: any = null;
      const loadVAD = async () => {
        try {
          const VAD = await import("@ricky0123/vad");
          vadModel = await VAD.MicVAD.new({
            onFrameProcessed: () => {}, // We'll handle frames ourselves
          });
          console.log("✓ VAD model loaded successfully");
        } catch (error) {
          console.warn("⚠️ Could not load VAD model, using fallback RMS detection:", error);
        }
      };

      loadVAD();

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        totalSamplesProcessed += inputData.length;

        // Calculate audio level (RMS) for basic detection
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const db = 20 * Math.log10(rms + 1e-10);

        // Accumulate audio data
        const newBuffer = new Float32Array(audioBuffer.length + inputData.length);
        newBuffer.set(audioBuffer);
        newBuffer.set(inputData, audioBuffer.length);
        audioBuffer = newBuffer;

        // Debug: log current state every 500ms
        if (totalSamplesProcessed - lastDebugLog > audioContext.sampleRate / 2) {
          const bufferDuration = (audioBuffer.length / audioContext.sampleRate).toFixed(2);
          console.log(
            `📊 Audio: ${db.toFixed(1)}dB | Speaking: ${isCurrentlySpeaking ? "YES" : "NO"} | ` +
            `Buffer: ${bufferDuration}s | Pause: ${pauseFrames}/${minPauseFramesForTranscription}`
          );
          lastDebugLog = totalSamplesProcessed;
        }

        // Improved voice activity detection with hysteresis
        // Use RMS threshold with longer pause detection for natural speech breaks
        const speechThreshold = -28; // dB threshold for active speech
        const noiseThreshold = -40; // dB threshold to consider as silence

        if (!isCurrentlySpeaking) {
          // Not speaking - waiting for speech to start
          if (db > speechThreshold) {
            isCurrentlySpeaking = true;
            pauseFrames = 0;
            silenceFrames = 0;
            console.log(`🎤 Speech detected at ${db.toFixed(1)}dB - START RECORDING`);
          }
        } else {
          // Currently speaking - monitor for natural pause or silence
          if (db < noiseThreshold) {
            // Silence/pause detected
            pauseFrames++;

            const bufferDurationSeconds = audioBuffer.length / audioContext.sampleRate;
            const timeSinceLastSend = (Date.now() - lastSentTranscriptionTime) / 1000;

            // Decision logic for when to send transcription
            const shouldSend =
              // Option 1: Natural sentence pause (0.3-0.5s silence after some speech)
              (pauseFrames >= minPauseFramesForTranscription && bufferDurationSeconds > 1) ||
              // Option 2: Long silence (1.5+ seconds) - definite pause
              (pauseFrames >= 30 && bufferDurationSeconds > 0.5) ||
              // Option 3: Very long audio accumulation (>15 seconds) - force send to keep chunks reasonable
              (audioBuffer.length > maxAudioDurationBeforeForceSend && bufferDurationSeconds > 5);

            if (shouldSend && audioBuffer.length > 4096) {
              const pauseDuration = (pauseFrames / audioContext.sampleRate * 4096).toFixed(2);
              const totalDuration = (audioBuffer.length / audioContext.sampleRate).toFixed(2);
              console.log(
                `✋ Pause detected (${pauseDuration}s after ${totalDuration}s of speech) - sending for transcription`
              );

              // Convert accumulated Float32 audio to Int16
              const int16Data = new Int16Array(audioBuffer.length);
              for (let i = 0; i < audioBuffer.length; i++) {
                let s = Math.max(-1, Math.min(1, audioBuffer[i]));
                int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
              }

              // Send to WebSocket
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(int16Data.buffer);
                chunksSent++;
                lastSentTranscriptionTime = Date.now();
                console.log(`✓ Sent chunk ${chunksSent} (${totalDuration}s audio)`);
              }

              // Reset for next phrase
              audioBuffer = new Float32Array(0);
              pauseFrames = 0;
              silenceFrames = 0;
              isCurrentlySpeaking = false;
            }
          } else if (db > speechThreshold) {
            // Speech resumed - reset pause counter
            if (pauseFrames > 0) {
              console.log(`🔊 Speech resumed after pause of ${pauseFrames} frames`);
            }
            pauseFrames = 0;
            silenceFrames = 0;
          } else {
            // In between speech and silence - ambiguous zone
            pauseFrames++;
          }
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Store references for cleanup
      const audioContextRef = { audioContext, source, processor };
      mediaRecorderRef.current = {
        stop: () => {
          console.log(`Stopped recording. Total chunks sent: ${chunksSent}`);
          source.disconnect();
          processor.disconnect();

          // Wait a bit for the last chunk to be processed by server
          setTimeout(() => {
            console.log("Closing WebSocket after delay to ensure final processing");
            if (ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
            audioContext.close();
          }, 500);

          stream.getTracks().forEach((track) => track.stop());
        },
      } as any;

      setIsRecording(true);
      setRecordingTime(0);
      // Don't clear transcript - just indicate we're recording
      // setTranscript("🎤 Listening... (live mode) - Recording");
      setIsProcessing(false); // Not processing - we're actively listening
    } catch (error) {
      console.error("Error starting live transcription:", error);
      setTranscript(`Error starting recording: ${error}`);
      setIsProcessing(false);
    }
  };

  const startStandardRecording = (stream: MediaStream) => {
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/wav",
      });
      await sendAudioForTranscription(audioBlob);
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    // Don't clear transcript - keep meeting transcript visible
    // setTranscript("");
    setIsProcessing(false);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log("Stopping recording...");
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Only set isProcessing for standard mode - live mode handles it via WebSocket
      if (!useLiveTranscription) {
        setIsProcessing(true);
      }
    }
  };

  const sendAudioForTranscription = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.wav");
      formData.append("title", `Recording - ${new Date().toLocaleString()}`);
      formData.append("model", selectedModel);

      const response = await axios.post(
        "http://localhost:8000/transcribe",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setTranscript(response.data.content);
      onTranscriptionComplete(response.data.content);
    } catch (error) {
      console.error("Transcription error:", error);
      setTranscript("Error transcribing audio. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Audio Recorder</h2>

        {/* Mode Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useLiveTranscription}
            onChange={(e) => setUseLiveTranscription(e.target.checked)}
            disabled={isRecording}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-700">
            {useLiveTranscription ? "🔴 Live" : "Standard"}
          </span>
        </label>
      </div>

      {/* System Audio Toggle */}
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={captureSystemAudio}
            onChange={(e) => setCaptureSystemAudio(e.target.checked)}
            disabled={isRecording}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-700">
            📺 Capture System Audio (Speakers)
          </span>
        </label>

        {captureSystemAudio && (
          <label className="flex items-center gap-2 cursor-pointer ml-6 mb-3">
            <input
              type="checkbox"
              checked={captureMicWithSystem}
              onChange={(e) => setCaptureMicWithSystem(e.target.checked)}
              disabled={isRecording}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">
              🎤 Also capture my microphone
            </span>
          </label>
        )}

        <p className="text-xs text-gray-600">
          {captureSystemAudio
            ? captureMicWithSystem
              ? "✓ Will capture both speaker and microphone audio"
              : "✓ Will capture speaker audio only"
            : "Click to enable speaker audio capture"}
        </p>
      </div>

      {/* Audio Device Selector */}
      {!captureSystemAudio && audioDevices.length > 0 && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <label className="block text-sm font-semibold text-gray-800 mb-3">
            🎤 Select Audio Input Device
          </label>
          <div className="space-y-2">
            {/* Default Device Option */}
            <button
              onClick={() => setSelectedAudioDevice("default")}
              disabled={isRecording}
              className={`w-full p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                selectedAudioDevice === "default"
                  ? "border-blue-500 bg-blue-100 shadow-md"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50"
              } ${isRecording ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎧</span>
                  <div>
                    <p className="font-medium text-gray-900">System Default</p>
                    <p className="text-xs text-gray-600">Uses your primary audio device</p>
                  </div>
                </div>
                {selectedAudioDevice === "default" && (
                  <span className="text-blue-600 font-bold">✓</span>
                )}
              </div>
            </button>

            {/* Other Devices */}
            {audioDevices.map((device) => {
              const getDeviceIcon = (label: string) => {
                if (label.toLowerCase().includes("headset")) return "🎧";
                if (label.toLowerCase().includes("earphone")) return "🔊";
                if (label.toLowerCase().includes("usb")) return "🔌";
                if (label.toLowerCase().includes("virtual")) return "💻";
                return "🎤";
              };

              const icon = getDeviceIcon(device.label || "");
              return (
                <button
                  key={device.deviceId}
                  onClick={() => setSelectedAudioDevice(device.deviceId)}
                  disabled={isRecording}
                  className={`w-full p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                    selectedAudioDevice === device.deviceId
                      ? "border-blue-500 bg-blue-100 shadow-md"
                      : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                  } ${isRecording ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {device.label || "Unknown Device"}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {device.deviceId.substring(0, 12)}...
                        </p>
                      </div>
                    </div>
                    {selectedAudioDevice === device.deviceId && (
                      <span className="text-blue-600 font-bold ml-2">✓</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Model Selection */}
      <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
        <label className="block text-sm font-semibold text-gray-800 mb-3">
          🧠 Transcription Model
        </label>

        {/* NVIDIA Parakeet Models - Primary Options */}
        <p className="text-xs font-semibold text-purple-700 mb-2 uppercase">⚡ Recommended (NVIDIA Parakeet)</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setSelectedModel("parakeet-tdt-0.6b-v3")}
            disabled={isRecording}
            className={`p-3 rounded-lg border-2 transition-all duration-200 ${
              selectedModel === "parakeet-tdt-0.6b-v3"
                ? "border-purple-500 bg-purple-100 shadow-md"
                : "border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50"
            } ${isRecording ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="text-left">
              <p className="font-bold text-gray-900 text-sm">0.6B V3 ⭐</p>
              <p className="text-xs text-gray-600">Fastest</p>
              {selectedModel === "parakeet-tdt-0.6b-v3" && (
                <p className="text-purple-600 font-bold mt-1">✓ Selected</p>
              )}
            </div>
          </button>

          <button
            onClick={() => setSelectedModel("parakeet-tdt-1.1b")}
            disabled={isRecording}
            className={`p-3 rounded-lg border-2 transition-all duration-200 ${
              selectedModel === "parakeet-tdt-1.1b"
                ? "border-purple-500 bg-purple-100 shadow-md"
                : "border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50"
            } ${isRecording ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="text-left">
              <p className="font-bold text-gray-900 text-sm">1.1B</p>
              <p className="text-xs text-gray-600">More accurate</p>
              {selectedModel === "parakeet-tdt-1.1b" && (
                <p className="text-purple-600 font-bold mt-1">✓ Selected</p>
              )}
            </div>
          </button>
        </div>

        {/* Alternative Models */}
        <p className="text-xs font-semibold text-indigo-700 mb-2 uppercase">🤖 Alternatives</p>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={isRecording}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="parakeet-ctc-0.6b">Parakeet CTC 0.6B (older, faster)</option>
          <option value="parakeet-ctc-1.1b">Parakeet CTC 1.1B (older, more accurate)</option>
          <option value="whisper-tiny">Whisper Tiny (fastest, least accurate)</option>
          <option value="whisper-base">Whisper Base (balanced)</option>
          <option value="whisper-small">Whisper Small (better accuracy)</option>
          <option value="whisper-medium">Whisper Medium (high accuracy)</option>
          <option value="whisper-large">Whisper Large (most accurate, slowest)</option>
        </select>
      </div>

      {/* Info */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        {useLiveTranscription
          ? "✨ Live transcription: Detects when you finish speaking and transcribes each sentence. Pauses are automatic!"
          : "📋 Standard mode: Records until you stop, then transcribes the complete audio for better accuracy"}
      </div>

      {/* Recording Timer */}
      {isRecording && (
        <div className="mb-4 text-center">
          <p className="text-lg font-semibold text-red-600">
            Recording: {formatTime(recordingTime)}
          </p>
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={startRecording}
          disabled={isRecording || isProcessing}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
        >
          {isRecording ? "🎤 Recording..." : "🎙️ Start Recording"}
        </button>

        <button
          onClick={stopRecording}
          disabled={!isRecording}
          className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
        >
          ⏹️ Stop Recording
        </button>

        <button
          onClick={() => {
            setTranscript("");
            setAccumulatedTranscript("");
            setMessages([]);
            accumulatedTranscriptRef.current = "";
          }}
          disabled={isRecording}
          className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
        >
          🗑️ Clear Transcript
        </button>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
          <p className="text-yellow-800">
            ⏳ Processing audio... This may take a moment.
          </p>
        </div>
      )}

      {/* Transcript Display - New Message Format */}
      {(messages.length > 0 || transcript) && (
        <div className="mt-6 border-t pt-6 pb-4">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">
            Transcript {useLiveTranscription && "📨"}
          </h3>

          {/* Show message-based display if in live mode with messages, otherwise show traditional view */}
          {useLiveTranscription && messages.length > 0 ? (
            <>
              {/* Recording Indicator - Outside the scroll area */}
              {isRecording && (
                <div className="flex gap-3 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 animate-pulse flex-shrink-0">
                    <span className="text-red-600 animate-bounce">🔴</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-red-700">
                      Listening for more...
                    </span>
                  </div>
                </div>
              )}

              <div className="h-96 mb-4 rounded-lg border border-gray-300 overflow-hidden flex flex-col bg-gray-50">
                <TranscriptMessages
                  messages={messages}
                  isLive={useLiveTranscription}
                  isRecording={isRecording}
                />
              </div>

              {/* Full transcript view */}
              {transcript && (
                <details className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <summary className="cursor-pointer font-semibold text-blue-900 py-2">
                    📄 Full Transcript ({transcript.length} characters)
                  </summary>
                  <div className="max-h-48 overflow-y-auto mt-2 p-2 bg-white rounded">
                    <p className="text-blue-800 whitespace-pre-wrap text-xs">
                      {transcript}
                    </p>
                  </div>
                </details>
              )}
            </>
          ) : transcript ? (
            /* Fallback to traditional view */
            <div className="h-96 p-4 bg-gray-100 rounded-lg border border-gray-300 overflow-y-auto">
              <p className="text-gray-700 whitespace-pre-wrap">{transcript}</p>
            </div>
          ) : null}

          {/* Copy and Download Buttons */}
          {transcript && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(transcript);
                  alert("Transcript copied to clipboard!");
                }}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
              >
                📋 Copy
              </button>

              <button
                onClick={() => {
                  const element = document.createElement("a");
                  element.setAttribute(
                    "href",
                    "data:text/plain;charset=utf-8," +
                      encodeURIComponent(transcript)
                  );
                  element.setAttribute(
                    "download",
                    `transcript-${new Date().getTime()}.txt`
                  );
                  element.style.display = "none";
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                }}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
              >
                💾 Download
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {transcript && transcript.includes("Error") && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 rounded-lg text-red-800">
          {transcript}
        </div>
      )}
    </div>
  );
}
