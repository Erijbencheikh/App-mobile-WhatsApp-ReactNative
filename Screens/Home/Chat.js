import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import firebase from "../../config";
import { Ionicons } from "@expo/vector-icons";

const database = firebase.database();

export default function Chat(props) {
  const { currentid, secondid } = props.route.params;
  const flatListRef = useRef();

  const [messages, setMessages] = useState([]);
  const [recipientData, setRecipientData] = useState(null);
  const [inputText, setInputText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [bgImage, setBgImage] = useState(require("../../assets/background.jpg")); // default background

  const roomID = currentid > secondid ? currentid + secondid : secondid + currentid;
  const ref_discussion = database.ref("Discussions").child(roomID);
  const ref_recipient = database.ref("Acounts").child(secondid);

  // Hide default header
  useLayoutEffect(() => { props.navigation.setOptions({ headerShown: false }); }, []);

  // Fetch recipient data
  useEffect(() => {
    ref_recipient.once("value").then(snapshot => {
      if (snapshot.exists()) setRecipientData(snapshot.val());
    });
  }, []);

  // Listen for messages
  useEffect(() => {
    const listener = ref_discussion.on("value", snapshot => {
      const fetchedMessages = [];
      snapshot.forEach(child => {
        const item = child.val() || {};
        const timestamp = item.createdAt ? Number(item.createdAt) : 0;
        fetchedMessages.push({
          _id: child.key || Date.now().toString(),
          text: item.text || item.Text || "",
          createdAt: timestamp,
          userId: item.user ? item.user._id : item.Sender || "unknown",
          seen: item.seen || {},
          currentIdTyping: item.currentIdTyping || false,
          secondIdTyping: item.secondIdTyping || false,
          onlineStatus: item.onlineStatus || false
        });
      });
      fetchedMessages.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(fetchedMessages);
    });
    return () => ref_discussion.off();
  }, []);

  // Mark received messages as seen
  useEffect(() => {
    messages.forEach(msg => {
      if (msg.userId !== currentid && (!msg.seen || msg.seen[currentid] !== true)) {
        ref_discussion.child(msg._id).child("seen").child(currentid).set(true);
      }
    });
  }, [messages]);

  // Send message
  const sendMessage = () => {
    if (!inputText.trim()) return;
    const key = ref_discussion.push().key;
    const newMsg = {
      _id: key,
      text: inputText,
      createdAt: Date.now(),
      user: { _id: currentid },
      Sender: currentid,
      seen: { [currentid]: true },
      currentIdTyping: false,
      secondIdTyping: otherTyping,
      onlineStatus
    };
    ref_discussion.child(key).set(newMsg)
      .then(() => setInputText(""))
      .catch(error => Alert.alert("Error", error.message));
  };

  // Typing indicator
  useEffect(() => {
    const refTyping = database.ref(`TypingStatus/${roomID}/${currentid}`);
    refTyping.set(false);
    return () => refTyping.set(false);
  }, []);

  useEffect(() => {
    const refOtherTyping = database.ref(`TypingStatus/${roomID}/${secondid}`);
    refOtherTyping.on("value", snapshot => setOtherTyping(snapshot.val() === true));
    return () => refOtherTyping.off();
  }, []);

  // Online / Last seen
  useEffect(() => {
    const userStatusRef = database.ref(`OnlineStatus/${currentid}`);
    const lastSeenRef = database.ref(`LastSeen/${currentid}`);
    const connectedRef = database.ref(".info/connected");

    connectedRef.on("value", snap => {
      if (snap.val() === true) {
        userStatusRef.onDisconnect().set(false);
        lastSeenRef.onDisconnect().set(Date.now());
        userStatusRef.set(true);
      }
    });

    const otherStatusRef = database.ref(`OnlineStatus/${secondid}`);
    const otherLastSeenRef = database.ref(`LastSeen/${secondid}`);

    otherStatusRef.on("value", snap => setOnlineStatus(snap.val() === true));
    otherLastSeenRef.on("value", snap => setLastSeen(snap.val()));

    return () => {
      userStatusRef.set(false);
      lastSeenRef.set(Date.now());
      connectedRef.off();
      otherStatusRef.off();
      otherLastSeenRef.off();
    };
  }, []);

  // Pick background image
  const pickBackground = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8
    });
    if (!result.cancelled) setBgImage({ uri: result.uri });
  };

  // Render message
  const renderMessage = ({ item }) => {
    const isMe = item.userId === currentid;
    let timeString = "";
    if (item.createdAt > 0) {
      timeString = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return (
      <View style={[styles.messageRow, isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
        {!isMe && recipientData && (
          <Image
            source={recipientData.ProfileImage ? { uri: recipientData.ProfileImage } : require("../../assets/profil.png")}
            style={styles.avatarSmall}
          />
        )}
        <View style={[styles.messageBubble, { backgroundColor: isMe ? "#3b4db8" : "#ffffff", borderBottomRightRadius: isMe ? 0 : 15, borderBottomLeftRadius: isMe ? 15 : 0 }]}>
          <Text style={{ color: isMe ? "#fff" : "#000", fontSize: 16 }}>{item.text}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 3 }}>
            <Text style={{ fontSize: 10, color: isMe ? "#ddd" : "#555", marginRight: 5 }}>{timeString}</Text>
            {isMe && (
              <Ionicons
                name={item.seen[secondid] ? "checkmark-done" : "checkmark"}
                size={14}
                color={item.seen[secondid] ? "#4fc3f7" : "#ddd"}
              />
            )}
          </View>
          {/* Typing & online status for each message */}
          <View style={{ marginTop: 2 }}>
            {item.currentIdTyping && <Text style={{ fontSize: 10, color: "red" }}>You are typing...</Text>}
            {item.secondIdTyping && <Text style={{ fontSize: 10, color: "green" }}>They are typing...</Text>}
            <Text style={{ fontSize: 10, color: "#888" }}>{item.onlineStatus ? "Online" : "Offline"}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground source={bgImage} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3b4db8" />

      {/* Header */}
      <View style={styles.customHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => props.navigation.goBack()} style={{ paddingRight: 10 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <Image source={recipientData?.ProfileImage ? { uri: recipientData.ProfileImage } : require("../../assets/profil.png")} style={styles.headerAvatar} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerName}>{recipientData?.FullName || "User"}</Text>
            <Text style={styles.headerPseudo}>@{recipientData?.Pseudo || "..."}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={pickBackground} style={{ marginRight: 10 }}>
            <Ionicons name="image" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert("Call", "Calling...")}>
            <Ionicons name="call" size={22} color="white" style={{ marginRight: 15 }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert("Video", "Video calling...")}>
            <Ionicons name="videocam" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
          style={{ flex: 1 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={(text) => {
              setInputText(text);
              database.ref(`TypingStatus/${roomID}/${currentid}`).set(text.length > 0);
            }}
            placeholder="Type a message..."
            placeholderTextColor="#888"
            multiline
            onBlur={() => database.ref(`TypingStatus/${roomID}/${currentid}`).set(false)}
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
            <View style={styles.sendIconBg}>
              <Ionicons name="send" size={20} color="white" style={{ marginLeft: 2 }} />
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#3b4db8",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    zIndex: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 1.5,
    borderColor: "white",
    backgroundColor: "#ddd",
  },
  headerName: { color: "white", fontSize: 18, fontWeight: "bold" },
  headerPseudo: { color: "#e0e0e0", fontSize: 12, fontStyle: "italic" },
  messageRow: { flexDirection: "row", alignItems: "flex-end", marginVertical: 5 },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: "#fff" },
  messageBubble: {
    maxWidth: "75%",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 1,
    elevation: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
    maxHeight: 100,
  },
  sendBtn: { marginLeft: 10 },
  sendIconBg: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "#3b4db8",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
});
