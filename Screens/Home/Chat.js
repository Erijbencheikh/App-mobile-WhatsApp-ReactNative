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
  Alert,
} from "react-native";
import firebase from "../../config";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

const database = firebase.database();

export default function Chat(props) {
  const { currentid, secondid } = props.route.params;
  const flatListRef = useRef();

  // messages and meta state
  const [messages, setMessages] = useState([]);
  const [recipientData, setRecipientData] = useState(null);
  const [inputText, setInputText] = useState("");
  const [typingState, setTypingState] = useState({
    currentIDisTyping: false,
    secondIDisTyping: false,
  });
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [recipientOnline, setRecipientOnline] = useState(false); // for the small dot

  const roomID = currentid > secondid ? currentid + secondid : secondid + currentid;
  const ref_discussion = database.ref("Discussions").child(roomID);
  const ref_recipient = database.ref("Acounts").child(secondid);
  const ref_my_contacts_current = database.ref("MyContacts").child(currentid);
  const ref_my_contacts_second = database.ref("MyContacts").child(secondid);

  const amFirst = currentid < secondid;
  const isSelfChat = currentid === secondid;

  // refs for debounce timer
  //const typingTimeoutRef = useRef(null);

  useLayoutEffect(() => {
    props.navigation.setOptions({ headerShown: false });
  }, []);

  // Ensure the discussion node has the typing/background keys
  useEffect(() => {
    ref_discussion.once("value").then((snap) => {
      const toUpdate = {};
      if (!snap.hasChild("currentIDisTyping")) toUpdate.currentIDisTyping = false;
      if (!snap.hasChild("secondIDisTyping")) toUpdate.secondIDisTyping = false;
      if (!snap.hasChild("BackgroundImage")) toUpdate.BackgroundImage = null;
      if (Object.keys(toUpdate).length) ref_discussion.update(toUpdate);
    });
  }, []);

  // Load recipient profile + listen to its online/other fields (for online dot)
  useEffect(() => {
    // single fetch for profile data
    ref_recipient.once("value").then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setRecipientData(data);
        setRecipientOnline(!!data.online);
      }
    });

    // listen for changes in recipient (online/isTyping etc)
    const recipientListener = ref_recipient.on("value", (snap) => {
      if (!snap.exists()) return;
      const d = snap.val();
      setRecipientData(d);
      setRecipientOnline(!!d.online);
    });

    return () => ref_recipient.off("value", recipientListener);
  }, [secondid]);

  // Discussion listener: messages + typing flags + background image
  useEffect(() => {
    const listener = ref_discussion.on("value", (snapshot) => {
      const fetchedMessages = [];
      const currentTyping = snapshot.child("currentIDisTyping").val();
      const secondTyping = snapshot.child("secondIDisTyping").val();

      setTypingState({
        currentIDisTyping: !!currentTyping,
        secondIDisTyping: !!secondTyping,
      });

      const bg = snapshot.child("BackgroundImage").val();
      setBackgroundImage(bg || null);

      snapshot.forEach((child) => {
        const key = child.key;
        const item = child.val();
        if (key === "currentIDisTyping" || key === "secondIDisTyping" || key === "BackgroundImage") return;
        if (item && (item.text || item.createdAt || item.Sender || item.user)) {
          fetchedMessages.push({
            _id: key,
            text: item.text || "",
            createdAt: item.createdAt ? Number(item.createdAt) : 0,
            userId: item.user ? item.user._id : item.Sender,
            isSeen: item.isSeen || false,
            seenBy: item.seenBy || null,
            seenAt: item.seenAt || null,
          });
        }
      });

      fetchedMessages.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(fetchedMessages);

      // mark messages from other as seen
      snapshot.forEach((child) => {
        const key = child.key;
        if (["currentIDisTyping", "secondIDisTyping", "BackgroundImage"].includes(key)) return;

        const item = child.val();
        if (!item) return;
        const sender = item.Sender || (item.user && item.user._id);
        const isSeen = item.isSeen === true;

        if (sender === secondid && !isSeen) {
          ref_discussion.child(key).update({
            isSeen: true,
            seenBy: currentid,
            seenAt: Date.now(),
          });
        }
      });
    });

    return () => ref_discussion.off("value", listener);
  }, [roomID, currentid, secondid]);

  // helper for deciding whether other is typing
  const otherIsTyping = () => {
    if (isSelfChat) return typingState.currentIDisTyping && typingState.secondIDisTyping;
    return amFirst ? typingState.secondIDisTyping : typingState.currentIDisTyping;
  };

  // SEND MESSAGE: also clear typing flag for this user
  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const key = ref_discussion.push().key;
    const newMsg = {
      _id: key,
      text: inputText,
      createdAt: Date.now(),
      user: { _id: currentid },
      Sender: currentid,
      isSeen: false,
      seenBy: null,
      seenAt: null,
    };

   try {
      await ref_discussion.child(key).set(newMsg);

      if (amFirst) {
        await ref_discussion.child("currentIDisTyping").set(false);
      } else {
        await ref_discussion.child("secondIDisTyping").set(false);
      }

      await ref_my_contacts_current.child(secondid).set(true);
      await ref_my_contacts_second.child(currentid).set(true);

      setInputText("");
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to send message");
    }
  };



  const handleFocus = () => {
    if (isSelfChat) {
      ref_discussion.child("currentIDisTyping").set(true);
      ref_discussion.child("secondIDisTyping").set(true);
    } else {
      if (amFirst) ref_discussion.child("currentIDisTyping").set(true);
      else ref_discussion.child("secondIDisTyping").set(true);
    }
  };


    const handleBlur = () => {
    if (isSelfChat) {
      ref_discussion.child("currentIDisTyping").set(false);
      ref_discussion.child("secondIDisTyping").set(false);
    } else {
      if (amFirst) ref_discussion.child("currentIDisTyping").set(false);
      else ref_discussion.child("secondIDisTyping").set(false);
    }
  };

  const handleTyping = (text) => {
    setInputText(text);
    if (!text) handleBlur();
    else handleFocus();
  };


  // change background image (unchanged)
  const changeBackground = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required to access photos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setBackgroundImage(uri);
      ref_discussion.child("BackgroundImage").set(uri);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.userId === currentid;
    const timeString = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    return (
      <View style={[styles.messageRow, isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
        {!isMe && recipientData && (
          <Image
            source={recipientData.ProfileImage ? { uri: recipientData.ProfileImage } : require("../../assets/profil.png")}
            style={styles.avatarSmall}
          />
        )}
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isMe ? "#3b4db8" : "#fff",
              borderBottomRightRadius: isMe ? 0 : 15,
              borderBottomLeftRadius: isMe ? 15 : 0,
            },
          ]}
        >
          <Text style={{ color: isMe ? "#fff" : "#000", fontSize: 16 }}>{item.text}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center" }}>
            <Text style={{ fontSize: 10, color: isMe ? "#ddd" : "#555", marginTop: 3, textAlign: "right", marginRight: 6 }}>
              {timeString}
            </Text>
            {isMe && <Text style={{ fontSize: 12, color: isMe ? "#ddd" : "#555", marginTop: 3 }}>{item.isSeen ? "✓✓" : "✓"}</Text>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground source={backgroundImage ? { uri: backgroundImage } : require("../../assets/background.jpg")} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3b4db8" />

      {/* HEADER */}
      <View style={styles.customHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => props.navigation.goBack()} style={{ paddingRight: 10 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <View>
            <Image
              source={recipientData?.ProfileImage ? { uri: recipientData.ProfileImage } : require("../../assets/profil.png")}
              style={styles.headerAvatar}
            />
            {/* online/offline circle: green if online, grey otherwise */}
            <View
              style={[
                { position: "absolute", right: -2, bottom: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#3b4db8" },
                recipientOnline ? { backgroundColor: "#3ddc84" } : { backgroundColor: "#bbb" }
              ]}
            />
          </View>

          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerName}>{recipientData?.FullName || "User"}</Text>
            <Text style={styles.headerPseudo}>@{recipientData?.Pseudo || "..."}</Text>
            {otherIsTyping() && <Text style={{ color: "#e0e0e0", fontSize: 12, fontStyle: "italic" }}>Typing...</Text>}
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={changeBackground}>
            <Ionicons name="image" size={22} color="white" style={{ marginRight: 15 }} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => Alert.alert("Call", "Calling...")}>
            <Ionicons name="call" size={22} color="white" style={{ marginRight: 15 }} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => Alert.alert("Video", "Video calling...")}>
            <Ionicons name="videocam" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputArea}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTyping}         // typing updates are debounced and persisted to Firebase
            placeholder="Type a message..."
            placeholderTextColor="#888"
            multiline
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
            <View style={styles.sendIconBg}>
              <Ionicons name="send" size={20} color="white" />
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
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerAvatar: { width: 45, height: 45, borderRadius: 25, borderWidth: 1.5, borderColor: "white" },
  headerName: { color: "white", fontSize: 18, fontWeight: "bold" },
  headerPseudo: { color: "#e0e0e0", fontSize: 12 },
  headerRight: { flexDirection: "row", alignItems: "center" },
  messageRow: { flexDirection: "row", alignItems: "flex-end", marginVertical: 5 },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: "#fff" },
  messageBubble: { maxWidth: "75%", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, elevation: 1 },
  inputArea: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 10 },
  textInput: { flex: 1, backgroundColor: "#f0f2f5", borderRadius: 25, paddingHorizontal: 20, paddingVertical: 10, fontSize: 16, maxHeight: 100 },
  sendBtn: { marginLeft: 10 },
  sendIconBg: { width: 45, height: 45, borderRadius: 25, backgroundColor: "#3b4db8", justifyContent: "center", alignItems: "center" },
});
