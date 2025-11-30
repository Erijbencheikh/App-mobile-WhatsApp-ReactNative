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
import React, { useState, useEffect } from "react";
import firebase from "../../config";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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

  // Supabase image upload helper (unchanged)
  const uploadimageToSupabase = async (localURL) => {
    const response = await fetch(localURL);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    await supabase.storage
      .from('lesimagesprofiles')
      .upload(currentid + ".jpg", arrayBuffer, {
        upset: true
      });

    const { data } = supabase.storage
      .from('lesimagesprofiles')
      .getPublicUrl(currentid + ".jpg");
    return data.publicUrl;
  };

  // pick and remove image (unchanged)
  async function pickImage() {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      setUserImage(result.assets[0].uri);
    }
    setModalVisible(false);
  }

  function removeImage() {
    setUserImage(null);
    setModalVisible(false);
  }

  // Save updated data — also keep isTyping default to false (safety)
  function saveData() {
    refAccount
      .update({
        FullName: nom,
        Pseudo: pseudo,
        Email: email,
        Numero: numero,
        ProfileImage: userImage ? userImage : null,
        isTyping: false,
      })
      .then(() => Alert.alert("Updated", "Your information has been updated!"));
  }

  // LOGOUT: set online false and update lastSeen timestamp, then sign out
  function logout() {
    refAccount.update({ online: false, lastSeen: Date.now() }).finally(() => {
      auth.signOut().then(() => {
        navigation.replace("Auth");
      });
    });
  }

  return (
    <ImageBackground source={require("../../assets/background.jpg")} style={styles.container}>
      <StatusBar style="light" />

      <Text style={styles.welcomeText}>Welcome, {nom}</Text>

      <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.profileContainer}>
        <Image source={ userImage ? { uri: userImage } : require("../../assets/profil.png") } style={styles.profilePic} />
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
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Profile Picture</Text>

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
    </ImageBackground>
  );
}

// styles (unchanged)
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  welcomeText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "white",
    marginBottom: 20,
    marginTop: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
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
  logout: { marginTop: 15, color: "#d9534f", fontWeight: "600", textDecorationLine: "underline" },
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: "75%", padding: 25, backgroundColor: "white", borderRadius: 18, alignItems: "center" },
  modalTitle: { fontSize: 20, marginBottom: 20, fontWeight: "700" },
  modalBtn: { width: "100%", padding: 12, backgroundColor: "#e3e3e3", borderRadius: 10, alignItems: "center", marginVertical: 5 },
  removeBtn: { backgroundColor: "#d9534f" },
  modalBtnText: { fontWeight: "600", fontSize: 16 },
  cancelBtn: { marginTop: 12, color: "#007bff", fontWeight: "700", fontSize: 16 },
});
