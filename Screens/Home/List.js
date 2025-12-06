import {FlatList, ImageBackground, Image,StyleSheet,
  Text,TextInput,View,TouchableOpacity,StatusBar, Modal,Alert} from "react-native";
import firebase from "../../config";
import React, { useEffect, useState, useLayoutEffect } from "react";
import { Ionicons } from "@expo/vector-icons";

const database = firebase.database();
const ref_all_accounts = database.ref("Acounts");

export default function List({ navigation, route }) {
  const currentid = route.params?.currentid;

  const [data, setData] = useState([]); // All users
  const [myContacts, setMyContacts] = useState([]); // IDs of added contacts

  const [searchText, setSearchText] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [numberInput, setNumberInput] = useState("");
  const [searchResult, setSearchResult] = useState(null);

  // Reference to current user's contacts
  const ref_my_contacts = database.ref("MyContacts").child(currentid);

  // Set up header options
  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Contacts",
      headerRight: () => (
        <TouchableOpacity style={{ marginRight: 15 }} onPress={() => setModalVisible(true)}>
          <Ionicons name="person-add" size={24} color="white" />
        </TouchableOpacity>
      ),
      headerStyle: { backgroundColor: "#3b4db8" },
      headerTintColor: "#fff",
    });
  }, [navigation]);

  // Fetch all users 
  useEffect(() => {
    ref_all_accounts.on("value", (snapshot) => {
      const d = [];
      snapshot.forEach((child) => {
        const user = child.val(); //Convert object to array
        d.push(user); // include current user as well
      });
      setData(d);
    });
    return () => ref_all_accounts.off(); // Cleanup listener
  }, []);

  // Fetch my added contacts
  useEffect(() => {
    ref_my_contacts.on("value", (snapshot) => {
      const contactIds = [];
      snapshot.forEach((child) => {
        contactIds.push(child.key); // Collect contact IDs
      });
      setMyContacts(contactIds);
    });
    return () => ref_my_contacts.off();
  }, []);

  // Filtered contacts based on added contacts and search text
  const myContactsData = data.filter(user => myContacts.includes(user.Id));
  const filteredContacts = myContactsData.filter(user => {
    const text = searchText.toLowerCase();
    return (
      user.FullName?.toLowerCase().includes(text) ||
      user.Pseudo?.toLowerCase().includes(text) ||
      user.Numero?.toLowerCase().includes(text)
    );
  });

  // Add new contact by number
  const addContactByNumber = () => {
    if (!searchResult) return;
    // Add to my contacts FriendID = true
    ref_my_contacts.child(searchResult.Id).set(true)
      .then(() => {
        Alert.alert("Success", "Contact added!");
        setModalVisible(false);
        setNumberInput("");
        setSearchResult(null);
      })
      .catch((err) => Alert.alert("Error", err.message));
  };

  const handleSearchNumber = (text) => {
    setNumberInput(text);
    if (text.length >= 3) {
      const found = data.find(u => u.Numero === text);
      setSearchResult(found || null);
    } else {
      setSearchResult(null);
    }
  };

  // Render item (Individual Contact Card )
  const renderItem = ({ item }) => {
    const userImage = item.ProfileImage ? { uri: item.ProfileImage } : require("../../assets/profil.png");
    return (
      <View style={styles.card}>
        <Image source={userImage} style={styles.avatar} />
        <View style={styles.textContainer}>
          <Text style={styles.name}>{item.FullName || "Unknown Name"}</Text>
          <Text style={styles.pseudo}>@{item.Pseudo || "user"}</Text>
          <Text style={styles.contact}>{item.Numero || "No number"}</Text>
        </View>
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => {
            navigation.navigate("Chat", {
              currentid: currentid,
              secondid: item.Id,
            });
          }}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="white" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ImageBackground source={require("../../assets/background.jpg")} style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Search my contacts */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={{ marginRight: 10 }} />
        <TextInput
          placeholder="Search..."
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Contacts list */}
      <FlatList
        data={filteredContacts}
        renderItem={renderItem}
        keyExtractor={(item) => item.Id}
        style={{ width: "100%" }}
        contentContainerStyle={{ alignItems: "center", paddingBottom: 20 }}
      />

      {/* Modal for adding a contact */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalWrapper}>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 18, marginBottom: 10 }}>Add Contact by Number</Text>
            <TextInput
              placeholder="Enter number"
              style={styles.numberInput}
              value={numberInput}
              onChangeText={handleSearchNumber}
              keyboardType="numeric"
            />
            {searchResult && (
              <View style={{ marginVertical: 10, padding: 10, backgroundColor: "#eee", borderRadius: 10 }}>
                <Text style={{ fontWeight: "bold" }}>{searchResult.FullName}</Text>
                <Text>@{searchResult.Pseudo}</Text>
                <Text>{searchResult.Numero}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 15 }}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setModalVisible(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#3b4db8" }]}
                onPress={addContactByNumber}
              >
                <Text style={{ color: "#fff" }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffffdd",
    width: "90%",
    height: 50,
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 15,
  },
  searchInput: { flex: 1, height: "100%", fontSize: 16 },
  card: {
    flexDirection: "row",
    width: "90%",
    backgroundColor: "#ffffffdd",
    borderRadius: 15,
    padding: 15,
    marginVertical: 6,
    alignItems: "center",
    elevation: 3,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: "#3b4db8" },
  textContainer: { flex: 1, marginLeft: 15, justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "bold", color: "#333" },
  pseudo: { fontSize: 14, color: "#666", fontStyle: "italic" },
  contact: { fontSize: 12, color: "#888", marginTop: 2 },
  chatBtn: { backgroundColor: "#3b4db8", width: 45, height: 45, borderRadius: 22.5, justifyContent: "center", alignItems: "center" },

  modalWrapper: { flex: 1, backgroundColor: "#00000066", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "85%", backgroundColor: "#fff", borderRadius: 15, padding: 20 },
  numberInput: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, paddingHorizontal: 15, height: 45, marginBottom: 10 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#eee", marginHorizontal: 5 },
});
