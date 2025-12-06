import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  ImageBackground,
  TouchableOpacity,
  Alert,
  StatusBar,
  Modal,
} from "react-native";
import { supabase } from "../../config";
import React, { useState, useEffect, useLayoutEffect } from "react";
import firebase from "../../config";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { EmailAuthProvider } from "firebase/auth";

export default function Account({ route, navigation }) {
  const { currentid } = route.params;

  const database = firebase.database();
  const refAccount = database.ref("Acounts").child(currentid);
  const auth = firebase.auth();

  const [nom, setNom] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [numero, setNumero] = useState("");
  const [userImage, setUserImage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // New state for Account Deletion
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [confirmPwd, setConfirmPwd] = useState("");

  // FIX: This hides the white header bar so the background covers the top
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Load user info once
  useEffect(() => {
    refAccount.once("value").then((snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setNom(data.FullName || "");
        setPseudo(data.Pseudo || "");
        setEmail(data.Email || "");
        setNumero(data.Numero || "");
        setUserImage(data.ProfileImage || null);
      }
    });
  }, []);

  // Supabase upload helper
  const uploadImageToSupabase = async (localURL) => {
    try {
      const fileName = `${currentid}_${Date.now()}.jpg`;

      const response = await fetch(localURL);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      // Upload image
      const { error: uploadError } = await supabase.storage
        .from("lesimagesprofiles")
        .upload(fileName, arrayBuffer, { contentType: "image/jpeg", upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from("lesimagesprofiles").getPublicUrl(fileName);

      return { publicUrl: data.publicUrl, fileName };
    } catch (error) {
      Alert.alert("Upload Error", error.message);
      return { publicUrl: null, fileName: null };
    }
  };

  // Pick image and upload to Supabase
  const pickImage = async () => {
    setModalVisible(false);
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        return Alert.alert("Permission required", "Permission is required to pick an image!");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!result.canceled) {
        const localUri = result.assets[0].uri;

        // Fetch previous file name from Firebase (if any)
        const snapshot = await refAccount.once("value");
        const prevFileName = snapshot.val()?.ImageFileName;

        // Upload to Supabase
        const { publicUrl, fileName } = await uploadImageToSupabase(localUri);

        if (publicUrl && fileName) {
          setUserImage(publicUrl);

          // Delete old file from Supabase
          if (prevFileName) {
            await supabase.storage.from("lesimagesprofiles").remove([prevFileName]);
          }

          // Save new URL + filename in Firebase
          await refAccount.update({
            ProfileImage: publicUrl,
            ImageFileName: fileName,
          });
        }
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  // NEW: Function to Open Camera and Take Photo
  const takePhoto = async () => {
    setModalVisible(false);
    try {
      // NEW: Request camera permissions
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        return Alert.alert("Permission required", "Permission is required to access the camera!");
      }

      // NEW: Launch Camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      // NEW: Same upload logic as pickImage
      if (!result.canceled) {
        const localUri = result.assets[0].uri;

        const snapshot = await refAccount.once("value");
        const prevFileName = snapshot.val()?.ImageFileName;

        const { publicUrl, fileName } = await uploadImageToSupabase(localUri);

        if (publicUrl && fileName) {
          setUserImage(publicUrl);

          if (prevFileName) {
            await supabase.storage.from("lesimagesprofiles").remove([prevFileName]);
          }

          await refAccount.update({
            ProfileImage: publicUrl,
            ImageFileName: fileName,
          });
        }
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  function removeImage() {
    setUserImage(null);
    setModalVisible(false);
    refAccount.update({ ProfileImage: null, ImageFileName: null });
  }

  function saveData() {
    refAccount
      .update({
        FullName: nom,
        Pseudo: pseudo,
        Email: email,
        Numero: numero,
        isTyping: false,
      })
      .then(() => Alert.alert("Updated", "Your information has been updated!"));
  }

  async function logout() {
    try {
      await refAccount.update({ online: false, lastSeen: Date.now() });

      // remove saved auto-login credentials
      await AsyncStorage.removeItem("EMAIL");
      await AsyncStorage.removeItem("PWD");

      // remove UID used for auto-login
      await AsyncStorage.removeItem("CURRENT_UID");

      await auth.signOut();

      navigation.replace("Auth");
    } catch (error) {
      Alert.alert("Logout error", error.message);
    }
  }

  // pour supprimer le compte
  const handleDeleteAccount = async () => {
    if (!confirmPwd) {
      Alert.alert("Password Required", "Please enter your password to confirm deletion.");
      return;
    }
    try {
      const user = auth.currentUser;
      // Build the credential with email + password
      const credential = EmailAuthProvider.credential(user.email, confirmPwd);
      // Reauthenticate properly
      await user.reauthenticateWithCredential(credential);
      // Delete user data from Realtime Database
      await refAccount.remove();
      // Delete user account
      await user.delete();
      // Cleanup local storage
      await AsyncStorage.removeItem("CURRENT_UID");
      await AsyncStorage.removeItem("EMAIL");
      await AsyncStorage.removeItem("PWD");

      setDeleteModalVisible(false);
      navigation.replace("Auth");

    } catch (error) {
      Alert.alert("Delete Failed", error.message);
    }
  };

  return (
    <ImageBackground source={require("../../assets/background.jpg")} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3b4db8" />

      <Text style={styles.welcomeText}>Welcome, {nom}</Text>

      <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.profileContainer}>
        <Image source={userImage ? { uri: userImage } : require("../../assets/profil.png")} style={styles.profilePic} />
        <View style={styles.editIconContainer}>
          <MaterialCommunityIcons name="pencil" size={18} color="white" />
        </View>
      </TouchableOpacity>

      <View style={styles.card}>
        <TextInput style={styles.input} value={nom} onChangeText={setNom} placeholder="Name" />
        <TextInput style={styles.input} value={pseudo} onChangeText={setPseudo} placeholder="Pseudo" />
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" />
        <TextInput style={styles.input} value={numero} onChangeText={setNumero} placeholder="Number" />

        <TouchableOpacity style={styles.btn} onPress={saveData}>
          <Text style={styles.btnText}>Save Changes</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>

        {/* Delete Account Link */}
        <TouchableOpacity onPress={() => { setConfirmPwd(""); setDeleteModalVisible(true); }}>
            <Text style={styles.deleteLink}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Picture Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Profile Picture</Text>
            
            {/* NEW: Button to open Camera */}
            <TouchableOpacity style={styles.modalBtn} onPress={takePhoto}>
              <Text style={styles.modalBtnText}>Take a photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalBtn} onPress={pickImage}>
              <Text style={styles.modalBtnText}>Choose from gallery</Text>
            </TouchableOpacity>

            {userImage && (
              <TouchableOpacity style={[styles.modalBtn, styles.removeBtn]} onPress={removeImage}>
                <Text style={[styles.modalBtnText, { color: "white" }]}>Remove photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtn}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="slide" onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalCard, { borderColor: 'red', borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: '#d9534f' }]}>Delete Account</Text>
            <Text style={{ textAlign: 'center', marginBottom: 15 }}>
              This action is irreversible. Enter your password to confirm.
            </Text>

            <TextInput 
              style={[styles.input, { width: '100%', borderColor: '#ccc', borderWidth: 1 }]} 
              placeholder="Confirm Password"
              secureTextEntry
              value={confirmPwd}
              onChangeText={setConfirmPwd}
            />

            <TouchableOpacity style={[styles.btn, { backgroundColor: '#d9534f', marginTop: 10, width: '100%' }]} onPress={handleDeleteAccount}>
              <Text style={styles.btnText}>Confirm Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setDeleteModalVisible(false)}>
              <Text style={styles.cancelBtn}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  welcomeText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "white",
    marginBottom: 20,
    marginTop: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
  profileContainer: { marginBottom: 20, position: "relative" },
  profilePic: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: "white" },
  editIconContainer: {
    position: "absolute", bottom: 0, right: 0, backgroundColor: "#3b4db8",
    width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "white",
  },
  card: { width: "90%", padding: 25, backgroundColor: "#ffffffdd", borderRadius: 20, alignItems: "center" },
  input: { width: "85%", backgroundColor: "#ececec", padding: 12, borderRadius: 10, marginVertical: 7 },
  btn: { marginTop: 20, width: "85%", padding: 12, backgroundColor: "#3b4db8", borderRadius: 12, alignItems: "center" },
  btnText: { color: "white", fontWeight: "700", fontSize: 16 },
  logout: { marginTop: 15, color: "#3b4db8", fontWeight: "600", textDecorationLine: "underline" },
  deleteLink: { marginTop: 15, color: "#d9534f", fontWeight: "600", textDecorationLine: "underline" },
  
  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: "75%", padding: 25, backgroundColor: "white", borderRadius: 18, alignItems: "center" },
  modalTitle: { fontSize: 20, marginBottom: 20, fontWeight: "700" },
  modalBtn: { width: "100%", padding: 12, backgroundColor: "#e3e3e3", borderRadius: 10, alignItems: "center", marginVertical: 5 },
  removeBtn: { backgroundColor: "#d9534f" },
  modalBtnText: { fontWeight: "600", fontSize: 16 },
  cancelBtn: { marginTop: 12, color: "#007bff", fontWeight: "700", fontSize: 16 },
});