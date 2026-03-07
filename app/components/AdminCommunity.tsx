/**
 * AdminCommunity.tsx — Administration Communauté
 *
 * SECTIONS :
 *   1. Groupes       → créer / modifier / supprimer / gérer membres
 *   2. Notifications → publier (globale ou ciblée) / supprimer
 *   3. Trophées      → attribuer 🏆 à un utilisateur
 *   4. Paramètres    → ouvrir/fermer les inscriptions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, Alert, Switch, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:       '#F5F0FA', surface: '#FFFFFF', border: '#E0D5F0',
  purple:   '#7C3AED', purpleL: '#A855F7', gold: '#D97706',
  danger:   '#DC2626', muted: '#6B7280',   text: '#111827',
  soft:     '#374151', green: '#059669',   blue: '#2563EB',
  orange:   '#EA580C',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Section = 'groups' | 'notifications' | 'trophies' | 'settings';

interface Group {
  id: string; name: string; description?: string | null;
  created_at: string; member_count: number;
}
interface GroupMember {
  member_row_id: string; user_id: string; joined_at: string;
  nom: string; prenom: string; role: string;
}
interface UserProfile {
  id: string; nom: string; prenom: string;
  role: string; trophies_count: number;
}
interface Notification {
  id: string; type: 'global' | 'targeted'; title: string;
  content: string; is_read: boolean; created_at: string;
  sender: { nom: string; prenom: string } | null;
  target: { nom: string; prenom: string } | null;
  target_user_id: string | null;
}
interface Trophy {
  id: string; reason: string | null; awarded_at: string;
  awarder: { nom: string; prenom: string } | null;
}
interface AppSettings {
  registrations_open: boolean; registrations_message: string; updated_at: string;
}

interface AdminCommunityProps {
  adminEmail: string; adminPassword: string; onBack: () => void;
}

export default function AdminCommunity({ adminEmail, adminPassword, onBack }: AdminCommunityProps) {
  const [section,       setSection]       = useState<Section>('groups');
  const [loading,       setLoading]       = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error,         setError]         = useState('');

  // Groupes
  const [groups,       setGroups]       = useState<Group[]>([]);
  const [selGroup,     setSelGroup]     = useState<Group | null>(null);
  const [members,      setMembers]      = useState<GroupMember[]>([]);
  const [showGrpForm,  setShowGrpForm]  = useState(false);
  const [editingGrp,   setEditingGrp]   = useState<Group | null>(null);
  const [grpName,      setGrpName]      = useState('');
  const [grpDesc,      setGrpDesc]      = useState('');

  // Modal ajout membre
  const [showAddMember, setShowAddMember] = useState(false);
  const [userSearch,    setUserSearch]    = useState('');
  const [userList,      setUserList]      = useState<UserProfile[]>([]);
  const [userLoading,   setUserLoading]   = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifForm, setShowNotifForm]  = useState(false);
  const [notifType,     setNotifType]      = useState<'global' | 'targeted'>('global');
  const [notifTitle,    setNotifTitle]     = useState('');
  const [notifContent,  setNotifContent]   = useState('');
  const [notifTarget,   setNotifTarget]    = useState<UserProfile | null>(null);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [targetSearch,  setTargetSearch]   = useState('');
  const [targetList,    setTargetList]     = useState<UserProfile[]>([]);

  // Trophées
  const [trophyUser,   setTrophyUser]   = useState<UserProfile | null>(null);
  const [trophyReason, setTrophyReason] = useState('');
  const [trophySearch, setTrophySearch] = useState('');
  const [trophyList,   setTrophyList]   = useState<UserProfile[]>([]);
  const [trophySearchLoading, setTrophySearchLoading] = useState(false);
  const [userTrophies, setUserTrophies] = useState<Trophy[]>([]);

  // Settings
  const [settings,    setSettings]    = useState<AppSettings | null>(null);
  const [regMessage,  setRegMessage]  = useState('');

  // ─── API helper ──────────────────────────────────────────────────────────
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

  // ─── Chargements initiaux ────────────────────────────────────────────────
  useEffect(() => {
    if (section === 'groups')        loadGroups();
    if (section === 'notifications') loadNotifications();
    if (section === 'settings')      loadSettings();
  }, [section]);

  const loadGroups = useCallback(async () => {
    setLoading(true); setError('');
    try { const d = await api({ function: 'listGroups' }); setGroups(d.groups || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadMembers = useCallback(async (groupId: string) => {
    setLoading(true);
    try { const d = await api({ function: 'listGroupMembers', group_id: groupId }); setMembers(d.members || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadNotifications = useCallback(async () => {
    setLoading(true); setError('');
    try { const d = await api({ function: 'listNotifications' }); setNotifications(d.notifications || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const loadSettings = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const d = await api({ function: 'getSettings' });
      setSettings(d.settings);
      setRegMessage(d.settings?.registrations_message ?? '');
    }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  // ─── Recherche utilisateurs (générique) ──────────────────────────────────
  const searchUsers = useCallback(async (q: string, setList: (u: UserProfile[]) => void, setLoad: (b: boolean) => void) => {
    setLoad(true);
    try { const d = await api({ function: 'listUsers', search: q, limit: 20 }); setList(d.users || []); }
    catch {}
    finally { setLoad(false); }
  }, [api]);

  // ─── GROUPES — actions ───────────────────────────────────────────────────
  const openGroupForm = (g?: Group) => {
    setEditingGrp(g ?? null);
    setGrpName(g?.name ?? '');
    setGrpDesc(g?.description ?? '');
    setShowGrpForm(true);
  };

  const saveGroup = async () => {
    if (!grpName.trim()) return;
    setActionLoading('group-save');
    try {
      if (editingGrp) {
        await api({ function: 'updateGroup', group_id: editingGrp.id, name: grpName, description: grpDesc });
      } else {
        await api({ function: 'createGroup', name: grpName, description: grpDesc });
      }
      setShowGrpForm(false); setEditingGrp(null);
      await loadGroups();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); }
  };

  const confirmDeleteGroup = (g: Group) => {
    Alert.alert('Supprimer le groupe', `Supprimer "${g.name}" et tous ses messages ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        setActionLoading(`del-grp-${g.id}`);
        try { await api({ function: 'deleteGroup', group_id: g.id }); await loadGroups(); if (selGroup?.id === g.id) setSelGroup(null); }
        catch (e: any) { Alert.alert('Erreur', e.message); }
        finally { setActionLoading(null); }
      }},
    ]);
  };

  const openGroupDetail = async (g: Group) => {
    setSelGroup(g); await loadMembers(g.id);
  };

  const removeMember = (m: GroupMember) => {
    Alert.alert('Retirer', `Retirer ${m.prenom} ${m.nom} du groupe ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: async () => {
        setActionLoading(`rm-${m.user_id}`);
        try {
          await api({ function: 'removeGroupMember', group_id: selGroup!.id, user_id: m.user_id });
          await loadMembers(selGroup!.id);
          await loadGroups();
        } catch (e: any) { Alert.alert('Erreur', e.message); }
        finally { setActionLoading(null); }
      }},
    ]);
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

  // ─── NOTIFICATIONS — actions ─────────────────────────────────────────────
  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifContent.trim()) return;
    if (notifType === 'targeted' && !notifTarget)
      return Alert.alert('Requis', 'Sélectionnez un utilisateur cible');

    setActionLoading('notif-send');
    try {
      await api({
        function:       'createNotification',
        type:           notifType,
        title:          notifTitle,
        content:        notifContent,
        target_user_id: notifType === 'targeted' ? notifTarget!.id : undefined,
      });
      setShowNotifForm(false);
      setNotifTitle(''); setNotifContent(''); setNotifTarget(null); setNotifType('global');
      await loadNotifications();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); }
  };

  const confirmDeleteNotif = (n: Notification) => {
    Alert.alert('Supprimer', 'Supprimer cette notification ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        setActionLoading(`del-notif-${n.id}`);
        try { await api({ function: 'deleteNotification', notification_id: n.id }); await loadNotifications(); }
        catch (e: any) { Alert.alert('Erreur', e.message); }
        finally { setActionLoading(null); }
      }},
    ]);
  };

  // ─── TROPHÉES — actions ──────────────────────────────────────────────────
  const loadUserTrophies = async (u: UserProfile) => {
    setTrophyUser(u); setTrophyList([]);
    setLoading(true);
    try { const d = await api({ function: 'listTrophies', user_id: u.id }); setUserTrophies(d.trophies || []); }
    catch {}
    finally { setLoading(false); }
  };

  const awardTrophy = async () => {
    if (!trophyUser) return;
    setActionLoading('trophy-award');
    try {
      const d = await api({ function: 'awardTrophy', user_id: trophyUser.id, reason: trophyReason || undefined });
      Alert.alert('🏆 Trophée attribué !', `${d.awarded_to} a maintenant ${d.new_count} trophée(s)`);
      setTrophyReason('');
      await loadUserTrophies(trophyUser);
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); }
  };

  // ─── SETTINGS — actions ──────────────────────────────────────────────────
  const toggleRegistrations = async (open: boolean) => {
    setActionLoading('reg-toggle');
    try {
      await api({ function: 'setRegistrationsOpen', open, message: regMessage || undefined });
      await loadSettings();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  // ══════════════════════════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={S.container}>

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <LinearGradient colors={['#7C3AED', '#4C1D95']} style={S.header}>
        <TouchableOpacity onPress={onBack} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>🌐 Communauté</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* ─── ONGLETS SECTIONS ────────────────────────────────────────────── */}
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* ══════════════════════════════════════════════════════════════
            SECTION GROUPES
        ══════════════════════════════════════════════════════════════ */}
        {section === 'groups' && !selGroup && (
          <View>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Groupes de discussion</Text>
              <TouchableOpacity style={S.btnPrimary} onPress={() => openGroupForm()}>
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={S.btnPrimaryTxt}>Créer</Text>
              </TouchableOpacity>
            </View>

            {loading
              ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />
              : groups.length === 0
                ? <View style={S.empty}><Ionicons name="people-circle-outline" size={50} color={C.muted} /><Text style={S.emptyTxt}>Aucun groupe</Text></View>
                : groups.map(g => (
                  <TouchableOpacity key={g.id} style={S.card} onPress={() => openGroupDetail(g)} activeOpacity={0.8}>
                    <View style={S.cardRow}>
                      <View style={S.groupIcon}>
                        <Ionicons name="people" size={22} color="#FF8C00" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.cardTitle}>{g.name}</Text>
                        {g.description ? <Text style={S.cardSub} numberOfLines={1}>{g.description}</Text> : null}
                        <Text style={S.cardMeta}>{g.member_count} membre{g.member_count !== 1 ? 's' : ''} · {fmtDate(g.created_at)}</Text>
                      </View>
                      <View style={S.cardActions}>
                        <TouchableOpacity style={S.iconBtn} onPress={e => { e.stopPropagation?.(); openGroupForm(g); }}>
                          <Ionicons name="pencil-outline" size={16} color={C.purple} />
                        </TouchableOpacity>
                        <TouchableOpacity style={S.iconBtn} onPress={e => { e.stopPropagation?.(); confirmDeleteGroup(g); }}
                          disabled={actionLoading === `del-grp-${g.id}`}>
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

        {/* Détail groupe → membres */}
        {section === 'groups' && selGroup && (
          <View>
            <TouchableOpacity style={S.backLink} onPress={() => { setSelGroup(null); loadGroups(); }}>
              <Ionicons name="chevron-back" size={18} color={C.purple} />
              <Text style={S.backLinkTxt}>Retour aux groupes</Text>
            </TouchableOpacity>

            <View style={S.groupDetailHeader}>
              <View>
                <Text style={S.sectionTitle}>{selGroup.name}</Text>
                {selGroup.description ? <Text style={S.cardSub}>{selGroup.description}</Text> : null}
              </View>
              <TouchableOpacity style={S.btnPrimary} onPress={() => { setUserSearch(''); setUserList([]); setShowAddMember(true); }}>
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
                      <Text style={S.memberRole}>{m.role} · depuis {fmtDate(m.joined_at)}</Text>
                    </View>
                    <TouchableOpacity style={S.iconBtnDanger} onPress={() => removeMember(m)}
                      disabled={actionLoading === `rm-${m.user_id}`}>
                      {actionLoading === `rm-${m.user_id}`
                        ? <ActivityIndicator size="small" color={C.danger} />
                        : <Ionicons name="remove-circle-outline" size={20} color={C.danger} />}
                    </TouchableOpacity>
                  </View>
                ))}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION NOTIFICATIONS
        ══════════════════════════════════════════════════════════════ */}
        {section === 'notifications' && (
          <View>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Notifications</Text>
              <TouchableOpacity style={S.btnPrimary} onPress={() => { setNotifTitle(''); setNotifContent(''); setNotifType('global'); setNotifTarget(null); setShowNotifForm(true); }}>
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
                    <View style={[S.notifTypePill, n.type === 'global' ? S.notifGlobal : S.notifTargeted]}>
                      <Text style={S.notifTypeTxt}>{n.type === 'global' ? '🌐 Global' : `🎯 ${n.target ? `${n.target.prenom} ${n.target.nom}` : 'Ciblé'}`}</Text>
                    </View>
                    <Text style={S.notifTitle}>{n.title}</Text>
                    <Text style={S.notifContent} numberOfLines={2}>{n.content}</Text>
                    <View style={S.notifFooter}>
                      <Text style={S.notifMeta}>{n.sender ? `${n.sender.prenom} ${n.sender.nom}` : '?'} · {fmtDate(n.created_at)}</Text>
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

        {/* ══════════════════════════════════════════════════════════════
            SECTION TROPHÉES
        ══════════════════════════════════════════════════════════════ */}
        {section === 'trophies' && (
          <View>
            <Text style={S.sectionTitle}>Attribuer un trophée 🏆</Text>

            {/* Recherche utilisateur */}
            <View style={S.searchBar}>
              <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, fontSize: 14, color: C.text }}
                placeholder="Rechercher un utilisateur…"
                placeholderTextColor={C.muted}
                value={trophySearch}
                onChangeText={t => {
                  setTrophySearch(t);
                  if (t.length >= 2) searchUsers(t, setTrophyList, setTrophySearchLoading);
                  else setTrophyList([]);
                }}
              />
              {trophySearchLoading && <ActivityIndicator size="small" color={C.purple} />}
            </View>

            {trophyList.length > 0 && !trophyUser && (
              <View style={S.pickList}>
                {trophyList.map(u => (
                  <TouchableOpacity key={u.id} style={S.pickItem} onPress={() => { setTrophyUser(u); setTrophySearch(''); setTrophyList([]); loadUserTrophies(u); }}>
                    <View style={S.pickAvatar}><Text style={S.pickAvatarTxt}>{u.prenom.charAt(0)}{u.nom.charAt(0)}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.pickName}>{u.prenom} {u.nom}</Text>
                      <Text style={S.pickMeta}>{u.role} · 🏆 {u.trophies_count}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Utilisateur sélectionné */}
            {trophyUser && (
              <View>
                <View style={S.selectedUser}>
                  <View style={S.pickAvatar}><Text style={S.pickAvatarTxt}>{trophyUser.prenom.charAt(0)}{trophyUser.nom.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.pickName}>{trophyUser.prenom} {trophyUser.nom}</Text>
                    <Text style={S.pickMeta}>{trophyUser.role} · 🏆 {trophyUser.trophies_count} trophée(s)</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setTrophyUser(null); setUserTrophies([]); }}>
                    <Ionicons name="close-circle" size={22} color={C.muted} />
                  </TouchableOpacity>
                </View>

                <Text style={S.fieldLabel}>Motif du trophée (optionnel)</Text>
                <TextInput
                  style={S.input}
                  placeholder="Ex: 1er place Run #3 Arts"
                  placeholderTextColor={C.muted}
                  value={trophyReason}
                  onChangeText={setTrophyReason}
                />

                <TouchableOpacity
                  style={[S.btnGold, actionLoading === 'trophy-award' && S.btnDisabled]}
                  onPress={awardTrophy}
                  disabled={actionLoading === 'trophy-award'}
                >
                  {actionLoading === 'trophy-award'
                    ? <ActivityIndicator color="#FFF" />
                    : <><Ionicons name="trophy" size={18} color="#FFF" /><Text style={S.btnGoldTxt}>Attribuer le trophée</Text></>}
                </TouchableOpacity>

                {/* Historique trophées de l'utilisateur */}
                {loading
                  ? <ActivityIndicator color={C.purple} style={{ marginTop: 16 }} />
                  : userTrophies.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={S.subTitle}>Trophées de {trophyUser.prenom}</Text>
                      {userTrophies.map(t => (
                        <View key={t.id} style={S.trophyRow}>
                          <Text style={S.trophyEmoji}>🏆</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={S.trophyReason}>{t.reason ?? 'Trophée'}</Text>
                            <Text style={S.trophyMeta}>
                              par {t.awarder ? `${t.awarder.prenom} ${t.awarder.nom}` : '?'} · {fmtDate(t.awarded_at)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
              </View>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION PARAMÈTRES
        ══════════════════════════════════════════════════════════════ */}
        {section === 'settings' && (
          <View>
            <Text style={S.sectionTitle}>Paramètres de l'application</Text>

            {loading
              ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />
              : settings && (
                <View>
                  {/* Toggle inscriptions */}
                  <View style={S.settingCard}>
                    <View style={S.settingRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={S.settingTitle}>Inscriptions</Text>
                        <Text style={S.settingSub}>
                          {settings.registrations_open
                            ? '✅ Ouvertes — les nouveaux utilisateurs peuvent s'inscrire'
                            : '🔐 Fermées — tout nouvel essai d'inscription est bloqué'}
                        </Text>
                        <Text style={S.settingMeta}>Dernière modif : {fmtDate(settings.updated_at)}</Text>
                      </View>
                      <Switch
                        value={settings.registrations_open}
                        onValueChange={v => {
                          Alert.alert(
                            v ? 'Ouvrir les inscriptions ?' : 'Fermer les inscriptions ?',
                            v ? 'Les nouveaux utilisateurs pourront s\'inscrire.' : 'Toute tentative d\'inscription sera refusée.',
                            [
                              { text: 'Annuler', style: 'cancel' },
                              { text: 'Confirmer', onPress: () => toggleRegistrations(v) },
                            ]
                          );
                        }}
                        trackColor={{ false: '#DDD', true: '#A855F7' }}
                        thumbColor={settings.registrations_open ? C.purple : '#888'}
                        disabled={actionLoading === 'reg-toggle'}
                      />
                    </View>

                    {/* Message personnalisé affiché quand inscriptions fermées */}
                    <View style={{ marginTop: 16 }}>
                      <Text style={S.fieldLabel}>Message affiché lors de la tentative d'inscription</Text>
                      <TextInput
                        style={[S.input, { minHeight: 70 }]}
                        placeholder="Les inscriptions sont actuellement fermées. 🔐"
                        placeholderTextColor={C.muted}
                        value={regMessage}
                        onChangeText={setRegMessage}
                        multiline
                      />
                      <TouchableOpacity
                        style={[S.btnPrimary, { alignSelf: 'flex-start', marginTop: 8 }]}
                        onPress={() => toggleRegistrations(settings.registrations_open)}
                        disabled={actionLoading === 'reg-toggle'}
                      >
                        <Text style={S.btnPrimaryTxt}>Sauvegarder le message</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
          </View>
        )}

      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════
          MODALES
      ══════════════════════════════════════════════════════════════ */}

      {/* Modal : créer / modifier groupe */}
      <Modal visible={showGrpForm} animationType="slide" transparent onRequestClose={() => setShowGrpForm(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>{editingGrp ? 'Modifier le groupe' : 'Nouveau groupe'}</Text>

            <Text style={S.fieldLabel}>Nom du groupe *</Text>
            <TextInput style={S.input} placeholder="Nom…" placeholderTextColor={C.muted} value={grpName} onChangeText={setGrpName} />

            <Text style={S.fieldLabel}>Description (optionnel)</Text>
            <TextInput style={[S.input, { minHeight: 70 }]} placeholder="Description…" placeholderTextColor={C.muted} value={grpDesc} onChangeText={setGrpDesc} multiline />

            <View style={S.modalActions}>
              <TouchableOpacity style={S.btnSecondary} onPress={() => setShowGrpForm(false)}>
                <Text style={S.btnSecondaryTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.btnPrimary, !grpName.trim() && S.btnDisabled]} onPress={saveGroup}
                disabled={!grpName.trim() || actionLoading === 'group-save'}>
                {actionLoading === 'group-save'
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={S.btnPrimaryTxt}>{editingGrp ? 'Enregistrer' : 'Créer'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal : ajouter membre au groupe */}
      <Modal visible={showAddMember} animationType="slide" transparent onRequestClose={() => setShowAddMember(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>Ajouter un membre</Text>
            <View style={S.searchBar}>
              <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, fontSize: 14, color: C.text }}
                placeholder="Rechercher un utilisateur…"
                placeholderTextColor={C.muted}
                value={userSearch}
                onChangeText={t => { setUserSearch(t); if (t.length >= 2) searchUsers(t, setUserList, setUserLoading); else setUserList([]); }}
                autoFocus
              />
              {userLoading && <ActivityIndicator size="small" color={C.purple} />}
            </View>
            <ScrollView style={{ maxHeight: 280, marginTop: 8 }}>
              {userList.length === 0 && userSearch.length >= 2 && !userLoading && (
                <Text style={S.emptyTxt}>Aucun résultat</Text>
              )}
              {userList.map(u => (
                <TouchableOpacity key={u.id} style={S.pickItem} onPress={() => addMember(u)}
                  disabled={actionLoading === `add-${u.id}`}>
                  <View style={S.pickAvatar}><Text style={S.pickAvatarTxt}>{u.prenom.charAt(0)}{u.nom.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.pickName}>{u.prenom} {u.nom}</Text>
                    <Text style={S.pickMeta}>{u.role}</Text>
                  </View>
                  {actionLoading === `add-${u.id}` && <ActivityIndicator size="small" color={C.purple} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[S.btnSecondary, { marginTop: 12 }]} onPress={() => setShowAddMember(false)}>
              <Text style={S.btnSecondaryTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal : créer notification */}
      <Modal visible={showNotifForm} animationType="slide" transparent onRequestClose={() => setShowNotifForm(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>Publier une notification</Text>

            {/* Type global / ciblée */}
            <View style={S.typeSwitch}>
              <TouchableOpacity style={[S.typePill, notifType === 'global' && S.typePillActive]} onPress={() => setNotifType('global')}>
                <Text style={[S.typePillTxt, notifType === 'global' && S.typePillTxtActive]}>🌐 Globale</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.typePill, notifType === 'targeted' && S.typePillActive]} onPress={() => setNotifType('targeted')}>
                <Text style={[S.typePillTxt, notifType === 'targeted' && S.typePillTxtActive]}>🎯 Ciblée</Text>
              </TouchableOpacity>
            </View>

            {/* Cible (si ciblée) */}
            {notifType === 'targeted' && (
              <TouchableOpacity style={S.targetSelector} onPress={() => { setTargetSearch(''); setTargetList([]); setShowTargetPicker(true); }}>
                <Ionicons name="person-outline" size={16} color={notifTarget ? C.purple : C.muted} />
                <Text style={[S.targetSelectorTxt, notifTarget && { color: C.purple }]}>
                  {notifTarget ? `${notifTarget.prenom} ${notifTarget.nom}` : 'Sélectionner un utilisateur…'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={C.muted} />
              </TouchableOpacity>
            )}

            <Text style={S.fieldLabel}>Titre *</Text>
            <TextInput style={S.input} placeholder="Titre de la notification" placeholderTextColor={C.muted} value={notifTitle} onChangeText={setNotifTitle} />

            <Text style={S.fieldLabel}>Contenu *</Text>
            <TextInput style={[S.input, { minHeight: 80 }]} placeholder="Contenu du message…" placeholderTextColor={C.muted} value={notifContent} onChangeText={setNotifContent} multiline />

            <View style={S.modalActions}>
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

      {/* Modal : sélecteur de cible notif */}
      <Modal visible={showTargetPicker} animationType="fade" transparent onRequestClose={() => setShowTargetPicker(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>Sélectionner la cible</Text>
            <View style={S.searchBar}>
              <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, fontSize: 14, color: C.text }}
                placeholder="Nom de l'utilisateur…"
                placeholderTextColor={C.muted}
                value={targetSearch}
                onChangeText={t => { setTargetSearch(t); if (t.length >= 2) searchUsers(t, setTargetList, () => {}); else setTargetList([]); }}
                autoFocus
              />
            </View>
            <ScrollView style={{ maxHeight: 250, marginTop: 8 }}>
              {targetList.map(u => (
                <TouchableOpacity key={u.id} style={S.pickItem} onPress={() => { setNotifTarget(u); setShowTargetPicker(false); }}>
                  <View style={S.pickAvatar}><Text style={S.pickAvatarTxt}>{u.prenom.charAt(0)}{u.nom.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.pickName}>{u.prenom} {u.nom}</Text>
                    <Text style={S.pickMeta}>{u.role}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[S.btnSecondary, { marginTop: 12 }]} onPress={() => setShowTargetPicker(false)}>
              <Text style={S.btnSecondaryTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 52 : 38, paddingBottom: 14, paddingHorizontal: 16 },
  backBtn:     { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },

  tabs:        { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: C.border },
  tab:         { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  tabActive:   { borderBottomWidth: 3, borderBottomColor: C.purple },
  tabTxt:      { fontSize: 10, color: C.muted, fontWeight: '600' },
  tabTxtActive:{ color: C.purple },

  errBanner:   { backgroundColor: '#FEF2F2', padding: 10, borderLeftWidth: 4, borderLeftColor: C.danger, marginHorizontal: 16, marginTop: 8, borderRadius: 8 },
  errTxt:      { color: C.danger, fontSize: 13 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:  { fontSize: 17, fontWeight: '700', color: C.text },
  subTitle:      { fontSize: 14, fontWeight: '700', color: C.soft, marginBottom: 8 },

  card:       { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 5 }, android: { elevation: 2 } }) },
  cardRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: C.text },
  cardSub:    { fontSize: 12, color: C.muted, marginTop: 2 },
  cardMeta:   { fontSize: 11, color: C.muted, marginTop: 4 },
  cardActions:{ flexDirection: 'row', gap: 6 },
  groupIcon:  { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },

  iconBtn:       { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F3EEFF', justifyContent: 'center', alignItems: 'center' },
  iconBtnDanger: { padding: 4 },

  backLink:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backLinkTxt: { fontSize: 14, color: C.purple, fontWeight: '600' },
  groupDetailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },

  memberRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  memberAvatar:   { width: 40, height: 40, borderRadius: 20, backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center' },
  memberAvatarTxt:{ color: '#FFF', fontWeight: '700', fontSize: 14 },
  memberName:     { fontSize: 14, fontWeight: '600', color: C.text },
  memberRole:     { fontSize: 11, color: C.muted, marginTop: 2 },

  notifCard:      { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  notifTypePill:  { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  notifGlobal:    { backgroundColor: '#DBEAFE' },
  notifTargeted:  { backgroundColor: '#FEF3C7' },
  notifTypeTxt:   { fontSize: 11, fontWeight: '700', color: C.text },
  notifTitle:     { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  notifContent:   { fontSize: 13, color: C.soft, lineHeight: 18 },
  notifFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  notifMeta:      { fontSize: 11, color: C.muted },

  trophyRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#FEF3C7' },
  trophyEmoji:    { fontSize: 20 },
  trophyReason:   { fontSize: 13, fontWeight: '600', color: C.text },
  trophyMeta:     { fontSize: 11, color: C.muted, marginTop: 2 },

  settingCard:    { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  settingRow:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  settingTitle:   { fontSize: 16, fontWeight: '700', color: C.text },
  settingSub:     { fontSize: 13, color: C.soft, marginTop: 4, lineHeight: 18 },
  settingMeta:    { fontSize: 11, color: C.muted, marginTop: 6 },

  searchBar:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3EEFF', borderRadius: 10, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: C.border },
  pickList:     { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginTop: 6, overflow: 'hidden' },
  pickItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  pickAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center' },
  pickAvatarTxt:{ color: '#FFF', fontWeight: '700', fontSize: 13 },
  pickName:     { fontSize: 14, fontWeight: '600', color: C.text },
  pickMeta:     { fontSize: 11, color: C.muted, marginTop: 2 },

  selectedUser: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3EEFF', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border },

  typeSwitch:      { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typePill:        { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: '#F9F9F9' },
  typePillActive:  { backgroundColor: C.purple, borderColor: C.purple },
  typePillTxt:     { fontSize: 13, fontWeight: '600', color: C.muted },
  typePillTxtActive: { color: '#FFF' },

  targetSelector:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3EEFF', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  targetSelectorTxt: { flex: 1, fontSize: 14, color: C.muted },

  fieldLabel:    { fontSize: 12, fontWeight: '700', color: C.soft, marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:         { backgroundColor: '#F9F6FF', borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, marginBottom: 2 },

  btnPrimary:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  btnPrimaryTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  btnSecondary:  { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  btnSecondaryTxt:{ fontSize: 14, color: C.muted, fontWeight: '600' },
  btnGold:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D97706', borderRadius: 12, paddingVertical: 13, marginTop: 10 },
  btnGoldTxt:    { color: '#FFF', fontSize: 15, fontWeight: '700' },
  btnDisabled:   { opacity: 0.4 },

  empty:    { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyTxt: { fontSize: 14, color: C.muted, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '85%' },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
});
