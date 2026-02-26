/**
 * TabAwale.tsx — Interface de jeu Awalé en temps réel
 *
 * CONNEXION :
 *   • socket.io — persistante bidirectionnelle
 *   • Authentification via user_id + access_token
 *   • Room = match_id
 *
 * AFFICHAGE :
 *   • Plateau 2×6 — rangée du bas = joueur, haut = adversaire
 *   • Timer visuel du coup en cours
 *   • Scores en temps réel
 *   • Animation de semailles
 *   • Fin de partie : victoire / défaite / égalité
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { io as socketIO, Socket } from 'socket.io-client'

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com'
const NATIVE      = Platform.OS !== 'web'

const haptic = {
  light:   () => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) },
  medium:  () => { if (NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) },
  success: () => { if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
  error:   () => { if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error) },
}

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:          '#080C0A',
  surface:     '#0F1A12',
  surfaceHigh: '#162019',
  border:      '#1E3022',
  green:       '#2D7A45',
  greenLight:  '#3DAA60',
  gold:        '#C9A84C',
  cream:       '#E8F0E0',
  muted:       '#4A6B52',
  danger:      '#E74C3C',
  white:       '#FFFFFF',
  myRow:       '#1A3D22',
  oppRow:      '#0F1E14',
  activeHole:  '#2D7A45',
  emptyHole:   '#0A1510',
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface GameState {
  match_id:          string
  board:             number[][]
  scores:            number[]
  current_player_id: string | null
  timer_ends_at:     string | null
  status:            'waiting' | 'playing' | 'finished'
  winner_id:         string | null
  end_reason:        'score' | 'empty' | 'timeout' | null
  move_count:        number
  row0_player_id:    string | null
  row1_player_id:    string | null
}

interface TabAwaleProps {
  matchId:     string
  userId:      string
  accessToken: string
  onBack?:     () => void
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function TabAwale({ matchId, userId, accessToken, onBack }: TabAwaleProps) {

  const [gameState,   setGameState]   = useState<GameState | null>(null)
  const [connected,   setConnected]   = useState(false)
  const [error,       setError]       = useState('')
  const [timeLeft,    setTimeLeft]    = useState<number | null>(null)
  const [lastMove,    setLastMove]    = useState<number | null>(null)
  const [gameOver,    setGameOver]    = useState<{
    winner_id: string | null
    end_reason: string
    scores: number[]
    is_draw: boolean
  } | null>(null)

  const socketRef    = useRef<Socket | null>(null)
  const timerRef     = useRef<NodeJS.Timeout | null>(null)
  const fadeAnim     = useRef(new Animated.Value(0)).current
  const holeAnims    = useRef<Animated.Value[]>(
    Array.from({ length: 12 }, () => new Animated.Value(1))
  ).current

  // ─── Déterminer ma rangée ─────────────────────────────────────────────────
  const myRow = gameState?.row1_player_id === userId ? 1 : 0
  const isMyTurn = gameState?.current_player_id === userId && gameState?.status === 'playing'

  // ─── Connexion socket.io ──────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: NATIVE }).start()

    const socket = socketIO(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setError('')
      console.log('[TabAwale] Connecté:', socket.id)

      // Rejoindre le match
      socket.emit('join_match', {
        match_id:     matchId,
        user_id:      userId,
        access_token: accessToken,
      })
    })

    socket.on('disconnect', () => {
      setConnected(false)
      console.log('[TabAwale] Déconnecté')
    })

    socket.on('connect_error', (err) => {
      setError('Impossible de se connecter au serveur')
      console.error('[TabAwale] Erreur connexion:', err)
    })

    socket.on('game_state', (state: GameState) => {
      setGameState(state)
      startLocalTimer(state.timer_ends_at)
    })

    socket.on('game_started', (data: any) => {
      haptic.success()
      console.log('[TabAwale] Partie démarrée:', data)
    })

    socket.on('game_over', (data: any) => {
      setGameOver(data)
      clearLocalTimer()
      if (data.winner_id === userId) {
        haptic.success()
      } else if (!data.is_draw) {
        haptic.error()
      }
    })

    socket.on('error', (data: { message: string }) => {
      setError(data.message)
      haptic.error()
    })

    return () => {
      clearLocalTimer()
      socket.disconnect()
    }
  }, [matchId, userId, accessToken])

  // ─── Timer local (compte à rebours affiché) ───────────────────────────────
  const startLocalTimer = useCallback((timerEndsAt: string | null) => {
    clearLocalTimer()
    if (!timerEndsAt) return

    const update = () => {
      const diff = Math.max(0, Math.ceil((new Date(timerEndsAt).getTime() - Date.now()) / 1000))
      setTimeLeft(diff)
      if (diff > 0) {
        timerRef.current = setTimeout(update, 200)
      }
    }
    update()
  }, [])

  const clearLocalTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }, [])

  // ─── Jouer un trou ────────────────────────────────────────────────────────
  const playHole = useCallback((hole: number) => {
    if (!isMyTurn) return
    if (!gameState) return

    const board = gameState.board
    if (board[myRow][hole] === 0) return

    haptic.medium()
    setLastMove(hole)
    setError('')

    // Animation du trou
    Animated.sequence([
      Animated.timing(holeAnims[myRow === 1 ? hole : hole + 6], {
        toValue: 0.8, duration: 100, useNativeDriver: NATIVE
      }),
      Animated.timing(holeAnims[myRow === 1 ? hole : hole + 6], {
        toValue: 1, duration: 100, useNativeDriver: NATIVE
      }),
    ]).start()

    socketRef.current?.emit('play', { hole })
  }, [isMyTurn, gameState, myRow, holeAnims])

  // ─── Rendu ────────────────────────────────────────────────────────────────

  // Chargement
  if (!connected || !gameState) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.greenLight} />
        <Text style={styles.loadingText}>
          {!connected ? 'Connexion au serveur…' : 'Chargement de la partie…'}
        </Text>
      </View>
    )
  }

  // Démarrage (waiting = transitoire, le jeu commence dès connexion)
  if (gameState.status === 'waiting') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.greenLight} />
        <Text style={styles.waitingTitle}>Démarrage de la partie…</Text>
        <Text style={styles.waitingText}>L'adversaire peut vous rejoindre à tout moment</Text>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  // Fin de partie
  if (gameOver || gameState.status === 'finished') {
    const result = gameOver ?? {
      winner_id:  gameState.winner_id,
      end_reason: gameState.end_reason ?? '',
      scores:     gameState.scores,
      is_draw:    gameState.winner_id === null,
    }
    const iWon  = result.winner_id === userId
    const isDraw = result.is_draw

    return (
      <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
        <View style={styles.gameOverBox}>
          <Text style={styles.gameOverEmoji}>
            {isDraw ? '🤝' : iWon ? '🏆' : '💔'}
          </Text>
          <Text style={[styles.gameOverTitle,
            isDraw ? styles.drawColor : iWon ? styles.winColor : styles.loseColor]}>
            {isDraw ? 'Égalité !' : iWon ? 'Victoire !' : 'Défaite'}
          </Text>
          <Text style={styles.gameOverReason}>
            {result.end_reason === 'timeout' ? 'Temps écoulé'
              : result.end_reason === 'score' ? 'Score atteint'
              : 'Plateau vide'}
          </Text>
          <View style={styles.finalScores}>
            <ScoreBox
              score={myRow === 0 ? result.scores[0] : result.scores[1]}
              label="Vous"
              highlight={iWon}
            />
            <Text style={styles.scoreSep}>—</Text>
            <ScoreBox
              score={myRow === 0 ? result.scores[1] : result.scores[0]}
              label="Adversaire"
              highlight={!iWon && !isDraw}
            />
          </View>
          {onBack && (
            <TouchableOpacity style={styles.doneBtn} onPress={onBack}>
              <Text style={styles.doneBtnText}>Terminer</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    )
  }

  // ── Jeu en cours ──────────────────────────────────────────────────────────
  const board  = gameState.board
  const scores = gameState.scores

  const myScore  = myRow === 0 ? scores[0] : scores[1]
  const oppScore = myRow === 0 ? scores[1] : scores[0]
  const oppRow   = myRow === 1 ? 0 : 1

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>

      {/* ── Bouton ✕ retour ── */}
      {onBack && (
        <TouchableOpacity style={styles.closeBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={C.cream} />
        </TouchableOpacity>
      )}

      {/* ── Erreur ── */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={14} color={C.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')}>
            <Ionicons name="close" size={14} color={C.danger} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Scores ── */}
      <View style={styles.scoreBar}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Adversaire</Text>
          <Text style={styles.scoreValue}>{oppScore}</Text>
        </View>
        <View style={styles.turnIndicator}>
          {isMyTurn
            ? <Text style={styles.yourTurn}>🟢 Votre tour</Text>
            : <Text style={styles.oppTurn}>⏳ Tour adverse</Text>}
        </View>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Vous</Text>
          <Text style={[styles.scoreValue, styles.myScore]}>{myScore}</Text>
        </View>
      </View>

      {/* ── Timer ── */}
      {timeLeft !== null && gameState.status === 'playing' && (
        <View style={styles.timerBar}>
          <View style={[
            styles.timerFill,
            { backgroundColor: timeLeft <= 5 ? C.danger : C.greenLight }
          ]} />
          <Text style={[
            styles.timerText,
            { color: timeLeft <= 5 ? C.danger : C.cream }
          ]}>
            {timeLeft}s
          </Text>
        </View>
      )}

      {/* ── Plateau ── */}
      <View style={styles.boardContainer}>

        {/* Rangée adversaire (haut) */}
        <View style={styles.rowLabel}>
          <Text style={styles.rowLabelText}>Adversaire</Text>
        </View>
        <View style={[styles.row, styles.oppRowBg]}>
          {/* Affichage miroir pour l'adversaire */}
          {[...board[oppRow]].reverse().map((seeds, idx) => {
            const col = 5 - idx
            return (
              <View key={`opp-${col}`} style={[styles.hole, styles.holeOpp]}>
                <Text style={styles.holeSeeds}>{seeds}</Text>
                <SeedDots count={seeds} color={C.muted} />
              </View>
            )
          })}
        </View>

        {/* Séparateur */}
        <View style={styles.divider} />

        {/* Rangée joueur (bas) */}
        <View style={[styles.row, styles.myRowBg]}>
          {board[myRow].map((seeds, col) => {
            const canPlay = isMyTurn && seeds > 0
            const anim    = holeAnims[myRow === 1 ? col : col + 6]
            return (
              <Animated.View key={`my-${col}`} style={{ transform: [{ scale: anim }] }}>
                <TouchableOpacity
                  style={[
                    styles.hole,
                    styles.holeMy,
                    canPlay && styles.holeActive,
                    seeds === 0 && styles.holeEmpty,
                    lastMove === col && isMyTurn && styles.holeLastMove,
                  ]}
                  onPress={() => playHole(col)}
                  disabled={!canPlay}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.holeSeeds, canPlay && styles.holeSeedsActive]}>
                    {seeds}
                  </Text>
                  <SeedDots count={seeds} color={canPlay ? C.greenLight : C.muted} />
                </TouchableOpacity>
              </Animated.View>
            )
          })}
        </View>
        <View style={styles.rowLabel}>
          <Text style={[styles.rowLabelText, { color: C.greenLight }]}>Vous</Text>
        </View>

      </View>

      {/* ── Info coup ── */}
      <View style={styles.moveInfo}>
        <Text style={styles.moveInfoText}>
          Coup #{gameState.move_count + 1}
        </Text>
        {!connected && (
          <Text style={styles.reconnecting}>⚠ Reconnexion…</Text>
        )}
      </View>

    </Animated.View>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function SeedDots({ count, color }: { count: number; color: string }) {
  if (count === 0) return null
  const display = Math.min(count, 12)
  return (
    <View style={styles.dotsGrid}>
      {Array.from({ length: display }).map((_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: color }]} />
      ))}
      {count > 12 && <Text style={[styles.dotMore, { color }]}>+{count - 12}</Text>}
    </View>
  )
}

