import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ImageBackground, Image, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, StatusBar, Alert, Linking, ActivityIndicator, Modal, Dimensions, SafeAreaView, ScrollView
} from "react-native";
import firebase, { supabase } from "../../config"; 
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker"; 

const database = firebase.database();
const { width } = Dimensions.get("window");

export default function GroupChat(props) {
  const { currentid, groupId, groupName } = props.route.params;
  
  const flatListRef = useRef();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [currentUserData, setCurrentUserData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(null);
  
  // Modals
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [sharedModalVisible, setSharedModalVisible] = useState(false);
  const [nonMembers, setNonMembers] = useState([]);
  
  const ref_group_msgs = database.ref("GroupDiscussion").child(groupId);
  const ref_group_meta = database.ref("Groups").child(groupId);

  useLayoutEffect(() => {
    props.navigation.setOptions({ headerShown: false });
  }, []);

  useEffect(() => {
    database.ref("Acounts").child(currentid).once("value").then(snap => {
      if(snap.exists()) setCurrentUserData(snap.val());
    });
  }, []);

  useEffect(() => {
    // Listener for messages AND background
    const listener = ref_group_msgs.on("value", (snapshot) => {
      const fetchedMessages = [];
      snapshot.forEach((child) => {
        const item = child.val();
        if (item) {
          fetchedMessages.push({
            _id: child.key,
            ...item
          });
        }
      });
      fetchedMessages.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(fetchedMessages);
    });

    // Listener for background image changes
    const bgListener = ref_group_meta.child("BackgroundImage").on("value", (snap) => {
        if(snap.exists()) setBackgroundImage(snap.val());
        else setBackgroundImage(null);
    });

    return () => {
        ref_group_msgs.off("value", listener);
        ref_group_meta.child("BackgroundImage").off("value", bgListener);
    };
  }, [groupId]);

  const loadNonMembers = async () => {
    const groupSnap = await ref_group_meta.child("members").once("value");
    const currentMembers = groupSnap.val() || {};
    const usersSnap = await database.ref("Acounts").once("value");
    const potentialMembers = [];
    usersSnap.forEach(child => {
      if (!currentMembers[child.key]) {
        potentialMembers.push({ id: child.key, ...child.val() });
      }
    });
    setNonMembers(potentialMembers);
    setAddMemberModalVisible(true);
  };

  const addMemberToGroup = (userId) => {
    Alert.alert("Add Member", "Add this user to the group?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Add", 
        onPress: () => {
          ref_group_meta.child("members").child(userId).set(true);
          sendMessage("text", "Added a new member!", true);
          setAddMemberModalVisible(false);
          Alert.alert("Success", "User added!");
        }
      }
    ]);
  };

  const changeBackground = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
    });
    if (!result.canceled) {
        // Save background to Group Metadata
        ref_group_meta.child("BackgroundImage").set(result.assets[0].uri);
    }
  };

  const uploadImageToSupabase = async (localURL) => {
    try {
      const fileName = `grp_${groupId}_${Date.now()}.jpg`;
      const response = await fetch(localURL);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error } = await supabase.storage.from("lesimagesprofiles").upload(fileName, arrayBuffer, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("lesimagesprofiles").getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) { Alert.alert("Error", error.message); return null; }
  };

  const uploadFileToSupabase = async (uri, fileName, mimeType) => {
     try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();
        const storagePath = `files/grp_${groupId}_${Date.now()}_${fileName}`;
        const { error } = await supabase.storage.from("lesimagesprofiles").upload(storagePath, arrayBuffer, { contentType: mimeType || 'application/octet-stream', upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from("lesimagesprofiles").getPublicUrl(storagePath);
        return data.publicUrl;
    } catch (error) { Alert.alert("Error", error.message); return null; }
  };

  const sendMessage = async (type = "text", content = null, isSystem = false) => {
    if (type === "text" && !inputText.trim() && !isSystem) return;

    const key = ref_group_msgs.push().key;
    const name = currentUserData?.FullName || "User";
    
    const msgData = {
        _id: key,
        createdAt: Date.now(),
        senderId: isSystem ? "SYSTEM" : currentid,
        senderName: isSystem ? "System" : name,
        senderImage: currentUserData?.ProfileImage || null,
        type: type,
        text: type === 'text' ? (isSystem ? content : inputText) : `${type.toUpperCase()} sent`,
    };

    if (type === 'image') msgData.image = content;
    if (type === 'location') msgData.location = content;
    if (type === 'file') msgData.file = content;

    await ref_group_msgs.child(key).set(msgData);
    
    if (!isSystem) {
        ref_group_meta.update({
            lastMessage: type === 'text' ? inputText : `${name} sent a ${type}`,
            lastMessageTime: Date.now()
        });
    }

    if (type === "text") setInputText("");
  };

  const pickImage = async () => {
     const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
     if (!res.canceled) {
         setUploading(true);
         const url = await uploadImageToSupabase(res.assets[0].uri);
         setUploading(false);
         if(url) sendMessage("image", url);
     }
  };

  const pickFile = async () => {
      try {
          const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
          if(!res.canceled && res.assets) {
              const file = res.assets[0];
              if(file.size > 10*1024*1024) return Alert.alert("Too big", "Max 10MB");
              setUploading(true);
              const url = await uploadFileToSupabase(file.uri, file.name, file.mimeType);
              setUploading(false);
              if(url) sendMessage("file", { url, name: file.name, type: file.mimeType });
          }
      } catch(e) { Alert.alert("Error", e.message); setUploading(false); }
  };

  const sendLoc = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if(status !== 'granted') return;
      setUploading(true);
      let loc = await Location.getCurrentPositionAsync({});
      setUploading(false);
      sendMessage("location", { latitude: loc.coords.latitude, longitude: loc.coords.longitude });
  };

  const openMap = (loc) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${loc.latitude},${loc.longitude}`,
      android: `geo:0,0?q=${loc.latitude},${loc.longitude}`,
    });
    Linking.openURL(url);
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === currentid;
    const isSystem = item.senderId === "SYSTEM";

    if (isSystem) {
        return (
            <View style={{alignItems: 'center', marginVertical: 10}}>
                <View style={{backgroundColor: '#e1e1e1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12}}>
                    <Text style={{fontSize: 12, color: '#555', fontWeight:'500'}}>{item.text}</Text>
                </View>
            </View>
        );
    }

    return (
      <View style={[styles.msgRow, isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
        {!isMe && (
          <Image source={item.senderImage ? { uri: item.senderImage } : require("../../assets/profil.png")} style={styles.avatar} />
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
          
          {item.type === 'image' && (
             <TouchableOpacity onPress={() => Linking.openURL(item.image)}>
                <Image source={{uri: item.image}} style={{width: 200, height: 150, borderRadius: 10}} />
             </TouchableOpacity>
          )}
          {item.type === 'location' && (
              <TouchableOpacity onPress={() => openMap(item.location)} style={{flexDirection:'row', alignItems:'center'}}>
                  <Ionicons name="location" size={24} color={isMe ? "#fff" : "#e74c3c"} />
                  <Text style={[styles.msgText, {color: isMe?"#fff":"#000", textDecorationLine:'underline'}]}>View Location</Text>
              </TouchableOpacity>
          )}
          {item.type === 'file' && (
              <TouchableOpacity onPress={() => Linking.openURL(item.file.url)} style={{flexDirection:'row', alignItems:'center'}}>
                   <Ionicons name="document" size={24} color={isMe ? "#fff" : "#f39c12"} />
                   <Text style={[styles.msgText, {color: isMe?"#fff":"#000", marginLeft: 5}]}>{item.file.name}</Text>
              </TouchableOpacity>
          )}
          {item.type === 'text' && (
              <Text style={{color: isMe ? "#fff" : "#000", fontSize: 16}}>{item.text}</Text>
          )}
          
          <Text style={{fontSize: 10, color: isMe?"#ddd":"#555", textAlign: 'right', marginTop: 4}}>
              {new Date(item.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
          </Text>
        </View>
      </View>
    );
  };

  // Shared Filters
  const sharedImages = messages.filter(m => m.type === 'image');
  const sharedFiles = messages.filter(m => m.type === 'file');
  const sharedLocations = messages.filter(m => m.type === 'location');

  return (
    <ImageBackground source={backgroundImage ? { uri: backgroundImage } : require("../../assets/background.jpg")} style={{ flex: 1 }}>
       <StatusBar barStyle="light-content" backgroundColor="#3b4db8" />
       
       {/* Responsive Header Container */}
       <View style={{backgroundColor: "#3b4db8", paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
         <SafeAreaView>
            <View style={styles.header}>
               <View style={{flexDirection:'row', alignItems:'center', flex: 1}}>
                   <TouchableOpacity onPress={() => props.navigation.goBack()} style={{padding: 5}}>
                       <Ionicons name="arrow-back" size={24} color="white" />
                   </TouchableOpacity>
                   <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
                        <Text style={styles.headerSub}>Tap icons for options</Text>
                   </View>
               </View>

               {/* Right Side Icons: Shared, Bg, Add Member */}
               <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <TouchableOpacity onPress={() => setSharedModalVisible(true)} style={styles.headerIcon}>
                        <Ionicons name="folder-open" size={22} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={changeBackground} style={styles.headerIcon}>
                        <Ionicons name="image" size={22} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={loadNonMembers} style={styles.headerIcon}>
                        <Ionicons name="person-add" size={22} color="white" />
                    </TouchableOpacity>
               </View>
            </View>
         </SafeAreaView>
       </View>

       {/* Keyboard Avoiding View */}
       <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
            style={{flex: 1}}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0} 
        >
           <FlatList
             ref={flatListRef}
             data={messages}
             renderItem={renderMessage}
             keyExtractor={item => item._id}
             contentContainerStyle={{padding: 10, paddingBottom: 90}} 
             onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
             showsVerticalScrollIndicator={false}
           />
           
           {uploading && (
               <View style={styles.loaderContainer}>
                    <ActivityIndicator color="#3b4db8" />
                    <Text style={{fontSize: 10, color: "#3b4db8", marginTop: 4}}>Uploading...</Text>
               </View>
           )}

           <View style={styles.inputWrapper}>
               <View style={styles.inputContainer}>
                  <TouchableOpacity onPress={sendLoc} style={styles.iconBtn}>
                      <Ionicons name="location" size={22} color="#3b4db8" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={pickFile} style={styles.iconBtn}>
                      <Ionicons name="attach" size={22} color="#3b4db8" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
                      <Ionicons name="camera" size={22} color="#3b4db8" />
                  </TouchableOpacity>
                  
                  <TextInput 
                    style={styles.input} 
                    value={inputText} 
                    onChangeText={setInputText} 
                    placeholder="Type a message..." 
                    placeholderTextColor="#999"
                    multiline
                  />
                  <TouchableOpacity onPress={() => sendMessage("text")} style={styles.sendBtn}>
                      <Ionicons name="send" size={18} color="white" style={{marginLeft: 2}} />
                  </TouchableOpacity>
               </View>
           </View>

       </KeyboardAvoidingView>

       {/* Add Member Modal */}
       <Modal visible={addMemberModalVisible} animationType="slide">
           <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
               <View style={styles.modalHeader}>
                   <TouchableOpacity onPress={() => setAddMemberModalVisible(false)} style={{padding: 5}}>
                       <Ionicons name="arrow-back" size={24} color="#333" />
                   </TouchableOpacity>
                   <Text style={{fontSize: 18, fontWeight: 'bold'}}>Add Members</Text>
                   <View style={{width: 30}} />
               </View>
               <FlatList 
                  data={nonMembers}
                  keyExtractor={item => item.id}
                  renderItem={({item}) => (
                      <TouchableOpacity style={styles.userRow} onPress={() => addMemberToGroup(item.id)}>
                          <Image source={item.ProfileImage ? { uri: item.ProfileImage } : require("../../assets/profil.png")} style={styles.avatarMember} />
                          <Text style={{fontSize: 16, marginLeft: 15}}>{item.FullName || item.Pseudo}</Text>
                          <Ionicons name="add-circle-outline" size={24} color="#3b4db8" style={{marginLeft: 'auto'}} />
                      </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 20, color: '#666'}}>No new users to add.</Text>}
               />
           </SafeAreaView>
       </Modal>

       {/* Shared Media Modal */}
       <Modal visible={sharedModalVisible} animationType="slide" onRequestClose={() => setSharedModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
          <View style={[styles.header, {backgroundColor: '#3b4db8'}]}>
             <TouchableOpacity onPress={() => setSharedModalVisible(false)}>
                <Ionicons name="arrow-back" size={24} color="white" />
             </TouchableOpacity>
             <Text style={{ color: "white", fontSize: 18, fontWeight: "bold", marginLeft: 15 }}>Group Files</Text>
             <View style={{flex:1}}/>
          </View>

          <ScrollView style={{ padding: 15 }}>
            <Text style={styles.sectionTitle}>Photos ({sharedImages.length})</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
               {sharedImages.length === 0 && <Text style={styles.emptyText}>No images.</Text>}
               {sharedImages.map((msg) => (
                 <TouchableOpacity key={msg._id} onPress={() => Linking.openURL(msg.image)}>
                    <Image source={{ uri: msg.image }} style={styles.gridImage} />
                 </TouchableOpacity>
               ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Documents ({sharedFiles.length})</Text>
            {sharedFiles.length === 0 && <Text style={styles.emptyText}>No files.</Text>}
            {sharedFiles.map((msg) => (
                <TouchableOpacity key={msg._id} onPress={() => Linking.openURL(msg.file.url)} style={styles.fileItem}>
                    <Ionicons name="document-text" size={24} color="#3b4db8" />
                    <View style={{marginLeft: 10, flex: 1}}>
                        <Text style={{fontWeight: 'bold', fontSize: 14}} numberOfLines={1}>{msg.file.name}</Text>
                        <Text style={{color: '#666', fontSize: 12}}>By {msg.senderName}</Text>
                    </View>
                    <Ionicons name="download-outline" size={20} color="#333" />
                </TouchableOpacity>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Locations ({sharedLocations.length})</Text>
            {sharedLocations.length === 0 && <Text style={styles.emptyText}>No locations.</Text>}
            {sharedLocations.map((msg) => (
                <TouchableOpacity key={msg._id} onPress={() => openMap(msg.location)} style={styles.fileItem}>
                    <Ionicons name="location-sharp" size={24} color="#e74c3c" />
                    <View style={{marginLeft: 10}}>
                        <Text style={{fontWeight: 'bold'}}>Location Shared</Text>
                        <Text style={{color: '#666', fontSize: 12}}>{new Date(msg.createdAt).toLocaleString()}</Text>
                    </View>
                </TouchableOpacity>
            ))}
            <View style={{height: 50}}/>
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  headerTextContainer: { marginLeft: 10, flex: 1 },
  headerTitle: { color: "white", fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: "#dcdcdc", fontSize: 11 },
  headerIcon: { marginLeft: 15 },
  
  msgRow: { flexDirection: "row", marginVertical: 6 },
  avatar: { width: 34, height: 34, borderRadius: 17, marginRight: 8, marginTop: 10 },
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 18, elevation: 1 },
  bubbleMe: { backgroundColor: "#3b4db8", borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: "#fff", borderBottomLeftRadius: 2 },
  senderName: { fontSize: 11, color: "#e67e22", fontWeight: 'bold', marginBottom: 4 },
  
  // Floating Input
  inputWrapper: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      paddingHorizontal: 10,
      paddingBottom: Platform.OS === 'ios' ? 10 : 15, 
      backgroundColor: 'transparent'
  },
  inputContainer: { 
      flexDirection: "row", 
      alignItems: "center", 
      backgroundColor: "#fff", 
      paddingVertical: 8, paddingHorizontal: 10, 
      borderRadius: 30,
      elevation: 5,
      shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.25, shadowRadius: 3.84
  },
  iconBtn: { padding: 5, marginHorizontal: 2 },
  input: { flex: 1, fontSize: 16, maxHeight: 100, marginHorizontal: 5, color: '#333' },
  sendBtn: { 
      backgroundColor: "#3b4db8", width: 40, height: 40, borderRadius: 20, 
      justifyContent: 'center', alignItems: 'center', elevation: 2
  },
  loaderContainer: { alignSelf:'center', backgroundColor: 'rgba(255,255,255,0.8)', padding: 10, borderRadius: 10, marginBottom: 10 },

  // Modals
  modalHeader: { flexDirection: 'row', justifyContent:'space-between', alignItems:'center', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  avatarMember: { width: 40, height: 40, borderRadius: 20 },
  
  // Shared Files Styles
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  gridImage: { width: (width - 60) / 3, height: (width - 60) / 3, margin: 5, borderRadius: 8, backgroundColor: '#ddd' },
  fileItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, elevation: 1 },
  emptyText: { color: '#999', fontStyle: 'italic', marginBottom: 10 },
});