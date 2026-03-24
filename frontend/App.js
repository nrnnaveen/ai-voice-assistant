import React, { useState } from "react";
import { View, Button, Text, Platform, StyleSheet, Alert } from "react-native";
import { Audio } from "expo-av"; // Mobile audio
import * as FileSystem from "expo-file-system"; // Mobile file handling

export default function App() {
  const [recording, setRecording] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Start recording
  const startRecording = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Recording not supported", "Audio recording is not supported on web.");
      return;
    }

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
      setStatusMessage("Recording...");
    } catch (error) {
      console.error(error);
      setStatusMessage("Failed to start recording");
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setStatusMessage("Processing audio...");

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });

      // Send audio to backend
      const response = await fetch("/api/deepgram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64 }),
      });

      const data = await response.json();
      setTranscript(data.transcript || "No transcript");
      setRecording(null);
      setStatusMessage("Recording stopped");
    } catch (error) {
      console.error(error);
      setStatusMessage("Failed to stop recording");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Voice Assistant</Text>
      <Text style={styles.status}>{statusMessage}</Text>
      <View style={styles.buttonContainer}>
        <Button
          title="Start Recording"
          onPress={startRecording}
          disabled={recording !== null || Platform.OS === "web"}
        />
        <View style={{ height: 10 }} />
        <Button
          title="Stop Recording"
          onPress={stopRecording}
          disabled={recording === null}
        />
      </View>
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    marginBottom: 20,
    color: "gray",
    textAlign: "center",
  },
  buttonContainer: {
    width: "80%",
    marginBottom: 30,
  },
  transcriptTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  transcript: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
});
