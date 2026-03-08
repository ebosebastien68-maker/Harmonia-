/**
 * AdminCommunity.tsx — v5
 *
 * CORRECTIFS v5 :
 *   • [BUG CRITIQUE] UserSearchExact extrait HORS de AdminCommunity
 *     → Avant : défini à l'intérieur → nouveau type à chaque render → démontage/remontage
 *       → TextInput perdait le focus à chaque frappe → recherche impossible
 *   • UserSearchExact reçoit tout son état en props (pickNom, pickPrenom, etc.)
 *   • setPickMsg + setPickResults ajoutés aux props (utilisés dans onChangeText)
 *   • animationType conditionné Platform.OS (web = 'none')
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, Alert, Switch, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

const SLIDE = Platform.OS === 'web' ? 'none' : 'slide';
const FADE  = Platform.OS === 'web' ? 'none' : 'fade';

const C = {
  bg: '#F5F0FA', surface: '#FFFFFF', border: '#E0D5F0',
  purple: '#7C3AED', purpleL: '#A855F7', gold: '#D97706',
  danger: '#DC2626', muted: '#6B7280', text: '#111827',
  soft: '#374151', green: '#059669', blue: '#2563EB',
};

type Section = 'groups' | 'notifications' | 'trophies' | 'settings';

interface Group       { id: string; name: string; description?: string | null; created_at: string; member_count: number }
interface GroupMember { member_row_id: string; user_id: string; joined_at: string; nom: string; prenom: string }
interface UserProfile { id: string; nom: string; prenom: string; role: string; trophies_count: number }
interface Notification {
  id: string; type: 'global' | 'targeted'; title: string; content: string;
  is_read: boolean; created_at: string;
  sender: { nom: string; prenom: string } | null;
  target: { nom: string; prenom: string } | null;
  target_user_id: string | null;
}
interface Trophy {
  id: string; title: string; description: string | null;
  reason: string | null; awarded_at: string;
  awarder: { nom: string; prenom: string } | null;
}
interface GameSession  { id: string; title: string; description?: string | null; is_paid: boolean; price_cfa: number; is_open: boolean; created_at: string }
interface GameWithSessions { id: string; key_name: string; title: string; sessions: GameSession[] }
interface AppSettings  { registrations_open: boolean; registrations_message: string; updated_at: string }

// ─────────────────────────────────────────────────────────────────────────────
// UserSearchExact — COMPOSANT EXTRAIT (hors de AdminCommunity)
// CORRECTIF : était défini à l'intérieur → chaque setState du parent recréait
// un nouveau type de composant → React démontait/remontait → focus perdu à chaque frappe
// ─────────────────────────────────────────────────────────────────────────────
interface UserSearchExactProps {
  pickNom:       string;
  setPickNom:    (v: string) => void;
  pickPrenom:    string;
  setPickPrenom: (v: string) => void;
  pickResults:   UserProfile[];
  setPickResults:(v: UserProfile[]) => void;
  pickLoading:   boolean;
  pickMsg:       { type: 'ok' | 'err'; text: string } | null;
  setPickMsg:    (v: { type: 'ok' | 'err'; text: string } | null) => void;
  onSearch:      () => void;
  onSelect:      (u: UserProfile) => void;
  showTrophies?: boolean;
  actionLoading?: string | null;
}

function UserSearchExact({
  pickNom, setPickNom, pickPrenom, setPickPrenom,
  pickResults, setPickResults, pickLoading, pickMsg, setPickMsg,
  onSearch, onSelect, showTrophies, actionLoading: al,
}: UserSearchExactProps) {
  return (
    <View>
      <View style={S.pickFieldRow}>
        <View style={[S.searchBar, { flex: 1 }]}>
          <TextInput
            style={{ flex: 1, fontSize: 14, color: C.text }}
            placeholder="Prénom exact"
            placeholderTextColor={C.muted}
            value={pickPrenom}
            onChangeText={t => { setPickPrenom(t); setPickMsg(null); setPickResults([]); }}
            autoCapitalize="words"
          />
        </View>
        <View style={[S.searchBar, { flex: 1 }]}>
          <TextInput
            style={{ flex: 1, fontSize: 14, color: C.text }}
            placeholder="Nom exact"
            placeholderTextColor={C.muted}
            value={pickNom}
            onChangeText={t => { setPickNom(t); setPickMsg(null); setPickResults([]); }}
            autoCapitalize="words"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[S.btnSearch, { marginTop: 8, alignSelf: 'flex-end' }, pickLoading && S.btnDisabled]}
        onPress={onSearch}
        disabled={pickLoading}
      >
        {pickLoading
          ? <ActivityIndicator size="small" color="#FFF" />
          : <><Ionicons name="search" size={14} color="#FFF" /><Text style={S.btnSearchTxt}> Rechercher</Text></>}
      </TouchableOpacity>

      {pickMsg && (
        <View style={[S.feedbackRow, { marginTop: 8 }]}>
          <Ionicons
            name={pickMsg.type === 'ok' ? 'checkmark-circle' : 'alert-circle'}
            size={15}
            color={pickMsg.type === 'ok' ? C.green : C.danger}
          />
          <Text style={[S.feedbackTxt, { color: pickMsg.type === 'ok' ? C.green : C.danger }]}>
            {pickMsg.text}
          </Text>
        </View>
      )}

      {pickResults.length > 0 && (
        <View style={[S.pickList, { marginTop: 10 }]}>
          {pickResults.map(u => (
            <TouchableOpacity
              key={u.id} style={S.pickItem}
              onPress={() => onSelect(u)}
              disabled={al === `add-${u.id}`}
            >
              <View style={S.pickAvatar}>
                <Text style={S.pickAvatarTxt}>{u.prenom.charAt(0)}{u.nom.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.pickName}>{u.prenom} {u.nom}</Text>
                <Text style={S.pickMeta}>
                  {u.role}{showTrophies ? ` · 🏆 ${u.trophies_count}` : ''}
                </Text>
              </View>
              {al === `add-${u.id}`
                ? <ActivityIndicator size="small" color={C.purple} />
                : <Ionicons name="chevron-forward" size={16} color={C.muted} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const GAME_ICONS: Record<string, { icon: string; colors: [string, string] }> = {
  arts:        { icon: 'color-palette',   colors: ['#EC4899', '#BE185D'] },
  performance: { icon: 'flash',           colors: ['#6366F1', '#4F46E5'] },
  music:       { icon: 'musical-notes',   colors: ['#06B6D4', '#0891B2'] },
  artisanat:   { icon: 'hammer',          colors: ['#92400E', '#78350F'] },
  awale:       { icon: 'grid',            colors: ['#10B981', '#059669'] },
  dames:       { icon: 'apps',            colors: ['#3B82F6', '#2563EB'] },
  vraioufaux:  { icon: 'help-circle',     colors: ['#F59E0B', '#D97706'] },
};

interface Props { adminEmail: string; adminPassword: string; onBack: () => void }

export default function AdminCommunity({ adminEmail, adminPassword, onBack }: Props) {
  const [section,       setSection]       = useState<Section>('groups');
  const [loading,       setLoading]       = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error,         setError]         = useState('');

  // ── Groupes ───────────────────────────────────────────────────────────────
  const [groups,        setGroups]        = useState<Group[]>([]);
  const [selGroup,      setSelGroup]      = useState<Group | null>(null);
  const [members,       setMembers]       = useState<GroupMember[]>([]);
  const [showGrpForm,   setShowGrpForm]   = useState(false);
  const [editingGrp,    setEditingGrp]    = useState<Group | null>(null);
  const [grpName,       setGrpName]       = useState('');
  const [grpDesc,       setGrpDesc]       = useState('');
  const [showAddMember, setShowAddMember] = useState(false);

  // ── Picker partagé — état remonté ici, passé en props à UserSearchExact ──
  const [pickNom,     setPickNom]     = useState('');
  const [pickPrenom,  setPickPrenom]  = useState('');
  const [pickResults, setPickResults] = useState<UserProfile[]>([]);
  const [pickLoading, setPickLoading] = useState(false);
  const [pickMsg,     setPickMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifications,    setNotifications]    = useState<Notification[]>([]);
  const [showNotifForm,    setShowNotifForm]    = useState(false);
  const [notifType,        setNotifType]        = useState<'global' | 'targeted'>('global');
  const [notifTitle,       setNotifTitle]       = useState('');
  const [notifContent,     setNotifContent]     = useState('');
  const [notifTarget,      setNotifTarget]      = useState<UserProfile | null>(null);
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  // ── Trophées ──────────────────────────────────────────────────────────────
  const [trophyUser,      setTrophyUser]      = useState<UserProfile | null>(null);
  const [trophyTitle,     setTrophyTitle]     = useState('');
  const [trophyDesc,      setTrophyDesc]      = useState('');
  const [userTrophies,    setUserTrophies]    = useState<Trophy[]>([]);
  const [trophiesLoading, setTrophiesLoading] = useState(false);

  // ── Réglages ──────────────────────────────────────────────────────────────
  const [settings,   setSettings]   = useState<AppSettings | null>(null);
  const [regMessage, setRegMessage] = useState('');
  const [games,      setGames]      = useState<GameWithSessions[]>([]);
  const [toggling,   setToggling]   = useState<string | null>(null);

  // ── Modale confirmation ───────────────────────────────────────────────────
  const [confirm, setConfirm] = useState<{
    visible: boolean; title: string; message: string;
    onConfirm: () => void; confirmLabel?: string; danger?: boolean;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const askConfirm = (title: string, message: string, onConfirm: () => void, danger = true) =>
    setConfirm({ visible: true, title, message, onConfirm, danger, confirmLabel: 'Confirmer' });
  const closeConfirm = () => setConfirm(c => ({ ...c, visible: false }));

  // ── API ───────────────────────────────────────────────────────────────────
  const api = useCallback(async (body: Record<string, any>) => {
    const res  = await fetch(`${BACKEND_URL}/admin-community`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.details ? `${data.error} — ${data.details}` : (data?.error || `Erreur ${res.status}`));
    return data;
  }, [adminEmail, adminPassword]);

  // ── Chargements ───────────────────────────────────────────────────────────
  useEffect(() => {
    setError('');
    if (section === 'groups')        loadGroups();
    if (section === 'notifications') loadNotifications();
    if (section === 'settings')      loadSettingsAndSessions();
    if (section === 'trophies')      resetPicker();
  }, [section]);

  const loadGroups = useCallback(async () => {
    setLoading(true); setError('');
    try { const d = await api({ function: 'listGroups' }); setGroups(d.groups || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadMembers = useCallback(async (gid: string) => {
    setLoading(true);
    try { const d = await api({ function: 'listGroupMembers', group_id: gid }); setMembers(d.members || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadNotifications = useCallback(async () => {
    setLoading(true); setError('');
    try { const d = await api({ function: 'listNotifications' }); setNotifications(d.notifications || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadSettingsAndSessions = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [ds, dg] = await Promise.all([
        api({ function: 'getSettings' }),
        api({ function: 'listGameSessions' }),
      ]);
      setSettings(ds.settings);
      setRegMessage(ds.settings?.registrations_message ?? '');
      setGames(dg.games || []);
    }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadUserTrophies = useCallback(async (u: UserProfile) => {
    setTrophiesLoading(true);
    try { const d = await api({ function: 'listTrophies', user_id: u.id }); setUserTrophies(d.trophies || []); }
    catch {}
    finally { setTrophiesLoading(false); }
  }, [api]);

  // ── Recherche exacte ─────────────────────────────────────────────────────
  const resetPicker = () => {
    setPickNom(''); setPickPrenom(''); setPickResults([]); setPickMsg(null);
  };

  const searchExact = useCallback(async () => {
    if (!pickNom.trim() || !pickPrenom.trim()) {
      setPickMsg({ type: 'err', text: 'Saisissez le nom ET le prénom exacts.' });
      return;
    }
    setPickLoading(true); setPickMsg(null); setPickResults([]);
    try {
      const d = await api({ function: 'searchUserExact', nom: pickNom.trim(), prenom: pickPrenom.trim() });
      const users: UserProfile[] = d.users ?? [];
      setPickResults(users);
      if (users.length === 0)
        setPickMsg({ type: 'err', text: `Aucun profil "${pickPrenom.trim()} ${pickNom.trim()}" trouvé.` });
      else
        setPickMsg({ type: 'ok', text: `${users.length} profil(s) trouvé(s).` });
    } catch (e: any) {
      setPickMsg({ type: 'err', text: e.message });
    } finally {
      setPickLoading(false);
    }
  }, [api, pickNom, pickPrenom]);

  // Props partagés pour UserSearchExact — évite de les répéter à chaque usage
  const pickerProps = {
    pickNom, setPickNom,
    pickPrenom, setPickPrenom,
    pickResults, setPickResults,
    pickLoading,
    pickMsg, setPickMsg,
    onSearch: searchExact,
  };

  // ── Actions GROUPES ───────────────────────────────────────────────────────
  const openGroupForm = (g?: Group) => {
    setEditingGrp(g ?? null); setGrpName(g?.name ?? ''); setGrpDesc(g?.description ?? '');
    setShowGrpForm(true);
  };
  const saveGroup = async () => {
    if (!grpName.trim()) return;
    setActionLoading('group-save');
    try {
      if (editingGrp) await api({ function: 'updateGroup', group_id: editingGrp.id, name: grpName, description: grpDesc });
      else            await api({ function: 'createGroup', name: grpName, description: grpDesc });
      setShowGrpForm(false); setEditingGrp(null); await loadGroups();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); }
  };
  const confirmDeleteGroup = (g: Group) => {
    askConfirm('Supprimer le groupe', `Supprimer "${g.name}" et tous ses messages ?`, async () => {
      closeConfirm();
      setActionLoading(`del-grp-${g.id}`);
      try {
        await api({ function: 'deleteGroup', group_id: g.id });
        await loadGroups();
        if (selGroup?.id === g.id) setSelGroup(null);
      }
      catch (e: any) { Alert.alert('Erreur', e.message); }
      finally { setActionLoading(null); }
    });
  };
  const openGroupDetail = async (g: Group) => { setSelGroup(g); await loadMembers(g.id); };
  const removeMember = (m: GroupMember) => {
    askConfirm('Retirer le membre', `Retirer ${m.prenom} ${m.nom} du groupe ?`, async () => {
      closeConfirm();
      setActionLoading(`rm-${m.user_id}`);
      try {
        await api({ function: 'removeGroupMember', group_id: selGroup!.id, user_id: m.user_id });
        await loadMembers(selGroup!.id);
        await loadGroups();
      }
      catch (e: any) { Alert.alert('Erreur', e.message); }
      finally { setActionLoading(null); }
    });
  };
  const addMember = async (u: UserProfile) => {
    setActionLoading(`add-${u.id}`);
    try {
      const d = await api({ function: 'addGroupMember', group_id: selGroup!.id, user_id: u.id });
      if (d.already_member) Alert.alert('Info', `${u.prenom} ${u.nom} est déjà membre`);
      await loadMembers(selGroup!.id);
      await loadGroups();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); setShowAddMember(false); }
  };

  // ── Actions NOTIFICATIONS ─────────────────────────────────────────────────
  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifContent.trim()) return;
    if (notifType === 'targeted' && !notifTarget) return Alert.alert('Requis', 'Sélectionnez un utilisateur cible');
    setActionLoading('notif-send');
    try {
      await api({
        function: 'createNotification',
        type: notifType,
        title: notifTitle,
        content: notifContent,
        target_user_id: notifType === 'targeted' ? notifTarget!.id : undefined,
      });
      setShowNotifForm(false);
      setNotifTitle(''); setNotifContent(''); setNotifTarget(null); setNotifType('global');
      await loadNotifications();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); }
  };
  const confirmDeleteNotif = (n: Notification) => {
    askConfirm('Supprimer la notification', 'Supprimer cette notification ?', async () => {
      closeConfirm();
      setActionLoading(`del-notif-${n.id}`);
      try { await api({ function: 'deleteNotification', notification_id: n.id }); await loadNotifications(); }
      catch (e: any) { Alert.alert('Erreur', e.message); }
      finally { setActionLoading(null); }
    });
  };

  // ── Actions TROPHÉES ──────────────────────────────────────────────────────
  const selectTrophyUser = async (u: UserProfile) => {
    setTrophyUser(u); setTrophyTitle(''); setTrophyDesc('');
    resetPicker();
    await loadUserTrophies(u);
  };
  const awardTrophy = async () => {
    if (!trophyUser || !trophyTitle.trim()) { Alert.alert('Requis', 'Le titre du trophée est obligatoire'); return; }
    setActionLoading('trophy-award');
    try {
      const d = await api({
        function: 'awardTrophy',
        user_id:     trophyUser.id,
        title:       trophyTitle,
        description: trophyDesc || undefined,
      });
      Alert.alert('🏆 Trophée attribué !', `${d.awarded_to} — ${d.new_count} trophée(s)`);
      setTrophyTitle(''); setTrophyDesc('');
      setTrophyUser(prev => prev ? { ...prev, trophies_count: d.new_count } : prev);
      await loadUserTrophies(trophyUser);
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); }
  };

  // ── Actions RÉGLAGES ──────────────────────────────────────────────────────
  const toggleRegistrations = async (open: boolean) => {
    const title   = open ? 'Ouvrir les inscriptions ?' : 'Fermer les inscriptions ?';
    const message = open
      ? 'Les nouveaux utilisateurs pourront créer un compte.'
      : 'Toute tentative de création de compte sera refusée.';
    askConfirm(title, message, async () => {
      closeConfirm(); setActionLoading('reg-toggle');
      try {
        await api({ function: 'setRegistrationsOpen', open, message: regMessage || undefined });
        await loadSettingsAndSessions();
      }
      catch (e: any) { Alert.alert('Erreur', e.message); }
      finally { setActionLoading(null); }
    });
  };
  const saveRegMessage = async () => {
    if (!settings) return; setActionLoading('reg-msg');
    try {
      await api({ function: 'setRegistrationsOpen', open: settings.registrations_open, message: regMessage });
      await loadSettingsAndSessions();
    }
    catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); }
  };
  const toggleSession = async (session: GameSession, game_id: string) => {
    const newVal = !session.is_open; setToggling(session.id);
    try {
      await api({ function: 'toggleSessionOpen', session_id: session.id, is_open: newVal });
      setGames(prev => prev.map(g =>
        g.id !== game_id ? g : { ...g, sessions: g.sessions.map(s => s.id === session.id ? { ...s, is_open: newVal } : s) }
      ));
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setToggling(null); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <View style={S.container}>

      {/* Modale confirmation */}
      <Modal transparent animationType={FADE} visible={confirm.visible} onRequestClose={closeConfirm}>
        <View style={S.cmOverlay}>
          <View style={S.cmBox}>
            <Text style={S.cmTitle}>{confirm.title}</Text>
            <Text style={S.cmMsg}>{confirm.message}</Text>
            <View style={S.cmRow}>
              <TouchableOpacity style={S.cmBtnCancel} onPress={closeConfirm}>
                <Text style={S.cmBtnCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.cmBtnConfirm, confirm.danger ? S.cmBtnDanger : undefined]}
                onPress={confirm.onConfirm}
              >
                <Text style={S.cmBtnConfirmTxt}>{confirm.confirmLabel ?? 'Confirmer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#4C1D95']} style={S.header}>
        <TouchableOpacity onPress={onBack} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>🌐 Communauté</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Onglets */}
      <View style={S.tabs}>
        {([
          { key: 'groups',        icon: 'people-circle-outline', label: 'Groupes'  },
          { key: 'notifications', icon: 'notifications-outline', label: 'Notifs'   },
          { key: 'trophies',      icon: 'trophy-outline',        label: 'Trophées' },
          { key: 'settings',      icon: 'settings-outline',      label: 'Réglages' },
        ] as { key: Section; icon: string; label: string }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[S.tab, section === t.key && S.tabActive]}
            onPress={() => { setSection(t.key); setSelGroup(null); setTrophyUser(null); setError(''); }}
          >
            <Ionicons name={t.icon as any} size={18} color={section === t.key ? C.purple : C.muted} />
            <Text style={[S.tabTxt, section === t.key && S.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <View style={S.errBanner}><Text style={S.errTxt}>⚠️ {error}</Text></View> : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>

        {/* ══════════════ GROUPES ══════════════ */}
        {section === 'groups' && !selGroup && (
          <View>
            <View style={S.secHeader}>
              <Text style={S.secTitle}>Groupes de discussion</Text>
              <TouchableOpacity style={S.btnPrimary} onPress={() => openGroupForm()}>
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={S.btnPrimaryTxt}>Nouveau</Text>
              </TouchableOpacity>
            </View>
            {loading
              ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />
              : groups.length === 0
                ? <View style={S.empty}><Ionicons name="people-circle-outline" size={50} color={C.muted} /><Text style={S.emptyTxt}>Aucun groupe</Text></View>
                : groups.map(g => (
                  <TouchableOpacity key={g.id} style={S.card} onPress={() => openGroupDetail(g)} activeOpacity={0.8}>
                    <View style={S.cardRow}>
                      <View style={S.groupIcon}><Ionicons name="people" size={22} color="#FF8C00" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.cardTitle}>{g.name}</Text>
                        {g.description ? <Text style={S.cardSub} numberOfLines={1}>{g.description}</Text> : null}
                        <Text style={S.cardMeta}>{g.member_count} membre{g.member_count !== 1 ? 's' : ''} · {fmtDate(g.created_at)}</Text>
                      </View>
                      <View style={S.cardActions}>
                        <TouchableOpacity style={S.iconBtn} onPress={e => { e.stopPropagation?.(); openGroupForm(g); }}>
                          <Ionicons name="pencil-outline" size={16} color={C.purple} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={S.iconBtn}
                          onPress={e => { e.stopPropagation?.(); confirmDeleteGroup(g); }}
                          disabled={actionLoading === `del-grp-${g.id}`}
                        >
                          {actionLoading === `del-grp-${g.id}`
                            ? <ActivityIndicator size="small" color={C.danger} />
                            : <Ionicons name="trash-outline" size={16} color={C.danger} />}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
          </View>
        )}

        {/* Détail groupe */}
        {section === 'groups' && selGroup && (
          <View>
            <TouchableOpacity style={S.backLink} onPress={() => { setSelGroup(null); loadGroups(); }}>
              <Ionicons name="chevron-back" size={18} color={C.purple} />
              <Text style={S.backLinkTxt}>Retour aux groupes</Text>
            </TouchableOpacity>
            <View style={S.secHeader}>
              <View style={{ flex: 1 }}>
                <Text style={S.secTitle}>{selGroup.name}</Text>
                {selGroup.description ? <Text style={S.cardSub}>{selGroup.description}</Text> : null}
              </View>
              <TouchableOpacity style={S.btnPrimary} onPress={() => { resetPicker(); setShowAddMember(true); }}>
                <Ionicons name="person-add-outline" size={14} color="#FFF" />
                <Text style={S.btnPrimaryTxt}>Ajouter</Text>
              </TouchableOpacity>
            </View>
            {loading
              ? <ActivityIndicator color={C.purple} style={{ marginTop: 20 }} />
              : members.length === 0
                ? <View style={S.empty}><Ionicons name="person-outline" size={44} color={C.muted} /><Text style={S.emptyTxt}>Aucun membre</Text></View>
                : members.map(m => (
                  <View key={m.user_id} style={S.memberRow}>
                    <View style={S.memberAvatar}>
                      <Text style={S.memberAvatarTxt}>{m.prenom.charAt(0)}{m.nom.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.memberName}>{m.prenom} {m.nom}</Text>
                      <Text style={S.memberMeta}>depuis {fmtDate(m.joined_at)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeMember(m)} disabled={actionLoading === `rm-${m.user_id}`}>
                      {actionLoading === `rm-${m.user_id}`
                        ? <ActivityIndicator size="small" color={C.danger} />
                        : <Ionicons name="remove-circle-outline" size={22} color={C.danger} />}
                    </TouchableOpacity>
                  </View>
                ))}
          </View>
        )}

        {/* ══════════════ NOTIFICATIONS ══════════════ */}
        {section === 'notifications' && (
          <View>
            <View style={S.secHeader}>
              <Text style={S.secTitle}>Notifications</Text>
              <TouchableOpacity
                style={S.btnPrimary}
                onPress={() => { setNotifTitle(''); setNotifContent(''); setNotifType('global'); setNotifTarget(null); setShowNotifForm(true); }}
              >
                <Ionicons name="megaphone-outline" size={14} color="#FFF" />
                <Text style={S.btnPrimaryTxt}>Publier</Text>
              </TouchableOpacity>
            </View>
            {loading
              ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />
              : notifications.length === 0
                ? <View style={S.empty}><Ionicons name="notifications-off-outline" size={50} color={C.muted} /><Text style={S.emptyTxt}>Aucune notification</Text></View>
                : notifications.map(n => (
                  <View key={n.id} style={S.notifCard}>
                    <View style={[S.notifPill, n.type === 'global' ? S.pillGlobal : S.pillTargeted]}>
                      <Text style={S.pillTxt}>
                        {n.type === 'global' ? '🌐 Globale' : `🎯 ${n.target ? `${n.target.prenom} ${n.target.nom}` : 'Ciblée'}`}
                      </Text>
                    </View>
                    <Text style={S.notifTitle}>{n.title}</Text>
                    <Text style={S.notifContent} numberOfLines={2}>{n.content}</Text>
                    <View style={S.notifFooter}>
                      <Text style={S.notifMeta}>
                        {n.sender ? `${n.sender.prenom} ${n.sender.nom}` : '?'} · {fmtDate(n.created_at)}
                      </Text>
                      <TouchableOpacity onPress={() => confirmDeleteNotif(n)} disabled={actionLoading === `del-notif-${n.id}`}>
                        {actionLoading === `del-notif-${n.id}`
                          ? <ActivityIndicator size="small" color={C.danger} />
                          : <Ionicons name="trash-outline" size={16} color={C.danger} />}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
          </View>
        )}

        {/* ══════════════ TROPHÉES ══════════════ */}
        {section === 'trophies' && (
          <View>
            <Text style={S.secTitle}>Attribuer un trophée 🏆</Text>
            <Text style={S.secSubtitle}>Recherchez un utilisateur par nom et prénom, puis attribuez un trophée.</Text>

            {!trophyUser && (
              <View style={{ marginTop: 12 }}>
                {/* UserSearchExact reçoit maintenant tout son état en props */}
                <UserSearchExact
                  {...pickerProps}
                  onSelect={selectTrophyUser}
                  showTrophies
                />
              </View>
            )}

            {trophyUser && (
              <View>
                <View style={S.selectedUser}>
                  <View style={S.pickAvatar}>
                    <Text style={S.pickAvatarTxt}>{trophyUser.prenom.charAt(0)}{trophyUser.nom.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.pickName}>{trophyUser.prenom} {trophyUser.nom}</Text>
                    <Text style={S.pickMeta}>{trophyUser.role} · 🏆 {trophyUser.trophies_count} trophée(s)</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setTrophyUser(null); setUserTrophies([]); setTrophyTitle(''); setTrophyDesc(''); }}>
                    <Ionicons name="close-circle" size={22} color={C.muted} />
                  </TouchableOpacity>
                </View>

                <View style={S.trophyForm}>
                  <Text style={S.fieldLabel}>Titre du trophée *</Text>
                  <TextInput
                    style={S.input}
                    placeholder="Ex: Champion Arts – Run #3"
                    placeholderTextColor={C.muted}
                    value={trophyTitle}
                    onChangeText={setTrophyTitle}
                  />
                  <Text style={S.fieldLabel}>Description (optionnel)</Text>
                  <TextInput
                    style={[S.input, { minHeight: 70 }]}
                    placeholder="Ex: Meilleur score du run avec 142 votes"
                    placeholderTextColor={C.muted}
                    value={trophyDesc}
                    onChangeText={setTrophyDesc}
                    multiline
                  />
                  <TouchableOpacity
                    style={[S.btnGold, (!trophyTitle.trim() || actionLoading === 'trophy-award') && S.btnDisabled]}
                    onPress={awardTrophy}
                    disabled={!trophyTitle.trim() || actionLoading === 'trophy-award'}
                  >
                    {actionLoading === 'trophy-award'
                      ? <ActivityIndicator color="#FFF" />
                      : <><Ionicons name="trophy" size={18} color="#FFF" /><Text style={S.btnGoldTxt}>Attribuer le trophée +1</Text></>}
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: 20 }}>
                  <Text style={S.subTitle}>Trophées de {trophyUser.prenom} ({trophyUser.trophies_count})</Text>
                  {trophiesLoading
                    ? <ActivityIndicator color={C.purple} style={{ marginTop: 10 }} />
                    : userTrophies.length === 0
                      ? <Text style={[S.emptyTxt, { marginTop: 10 }]}>Aucun trophée attribué</Text>
                      : userTrophies.map(t => (
                        <View key={t.id} style={S.trophyRow}>
                          <Text style={S.trophyEmoji}>🏆</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={S.trophyTitleTxt}>{t.title}</Text>
                            {t.description ? <Text style={S.trophyDescTxt}>{t.description}</Text> : null}
                            <Text style={S.trophyMeta}>
                              {t.awarder ? `${t.awarder.prenom} ${t.awarder.nom}` : '?'} · {fmtDate(t.awarded_at)}
                            </Text>
                          </View>
                        </View>
                      ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ══════════════ RÉGLAGES ══════════════ */}
        {section === 'settings' && (
          <View>
            {loading
              ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />
              : (
                <View>
                  <Text style={S.secTitle}>Inscriptions Harmonia</Text>
                  {settings && (
                    <View style={S.settingCard}>
                      <View style={S.settingRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={S.settingTitle}>{settings.registrations_open ? '✅ Ouvertes' : '🔐 Fermées'}</Text>
                          <Text style={S.settingSub}>
                            {settings.registrations_open
                              ? 'Les nouveaux utilisateurs peuvent créer un compte.'
                              : 'Toute tentative de création de compte est bloquée.'}
                          </Text>
                          <Text style={S.settingMeta}>Modifié le {fmtDate(settings.updated_at)}</Text>
                        </View>
                        {actionLoading === 'reg-toggle'
                          ? <ActivityIndicator color={C.purple} />
                          : <Switch
                              value={settings.registrations_open}
                              onValueChange={toggleRegistrations}
                              trackColor={{ false: '#DDD', true: '#A855F7' }}
                              thumbColor={settings.registrations_open ? C.purple : '#888'}
                            />}
                      </View>
                      <Text style={[S.fieldLabel, { marginTop: 14 }]}>Message quand inscriptions fermées</Text>
                      <TextInput
                        style={[S.input, { minHeight: 60 }]}
                        placeholder="Les inscriptions sont terminées. 🔐"
                        placeholderTextColor={C.muted}
                        value={regMessage}
                        onChangeText={setRegMessage}
                        multiline
                      />
                      <TouchableOpacity
                        style={[S.btnPrimary, { alignSelf: 'flex-start', marginTop: 8 }]}
                        onPress={saveRegMessage}
                        disabled={actionLoading === 'reg-msg'}
                      >
                        {actionLoading === 'reg-msg'
                          ? <ActivityIndicator color="#FFF" size="small" />
                          : <Text style={S.btnPrimaryTxt}>Sauvegarder</Text>}
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={[S.secTitle, { marginTop: 28 }]}>Sessions de jeux</Text>
                  <Text style={S.secSubtitle}>Ouvrez ou fermez les inscriptions pour chaque session.</Text>

                  {games.length === 0
                    ? <View style={S.empty}><Ionicons name="game-controller-outline" size={46} color={C.muted} /><Text style={S.emptyTxt}>Aucun jeu trouvé</Text></View>
                    : games.map(game => {
                        const icon = GAME_ICONS[game.key_name] ?? { icon: 'game-controller-outline', colors: ['#9CA3AF', '#6B7280'] as [string, string] };
                        return (
                          <View key={game.id} style={S.gameSection}>
                            <View style={S.gameHeader}>
                              <LinearGradient colors={icon.colors} style={S.gameIconWrap}>
                                <Ionicons name={icon.icon as any} size={18} color="#FFF" />
                              </LinearGradient>
                              <Text style={S.gameName}>{game.title}</Text>
                              <Text style={S.gameMeta}>{game.sessions.length} session{game.sessions.length !== 1 ? 's' : ''}</Text>
                            </View>
                            {game.sessions.length === 0
                              ? <Text style={[S.emptyTxt, { paddingLeft: 12, fontSize: 12 }]}>Aucune session</Text>
                              : game.sessions.map(s => (
                                <View key={s.id} style={S.sessionRow}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={S.sessionTitle} numberOfLines={1}>{s.title}</Text>
                                    <Text style={S.sessionMeta}>
                                      {s.is_paid ? `💰 ${s.price_cfa} FCFA` : 'Gratuit'}{' · '}{fmtDate(s.created_at)}
                                    </Text>
                                  </View>
                                  <View style={S.sessionToggle}>
                                    <Text style={[S.sessionState, { color: s.is_open ? C.green : C.danger }]}>
                                      {s.is_open ? 'Ouvert' : 'Fermé'}
                                    </Text>
                                    {toggling === s.id
                                      ? <ActivityIndicator size="small" color={C.purple} style={{ marginLeft: 8 }} />
                                      : <Switch
                                          value={s.is_open}
                                          onValueChange={() => toggleSession(s, game.id)}
                                          trackColor={{ false: '#DDD', true: '#A855F7' }}
                                          thumbColor={s.is_open ? C.purple : '#888'}
                                          disabled={!!toggling}
                                        />}
                                  </View>
                                </View>
                              ))}
                          </View>
                        );
                      })}
                </View>
              )}
          </View>
        )}

      </ScrollView>

      {/* ══════════════ MODALES ══════════════ */}

      {/* Créer / modifier groupe */}
      <Modal visible={showGrpForm} animationType={SLIDE} transparent onRequestClose={() => setShowGrpForm(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <Text style={S.sheetTitle}>{editingGrp ? 'Modifier le groupe' : 'Nouveau groupe'}</Text>
            <Text style={S.fieldLabel}>Nom *</Text>
            <TextInput style={S.input} placeholder="Nom…" placeholderTextColor={C.muted} value={grpName} onChangeText={setGrpName} />
            <Text style={S.fieldLabel}>Description</Text>
            <TextInput style={[S.input, { minHeight: 70 }]} placeholder="Description…" placeholderTextColor={C.muted} value={grpDesc} onChangeText={setGrpDesc} multiline />
            <View style={S.sheetActions}>
              <TouchableOpacity style={S.btnSecondary} onPress={() => setShowGrpForm(false)}>
                <Text style={S.btnSecondaryTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.btnPrimary, !grpName.trim() && S.btnDisabled]}
                onPress={saveGroup}
                disabled={!grpName.trim() || actionLoading === 'group-save'}
              >
                {actionLoading === 'group-save'
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={S.btnPrimaryTxt}>{editingGrp ? 'Enregistrer' : 'Créer'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ajouter membre */}
      <Modal visible={showAddMember} animationType={SLIDE} transparent onRequestClose={() => setShowAddMember(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <Text style={S.sheetTitle}>Ajouter un membre</Text>
            <UserSearchExact
              {...pickerProps}
              onSelect={u => addMember(u)}
              actionLoading={actionLoading}
            />
            <TouchableOpacity style={[S.btnSecondary, { marginTop: 12 }]} onPress={() => setShowAddMember(false)}>
              <Text style={S.btnSecondaryTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Créer notification */}
      <Modal visible={showNotifForm} animationType={SLIDE} transparent onRequestClose={() => setShowNotifForm(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <Text style={S.sheetTitle}>Publier une notification</Text>
            <View style={S.typeSwitch}>
              <TouchableOpacity style={[S.typePill, notifType === 'global' && S.typePillActive]} onPress={() => setNotifType('global')}>
                <Text style={[S.typePillTxt, notifType === 'global' && S.typePillTxtActive]}>🌐 Globale</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.typePill, notifType === 'targeted' && S.typePillActive]} onPress={() => setNotifType('targeted')}>
                <Text style={[S.typePillTxt, notifType === 'targeted' && S.typePillTxtActive]}>🎯 Ciblée</Text>
              </TouchableOpacity>
            </View>
            {notifType === 'targeted' && (
              <TouchableOpacity style={S.targetSel} onPress={() => { resetPicker(); setShowTargetPicker(true); }}>
                <Ionicons name="person-outline" size={16} color={notifTarget ? C.purple : C.muted} />
                <Text style={[S.targetSelTxt, notifTarget ? { color: C.purple } : undefined]}>
                  {notifTarget ? `${notifTarget.prenom} ${notifTarget.nom}` : 'Sélectionner un utilisateur…'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={C.muted} />
              </TouchableOpacity>
            )}
            <Text style={S.fieldLabel}>Titre *</Text>
            <TextInput style={S.input} placeholder="Titre…" placeholderTextColor={C.muted} value={notifTitle} onChangeText={setNotifTitle} />
            <Text style={S.fieldLabel}>Contenu *</Text>
            <TextInput style={[S.input, { minHeight: 80 }]} placeholder="Message…" placeholderTextColor={C.muted} value={notifContent} onChangeText={setNotifContent} multiline />
            <View style={S.sheetActions}>
              <TouchableOpacity style={S.btnSecondary} onPress={() => setShowNotifForm(false)}>
                <Text style={S.btnSecondaryTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.btnPrimary, (!notifTitle.trim() || !notifContent.trim()) && S.btnDisabled]}
                onPress={sendNotification}
                disabled={!notifTitle.trim() || !notifContent.trim() || actionLoading === 'notif-send'}
              >
                {actionLoading === 'notif-send'
                  ? <ActivityIndicator color="#FFF" />
                  : <><Ionicons name="send-outline" size={14} color="#FFF" /><Text style={S.btnPrimaryTxt}>Publier</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sélecteur cible notif */}
      <Modal visible={showTargetPicker} animationType={FADE} transparent onRequestClose={() => setShowTargetPicker(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <Text style={S.sheetTitle}>Sélectionner la cible</Text>
            <UserSearchExact
              {...pickerProps}
              onSelect={u => { setNotifTarget(u); setShowTargetPicker(false); }}
            />
            <TouchableOpacity style={[S.btnSecondary, { marginTop: 12 }]} onPress={() => setShowTargetPicker(false)}>
              <Text style={S.btnSecondaryTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 52 : 38, paddingBottom: 14, paddingHorizontal: 16 },
  backBtn:     { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },

  tabs:         { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: C.border },
  tab:          { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  tabActive:    { borderBottomWidth: 3, borderBottomColor: C.purple },
  tabTxt:       { fontSize: 10, color: C.muted, fontWeight: '600' },
  tabTxtActive: { color: C.purple },

  errBanner: { backgroundColor: '#FEF2F2', padding: 10, borderLeftWidth: 4, borderLeftColor: C.danger, marginHorizontal: 16, marginTop: 8, borderRadius: 8 },
  errTxt:    { color: C.danger, fontSize: 13 },

  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 4 },
  feedbackTxt: { fontSize: 13, fontWeight: '600', flex: 1 },

  secHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  secTitle:    { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 2 },
  secSubtitle: { fontSize: 12, color: C.muted, marginBottom: 14 },
  subTitle:    { fontSize: 14, fontWeight: '700', color: C.soft, marginBottom: 8 },

  card:        { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 5 }, android: { elevation: 2 } }) },
  cardRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: C.text },
  cardSub:     { fontSize: 12, color: C.muted, marginTop: 2 },
  cardMeta:    { fontSize: 11, color: C.muted, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 6 },
  groupIcon:   { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
  iconBtn:     { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F3EEFF', justifyContent: 'center', alignItems: 'center' },

  backLink:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backLinkTxt: { fontSize: 14, color: C.purple, fontWeight: '600' },

  memberRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  memberAvatar:    { width: 40, height: 40, borderRadius: 20, backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center' },
  memberAvatarTxt: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  memberName:      { fontSize: 14, fontWeight: '600', color: C.text },
  memberMeta:      { fontSize: 11, color: C.muted, marginTop: 2 },

  notifCard:    { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  notifPill:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  pillGlobal:   { backgroundColor: '#DBEAFE' },
  pillTargeted: { backgroundColor: '#FEF3C7' },
  pillTxt:      { fontSize: 11, fontWeight: '700', color: C.text },
  notifTitle:   { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  notifContent: { fontSize: 13, color: C.soft, lineHeight: 18 },
  notifFooter:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  notifMeta:    { fontSize: 11, color: C.muted },

  selectedUser:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3EEFF', borderRadius: 12, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: C.border },
  trophyForm:     { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginTop: 10, borderWidth: 1, borderColor: C.border },
  trophyRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#FEF3C7' },
  trophyEmoji:    { fontSize: 20, marginTop: 2 },
  trophyTitleTxt: { fontSize: 14, fontWeight: '700', color: C.text },
  trophyDescTxt:  { fontSize: 12, color: C.soft, marginTop: 2 },
  trophyMeta:     { fontSize: 11, color: C.muted, marginTop: 4 },

  settingCard:  { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  settingRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  settingTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  settingSub:   { fontSize: 13, color: C.soft, marginTop: 4, lineHeight: 18 },
  settingMeta:  { fontSize: 11, color: C.muted, marginTop: 6 },

  gameSection:  { marginBottom: 14 },
  gameHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  gameIconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  gameName:     { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  gameMeta:     { fontSize: 12, color: C.muted },
  sessionRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  sessionTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  sessionMeta:  { fontSize: 11, color: C.muted, marginTop: 2 },
  sessionToggle:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionState: { fontSize: 12, fontWeight: '700' },

  searchBar:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3EEFF', borderRadius: 10, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: C.border },
  pickFieldRow: { flexDirection: 'row', gap: 8 },
  btnSearch:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 14, height: 44, justifyContent: 'center' },
  btnSearchTxt: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  pickList:     { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginTop: 8, overflow: 'hidden' },
  pickItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  pickAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center' },
  pickAvatarTxt:{ color: '#FFF', fontWeight: '700', fontSize: 13 },
  pickName:     { fontSize: 14, fontWeight: '600', color: C.text },
  pickMeta:     { fontSize: 11, color: C.muted, marginTop: 2 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.soft, marginBottom: 5, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { backgroundColor: '#F9F6FF', borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text },

  btnPrimary:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  btnPrimaryTxt:   { color: '#FFF', fontSize: 14, fontWeight: '700' },
  btnSecondary:    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  btnSecondaryTxt: { fontSize: 14, color: C.muted, fontWeight: '600' },
  btnGold:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D97706', borderRadius: 12, paddingVertical: 14, marginTop: 10 },
  btnGoldTxt:      { color: '#FFF', fontSize: 15, fontWeight: '700' },
  btnDisabled:     { opacity: 0.4 },

  empty:    { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTxt: { fontSize: 14, color: C.muted, fontWeight: '600' },

  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '88%' },
  sheetTitle:   { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 16 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },

  typeSwitch:        { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typePill:          { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: '#F9F9F9' },
  typePillActive:    { backgroundColor: C.purple, borderColor: C.purple },
  typePillTxt:       { fontSize: 13, fontWeight: '600', color: C.muted },
  typePillTxtActive: { color: '#FFF' },
  targetSel:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3EEFF', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  targetSelTxt:      { flex: 1, fontSize: 14, color: C.muted },

  cmOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  cmBox:          { backgroundColor: '#FFF', borderRadius: 18, padding: 24, width: '100%', maxWidth: 340 },
  cmTitle:        { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 10 },
  cmMsg:          { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 20 },
  cmRow:          { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  cmBtnCancel:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#DDD' },
  cmBtnCancelTxt: { fontSize: 14, color: '#666', fontWeight: '600' },
  cmBtnConfirm:   { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#8A2BE2' },
  cmBtnDanger:    { backgroundColor: '#DC2626' },
  cmBtnConfirmTxt:{ fontSize: 14, color: '#FFF', fontWeight: '700' },
});
