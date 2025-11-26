import { StatusBar } from 'expo-status-bar';
import {
  Button,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Image,
  Alert
} from 'react-native';
import React, { useState } from 'react';
import firebase from '../config';
import * as ImagePicker from "expo-image-picker";

const database = firebase.database();
const ref_all_accounts = database.ref("Acounts");

export default function CreateUser({ navigation }) {

  const auth = firebase.auth();

  const [fullName, setFullName] = useState("");
  const [pseudo, setPseudo] = useState(""); // Added
  const [numero, setNumero] = useState(""); // Added
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confPwd, setConfPwd] = useState("");
  const [profilePic, setProfilePic] = useState(null);

  // PICK IMAGE (Directly opens gallery)
  async function pickImage() {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      setProfilePic(result.assets[0].uri);
    }
  }

  // REGISTER USER
  const handleRegister = async () => {
    if (!fullName || !email || !pwd || !pseudo) {
      Alert.alert("Missing info", "Please fill all required fields.");
      return;
    }
    if (pwd !== confPwd) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    try {
      await auth.createUserWithEmailAndPassword(email.trim(), pwd);
      const uid = auth.currentUser.uid;

      // Save ALL fields including Pseudo and Numero
      await ref_all_accounts.child(uid).set({
        Id: uid,
        FullName: fullName,
        Pseudo: pseudo,
        Numero: numero,
        Email: email.trim(),
        ProfileImage: profilePic ? profilePic : null
      });

      Alert.alert("Success", "Account created!");
      navigation.replace("Auth");

    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <ImageBackground
      source={require("../assets/background.jpg")}
      style={styles.container}
    >
      <View style={styles.card}>

        {/* Profile Photo */}
        <TouchableOpacity onPress={pickImage}>
          <Image
            source={
              profilePic
                ? { uri: profilePic }
                : require("../assets/profil.png")
            }
            style={styles.profilePic}
          />
        </TouchableOpacity>
        
        <Text style={styles.changePhotoText}>Tap image to select photo</Text>

        <Text style={styles.title}>Create Account</Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput
          style={styles.input}
          placeholder="Pseudo (Username)"
          value={pseudo}
          onChangeText={setPseudo}
        />

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={numero}
          onChangeText={setNumero}
          keyboardType="phone-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={pwd}
          onChangeText={setPwd}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          secureTextEntry
          value={confPwd}
          onChangeText={setConfPwd}
        />

        <View style={styles.row}>
          <Button title="Register" color="#3b4db8" onPress={handleRegister} />
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("Auth")}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="light" />
    </ImageBackground>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    width: "90%",
    padding: 25,
    backgroundColor: "#ffffffdd",
    borderRadius: 20,
    alignItems: "center",
    marginTop: 40
  },

  profilePic: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 5,
  },

  changePhotoText: { 
    color: "#666", 
    marginBottom: 15,
    fontSize: 12
  },

  title: { fontSize: 30, fontWeight: "700", marginBottom: 15 },

  input: {
    width: "90%",
    backgroundColor: "#ececec",
    padding: 12,
    borderRadius: 10,
    marginVertical: 5
  },

  row: { marginTop: 20, width: "90%" },

  link: {
    marginTop: 15,
    color: "#1b2fbf",
    fontWeight: "600",
    textDecorationLine: "underline"
  },
});