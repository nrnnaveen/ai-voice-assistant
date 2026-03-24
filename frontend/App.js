import React, { useState, useRef } from "react";
import { View, Button, Text, Platform, StyleSheet } from "react-native";

export default function App() {
  const [recording, setRecording] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Start recording
  const startRecording = async () => {
    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        recordedChunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => recordedChunksRef.current.push(e.data);
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setStatusMessage("Recording on web...");
      } catch (err) {
        console.error(err);
        setStatusMessage("Permission denied or error");
      }
      return;
    }

    // Mobile (expo-av)
    const { Audio } = await import("expo-av");
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setStatusMessage("Permission denied!");
        return;
      }
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setStatusMessage("Recording on mobile...");
    } catch (error) {
      console.error(error);
      setStatusMessage("Failed to start recording");
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (Platform.OS === "web") {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder) return;
      mediaRecorder.stop();
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const base64 = await blobToBase64(blob);

        const response = await fetch("/api/deepgram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64: base64 }),
        });
        const data = await response.json();
        setTranscript(data.transcript || "No transcript");
        setStatusMessage("Recording stopped");
      };
      return;
    }

    // Mobile
    if (!recording) return;
    const { FileSystem } = await import("expo-file-system");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });

      const response = await fetch("/api/deepgram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64 }),
      });
      const data = await response.json();
      setTranscript(data.transcript || "No transcript");
      setRecording(null);
      setStatusMessage("Recording stopped");
    } catch (err) {
      console.error(err);
      setStatusMessage("Failed to stop recording");
    }
  };

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Voice Assistant</Text>
      <Text style={styles.status}>{statusMessage}</Text>
      <View style={styles.buttonContainer}>
        <Button
          title="Start Recording"
          onPress={startRecording}
          disabled={recording !== null && Platform.OS !== "web"}
        />
        <View style={{ height: 10 }} />
        <Button
          title="Stop Recording"
          onPress={stopRecording}
          disabled={recording === null && Platform.OS !== "web"}
        />
      </View>
      <Text style={styles.transcriptTitle}>Transcript:</Text>
      <Text style={styles.transcript}>{transcript}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "flex-start", alignItems: "center", padding: 20, backgroundColor: "#f5f5f5", paddingTop: 50 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  status: { fontSize: 16, marginBottom: 20, color: "gray", textAlign: "center" },
  buttonContainer: { width: "80%", marginBottom: 30 },
  transcriptTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  transcript: { fontSize: 16, color: "#333", textAlign: "center" },
});
