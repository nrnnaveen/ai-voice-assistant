import React, { useState } from "react";
import { View, Button, Text } from "react-native";
import * as Audio from "expo-av";

export default function App() {
  const [recording, setRecording] = useState(null);
  const [transcript, setTranscript] = useState("");

  const startRecording = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== "granted") return;

    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
    await rec.startAsync();
    setRecording(rec);
  };

  const stopRecording = async () => {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });

    // Send audio to backend
    const response = await fetch("/api/deepgram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64: base64 })
    });

    const data = await response.json();
    setTranscript(data.transcript || "No transcript");
  };

  return (
    <View style={{ padding: 20 }}>
      <Button title="Start Recording" onPress={startRecording} />
      <Button title="Stop Recording" onPress={stopRecording} />
      <Text>Transcript: {transcript}</Text>
    </View>
  );
}
