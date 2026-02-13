import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const API_BASE = 'https://sjdjwtlcryyqqewapxip.supabase.co/functions/v1/games';

interface Question {
  id: string;
  question: string;
  correct_answer: boolean;
  category: string;
  difficulty: 'facile' | 'moyen' | 'difficile';
}

interface GameSession {
  id: string;
  title: string;
  description: string;
  is_paid: boolean;
  price_cfa: number;
}

export default function VraiFauxGame() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [gameActive, setGameActive] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<boolean | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    loadUserAndSessions();
  }, []);

  const loadUserAndSessions = async () => {
    try {
      const session = await AsyncStorage.getItem('harmonia_session');
      if (session) {
        const parsed = JSON.parse(session);
        setUserId(parsed.user.id);
      }

      await loadSessions();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'list-sessions',
          game_key: 'vrai_faux',
        }),
      });

      const data = await response.json();
      if (data.success && data.sessions) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const startGame = async (session: GameSession) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    setSelectedSession(session);
    setGameActive(true);
    setScore(0);
    setQuestionNumber(0);
    await loadNextQuestion();
  };

  const loadNextQuestion = async () => {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://harmonia-world.vercel.app',
        },
        body: JSON.stringify({
          action: 'get-question',
          game_key: 'vrai_faux',
        }),
      });

      const data = await response.json();
      if (data.success && data.question) {
        setCurrentQuestion(data.question);
        setQuestionNumber(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error loading question:', error);
    }
  };

  const handleAnswer = async (userAnswer: boolean) => {
    if (!currentQuestion) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const correct = userAnswer === currentQuestion.correct_answer;
    setIsCorrect(correct);
    setLastAnswer(userAnswer);
    setShowResult(true);

    if (correct) {
      setScore(prev => prev + 1);
    }

    // Attendre 1.5s puis passer à la question suivante
    setTimeout(() => {
      setShowResult(false);
      setLastAnswer(null);
      
      if (questionNumber >= totalQuestions) {
        endGame();
      } else {
        loadNextQuestion();
      }
    }, 1500);
  };

  const endGame = () => {
    setGameActive(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const restartGame = () => {
    if (selectedSession) {
      startGame(selectedSession);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!gameActive && !selectedSession) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#10B981', '#059669']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>❓ Vrai ou Faux</Text>
          <Text style={styles.headerSubtitle}>Testez vos connaissances</Text>
        </LinearGradient>

        <View style={styles.sessionsContainer}>
          {sessions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="game-controller-outline" size={80} color="#CCC" />
              <Text style={styles.emptyText}>Aucune session disponible</Text>
            </View>
          ) : (
            sessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => startGame(session)}
              >
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionTitle}>{session.title}</Text>
                  <Text style={styles.sessionDescription}>{session.description}</Text>
                  {session.is_paid && (
                    <View style={styles.priceTag}>
                      <Ionicons name="wallet" size={16} color="#10B981" />
                      <Text style={styles.priceText}>{session.price_cfa} CFA</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={24} color="#10B981" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    );
  }

  if (!gameActive) {
    // Écran de fin
    const percentage = Math.round((score / totalQuestions) * 100);
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#10B981', '#059669']} style={styles.resultContainer}>
          <Ionicons 
            name={percentage >= 70 ? 'trophy' : 'medal'} 
            size={80} 
            color="#FFD700" 
          />
          <Text style={styles.resultTitle}>Partie terminée !</Text>
          <Text style={styles.resultScore}>{score} / {totalQuestions}</Text>
          <Text style={styles.resultPercentage}>{percentage}%</Text>
          
          <View style={styles.resultButtons}>
            <TouchableOpacity style={styles.resultButton} onPress={restartGame}>
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.resultButtonText}>Rejouer</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.resultButton, styles.resultButtonSecondary]} 
              onPress={() => router.back()}
            >
              <Ionicons name="home" size={20} color="#10B981" />
              <Text style={[styles.resultButtonText, { color: '#10B981' }]}>Accueil</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Jeu actif
  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>Question {questionNumber}/{totalQuestions}</Text>
          <Text style={styles.scoreText}>Score: {score}</Text>
        </View>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(questionNumber / totalQuestions) * 100}%` }
            ]} 
          />
        </View>
      </View>

      {/* Question */}
      <View style={styles.questionContainer}>
        {currentQuestion && (
          <>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{currentQuestion.category}</Text>
            </View>
            
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            
            <View style={styles.difficultyIndicator}>
              {['facile', 'moyen', 'difficile'].map((level, index) => (
                <View
                  key={level}
                  style={[
                    styles.difficultyDot,
                    index <= ['facile', 'moyen', 'difficile'].indexOf(currentQuestion.difficulty) && styles.difficultyDotActive
                  ]}
                />
              ))}
            </View>
          </>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.answerButton, styles.trueButton]}
          onPress={() => handleAnswer(true)}
          disabled={showResult}
        >
          <LinearGradient colors={['#10B981', '#059669']} style={styles.answerGradient}>
            <Ionicons name="checkmark-circle" size={40} color="#FFF" />
            <Text style={styles.answerText}>VRAI</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.answerButton, styles.falseButton]}
          onPress={() => handleAnswer(false)}
          disabled={showResult}
        >
          <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.answerGradient}>
            <Ionicons name="close-circle" size={40} color="#FFF" />
            <Text style={styles.answerText}>FAUX</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Result Modal */}
      <Modal visible={showResult} transparent animationType="fade">
        <View style={styles.resultModal}>
          <View style={[
            styles.resultCard,
            isCorrect ? styles.resultCardCorrect : styles.resultCardIncorrect
          ]}>
            <Ionicons 
              name={isCorrect ? 'checkmark-circle' : 'close-circle'} 
              size={60} 
              color="#FFF" 
            />
            <Text style={styles.resultModalText}>
              {isCorrect ? '✅ Correct !' : '❌ Incorrect'}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  sessionsContainer: {
    flex: 1,
    padding: 16,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  sessionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 20,
  },
  progressContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  questionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  categoryBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  categoryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 24,
  },
  difficultyIndicator: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  difficultyDotActive: {
    backgroundColor: '#10B981',
  },
  buttonsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  answerButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  trueButton: {},
  falseButton: {},
  answerGradient: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  answerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 24,
    marginBottom: 16,
  },
  resultScore: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  resultPercentage: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 40,
  },
  resultButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  resultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  resultButtonSecondary: {
    backgroundColor: '#FFF',
  },
  resultButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  resultModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultCard: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
  },
  resultCardCorrect: {
    backgroundColor: '#10B981',
  },
  resultCardIncorrect: {
    backgroundColor: '#EF4444',
  },
  resultModalText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
  },
});