function ScoreBox({ score, label, highlight }: {
  score: number; label: string; highlight: boolean
}) {
  return (
    <View style={[styles.scoreBox, highlight && styles.scoreBoxHighlight]}>
      <Text style={styles.scoreBoxLabel}>{label}</Text>
      <Text style={[styles.scoreBoxValue, highlight && styles.scoreBoxValueHighlight]}>
        {score}
      </Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center',
              backgroundColor: C.bg, padding: 32, gap: 16 },

  loadingText:  { color: C.muted, fontSize: 14, marginTop: 12 },
  waitingTitle: { color: C.cream, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  waitingText:  { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  backBtn:     { marginTop: 20, paddingVertical: 12, paddingHorizontal: 32,
                 backgroundColor: C.surface, borderRadius: 12,
                 borderWidth: 1, borderColor: C.border },
  backBtnText: { color: C.cream, fontSize: 14, fontWeight: '600' },

  // Erreur
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8,
                 margin: 10, padding: 10, backgroundColor: '#2A0A0A',
                 borderRadius: 8, borderWidth: 1, borderColor: C.danger },
  errorText:   { flex: 1, color: C.danger, fontSize: 12 },

  // Scores
  scoreBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                 paddingHorizontal: 16, paddingVertical: 12,
                 backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  scoreItem:   { alignItems: 'center', gap: 2 },
  scoreLabel:  { color: C.muted, fontSize: 11 },
  scoreValue:  { color: C.cream, fontSize: 24, fontWeight: '800' },
  myScore:     { color: C.greenLight },
  turnIndicator: { alignItems: 'center' },
  yourTurn:    { color: C.greenLight, fontSize: 13, fontWeight: '700' },
  oppTurn:     { color: C.muted, fontSize: 13 },

  // Timer
  timerBar:  { height: 28, backgroundColor: C.surfaceHigh, marginHorizontal: 16,
               marginTop: 8, borderRadius: 8, overflow: 'hidden',
               borderWidth: 1, borderColor: C.border, justifyContent: 'center',
               alignItems: 'center' },
  timerFill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', opacity: 0.15 },
  timerText: { fontSize: 13, fontWeight: '700' },

  // Plateau
  boardContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 12,
                    paddingVertical: 8, gap: 4 },
  rowLabel:       { paddingHorizontal: 4, paddingVertical: 2 },
  rowLabelText:   { color: C.muted, fontSize: 11, fontWeight: '600' },

  row:       { flexDirection: 'row', justifyContent: 'space-around',
               paddingVertical: 10, paddingHorizontal: 6,
               borderRadius: 14, borderWidth: 1, borderColor: C.border },
  myRowBg:   { backgroundColor: C.myRow },
  oppRowBg:  { backgroundColor: C.oppRow },
  divider:   { height: 1, backgroundColor: C.border, marginVertical: 4 },

  // Trou
  hole:           { width: 52, height: 52, borderRadius: 26,
                    backgroundColor: C.emptyHole, alignItems: 'center',
                    justifyContent: 'center', borderWidth: 1, borderColor: C.border,
                    gap: 2 },
  holeOpp:        { opacity: 0.8 },
  holeMy:         { backgroundColor: '#0D1F10' },
  holeActive:     { backgroundColor: C.activeHole, borderColor: C.greenLight,
                    borderWidth: 2, shadowColor: C.greenLight,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
  holeEmpty:      { opacity: 0.3 },
  holeLastMove:   { borderColor: C.gold, borderWidth: 2 },
  holeSeeds:      { color: C.cream, fontSize: 16, fontWeight: '800' },
  holeSeedsActive:{ color: C.white },

  // Points graines
  dotsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
              width: 36, gap: 1, marginTop: 1 },
  dot:      { width: 4, height: 4, borderRadius: 2 },
  dotMore:  { fontSize: 8, fontWeight: '700' },

  // Bouton fermer
  closeBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 52 : 16, right: 16,
              zIndex: 99, width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center',
              justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  moveInfo:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 16, paddingVertical: 8,
                  borderTopWidth: 1, borderTopColor: C.border },
  moveInfoText: { color: C.muted, fontSize: 12 },
  reconnecting: { color: C.danger, fontSize: 12 },

  // Game over
  gameOverBox:   { flex: 1, justifyContent: 'center', alignItems: 'center',
                   backgroundColor: C.bg, gap: 16, padding: 32 },
  gameOverEmoji: { fontSize: 64 },
  gameOverTitle: { fontSize: 32, fontWeight: '900' },
  winColor:      { color: C.greenLight },
  loseColor:     { color: C.danger },
  drawColor:     { color: C.gold },
  gameOverReason:{ color: C.muted, fontSize: 14 },
  finalScores:   { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  scoreSep:      { color: C.muted, fontSize: 24, fontWeight: '800' },
  scoreBox:      { alignItems: 'center', backgroundColor: C.surface,
                   borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border,
                   minWidth: 90 },
  scoreBoxHighlight:      { borderColor: C.greenLight, backgroundColor: '#0D2A14' },
  scoreBoxLabel:          { color: C.muted, fontSize: 12, marginBottom: 6 },
  scoreBoxValue:          { color: C.cream, fontSize: 28, fontWeight: '900' },
  scoreBoxValueHighlight: { color: C.greenLight },
  doneBtn:     { marginTop: 24, paddingVertical: 14, paddingHorizontal: 48,
                 backgroundColor: C.green, borderRadius: 14 },
  doneBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
})
