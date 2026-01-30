import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <Text style={styles.text}>Page de Connexion Harmonia</Text>
      <Text style={styles.status}>Le système de navigation fonctionne ! 👍</Text>

      <TouchableOpacity 
        style={styles.button} 
        onPress={() => router.back()} // Pour revenir à l'accueil
      >
        <Text style={styles.buttonText}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5', // Ton blanc cassé
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  status: {
    fontSize: 16,
    color: '#11998e', // Ton vert professionnel
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#0072ff', // Ton bleu professionnel
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
