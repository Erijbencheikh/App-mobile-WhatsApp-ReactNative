import React, { useState, useEffect, useLayoutEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Image, StatusBar, Alert, ActivityIndicator, ImageBackground
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firebase from "../../config";

const database = firebase.database();

export default function GroupList(props) {
  const currentid = props.route.params.currentid;
  
  // State
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  useLayoutEffect(() => {
    props.navigation.setOptions({
      title: "My Groups",
      headerStyle: { backgroundColor: "#3b4db8" },
      headerTintColor: "#fff",
      headerRight: () => (
        <TouchableOpacity onPress={openCreateModal} style={{ marginRight: 15 }}>
          <Ionicons name="add-circle" size={28} color="white" />
        </TouchableOpacity>
      ),
    });
  }, [props.navigation]);

  // Fetch Groups where I am a member
  useEffect(() => {
    const ref_groups = database.ref("Groups");
    const listener = ref_groups.on("value", (snapshot) => {
      const groups = [];
      snapshot.forEach((child) => {
        const group = child.val();
        // Check if current user is in the members object
        if (group.members && group.members[currentid]) {
          groups.push({
            id: child.key,
            ...group
          });
        }
      });
      setMyGroups(groups);
      setLoading(false);
    });
    return () => ref_groups.off("value", listener);
  }, []);

  // Fetch All Users for the Selection List
  useEffect(() => {
    database.ref("Acounts").once("value").then(snapshot => {
      const users = [];
      snapshot.forEach(child => {
        if (child.key !== currentid) { // Don't add myself to the list
          users.push({
            id: child.key,
            ...child.val()
          });
        }
      });
      setAllUsers(users);
    });
  }, []);

  const openCreateModal = () => {
    setGroupName("");
    setSelectedUsers([]);
    setModalVisible(true);
  };

  const toggleUserSelection = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const createGroup = () => {
    if (!groupName.trim()) return Alert.alert("Error", "Please enter a group name");
    if (selectedUsers.length === 0) return Alert.alert("Error", "Select at least one member");

    const newGroupRef = database.ref("Groups").push();
    const membersObj = { [currentid]: true }; // Add creator
    selectedUsers.forEach(uid => membersObj[uid] = true); // Add selected users

    const newGroup = {
      name: groupName,
      createdBy: currentid,
      createdAt: Date.now(),
      members: membersObj,
      lastMessage: "Group created",
      lastMessageTime: Date.now()
    };

    newGroupRef.set(newGroup).then(() => {
      setModalVisible(false);
      // Optional: Navigate immediately to the new group
      props.navigation.navigate("GroupChat", {
        currentid: currentid,
        groupId: newGroupRef.key,
        groupName: groupName
      });
    });
  };

  const renderGroupItem = ({ item }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => props.navigation.navigate("GroupChat", {
        currentid: currentid,
        groupId: item.id,
        groupName: item.name
      })}
    >
      <View style={styles.groupIcon}>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "bold" }}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: 15 }}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.lastMsg} numberOfLines={1}>
          {item.lastMessage || "Tap to chat"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  const renderSelectUser = ({ item }) => {
    const isSelected = selectedUsers.includes(item.id);
    return (
      <TouchableOpacity 
        style={[styles.userSelectRow, isSelected && styles.userSelected]} 
        onPress={() => toggleUserSelection(item.id)}
      >
        <Image 
          source={item.ProfileImage ? { uri: item.ProfileImage } : require("../../assets/profil.png")} 
          style={styles.avatar} 
        />
        <Text style={[styles.userName, isSelected && {color: '#3b4db8', fontWeight:'bold'}]}>
          {item.FullName || item.Pseudo}
        </Text>
        {isSelected && <Ionicons name="checkmark-circle" size={24} color="#3b4db8" />}
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground source={require("../../assets/background.jpg")} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3b4db8" />
      
      {loading ? (
        <ActivityIndicator size="large" color="#3b4db8" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={myGroups}
          renderItem={renderGroupItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 10 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 20, color: "#666" }}>
              No groups yet. Create one!
            </Text>
          }
        />
      )}

      {/* CREATE GROUP MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Group</Text>
            <TouchableOpacity onPress={createGroup}>
              <Text style={styles.createBtnText}>Create</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.label}>Group Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Family, Work..."
              value={groupName}
              onChangeText={setGroupName}
            />
          </View>

          <Text style={[styles.label, { marginLeft: 20, marginTop: 10 }]}>Select Members</Text>
          <FlatList
            data={allUsers}
            renderItem={renderSelectUser}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
          />
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  groupCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    alignItems: "center",
    elevation: 2
  },
  groupIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "#3b4db8",
    justifyContent: "center", alignItems: "center"
  },
  groupName: { fontSize: 18, fontWeight: "bold", color: "#333" },
  lastMsg: { fontSize: 14, color: "#777", marginTop: 2 },
  
  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: "#f5f5f5" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 15, backgroundColor: "#fff", elevation: 3
  },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  createBtnText: { fontSize: 16, color: "#3b4db8", fontWeight: "bold" },
  inputSection: { padding: 20, backgroundColor: "#fff", marginTop: 10 },
  label: { fontSize: 14, color: "#666", marginBottom: 5 },
  input: { borderBottomWidth: 1, borderColor: "#ddd", fontSize: 16, paddingVertical: 5 },
  
  // User Selection
  userSelectRow: {
    flexDirection: "row", alignItems: "center",
    padding: 15, borderBottomWidth: 1, borderColor: "#eee",
    backgroundColor: "#fff"
  },
  userSelected: { backgroundColor: "#e8eaf6" },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 15 },
  userName: { fontSize: 16, flex: 1 },
});