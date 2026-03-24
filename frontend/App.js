import React, { useState, useRef } from "react";
import { View, Button, Text, Platform, StyleSheet } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech";

export default function App() {
  const [recording, setRecording] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [audioURL, setAudioURL] = useState(null);

  // For web
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const startRecording = async () => {
    setTranscript("");
    setAudioURL(null);

    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        recordedChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        mediaRecorder.onstart = () => setStatusMessage("Recording on web...");

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
      } catch (err) {
        console.error(err);
        setStatusMessage("Permission denied or error");
      }
      return;
    }

    // Mobile
    try {
      const { Audio } = await import("expo-av");
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

  const stopRecording = async () => {
    if (Platform.OS === "web") {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder) return;

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);

        const base64 = await blobToBase64(blob);

        try {
          const response = await fetch("/api/deepgram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64 }),
          });
          const data = await response.json();
          setTranscript(data.transcript || "No transcript");
          Speech.speak(data.transcript || "No transcript");
        } catch (err) {
          console.error(err);
          setTranscript("Backend error");
        }

        setStatusMessage("Recording stopped");
      };

      mediaRecorder.stop();
      mediaRecorderRef.current = null;
      return;
    }

    // Mobile
    if (!recording) return;
    try {
      const { Audio } = await import("expo-av");
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioURL(uri);

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });

      const response = await fetch("/api/deepgram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64 }),
      });

      const data = await response.json();
      setTranscript(data.transcript || "No transcript");
      Speech.speak(data.transcript || "No transcript");
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

  const playRecording = async () => {
    if (Platform.OS === "web") return; // Web uses <audio> element
    if (!audioURL) return;

    const { Audio } = await import("expo-av");
    const { sound } = await Audio.Sound.createAsync({ uri: audioURL });
    await sound.playAsync();
  };

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
          disabled={
            (recording === null && Platform.OS !== "web" && !mediaRecorderRef.current)
          }
        />
        {audioURL && Platform.OS !== "web" && (
          <>
            <View style={{ height: 10 }} />
            <Button title="Play Recording" onPress={playRecording} />
          </>
        )}
      </View>

      {audioURL && Platform.OS === "web" && (
        <View style={{ marginVertical: 20 }}>
          <Text style={{ fontWeight: "600", marginBottom: 5 }}>Playback:</Text>
          <audio controls src={audioURL} />
        </View>
      )}

      <Text style={styles.transcriptTitle}>Transcript:</Text>
      <Text style={styles.transcript}>{transcript}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
    paddingTop: 50,
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  status: { fontSize: 16, marginBottom: 20, color: "gray", textAlign: "center" },
  buttonContainer: { width: "80%", marginBottom: 30 },
  transcriptTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  transcript: { fontSize: 16, color: "#333", textAlign: "center" },
});
