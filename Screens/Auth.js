import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Alert,
  Switch,
  Modal
} from "react-native";
import React, { useState, useEffect } from "react";
import firebase from "../config";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Auth({ navigation }) {
  const auth = firebase.auth();
  const database = firebase.database();

  // Login States
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Forgot Password Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  // LOAD SAVED LOGIN INFO
  useEffect(() => {
    const loadSavedData = async () => {
      const savedEmail = await AsyncStorage.getItem("EMAIL");
      const savedPwd = await AsyncStorage.getItem("PWD");

      if (savedEmail && savedPwd) {
        setEmail(savedEmail);
        setPwd(savedPwd);
        setRememberMe(true);
      }
    };

    loadSavedData();
  }, []);

  const handleRememberMe = async (value) => {
    setRememberMe(value);

    if (!value) {
      await AsyncStorage.removeItem("EMAIL");
      await AsyncStorage.removeItem("PWD");
    }
  };

  // LOGIN USER (with real-time presence setup)
  const handleLogin = async () => {
    if (!email || !pwd) {
      Alert.alert("Missing info", "Please enter email and password.");
      return;
    }

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email.trim(), pwd);
      const user = userCredential.user;
      const uid = user.uid;

      // Save login only if rememberMe = true
      if (rememberMe) {
        await AsyncStorage.setItem("EMAIL", email.trim());
        await AsyncStorage.setItem("PWD", pwd);
      }

      // --- PRESENCE: mark this user online in Acounts/{uid} and ensure onDisconnect sets them offline
      const userRef = database.ref("Acounts").child(uid);

      // set online true now
      await userRef.update({ online: true });

      // If connection drops or app closes, onDisconnect will set online=false and lastSeen timestamp
      userRef.child("online").onDisconnect().set(false);
      userRef.child("lastSeen").onDisconnect().set(Date.now());

      // Redirect to Home and pass currentid
      navigation.replace("Home", { currentid: uid });

    } catch (error) {
      Alert.alert("Login Error", error.message);
    }
  };

  // FORGOT PASSWORD HELPERS
  const openForgotModal = () => {
    setResetEmail(email);
    setModalVisible(true);
  };

  const handleSendReset = async () => {
    if (!resetEmail) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }

    try {
      await auth.sendPasswordResetEmail(resetEmail.trim());
      setModalVisible(false);
      Alert.alert("Email sent", "Please check your inbox to reset your password.");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <ImageBackground source={require("../assets/background.jpg")} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome Back</Text>

        <TextInput
          placeholder="Email"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          placeholder="Password"
          style={styles.input}
          secureTextEntry
          value={pwd}
          onChangeText={setPwd}
        />

        <View style={styles.rememberRow}>
          <Text style={styles.rememberText}>Remember me</Text>
          <Switch
            value={rememberMe}
            onValueChange={handleRememberMe}
            thumbColor={rememberMe ? "#3b4db8" : "#aaa"}
          />
        </View>

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
          <Text style={styles.loginText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openForgotModal}>
          <Text style={styles.forgetPwd}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("CreateUser")}>
          <Text style={styles.link}>Don't have an account? Create one</Text>
        </TouchableOpacity>
      </View>

      {/* Forgot Password Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalDesc}>Enter your email to receive a reset link.</Text>

            <TextInput style={styles.modalInput} placeholder="Enter your email" value={resetEmail} onChangeText={setResetEmail} autoCapitalize="none" keyboardType="email-address" />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSendReset} style={styles.sendBtn}>
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

// STYLES (same as yours)
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    width: "90%",
    padding: 25,
    backgroundColor: "#ffffffdd",
    borderRadius: 20,
    alignItems: "center",
    marginTop: 50,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 20,
  },

  input: {
    width: "90%",
    backgroundColor: "#ececec",
    padding: 12,
    borderRadius: 10,
    marginVertical: 8,
  },

  loginBtn: {
    marginTop: 20,
    width: "90%",
    padding: 14,
    backgroundColor: "#3b4db8",
    borderRadius: 12,
    alignItems: "center",
  },

  loginText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },

  rememberRow: {
    width: "90%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },

  rememberText: {
    fontSize: 15,
    color: "#444",
  },

  forgetPwd: {
    marginTop: 15,
    color: "#d9534f",
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  link: {
    marginTop: 15,
    color: "#1b2fbf",
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalCard: {
    width: "85%",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalDesc: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
    textAlign: "center"
  },
  modalInput: {
    width: "100%",
    backgroundColor: "#f0f0f0",
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ddd"
  },
  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    padding: 10,
    marginRight: 10,
    alignItems: "center",
  },
  cancelText: {
    color: "gray",
    fontWeight: "bold",
  },
  sendBtn: {
    flex: 1,
    backgroundColor: "#3b4db8",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  sendText: {
    color: "white",
    fontWeight: "bold",
  }
});
