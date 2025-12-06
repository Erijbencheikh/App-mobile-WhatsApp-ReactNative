import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import {View,Text,StyleSheet,ImageBackground,Image,TextInput,TouchableOpacity,
  FlatList,KeyboardAvoidingView, Platform, StatusBar, Alert,Linking,ActivityIndicator,
  Modal, ScrollView, Dimensions} from "react-native";
import firebase, { supabase } from "../../config";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker"; 
import * as FileSystem from "expo-file-system"; 

const database = firebase.database();
// Get device width for responsive design
const { width } = Dimensions.get("window");

// --- Helper Functions for Date/Time ---
const getRelativeTime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
  
    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
};

const getExactTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
  
const getDateLabel = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
  
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(); 
};

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
  const [recipientOnline, setRecipientOnline] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // State to track which message is clicked to show relative time
  const [toggledMessageId, setToggledMessageId] = useState(null);
  
  // Shared Files Modal State
  const [sharedModalVisible, setSharedModalVisible] = useState(false);

  const roomID = currentid > secondid ? currentid + secondid : secondid + currentid;
  const ref_discussion = database.ref("Discussions").child(roomID);
  const ref_recipient = database.ref("Acounts").child(secondid);
  const ref_my_contacts_current = database.ref("MyContacts").child(currentid);
  const ref_my_contacts_second = database.ref("MyContacts").child(secondid);
  // Determine order for typing indicators
  const amFirst = currentid < secondid;
  // Self-chat check
  const isSelfChat = currentid === secondid;

  useLayoutEffect(() => {
    props.navigation.setOptions({ headerShown: false });
  }, []);

  // Initialize discussion fields 
  useEffect(() => {
    ref_discussion.once("value").then((snap) => {
      const toUpdate = {};
      if (!snap.hasChild("currentIDisTyping")) toUpdate.currentIDisTyping = false;
      if (!snap.hasChild("secondIDisTyping")) toUpdate.secondIDisTyping = false;
      if (!snap.hasChild("BackgroundImage")) toUpdate.BackgroundImage = null;
      if (Object.keys(toUpdate).length) ref_discussion.update(toUpdate);
    });
  }, []);

  // Recipient Data & Online Status   
  useEffect(() => {
    const recipientListener = ref_recipient.on("value", (snap) => {
      if (!snap.exists()) return;
      const d = snap.val();
      // Update recipient data and online status
      setRecipientData(d);
      setRecipientOnline(!!d.online);
    });
    return () => ref_recipient.off("value", recipientListener);
  }, [secondid]);

  // Messages Listener
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
        
        if (item) {
          fetchedMessages.push({
            _id: key,
            text: item.text || "",
            image: item.image || null,
            location: item.location || null,
            file: item.file || null, 
            createdAt: item.createdAt ? Number(item.createdAt) : 0,
            userId: item.user ? item.user._id : item.Sender,
            isSeen: item.isSeen || false,
          });
        }
      });

      fetchedMessages.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(fetchedMessages);

      // Mark seen
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

  //  Typing Indicator Functions 

  const otherIsTyping = () => {
    if (isSelfChat) return typingState.currentIDisTyping && typingState.secondIDisTyping;
    return amFirst ? typingState.secondIDisTyping : typingState.currentIDisTyping;
  };

  const handleFocus = () => {
    if (amFirst) ref_discussion.child("currentIDisTyping").set(true);
    else ref_discussion.child("secondIDisTyping").set(true);
  };

  const handleBlur = () => {
    if (amFirst) ref_discussion.child("currentIDisTyping").set(false);
    else ref_discussion.child("secondIDisTyping").set(false);
  };

  const handleTyping = (text) => {
    setInputText(text);
    if (!text) handleBlur();
    else handleFocus();
  };

  //  Sending Functions 

  const sendMessage = async (type = "text", content = null) => {
    if (type === "text" && !inputText.trim()) return;
    // Create new message key
    const key = ref_discussion.push().key;
    const newMsg = {
      _id: key,
      createdAt: Date.now(),
      user: { _id: currentid },
      Receiver: secondid,
      Sender: currentid,
      isSeen: false,
    };

    if (type === "text") {
      newMsg.text = inputText;
    } else if (type === "image") {
      newMsg.image = content;
      newMsg.text = " Image"; 
    } else if (type === "location") {
      newMsg.location = content;
      newMsg.text = " Location"; 
    }else if (type === "file") {
        newMsg.file = content; 
        newMsg.text = "File: " + content.name;
    }

    try {
      // Save message to database
      await ref_discussion.child(key).set(newMsg);

      if (type === "text") {
        setInputText("");
        handleBlur();
      }
        // Update contacts for both users
      await ref_my_contacts_current.child(secondid).set(true);
      await ref_my_contacts_second.child(currentid).set(true);
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  const uploadImageToSupabase = async (localURL) => {
    try {
      const fileName = `${currentid}_${Date.now()}.jpg`;
      const response = await fetch(localURL);
      // Convert to blob (binary large object)and then to array buffer
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("lesimagesprofiles")
        .upload(fileName, arrayBuffer, { contentType: "image/jpeg", upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("lesimagesprofiles").getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      Alert.alert("Upload Error", error.message);
      return null;
    }
  };

  // --- Helper to upload files to Supabase ---
  const uploadFileToSupabase = async (uri, fileName, mimeType) => {
    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();
        
        // Save to 'files' folder inside your bucket
        const storagePath = `files/${currentid}_${Date.now()}_${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from("lesimagesprofiles") 
            .upload(storagePath, arrayBuffer, { contentType: mimeType || 'application/octet-stream', upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("lesimagesprofiles").getPublicUrl(storagePath);
        return data.publicUrl;
    } catch (error) {
        Alert.alert("Upload Error", error.message);
        return null;
    }
  };

  const pickAndSendImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission required");

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, // Compresses images to 70% quality to reduce file size
    });

    if (!result.canceled) { //Checks if user actually selected an image (didn't cancel)
      setUploading(true);
      const uri = result.assets[0].uri;
      const publicUrl = await uploadImageToSupabase(uri);
      setUploading(false);
      if (publicUrl) {
        sendMessage("image", publicUrl);  // Send the message with the image URL in firebase
      }
    }
  };

  const pickAndSendFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true, // Essential for Android
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Size Limit Check
        if (file.size > 10 * 1024 * 1024) {
          return Alert.alert("File too large", "Maximum file size is 10MB.");
        }

        setUploading(true);
        
        // NEW: Upload to Supabase to get a real HTTP Link
        const publicUrl = await uploadFileToSupabase(file.uri, file.name, file.mimeType);

        setUploading(false);

        if (publicUrl) {
            // Send the HTTP URL to Firebase
            await sendMessage("file", {
                url: publicUrl,
                name: file.name,
                type: file.mimeType
            });
        }
      }
    } catch (err) {
      setUploading(false);
      Alert.alert("Upload Failed", "Could not process this file. " + (err.message || ""));
    }
  };


  const sendLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission to access location was denied');
      return;
    }

    setUploading(true);
    let location = await Location.getCurrentPositionAsync({});
    setUploading(false);
    
    sendMessage("location", {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    });
  };

  const changeBackground = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
    });
    if (!result.canceled) {
        ref_discussion.child("BackgroundImage").set(result.assets[0].uri);
    }
  };

  // --- Helpers for Display ---

  const openMap = (location) => {
    if(location) {
      const url = Platform.select({
        ios: `maps:0,0?q=${location.latitude},${location.longitude}`,
        android: `geo:0,0?q=${location.latitude},${location.longitude}`,
      });
      Linking.openURL(url);
    }
  };

  const toggleMessageTime = (messageId) => {
    if (toggledMessageId === messageId) {
        setToggledMessageId(null); // Untoggle if clicked again
    } else {
        setToggledMessageId(messageId); // Toggle this message
    }
  };

  const renderMessage = ({ item, index }) => {
    // Determine if the message is sent by the current user
    const isMe = item.userId === currentid;
    
    // Exact time inside the bubble
    const exactTime = item.createdAt ? getExactTime(item.createdAt) : "";
    // Relative time below the bubble
    const relativeTime = item.createdAt ? getRelativeTime(item.createdAt) : "";
    // Check if this specific message is toggled
    const isToggled = toggledMessageId === item._id;

    // --- DATE SEPARATOR LOGIC ---
    let showDateSeparator = false;
    const currentDate = new Date(item.createdAt);
    if (index === 0) {
        showDateSeparator = true;
    } else {
        const prevDate = new Date(messages[index - 1].createdAt);
        if (currentDate.toDateString() !== prevDate.toDateString()) {
            showDateSeparator = true;
        }
    }

    return (
      <View>
        {/* Date Separator */}
        {showDateSeparator && (
            <View style={styles.dateSeparator}>
                <Text style={styles.dateSeparatorText}>{getDateLabel(item.createdAt)}</Text>
            </View>
        )}

        <View style={[styles.messageRow, isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
            {!isMe && recipientData && (
            <Image
                source={recipientData.ProfileImage ? { uri: recipientData.ProfileImage } : require("../../assets/profil.png")}
                style={styles.avatarSmall}
            />
            )}
            
            {/* WRAP BUBBLE IN CONTAINER FOR RESPONSIVENESS AND CLICK */}
            <View style={{ maxWidth: '75%' }}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => toggleMessageTime(item._id)}>
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
                    {item.image ? (
                        <TouchableOpacity onPress={() => Linking.openURL(item.image)}>
                            <Image source={{ uri: item.image }} style={{ width: 200, height: 150, borderRadius: 10, marginBottom: 5 }} resizeMode="cover" />
                        </TouchableOpacity>
                    ) : item.location ? (
                        <TouchableOpacity onPress={() => openMap(item.location)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                            <Ionicons name="location-sharp" size={24} color={isMe ? "#fff" : "#e74c3c"} />
                            <Text style={{ color: isMe ? "#fff" : "#000", marginLeft: 5, textDecorationLine: "underline" }}>
                            View Location
                            </Text>
                        </TouchableOpacity>
                    ) : item.file ? (
                        // --- FILE RENDER BUBBLE ---
                        <TouchableOpacity 
                            onPress={() => Linking.openURL(item.file.url)} 
                            style={[styles.fileBubble, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#f0f0f0' }]}
                        >
                            <View style={styles.fileIconSmall}>
                                <Ionicons name="document-text" size={20} color="#fff" />
                            </View>
                            <View style={{flex: 1, paddingHorizontal: 5}}>
                                <Text style={{color: isMe ? "#fff" : "#000", fontWeight: 'bold'}} numberOfLines={1}>
                                    {item.file.name}
                                </Text>
                                <Text style={{color: isMe ? "#ddd" : "#666", fontSize: 10}}>
                                    Tap to download
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <Text style={{ color: isMe ? "#fff" : "#000", fontSize: 16 }}>{item.text}</Text>
                    )}

                    <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center" }}>
                        <Text style={{ fontSize: 10, color: isMe ? "#ddd" : "#555", marginTop: 3, textAlign: "right", marginRight: 6 }}>
                        {exactTime}
                        </Text>
                        {isMe && <Text style={{ fontSize: 12, color: isMe ? "#ddd" : "#555", marginTop: 3 }}>{item.isSeen ? "✓✓" : "✓"}</Text>}
                    </View>
                    </View>
                </TouchableOpacity>
                {/* RELATIVE TIME UNDER MESSAGE */}
                {isToggled && (
                    <Text style={{ 
                        fontSize: 11, 
                        color: '#ddd', 
                        marginTop: 2, 
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        marginBottom: 2
                    }}>
                        {relativeTime}
                    </Text>
                )}
            </View>
        </View>
      </View>
    );
  };

  // Shared Media Logic
  const sharedImages = messages.filter(m => m.image);
  const sharedLocations = messages.filter(m => m.location);
  const sharedFiles = messages.filter(m => m.file);

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
            <View
              style={[
                { position: "absolute", right: -2, bottom: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#3b4db8" },
                recipientOnline ? { backgroundColor: "#3ddc84" } : { backgroundColor: "#bbb" }
              ]}
            />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerName}>{recipientData?.FullName || "User"}</Text>
            {otherIsTyping() && <Text style={{ color: "#e0e0e0", fontSize: 12, fontStyle: "italic" }}>Typing...</Text>}
          </View>
        </View>

        <View style={styles.headerRight}>
           <TouchableOpacity onPress={() => setSharedModalVisible(true)} style={{ marginRight: 15 }}>
            <Ionicons name="folder-open" size={24} color="white" />
          </TouchableOpacity>
           <TouchableOpacity onPress={changeBackground}>
            <Ionicons name="image" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* NEW: Updated KeyboardAvoidingView with keyboardVerticalOffset to fix hidden input */}
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0} 
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {uploading && (
            <View style={{ alignItems: "center", padding: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}>
                <ActivityIndicator color="#3b4db8" />
                <Text style={{fontSize:10}}>Uploading...</Text>
            </View>
        )}

        <View style={styles.inputArea}>
          <TouchableOpacity onPress={sendLocation} style={{ marginRight: 10 }}>
            <Ionicons name="location" size={24} color="#3b4db8" />
          </TouchableOpacity>
            <TouchableOpacity onPress={pickAndSendFile} style={{ marginRight: 10 }}>
                      <Ionicons name="attach" size={24} color="#3b4db8" />
                    </TouchableOpacity>
          <TouchableOpacity onPress={pickAndSendImage} style={{ marginRight: 10 }}>
            <Ionicons name="camera" size={24} color="#3b4db8" />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTyping}
            placeholder="Type a message..."
            placeholderTextColor="#888"
            multiline
          />
          <TouchableOpacity onPress={() => sendMessage("text")} style={styles.sendBtn}>
            <View style={styles.sendIconBg}>
              <Ionicons name="send" size={20} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* SHARED FILES MODAL */}
      <Modal visible={sharedModalVisible} animationType="slide" transparent={false} onRequestClose={() => setSharedModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
          <View style={[styles.customHeader, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
             <TouchableOpacity onPress={() => setSharedModalVisible(false)}>
                <Ionicons name="arrow-back" size={24} color="white" />
             </TouchableOpacity>
             <Text style={{ color: "white", fontSize: 18, fontWeight: "bold", marginLeft: 15 }}>Shared Files</Text>
             <View style={{flex:1}}/>
          </View>

          <ScrollView style={{ padding: 15 }}>
            <Text style={styles.sectionTitle}>Photos ({sharedImages.length})</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
               {sharedImages.length === 0 && <Text style={{color: '#999', fontStyle: 'italic'}}>No images shared.</Text>}
               {sharedImages.map((msg) => (
                 <TouchableOpacity key={msg._id} onPress={() => Linking.openURL(msg.image)}>
                    <Image source={{ uri: msg.image }} style={styles.gridImage} />
                 </TouchableOpacity>
               ))}
            </View>
                       <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Shared Documents ({sharedFiles.length})</Text>
                        {sharedFiles.length === 0 && <Text style={{color: '#999', fontStyle: 'italic'}}>No files shared yet.</Text>}
                        {sharedFiles.map((msg) => (
                            <TouchableOpacity key={msg._id} onPress={() => Linking.openURL(msg.file.url)} style={styles.fileItem}>
                                <View style={styles.fileIconSmall}>
                                    <Ionicons name="document-text" size={20} color="white" />
                                </View>
                                <View style={{marginLeft: 10, flex: 1}}>
                                    <Text style={{fontWeight: 'bold', fontSize: 14}} numberOfLines={1}>{msg.file.name}</Text>
                                    <Text style={{color: '#666', fontSize: 12}}>
                                        Sent by {msg.senderName || 'User'} • {new Date(msg.createdAt).toLocaleDateString()}
                                    </Text>
                                </View>
                                <Ionicons name="download-outline" size={20} color="#333" />
                            </TouchableOpacity>
                        ))}

            <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Locations ({sharedLocations.length})</Text>
            {sharedLocations.length === 0 && <Text style={{color: '#999', fontStyle: 'italic'}}>No locations shared.</Text>}
            {sharedLocations.map((msg) => (
                <TouchableOpacity key={msg._id} onPress={() => openMap(msg.location)} style={styles.locationItem}>
                    <Ionicons name="location-sharp" size={24} color="#e74c3c" />
                    <View style={{marginLeft: 15}}>
                        <Text style={{fontWeight: 'bold'}}>Location Shared</Text>
                        <Text style={{color: '#666', fontSize: 12}}>
                            {new Date(msg.createdAt).toLocaleString()}
                        </Text>
                    </View>
                    <View style={{flex: 1, alignItems: 'flex-end'}}>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </View>
                </TouchableOpacity>
            ))}
            <View style={{height: 50}}/>
          </ScrollView>
        </View>
      </Modal>
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
  headerRight: { flexDirection: "row", alignItems: "center" },
  messageRow: { flexDirection: "row", alignItems: "flex-end", marginVertical: 5 },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: "#fff" },
  messageBubble: { width: '100%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, elevation: 1 },
  inputArea: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 10 },
  textInput: { flex: 1, backgroundColor: "#f0f2f5", borderRadius: 25, paddingHorizontal: 20, paddingVertical: 10, fontSize: 16, maxHeight: 100 },
  sendBtn: { marginLeft: 10 },
  sendIconBg: { width: 45, height: 45, borderRadius: 25, backgroundColor: "#3b4db8", justifyContent: "center", alignItems: "center" },
  
  // Date Separator Styles
  dateSeparator: { alignSelf: 'center', backgroundColor: '#e1e1e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 10 },
  dateSeparatorText: { fontSize: 12, color: '#555' },

  // Shared files styles
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  gridImage: { width: (width - 60) / 3, height: (width - 60) / 3, margin: 5, borderRadius: 8, backgroundColor: '#ddd' },
  locationItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, elevation: 1 },
   // File Styles
  fileContainer: { flexDirection: 'row', alignItems: 'center', maxWidth: 200 },
  fileIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f39c12', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  fileItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 8, elevation: 1 },
  fileIconSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f39c12', justifyContent: 'center', alignItems: 'center' },
  // Chat Bubble File
  fileBubble: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, width: 200, marginBottom: 5 },
});