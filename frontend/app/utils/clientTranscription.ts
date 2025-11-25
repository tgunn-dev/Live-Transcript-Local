/**
 * Client-side transcription using Transformers.js (browser/WASM version)
 * Runs Whisper model directly in the browser
 */

let transcriber: any = null;

// Dynamically import only browser-compatible code
async function importBrowserTransformers() {
  try {
    // Use dynamic import with module override to prevent Node.js backend from loading
    const transformersLib = await import(
      /* webpackIgnore: true */
      "@xenova/transformers"
    );
    return transformersLib;
  } catch (error) {
    console.error("Failed to import transformers:", error);
    throw error;
  }
}

export async function initializeTranscriber() {
  try {
    // Only import the pipeline function to avoid Node.js dependencies
    const transformersModule = await importBrowserTransformers();
    const { pipeline } = transformersModule;

    console.log("🔄 Loading Whisper Tiny model in browser (this may take 1-2 minutes on first load)...");

    // Use Whisper Tiny - smaller model suitable for browser
    // Model will be cached in browser storage after first load
    transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny",
      {
        quantized: true, // Use quantized model for faster loading/inference
      }
    );

    console.log("✓ Whisper model loaded successfully - ready for transcription");
    return transcriber;
  } catch (error) {
    console.error("Failed to initialize transcriber:", error);
    throw error;
  }
}

export async function transcribeAudio(audioBuffer: Float32Array, sampleRate: number): Promise<string> {
  if (!transcriber) {
    throw new Error("Transcriber not initialized. Call initializeTranscriber first.");
  }

  try {
    const durationSecs = (audioBuffer.length / sampleRate).toFixed(2);
    console.log(`🎵 Transcribing audio (${durationSecs}s @ ${sampleRate}Hz)...`);

    // Transcribe the audio using the loaded model
    const result = await transcriber(audioBuffer, {
      sampling_rate: sampleRate,
      top_k: 0,      // disable top-k sampling
      do_sample: false, // disable sampling, use greedy decoding
    });

    const text = (result.text || "").trim();

    if (!text) {
      console.warn("⚠️ No speech detected in audio");
      return "";
    }

    console.log("✓ Transcription complete:", text.substring(0, 100));
    return text;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

export function isTranscriberReady(): boolean {
  return transcriber !== null;
}

export async function unloadTranscriber() {
  transcriber = null;
  console.log("Transcriber unloaded");
}
