import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Définition des propriétés attendues depuis AuthAdmin.tsx
interface AdminAwaleProps {
  adminEmail: string;
  adminPassword: string;
  onBack: () => void;
}

export default function AdminAwale({ adminEmail, adminPassword, onBack }: AdminAwaleProps) {
  return (
    <View style={styles.container}>
      
      {/* --- EN-TÊTE (HEADER) --- */}
      <LinearGradient colors={['#10B981', '#059669']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gestion Awalé</Text>
          <View style={{ width: 28 }} /> {/* Espaceur pour bien centrer le titre */}
        </View>
      </LinearGradient>

      {/* --- CONTENU (EN DÉVELOPPEMENT) --- */}
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="construct-outline" size={80} color="#10B981" />
        </View>
        
        <Text style={styles.title}>En développement</Text>
        <Text style={styles.subtitle}>
          L'interface d'administration pour le jeu d'Awalé est actuellement en cours de construction. Revenez plus tard !
        </Text>
      </View>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA' 
  },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 20, 
    paddingHorizontal: 20, 
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30
  },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  backButton: { 
    padding: 5 
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#FFF' 
  },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 30 
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#E6FDF4', // Vert très clair pour faire ressortir l'icône
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 12 
  },
  subtitle: { 
    fontSize: 16, 
    color: '#666', 
    textAlign: 'center', 
    lineHeight: 24 
  },
});
