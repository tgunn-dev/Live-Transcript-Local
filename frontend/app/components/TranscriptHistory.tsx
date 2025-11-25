"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/app/contexts/AuthContext";

// Helper function to format timestamp (seconds) as MM:SS
const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface TranscriptSegment {
  text: string;
  timestamp: number;
  speaker: string;
  start_time: number;
  end_time: number;
}

interface Transcript {
  id: number;
  title: string;
  content: string;
  created_at: string;
  duration: number;
  segments?: TranscriptSegment[];
}

export default function TranscriptHistory() {
  const { token } = useAuth();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchTranscripts();
  }, [token]);

  const fetchTranscripts = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const headers: any = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.get(`${apiUrl}/transcripts`, { headers });
      setTranscripts(response.data);
    } catch (error) {
      console.error("Error fetching transcripts:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTranscript = async (id: number) => {
    if (!confirm("Are you sure you want to delete this transcript?")) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const headers: any = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      await axios.delete(`${apiUrl}/transcripts/${id}`, { headers });
      setTranscripts(transcripts.filter((t) => t.id !== id));
    } catch (error) {
      console.error("Error deleting transcript:", error);
      alert("Failed to delete transcript");
    }
  };

  const downloadTranscript = (transcript: Transcript) => {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(transcript.content)
    );
    element.setAttribute(
      "download",
      `${transcript.title.replace(/\s+/g, "_")}.txt`
    );
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading) {
    return <div className="text-center text-gray-600">Loading transcripts...</div>;
  }

  if (transcripts.length === 0) {
    return (
      <div className="text-center text-gray-600 py-8">
        No transcripts yet. Start recording to create your first transcript!
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Transcript History
      </h2>

      <div className="space-y-3">
        {transcripts.map((transcript) => (
          <div
            key={transcript.id}
            className="border border-gray-300 rounded-lg overflow-hidden"
          >
            <button
              onClick={() =>
                setExpandedId(
                  expandedId === transcript.id ? null : transcript.id
                )
              }
              className="w-full p-4 text-left hover:bg-gray-50 transition duration-200 flex justify-between items-center"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">
                  {transcript.title}
                </h3>
                <p className="text-sm text-gray-500">
                  {formatDistanceToNow(new Date(transcript.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <span className="text-gray-400">
                {expandedId === transcript.id ? "▼" : "▶"}
              </span>
            </button>

            {expandedId === transcript.id && (
              <div className="p-4 bg-gray-50 border-t border-gray-300">
                {/* Display segments with timestamps and speakers if available */}
                {transcript.segments && transcript.segments.length > 0 ? (
                  <div className="mb-4 space-y-3">
                    <h4 className="text-sm font-semibold text-gray-600 mb-2">
                      Transcript with Timestamps & Speakers:
                    </h4>
                    {transcript.segments.map((segment: TranscriptSegment, index: number) => (
                      <div
                        key={index}
                        className="border-l-4 border-blue-500 pl-3 py-2 bg-white rounded-r"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            {segment.speaker}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(segment.timestamp)}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">{segment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-700 mb-4 whitespace-pre-wrap">
                    {transcript.content}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(transcript.content);
                      alert("Transcript copied to clipboard!");
                    }}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200 text-sm"
                  >
                    Copy
                  </button>

                  <button
                    onClick={() => downloadTranscript(transcript)}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200 text-sm"
                  >
                    Download
                  </button>

                  <button
                    onClick={() => deleteTranscript(transcript.id)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
