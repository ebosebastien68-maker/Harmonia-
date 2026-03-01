/**
 * TabDames.tsx — Interface de jeu Dames en temps réel
 *
 * FLUX :
 *   1. Connexion → join_match
 *   2. status=prep → compte à rebours préparation
 *   3. status=playing → jeu avec sélection pièce + mouvements valides
 *   4. Captures en chaîne → même joueur rejoue
 *   5. ≤4 pions chacun → SUDDEN DEATH (premier à 8 captures)
 *   6. status=finished → victoire ou défaite
 *
 * PLATEAU :
 *   • Rouge (player1) toujours en BAS
 *   • Noir  (player2) toujours en HAUT
 *   • Cases sombres jouables (row+col impair)
 *   • Dame = pièce avec couronne ♔
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Platform, ScrollView,
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
  bg:           '#0A0A0A',
  surface:      '#141414',
  surfaceHigh:  '#1C1C1C',
  border:       '#2A2A2A',
  cream:        '#E8E0D0',
  muted:        '#666666',
  danger:       '#E74C3C',
  white:        '#FFFFFF',
  gold:         '#C9A84C',
  // Plateau
  darkSquare:   '#2C1810',   // case sombre jouable
  lightSquare:  '#8B6914',   // case claire décorative
  darkSqActive: '#1A0D08',
  // Pièces
  redPiece:     '#CC2200',
  redBright:    '#FF3311',
  redDark:      '#8B1500',
  blackPiece:   '#1A1A1A',
  blackBright:  '#333333',
  blackDark:    '#0A0A0A',
  // Sélection & moves
  selected:     '#FFD700',
  validMove:    '#00CC44',
  validCapture: '#FF6600',
  // Sudden death
  sdOrange:     '#FF6B00',
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Color   = 'red' | 'black'
type Cell    = { color: Color; king: boolean } | null
type Board   = Cell[][]

interface GameState {
  match_id:              string
  board:                 Board
  scores:                { red: number; black: number }
  current_player_id:     string | null
  timer_ends_at:         string | null
  prep_ends_at:          string | null
  status:                'waiting' | 'prep' | 'playing' | 'finished'
  winner_id:             string | null
  end_reason:            string | null
  move_count:            number
  sudden_death:          boolean
  sudden_death_captures: { red: number; black: number }
  sudden_death_target:   number
  player1_id:            string | null
  player2_id:            string | null
  player1_name:          string | null
  player2_name:          string | null
  player1_color:         'red'
  player2_color:         'black'
  color_map:             Record<string, Color>
}

interface ValidMove {
  to:          { row: number; col: number }
  isCapture:   boolean
  capturedAt?: { row: number; col: number }
}

interface TabDamesProps {
  matchId:     string
  userId:      string
  accessToken: string
  onBack?:     () => void
}

// ─── Calcul mouvements valides (côté frontend — affichage uniquement) ─────────
function getValidMoves(board: Board, row: number, col: number): ValidMove[] {
  const piece = board[row]?.[col]
  if (!piece) return []

  const moves: ValidMove[] = []
  const dirs = piece.king
    ? [[-1,-1],[-1,1],[1,-1],[1,1]]
    : piece.color === 'red'
      ? [[-1,-1],[-1,1]]
      : [[1,-1],[1,1]]

  for (const [dr, dc] of dirs) {
    const nr = row + dr
    const nc = col + dc
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue

    if (!board[nr][nc]) {
      moves.push({ to: { row: nr, col: nc }, isCapture: false })
    } else if (board[nr][nc]!.color !== piece.color) {
      const jr = nr + dr
      const jc = nc + dc
      if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !board[jr][jc]) {
        moves.push({ to: { row: jr, col: jc }, isCapture: true, capturedAt: { row: nr, col: nc } })
      }
    }
  }
  return moves
}

// ─── Composant principal ─────────────────────────────────────────────────────
export default function TabDames({ matchId, userId, accessToken, onBack }: TabDamesProps) {

  const [gameState,    setGameState]    = useState<GameState | null>(null)
  const [connected,    setConnected]    = useState(false)
  const [error,        setError]        = useState('')
  const [timeLeft,     setTimeLeft]     = useState<number | null>(null)
  const [prepTimeLeft, setPrepTimeLeft] = useState<number | null>(null)
  const [selected,     setSelected]     = useState<{ row: number; col: number } | null>(null)
  const [validMoves,   setValidMoves]   = useState<ValidMove[]>([])
  const [chainFrom,    setChainFrom]    = useState<{ row: number; col: number } | null>(null)
  const [sdMsg,        setSdMsg]        = useState(false)
  const [gameOver,     setGameOver]     = useState<{
    winner_id: string | null; end_reason: string; scores: any
  } | null>(null)

  const socketRef    = useRef<Socket | null>(null)
  const timerRef     = useRef<NodeJS.Timeout | null>(null)
  const prepTimerRef = useRef<NodeJS.Timeout | null>(null)
  const fadeAnim     = useRef(new Animated.Value(0)).current
  const selectAnim   = useRef(new Animated.Value(1)).current

  // ─── Infos joueur ──────────────────────────────────────────────────────────
  const myColor: Color  = gameState?.player1_id === userId ? 'red' : 'black'
  const isMyTurn        = gameState?.current_player_id === userId && gameState?.status === 'playing'

  // ─── Connexion WebSocket ───────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: NATIVE }).start()

    const socket = socketIO(`${BACKEND_URL}/dames`, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setError('')
      console.log('[TabDames] Connecté:', socket.id)
      socket.emit('join_match', { match_id: matchId, user_id: userId, access_token: accessToken })
    })

    socket.on('disconnect', () => {
      setConnected(false)
      console.log('[TabDames] Déconnecté')
    })

    socket.on('connect_error', () => {
      setError('Impossible de se connecter au serveur')
    })

    socket.on('game_state', (state: GameState) => {
      console.log(`[TabDames] game_state | status=${state.status} | current=${state.current_player_id}`)
      setGameState(state)
      setSelected(null)
      setValidMoves([])
      setChainFrom(null)

      if (state.status === 'prep') {
        startLocalPrepTimer(state.prep_ends_at)
        clearLocalTurnTimer()
      } else if (state.status === 'playing') {
        startLocalTurnTimer(state.timer_ends_at)
        clearLocalPrepTimer()
      } else {
        clearLocalTurnTimer()
        clearLocalPrepTimer()
      }
    })

    socket.on('prep_started', (data: { prep_ends_at: string }) => {
      haptic.light()
      startLocalPrepTimer(data.prep_ends_at)
    })

    socket.on('game_started', () => {
      haptic.success()
      setSdMsg(false)
      clearLocalPrepTimer()
    })

    socket.on('chain_capture', (data: { from: { row: number; col: number } }) => {
      haptic.medium()
      setChainFrom(data.from)
    })

    socket.on('sudden_death_started', () => {
      haptic.medium()
      setSdMsg(true)
      setTimeout(() => setSdMsg(false), 5000)
    })

    socket.on('game_over', (data: any) => {
      setGameOver(data)
      clearLocalTurnTimer()
      clearLocalPrepTimer()
      setSelected(null)
      setValidMoves([])
      data.winner_id === userId ? haptic.success() : haptic.error()
    })

    socket.on('error', (data: { message: string }) => {
      setError(data.message)
      haptic.error()
    })

    return () => {
      clearLocalTurnTimer()
      clearLocalPrepTimer()
      socket.disconnect()
    }
  }, [matchId, userId, accessToken])

  // ─── Timers locaux ─────────────────────────────────────────────────────────
  const startLocalTurnTimer = useCallback((endsAt: string | null) => {
    clearLocalTurnTimer()
    if (!endsAt) return
    const update = () => {
      const diff = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000))
      setTimeLeft(diff)
      if (diff > 0) timerRef.current = setTimeout(update, 200)
    }
    update()
  }, [])

  const clearLocalTurnTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setTimeLeft(null)
  }, [])

  const startLocalPrepTimer = useCallback((endsAt: string | null) => {
    clearLocalPrepTimer()
    if (!endsAt) return
    const update = () => {
      const diff = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000))
      setPrepTimeLeft(diff)
      if (diff > 0) prepTimerRef.current = setTimeout(update, 200)
    }
    update()
  }, [])

  const clearLocalPrepTimer = useCallback(() => {
    if (prepTimerRef.current) { clearTimeout(prepTimerRef.current); prepTimerRef.current = null }
    setPrepTimeLeft(null)
  }, [])

  // ─── Sélection / jeu ───────────────────────────────────────────────────────
  const handleCellPress = useCallback((row: number, col: number) => {
    if (!isMyTurn || !gameState) return
    const board = gameState.board

    // En capture en chaîne → seule la pièce chainFrom peut jouer
    if (chainFrom) {
      if (row !== chainFrom.row || col !== chainFrom.col) {
        // Si c'est une destination valide
        const move = validMoves.find(m => m.to.row === row && m.to.col === col)
        if (move) {
          sendMove(chainFrom, move.to)
        }
        return
      }
    }

    // Si une pièce est déjà sélectionnée
    if (selected) {
      // Cliquer sur une destination valide → jouer
      const move = validMoves.find(m => m.to.row === row && m.to.col === col)
      if (move) {
        sendMove(selected, move.to)
        return
      }

      // Cliquer sur une autre de nos pièces → changer sélection
      if (board[row]?.[col]?.color === myColor) {
        selectPiece(row, col, board)
        return
      }

      // Désélectionner
      setSelected(null)
      setValidMoves([])
      return
    }

    // Sélectionner une pièce
    if (board[row]?.[col]?.color === myColor) {
      selectPiece(row, col, board)
    }
  }, [isMyTurn, gameState, selected, validMoves, chainFrom, myColor])

  const selectPiece = useCallback((row: number, col: number, board: Board) => {
    haptic.light()
    setSelected({ row, col })
    const moves = getValidMoves(board, row, col)
    setValidMoves(moves)
    setError('')
    Animated.sequence([
      Animated.timing(selectAnim, { toValue: 1.1, duration: 80, useNativeDriver: NATIVE }),
      Animated.timing(selectAnim, { toValue: 1.0, duration: 80, useNativeDriver: NATIVE }),
    ]).start()
  }, [selectAnim])

  const sendMove = useCallback((from: { row: number; col: number }, to: { row: number; col: number }) => {
    haptic.medium()
    setSelected(null)
    setValidMoves([])
    setError('')
    socketRef.current?.emit('play', { from, to })
  }, [])

  // ─── États d'attente ───────────────────────────────────────────────────────
  if (!connected || !gameState) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.redBright} />
        <Text style={styles.loadingText}>
          {!connected ? 'Connexion au serveur…' : 'Chargement de la partie…'}
        </Text>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  if (gameState.status === 'waiting' || gameState.status === 'prep') {
    return (
      <View style={styles.centered}>
        {onBack && (
          <TouchableOpacity style={styles.closeBtn} onPress={onBack}>
            <Ionicons name="close" size={20} color={C.cream} />
          </TouchableOpacity>
        )}
        <Text style={styles.prepEmoji}>♟️</Text>
        <Text style={styles.prepTitle}>Préparation</Text>
        <Text style={styles.prepSubtitle}>La partie commence dans</Text>
        <View style={styles.prepCountdown}>
          <Text style={styles.prepCountdownNumber}>{prepTimeLeft !== null ? prepTimeLeft : '…'}</Text>
          <Text style={styles.prepCountdownUnit}>secondes</Text>
        </View>
        <Text style={styles.prepHint}>Rouge joue en premier</Text>
      </View>
    )
  }

  if (gameOver || gameState.status === 'finished') {
    const result = gameOver ?? {
      winner_id:  gameState.winner_id,
      end_reason: gameState.end_reason ?? '',
      scores:     gameState.scores,
    }
    const iWon     = result.winner_id === userId
    const myScore  = result.scores?.[myColor] ?? 0
    const oppColor: Color = myColor === 'red' ? 'black' : 'red'
    const oppScore = result.scores?.[oppColor] ?? 0
    const oppName  = gameState.player1_id === userId
      ? (gameState.player2_name || 'Adversaire')
      : (gameState.player1_name || 'Adversaire')

    const reasonLabel: Record<string, string> = {
      timeout:      'Temps écoulé',
      no_pieces:    'Plus de pièces',
      no_moves:     'Aucun mouvement possible',
      sudden_death: `${gameState.sudden_death_target} captures atteintes`,
    }

    return (
      <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
        <View style={styles.gameOverBox}>
          <Text style={styles.gameOverEmoji}>{iWon ? '🏆' : '💔'}</Text>
          <Text style={[styles.gameOverTitle, iWon ? styles.winColor : styles.loseColor]}>
            {iWon ? 'Victoire !' : 'Défaite'}
          </Text>
          <Text style={styles.gameOverReason}>
            {reasonLabel[result.end_reason] || result.end_reason}
          </Text>
          {gameState.sudden_death && (
            <View style={styles.sdBadge}>
              <Text style={styles.sdBadgeText}>⚡ Sudden Death</Text>
            </View>
          )}
          <View style={styles.colorIndicator}>
            <View style={[styles.colorDot, { backgroundColor: myColor === 'red' ? C.redPiece : C.blackBright }]} />
            <Text style={styles.colorLabel}>Vous jouez les {myColor === 'red' ? 'Rouges' : 'Noirs'}</Text>
          </View>
          {gameState.sudden_death && (
            <View style={styles.finalScores}>
              <ScoreBox value={myScore}  label="Captures"    highlight={iWon} />
              <Text style={styles.scoreSep}>—</Text>
              <ScoreBox value={oppScore} label={oppName}     highlight={!iWon} />
            </View>
          )}
          {onBack && (
            <TouchableOpacity style={styles.doneBtn} onPress={onBack}>
              <Text style={styles.doneBtnText}>Terminer</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    )
  }

  // ─── Jeu en cours ──────────────────────────────────────────────────────────
  const board    = gameState.board
  const isPlayer1 = gameState.player1_id === userId
  const myName   = isPlayer1 ? (gameState.player1_name || 'Vous') : (gameState.player2_name || 'Vous')
  const oppName  = isPlayer1 ? (gameState.player2_name || 'Adversaire') : (gameState.player1_name || 'Adversaire')

  // Rouge = player1 = bas → afficher tel quel
  // Noir  = player2 = haut → inverser le plateau pour qu'il voie aussi ses pièces en bas
  const displayBoard = myColor === 'black'
    ? [...board].reverse().map(row => [...row].reverse())
    : board

  const toActualCoords = (displayRow: number, displayCol: number): { row: number; col: number } => {
    if (myColor === 'black') {
      return { row: 7 - displayRow, col: 7 - displayCol }
    }
    return { row: displayRow, col: displayCol }
  }

  const myCaptures  = gameState.sudden_death_captures?.[myColor] ?? 0
  const oppCaptures = gameState.sudden_death_captures?.[myColor === 'red' ? 'black' : 'red'] ?? 0
  const sdTarget    = gameState.sudden_death_target ?? 8

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>

      {onBack && (
        <TouchableOpacity style={styles.closeBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={C.cream} />
        </TouchableOpacity>
      )}

      {/* ── Sudden Death banner ── */}
      {sdMsg && (
        <View style={styles.sdBanner}>
          <Text style={styles.sdBannerText}>⚡ Sudden Death — Premier à {sdTarget} captures gagne !</Text>
        </View>
      )}
      {gameState.sudden_death && !sdMsg && (
        <View style={styles.sdSmall}>
          <Text style={styles.sdSmallText}>⚡ Sudden Death — {myCaptures}/{sdTarget} captures</Text>
        </View>
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

      {/* ── Barre scores ── */}
      <View style={styles.scoreBar}>
        <PlayerInfo
          name={oppName}
          color={myColor === 'red' ? 'black' : 'red'}
          isTurn={!isMyTurn}
          captures={gameState.sudden_death ? oppCaptures : undefined}
          sdTarget={gameState.sudden_death ? sdTarget : undefined}
        />
        <View style={styles.turnCenter}>
          <Text style={isMyTurn ? styles.yourTurn : styles.oppTurn}>
            {isMyTurn ? '🟢 Votre tour' : '⏳ Tour adverse'}
          </Text>
          {chainFrom && isMyTurn && (
            <Text style={styles.chainText}>🔗 Capture en chaîne !</Text>
          )}
        </View>
        <PlayerInfo
          name={myName}
          color={myColor}
          isTurn={isMyTurn}
          captures={gameState.sudden_death ? myCaptures : undefined}
          sdTarget={gameState.sudden_death ? sdTarget : undefined}
          isMe
        />
      </View>

      {/* ── Timer ── */}
      {timeLeft !== null && (
        <View style={styles.timerBar}>
          <View style={[
            styles.timerFill,
            { backgroundColor: timeLeft <= 5 ? C.danger : C.redBright, opacity: 0.15 }
          ]} />
          <Text style={[styles.timerText, { color: timeLeft <= 5 ? C.danger : C.cream }]}>
            {timeLeft}s
          </Text>
        </View>
      )}

      {/* ── Légende couleur ── */}
      <View style={styles.colorHint}>
        <View style={[styles.colorDotSmall, { backgroundColor: myColor === 'red' ? C.redPiece : C.blackBright }]} />
        <Text style={styles.colorHintText}>Vous êtes les {myColor === 'red' ? 'Rouges ↓' : 'Noirs ↓'}</Text>
      </View>

      {/* ── Plateau 8×8 ── */}
      <View style={styles.boardWrapper}>
        {/* Colonnes A-H */}
        <View style={styles.colLabels}>
          {(myColor === 'black' ? ['H','G','F','E','D','C','B','A'] : ['A','B','C','D','E','F','G','H']).map(l => (
            <Text key={l} style={styles.colLabel}>{l}</Text>
          ))}
        </View>

        <View style={styles.boardRow}>
          {/* Lignes 8-1 */}
          <View style={styles.rowLabels}>
            {(myColor === 'black' ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1]).map(n => (
              <Text key={n} style={styles.rowLabel}>{n}</Text>
            ))}
          </View>

          <View style={styles.board}>
            {displayBoard.map((rowArr, displayRow) => (
              <View key={displayRow} style={styles.boardRowLine}>
                {rowArr.map((cell, displayCol) => {
                  const actual       = toActualCoords(displayRow, displayCol)
                  const isDark       = (actual.row + actual.col) % 2 === 1
                  const isSelected   = selected?.row === actual.row && selected?.col === actual.col
                  const isChainPiece = chainFrom?.row === actual.row && chainFrom?.col === actual.col
                  const validMove    = validMoves.find(m => m.to.row === actual.row && m.to.col === actual.col)
                  const isValidDest  = !!validMove

                  if (!isDark) {
                    return <View key={displayCol} style={[styles.cell, styles.lightCell]} />
                  }

                  return (
                    <TouchableOpacity
                      key={displayCol}
                      style={[
                        styles.cell,
                        styles.darkCell,
                        isSelected   && styles.cellSelected,
                        isChainPiece && styles.cellChain,
                        isValidDest  && !cell && (validMove?.isCapture ? styles.cellCapture : styles.cellValidMove),
                      ]}
                      onPress={() => handleCellPress(actual.row, actual.col)}
                      activeOpacity={0.7}
                      disabled={
                        !isMyTurn ||
                        (!cell && !isValidDest) ||
                        (!!cell && cell.color !== myColor && !isValidDest)
                      }
                    >
                      {/* Indicateur mouvement valide (case vide) */}
                      {isValidDest && !cell && (
                        <View style={[
                          styles.moveDot,
                          { backgroundColor: validMove?.isCapture ? C.validCapture : C.validMove }
                        ]} />
                      )}

                      {/* Pièce */}
                      {cell && (
                        <View style={[
                          styles.piece,
                          cell.color === 'red' ? styles.redPiece : styles.blackPiece,
                          isSelected   && styles.pieceSelected,
                          isChainPiece && styles.pieceChain,
                          isValidDest  && !!cell && styles.pieceCapturable,
                        ]}>
                          {cell.king && (
                            <Text style={[
                              styles.kingSymbol,
                              { color: cell.color === 'red' ? '#FFD700' : '#FFD700' }
                            ]}>♔</Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Pied de page ── */}
      <View style={styles.footer}>
        <Text style={styles.moveCount}>Coup #{gameState.move_count + 1}</Text>
        {!connected && <Text style={styles.reconnecting}>⚠ Reconnexion…</Text>}
        {selected && isMyTurn && (
          <Text style={styles.selectionHint}>
            {validMoves.length > 0
              ? `${validMoves.length} mouvement${validMoves.length > 1 ? 's' : ''} possible${validMoves.length > 1 ? 's' : ''}`
              : 'Aucun mouvement possible'}
          </Text>
        )}
      </View>

    </Animated.View>
  )
}

// ─── Composant info joueur ───────────────────────────────────────────────────
function PlayerInfo({
  name, color, isTurn, captures, sdTarget, isMe
}: {
  name: string; color: Color; isTurn: boolean
  captures?: number; sdTarget?: number; isMe?: boolean
}) {
  return (
    <View style={[styles.playerInfo, isMe && styles.playerInfoMe]}>
      <View style={[styles.pieceIndicator, {
        backgroundColor: color === 'red' ? C.redPiece : C.blackBright,
        borderColor:     isTurn ? C.gold : 'transparent',
        borderWidth:     isTurn ? 2 : 0,
      }]} />
      <View>
        <Text style={styles.playerName} numberOfLines={1}>{name}</Text>
        {captures !== undefined && sdTarget !== undefined && (
          <Text style={styles.playerCaptures}>{captures}/{sdTarget} cap.</Text>
        )}
      </View>
    </View>
  )
}

// ─── Boîte score fin de partie ───────────────────────────────────────────────
function ScoreBox({ value, label, highlight }: { value: number; label: string; highlight: boolean }) {
  return (
    <View style={[styles.scoreBox, highlight && styles.scoreBoxHighlight]}>
      <Text style={styles.scoreBoxLabel}>{label}</Text>
      <Text style={[styles.scoreBoxValue, highlight && styles.scoreBoxValueHL]}>{value}</Text>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const CELL_SIZE = Math.min(Math.floor((Platform.OS === 'web' ? 480 : 340) / 8), 48)

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, padding: 32, gap: 16 },

  loadingText: { color: C.muted, fontSize: 14, marginTop: 12 },
  backBtn:     { marginTop: 20, paddingVertical: 12, paddingHorizontal: 32, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  backBtnText: { color: C.cream, fontSize: 14, fontWeight: '600' },
  closeBtn:    { position: 'absolute', top: Platform.OS === 'ios' ? 52 : 16, right: 16, zIndex: 99, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },

  // Prep
  prepEmoji:           { fontSize: 56 },
  prepTitle:           { color: C.cream, fontSize: 26, fontWeight: '800' },
  prepSubtitle:        { color: C.muted, fontSize: 14 },
  prepCountdown:       { alignItems: 'center', marginVertical: 8 },
  prepCountdownNumber: { color: C.redBright, fontSize: 72, fontWeight: '900', lineHeight: 80 },
  prepCountdownUnit:   { color: C.muted, fontSize: 14 },
  prepHint:            { color: C.muted, fontSize: 13, textAlign: 'center' },

  // Sudden death
  sdBanner:     { backgroundColor: '#2A1000', paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.sdOrange },
  sdBannerText: { color: C.sdOrange, fontSize: 14, fontWeight: '800' },
  sdSmall:      { backgroundColor: '#1A0A00', paddingVertical: 5, paddingHorizontal: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#3A1A00' },
  sdSmallText:  { color: C.sdOrange, fontSize: 11, fontWeight: '600' },
  sdBadge:      { backgroundColor: '#1A0A00', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.sdOrange },
  sdBadgeText:  { color: C.sdOrange, fontSize: 13, fontWeight: '700' },

  // Erreur
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 8, padding: 10, backgroundColor: '#2A0A0A', borderRadius: 8, borderWidth: 1, borderColor: C.danger },
  errorText:   { flex: 1, color: C.danger, fontSize: 12 },

  // Score bar
  scoreBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  turnCenter:  { alignItems: 'center', gap: 2 },
  yourTurn:    { color: '#44DD66', fontSize: 12, fontWeight: '700' },
  oppTurn:     { color: C.muted, fontSize: 12 },
  chainText:   { color: C.validCapture, fontSize: 11, fontWeight: '700' },

  // Player info
  playerInfo:      { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 100 },
  playerInfoMe:    { flexDirection: 'row-reverse' },
  pieceIndicator:  { width: 20, height: 20, borderRadius: 10 },
  playerName:      { color: C.cream, fontSize: 12, fontWeight: '600' },
  playerCaptures:  { color: C.sdOrange, fontSize: 11, fontWeight: '700' },

  // Timer
  timerBar:  { height: 26, backgroundColor: C.surfaceHigh, marginHorizontal: 12, marginTop: 6, borderRadius: 7, overflow: 'hidden', borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  timerFill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%' },
  timerText: { fontSize: 12, fontWeight: '700' },

  // Légende couleur
  colorHint:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4 },
  colorDotSmall: { width: 12, height: 12, borderRadius: 6 },
  colorHintText: { color: C.muted, fontSize: 11 },

  // Plateau
  boardWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  colLabels:    { flexDirection: 'row', paddingLeft: 18, marginBottom: 2 },
  colLabel:     { width: CELL_SIZE, textAlign: 'center', color: C.muted, fontSize: 10 },
  boardRow:     { flexDirection: 'row' },
  rowLabels:    { justifyContent: 'space-around', marginRight: 2, width: 16 },
  rowLabel:     { color: C.muted, fontSize: 10, lineHeight: CELL_SIZE },
  board:        { borderWidth: 2, borderColor: C.border, borderRadius: 4, overflow: 'hidden' },
  boardRowLine: { flexDirection: 'row' },

  // Cellules
  cell:            { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  lightCell:       { backgroundColor: C.lightSquare },
  darkCell:        { backgroundColor: C.darkSquare },
  cellSelected:    { backgroundColor: '#3A2800', borderWidth: 2, borderColor: C.selected },
  cellChain:       { backgroundColor: '#3A1800', borderWidth: 2, borderColor: C.validCapture },
  cellValidMove:   { backgroundColor: '#0A2A10' },
  cellCapture:     { backgroundColor: '#2A1000' },
  pieceCapturable: { opacity: 0.5 },

  // Point de mouvement valide
  moveDot: { width: CELL_SIZE * 0.35, height: CELL_SIZE * 0.35, borderRadius: CELL_SIZE * 0.175, opacity: 0.8 },

  // Pièces
  piece: {
    width: CELL_SIZE * 0.78,
    height: CELL_SIZE * 0.78,
    borderRadius: CELL_SIZE * 0.39,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 4,
  },
  redPiece:     { backgroundColor: C.redPiece, borderWidth: 2, borderColor: C.redBright, shadowColor: C.redDark },
  blackPiece:   { backgroundColor: C.blackPiece, borderWidth: 2, borderColor: C.blackBright, shadowColor: '#000' },
  pieceSelected:{ borderColor: C.selected, borderWidth: 3, shadowColor: C.selected, shadowOpacity: 0.8 },
  pieceChain:   { borderColor: C.validCapture, borderWidth: 3 },
  kingSymbol:   { fontSize: CELL_SIZE * 0.36, fontWeight: '900', lineHeight: CELL_SIZE * 0.42 },

  // Couleur
  colorDot:   { width: 16, height: 16, borderRadius: 8 },
  colorLabel: { color: C.muted, fontSize: 13 },
  colorIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },

  // Footer
  footer:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  moveCount:      { color: C.muted, fontSize: 12 },
  reconnecting:   { color: C.danger, fontSize: 12 },
  selectionHint:  { color: C.gold, fontSize: 12, fontWeight: '600' },

  // Game over
  gameOverBox:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, gap: 16, padding: 32 },
  gameOverEmoji:        { fontSize: 64 },
  gameOverTitle:        { fontSize: 32, fontWeight: '900' },
  winColor:             { color: '#44DD66' },
  loseColor:            { color: C.danger },
  gameOverReason:       { color: C.muted, fontSize: 14 },
  finalScores:          { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  scoreSep:             { color: C.muted, fontSize: 24, fontWeight: '800' },
  scoreBox:             { alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, minWidth: 90 },
  scoreBoxHighlight:    { borderColor: '#44DD66', backgroundColor: '#0A1F0A' },
  scoreBoxLabel:        { color: C.muted, fontSize: 12, marginBottom: 6 },
  scoreBoxValue:        { color: C.cream, fontSize: 28, fontWeight: '900' },
  scoreBoxValueHL:      { color: '#44DD66' },
  doneBtn:     { marginTop: 24, paddingVertical: 14, paddingHorizontal: 48, backgroundColor: C.redPiece, borderRadius: 14 },
  doneBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
})
