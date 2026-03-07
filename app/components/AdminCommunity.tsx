/**
 * AdminCommunity.tsx \u2014 v2
 *
 * CORRECTIFS :
 *   \u2022 Troph\u00e9es  \u2192 titre (requis) + description + bouton "Attribuer" apr\u00e8s s\u00e9lection
 *   \u2022 R\u00e9glages  \u2192 inscriptions globales + toutes les sessions par jeu avec toggle
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, Alert, Switch, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_URL = 'https://eueke282zksk1zki18susjdksisk18sj.onrender.com';

const C = {
  bg: '#F5F0FA', surface: '#FFFFFF', border: '#E0D5F0',
  purple: '#7C3AED', purpleL: '#A855F7', gold: '#D97706',
  danger: '#DC2626', muted: '#6B7280', text: '#111827',
  soft: '#374151', green: '#059669', blue: '#2563EB',
  orange: '#EA580C',
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
interface GameSession { id: string; title: string; description?: string | null; is_paid: boolean; price_cfa: number; is_open: boolean; created_at: string }
interface GameWithSessions { id: string; key_name: string; title: string; sessions: GameSession[] }
interface AppSettings   { registrations_open: boolean; registrations_message: string; updated_at: string }

interface Props { adminEmail: string; adminPassword: string; onBack: () => void }

// \u2500\u2500\u2500 Ic\u00f4nes par jeu \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const GAME_ICONS: Record<string, { icon: string; colors: [string, string] }> = {
  arts:        { icon: 'color-palette',   colors: ['#EC4899', '#BE185D'] },
  performance: { icon: 'flash',           colors: ['#6366F1', '#4F46E5'] },
  music:       { icon: 'musical-notes',   colors: ['#06B6D4', '#0891B2'] },
  artisanat:   { icon: 'hammer',          colors: ['#92400E', '#78350F'] },
  awale:       { icon: 'grid',            colors: ['#10B981', '#059669'] },
  dames:       { icon: 'apps',            colors: ['#3B82F6', '#2563EB'] },
  vraioufaux:  { icon: 'help-circle',     colors: ['#F59E0B', '#D97706'] },
};

export default function AdminCommunity({ adminEmail, adminPassword, onBack }: Props) {
  const [section,       setSection]       = useState<Section>('groups');
  const [loading,       setLoading]       = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error,         setError]         = useState('');

  // \u2500\u2500 Groupes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const [groups,        setGroups]        = useState<Group[]>([]);
  const [selGroup,      setSelGroup]      = useState<Group | null>(null);
  const [members,       setMembers]       = useState<GroupMember[]>([]);
  const [showGrpForm,   setShowGrpForm]   = useState(false);
  const [editingGrp,    setEditingGrp]    = useState<Group | null>(null);
  const [grpName,       setGrpName]       = useState('');
  const [grpDesc,       setGrpDesc]       = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [userSearch,    setUserSearch]    = useState('');
  const [userList,      setUserList]      = useState<UserProfile[]>([]);
  const [userLoading,   setUserLoading]   = useState(false);

  // \u2500\u2500 Notifications \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const [notifications,     setNotifications]     = useState<Notification[]>([]);
  const [showNotifForm,     setShowNotifForm]     = useState(false);
  const [notifType,         setNotifType]         = useState<'global' | 'targeted'>('global');
  const [notifTitle,        setNotifTitle]        = useState('');
  const [notifContent,      setNotifContent]      = useState('');
  const [notifTarget,       setNotifTarget]       = useState<UserProfile | null>(null);
  const [showTargetPicker,  setShowTargetPicker]  = useState(false);
  const [targetSearch,      setTargetSearch]      = useState('');
  const [targetList,        setTargetList]        = useState<UserProfile[]>([]);

  // \u2500\u2500 Troph\u00e9es \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const [trophySearch,       setTrophySearch]       = useState('');
  const [trophySearchResult, setTrophySearchResult] = useState<UserProfile[]>([]);
  const [trophySearchLoad,   setTrophySearchLoad]   = useState(false);
  const [trophyUser,         setTrophyUser]         = useState<UserProfile | null>(null);
  const [trophyTitle,        setTrophyTitle]        = useState('');
  const [trophyDesc,         setTrophyDesc]         = useState('');
  const [userTrophies,       setUserTrophies]       = useState<Trophy[]>([]);
  const [trophiesLoading,    setTrophiesLoading]    = useState(false);

  // \u2500\u2500 R\u00e9glages \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const [settings,       setSettings]       = useState<AppSettings | null>(null);
  const [regMessage,     setRegMessage]     = useState('');
  const [games,          setGames]          = useState<GameWithSessions[]>([]);
  const [toggling,       setToggling]       = useState<string | null>(null);

  // ── Modale de confirmation (web + mobile) ───────────────────────────────
  const [confirm, setConfirm] = useState<{
    visible: boolean; title: string; message: string;
    onConfirm: () => void; confirmLabel?: string; danger?: boolean;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const askConfirm = (title: string, message: string, onConfirm: () => void, danger = true) => {
    setConfirm({ visible: true, title, message, onConfirm, danger, confirmLabel: 'Confirmer' });
  };

  // \u2500\u2500\u2500 API \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const api = useCallback(async (body: Record<string, any>) => {
    const res  = await fetch(`${BACKEND_URL}/admin-community`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.details ? `${data.error} \u2014 ${data.details}` : (data?.error || `Erreur ${res.status}`));
    return data;
  }, [adminEmail, adminPassword]);

  // \u2500\u2500\u2500 Chargements \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  useEffect(() => {
    setError('');
    if (section === 'groups')        loadGroups();
    if (section === 'notifications') loadNotifications();
    if (section === 'settings')      loadSettingsAndSessions();
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

  // \u2500\u2500\u2500 Recherche utilisateurs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const searchUsers = useCallback(async (
    q: string,
    setList: (u: UserProfile[]) => void,
    setLoad: (b: boolean) => void
  ) => {
    if (q.length < 2) { setList([]); return; }
    setLoad(true);
    try { const d = await api({ function: 'listUsers', search: q, limit: 20 }); setList(d.users || []); }
    catch {}
    finally { setLoad(false); }
  }, [api]);

  // \u2500\u2500\u2500 GROUPES actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
      setConfirm(c => ({ ...c, visible: false }));
      setActionLoading(`del-grp-${g.id}`);
      try { await api({ function: 'deleteGroup', group_id: g.id }); await loadGroups(); if (selGroup?.id === g.id) setSelGroup(null); }
      catch (e: any) { Alert.alert('Erreur', e.message); }
      finally { setActionLoading(null); }
    });
  };
  const openGroupDetail = async (g: Group) => { setSelGroup(g); await loadMembers(g.id); };
  const removeMember = (m: GroupMember) => {
    askConfirm('Retirer le membre', `Retirer ${m.prenom} ${m.nom} du groupe ?`, async () => {
      setConfirm(c => ({ ...c, visible: false }));
      setActionLoading(`rm-${m.user_id}`);
      try { await api({ function: 'removeGroupMember', group_id: selGroup!.id, user_id: m.user_id }); await loadMembers(selGroup!.id); await loadGroups(); }
      catch (e: any) { Alert.alert('Erreur', e.message); }
      finally { setActionLoading(null); }
    });
  };
  const addMember = async (u: UserProfile) => {
    setActionLoading(`add-${u.id}`);
    try {
      const d = await api({ function: 'addGroupMember', group_id: selGroup!.id, user_id: u.id });
      if (d.already_member) Alert.alert('Info', `${u.prenom} ${u.nom} est d\u00e9j\u00e0 membre`);
      await loadMembers(selGroup!.id); await loadGroups();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); setShowAddMember(false); }
  };

  // \u2500\u2500\u2500 NOTIFICATIONS actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifContent.trim()) return;
    if (notifType === 'targeted' && !notifTarget)
      return Alert.alert('Requis', 'S\u00e9lectionnez un utilisateur cible');
    setActionLoading('notif-send');
    try {
      await api({
        function: 'createNotification', type: notifType,
        title: notifTitle, content: notifContent,
        target_user_id: notifType === 'targeted' ? notifTarget!.id : undefined,
      });
      setShowNotifForm(false); setNotifTitle(''); setNotifContent(''); setNotifTarget(null); setNotifType('global');
      await loadNotifications();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); }
  };
  const confirmDeleteNotif = (n: Notification) => {
    askConfirm('Supprimer la notification', 'Supprimer cette notification ?', async () => {
      setConfirm(c => ({ ...c, visible: false }));
      setActionLoading(`del-notif-${n.id}`);
      try { await api({ function: 'deleteNotification', notification_id: n.id }); await loadNotifications(); }
      catch (e: any) { Alert.alert('Erreur', e.message); }
      finally { setActionLoading(null); }
    });
  };

  // \u2500\u2500\u2500 TROPH\u00c9ES actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const selectTrophyUser = async (u: UserProfile) => {
    setTrophyUser(u);
    setTrophySearch('');
    setTrophySearchResult([]);
    setTrophyTitle('');
    setTrophyDesc('');
    await loadUserTrophies(u);
  };

  const awardTrophy = async () => {
    if (!trophyUser || !trophyTitle.trim()) {
      Alert.alert('Requis', 'Le titre du troph\u00e9e est obligatoire'); return;
    }
    setActionLoading('trophy-award');
    try {
      const d = await api({
        function:    'awardTrophy',
        user_id:     trophyUser.id,
        title:       trophyTitle,
        description: trophyDesc || undefined,
      });
      Alert.alert('\ud83c\udfc6 Troph\u00e9e attribu\u00e9 !', `${d.awarded_to} \u2014 ${d.new_count} troph\u00e9e(s)`);
      setTrophyTitle(''); setTrophyDesc('');
      // Mettre \u00e0 jour le compteur localement
      setTrophyUser(prev => prev ? { ...prev, trophies_count: d.new_count } : prev);
      await loadUserTrophies(trophyUser);
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); }
  };

  // \u2500\u2500\u2500 R\u00c9GLAGES actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const toggleRegistrations = async (open: boolean) => {
    askConfirm(
      open ? 'Ouvrir les inscriptions ?' : 'Fermer les inscriptions ?',
      open ? "Les nouveaux utilisateurs pourront s'inscrire." : "Toute tentative d'inscription sera refusée.",
      async () => {
        setConfirm(c => ({ ...c, visible: false }));
        setActionLoading('reg-toggle');
        try { await api({ function: 'setRegistrationsOpen', open, message: regMessage || undefined }); await loadSettingsAndSessions(); }
        catch (e: any) { Alert.alert('Erreur', e.message); }
        finally { setActionLoading(null); }
      }
    );
  };

  const saveRegMessage = async () => {
    if (!settings) return;
    setActionLoading('reg-msg');
    try { await api({ function: 'setRegistrationsOpen', open: settings.registrations_open, message: regMessage }); await loadSettingsAndSessions(); }
    catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setActionLoading(null); }
  };

  const toggleSession = async (session: GameSession, game_id: string) => {
    const newVal = !session.is_open;
    setToggling(session.id);
    try {
      await api({ function: 'toggleSessionOpen', session_id: session.id, is_open: newVal });
      // Mise \u00e0 jour locale optimiste
      setGames(prev => prev.map(g =>
        g.id !== game_id ? g : {
          ...g,
          sessions: g.sessions.map(s =>
            s.id === session.id ? { ...s, is_open: newVal } : s
          )
        }
      ));
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setToggling(null); }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // RENDU
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

  // ── ConfirmModal ─────────────────────────────────────────────────────────
  const renderConfirmModal = () => (
    <Modal transparent animationType="fade" visible={confirm.visible} onRequestClose={() => setConfirm(c => ({ ...c, visible: false }))}>
      <View style={S.cmOverlay}>
        <View style={S.cmBox}>
          <Text style={S.cmTitle}>{confirm.title}</Text>
          <Text style={S.cmMsg}>{confirm.message}</Text>
          <View style={S.cmRow}>
            <TouchableOpacity style={S.cmBtnCancel} onPress={() => setConfirm(c => ({ ...c, visible: false }))}>
              <Text style={S.cmBtnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.cmBtnConfirm, confirm.danger && S.cmBtnDanger]} onPress={confirm.onConfirm}>
              <Text style={S.cmBtnConfirmTxt}>{confirm.confirmLabel ?? 'Confirmer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={S.container}>

      {renderConfirmModal()}

      {/* HEADER */}
      <LinearGradient colors={['#7C3AED', '#4C1D95']} style={S.header}>
        <TouchableOpacity onPress={onBack} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>\ud83c\udf10 Communaut\u00e9</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* ONGLETS */}
      <View style={S.tabs}>
        {([
          { key: 'groups',        icon: 'people-circle-outline', label: 'Groupes'  },
          { key: 'notifications', icon: 'notifications-outline', label: 'Notifs'   },
          { key: 'trophies',      icon: 'trophy-outline',        label: 'Troph\u00e9es' },
          { key: 'settings',      icon: 'settings-outline',      label: 'R\u00e9glages' },
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

      {error ? <View style={S.errBanner}><Text style={S.errTxt}>\u26a0\ufe0f {error}</Text></View> : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
            GROUPES
        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
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
                        <Text style={S.cardMeta}>{g.member_count} membre{g.member_count !== 1 ? 's' : ''} \u00b7 {fmtDate(g.created_at)}</Text>
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

        {/* D\u00e9tail groupe */}
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
                    <View style={S.memberAvatar}><Text style={S.memberAvatarTxt}>{m.prenom.charAt(0)}{m.nom.charAt(0)}</Text></View>
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

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
            NOTIFICATIONS
        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        {section === 'notifications' && (
          <View>
            <View style={S.secHeader}>
              <Text style={S.secTitle}>Notifications</Text>
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
                    <View style={[S.notifPill, n.type === 'global' ? S.pillGlobal : S.pillTargeted]}>
                      <Text style={S.pillTxt}>{n.type === 'global' ? '\ud83c\udf10 Globale' : `\ud83c\udfaf ${n.target ? `${n.target.prenom} ${n.target.nom}` : 'Cibl\u00e9e'}`}</Text>
                    </View>
                    <Text style={S.notifTitle}>{n.title}</Text>
                    <Text style={S.notifContent} numberOfLines={2}>{n.content}</Text>
                    <View style={S.notifFooter}>
                      <Text style={S.notifMeta}>{n.sender ? `${n.sender.prenom} ${n.sender.nom}` : '?'} \u00b7 {fmtDate(n.created_at)}</Text>
                      <TouchableOpacity onPress={() => confirmDeleteNotif(n)} disabled={actionLoading === `del-notif-${n.id}`}>
                        {actionLoading === `del-notif-${n.id}` ? <ActivityIndicator size="small" color={C.danger} /> : <Ionicons name="trash-outline" size={16} color={C.danger} />}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
          </View>
        )}

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
            TROPH\u00c9ES
        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        {section === 'trophies' && (
          <View>
            <Text style={S.secTitle}>Attribuer un troph\u00e9e \ud83c\udfc6</Text>
            <Text style={S.secSubtitle}>Recherchez un utilisateur, remplissez le titre et attribuez.</Text>

            {/* 1. Recherche */}
            {!trophyUser && (
              <View>
                <View style={[S.searchBar, { marginTop: 12 }]}>
                  <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 14, color: C.text }}
                    placeholder="Nom ou pr\u00e9nom de l'utilisateur\u2026"
                    placeholderTextColor={C.muted}
                    value={trophySearch}
                    onChangeText={t => { setTrophySearch(t); searchUsers(t, setTrophySearchResult, setTrophySearchLoad); }}
                  />
                  {trophySearchLoad && <ActivityIndicator size="small" color={C.purple} />}
                </View>

                {trophySearchResult.length > 0 && (
                  <View style={S.pickList}>
                    {trophySearchResult.map(u => (
                      <TouchableOpacity key={u.id} style={S.pickItem} onPress={() => selectTrophyUser(u)}>
                        <View style={S.pickAvatar}><Text style={S.pickAvatarTxt}>{u.prenom.charAt(0)}{u.nom.charAt(0)}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={S.pickName}>{u.prenom} {u.nom}</Text>
                          <Text style={S.pickMeta}>{u.role} \u00b7 \ud83c\udfc6 {u.trophies_count}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={C.muted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {trophySearch.length >= 2 && trophySearchResult.length === 0 && !trophySearchLoad && (
                  <Text style={[S.emptyTxt, { marginTop: 16, textAlign: 'center' }]}>Aucun r\u00e9sultat</Text>
                )}
              </View>
            )}

            {/* 2. Utilisateur s\u00e9lectionn\u00e9 + formulaire */}
            {trophyUser && (
              <View>
                {/* Carte utilisateur s\u00e9lectionn\u00e9 */}
                <View style={S.selectedUser}>
                  <View style={S.pickAvatar}><Text style={S.pickAvatarTxt}>{trophyUser.prenom.charAt(0)}{trophyUser.nom.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.pickName}>{trophyUser.prenom} {trophyUser.nom}</Text>
                    <Text style={S.pickMeta}>{trophyUser.role} \u00b7 \ud83c\udfc6 {trophyUser.trophies_count} troph\u00e9e(s)</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setTrophyUser(null); setUserTrophies([]); setTrophyTitle(''); setTrophyDesc(''); }}>
                    <Ionicons name="close-circle" size={22} color={C.muted} />
                  </TouchableOpacity>
                </View>

                {/* Formulaire troph\u00e9e */}
                <View style={S.trophyForm}>
                  <Text style={S.fieldLabel}>Titre du troph\u00e9e *</Text>
                  <TextInput
                    style={S.input}
                    placeholder="Ex: Champion Arts \u2013 Run #3"
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
                      : <><Ionicons name="trophy" size={18} color="#FFF" /><Text style={S.btnGoldTxt}>Attribuer le troph\u00e9e +1</Text></>}
                  </TouchableOpacity>
                </View>

                {/* Historique */}
                <View style={{ marginTop: 20 }}>
                  <Text style={S.subTitle}>Troph\u00e9es de {trophyUser.prenom} ({trophyUser.trophies_count})</Text>
                  {trophiesLoading
                    ? <ActivityIndicator color={C.purple} style={{ marginTop: 10 }} />
                    : userTrophies.length === 0
                      ? <Text style={[S.emptyTxt, { marginTop: 10 }]}>Aucun troph\u00e9e attribu\u00e9</Text>
                      : userTrophies.map(t => (
                        <View key={t.id} style={S.trophyRow}>
                          <Text style={S.trophyEmoji}>\ud83c\udfc6</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={S.trophyTitle}>{t.title}</Text>
                            {t.description ? <Text style={S.trophyDesc}>{t.description}</Text> : null}
                            <Text style={S.trophyMeta}>
                              {t.awarder ? `${t.awarder.prenom} ${t.awarder.nom}` : '?'} \u00b7 {fmtDate(t.awarded_at)}
                            </Text>
                          </View>
                        </View>
                      ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
            R\u00c9GLAGES
        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        {section === 'settings' && (
          <View>
            {loading
              ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />
              : (
                <View>

                  {/* \u2500\u2500 Inscriptions globales \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
                  <Text style={S.secTitle}>Inscriptions Harmonia</Text>
                  {settings && (
                    <View style={S.settingCard}>
                      <View style={S.settingRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={S.settingTitle}>
                            {settings.registrations_open ? '\u2705 Ouvertes' : '\ud83d\udd10 Ferm\u00e9es'}
                          </Text>
                          <Text style={S.settingSub}>
                            {settings.registrations_open
                              ? "Les nouveaux utilisateurs peuvent s'inscrire."
                              : "Toute tentative d'inscription est bloque."}
                          </Text>
                          <Text style={S.settingMeta}>Modifi\u00e9 le {fmtDate(settings.updated_at)}</Text>
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

                      <Text style={[S.fieldLabel, { marginTop: 14 }]}>Message quand inscriptions ferm\u00e9es</Text>
                      <TextInput
                        style={[S.input, { minHeight: 60 }]}
                        placeholder="Les inscriptions sont termin\u00e9es. \ud83d\udd10"
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

                  {/* \u2500\u2500 Sessions par jeu \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
                  <Text style={[S.secTitle, { marginTop: 28 }]}>Sessions de jeux</Text>
                  <Text style={S.secSubtitle}>Ouvrez ou fermez les inscriptions pour chaque session.</Text>

                  {games.length === 0
                    ? <View style={S.empty}><Ionicons name="game-controller-outline" size={46} color={C.muted} /><Text style={S.emptyTxt}>Aucun jeu trouv\u00e9</Text></View>
                    : games.map(game => {
                      const icon = GAME_ICONS[game.key_name] ?? { icon: 'game-controller-outline', colors: ['#9CA3AF', '#6B7280'] as [string,string] };
                      return (
                        <View key={game.id} style={S.gameSection}>
                          {/* En-t\u00eate du jeu */}
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
                                    {s.is_paid ? `\ud83d\udcb0 ${s.price_cfa} FCFA` : 'Gratuit'}
                                    {' \u00b7 '}{fmtDate(s.created_at)}
                                  </Text>
                                </View>
                                <View style={S.sessionToggle}>
                                  <Text style={[S.sessionState, { color: s.is_open ? C.green : C.danger }]}>
                                    {s.is_open ? 'Ouvert' : 'Ferm\u00e9'}
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

      {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
          MODALES
      \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}

      {/* Cr\u00e9er / modifier groupe */}
      <Modal visible={showGrpForm} animationType="slide" transparent onRequestClose={() => setShowGrpForm(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <Text style={S.sheetTitle}>{editingGrp ? 'Modifier le groupe' : 'Nouveau groupe'}</Text>
            <Text style={S.fieldLabel}>Nom *</Text>
            <TextInput style={S.input} placeholder="Nom\u2026" placeholderTextColor={C.muted} value={grpName} onChangeText={setGrpName} />
            <Text style={S.fieldLabel}>Description</Text>
            <TextInput style={[S.input, { minHeight: 70 }]} placeholder="Description\u2026" placeholderTextColor={C.muted} value={grpDesc} onChangeText={setGrpDesc} multiline />
            <View style={S.sheetActions}>
              <TouchableOpacity style={S.btnSecondary} onPress={() => setShowGrpForm(false)}><Text style={S.btnSecondaryTxt}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={[S.btnPrimary, !grpName.trim() && S.btnDisabled]} onPress={saveGroup} disabled={!grpName.trim() || actionLoading === 'group-save'}>
                {actionLoading === 'group-save' ? <ActivityIndicator color="#FFF" /> : <Text style={S.btnPrimaryTxt}>{editingGrp ? 'Enregistrer' : 'Cr\u00e9er'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ajouter membre */}
      <Modal visible={showAddMember} animationType="slide" transparent onRequestClose={() => setShowAddMember(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <Text style={S.sheetTitle}>Ajouter un membre</Text>
            <View style={S.searchBar}>
              <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, fontSize: 14, color: C.text }}
                placeholder="Nom de l'utilisateur\u2026"
                placeholderTextColor={C.muted}
                value={userSearch}
                onChangeText={t => { setUserSearch(t); searchUsers(t, setUserList, setUserLoading); }}
                autoFocus
              />
              {userLoading && <ActivityIndicator size="small" color={C.purple} />}
            </View>
            <ScrollView style={{ maxHeight: 280, marginTop: 8 }}>
              {userList.map(u => (
                <TouchableOpacity key={u.id} style={S.pickItem} onPress={() => addMember(u)} disabled={actionLoading === `add-${u.id}`}>
                  <View style={S.pickAvatar}><Text style={S.pickAvatarTxt}>{u.prenom.charAt(0)}{u.nom.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}><Text style={S.pickName}>{u.prenom} {u.nom}</Text><Text style={S.pickMeta}>{u.role}</Text></View>
                  {actionLoading === `add-${u.id}` && <ActivityIndicator size="small" color={C.purple} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[S.btnSecondary, { marginTop: 12 }]} onPress={() => setShowAddMember(false)}><Text style={S.btnSecondaryTxt}>Fermer</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cr\u00e9er notification */}
      <Modal visible={showNotifForm} animationType="slide" transparent onRequestClose={() => setShowNotifForm(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <Text style={S.sheetTitle}>Publier une notification</Text>
            <View style={S.typeSwitch}>
              <TouchableOpacity style={[S.typePill, notifType === 'global' && S.typePillActive]} onPress={() => setNotifType('global')}>
                <Text style={[S.typePillTxt, notifType === 'global' && S.typePillTxtActive]}>\ud83c\udf10 Globale</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.typePill, notifType === 'targeted' && S.typePillActive]} onPress={() => setNotifType('targeted')}>
                <Text style={[S.typePillTxt, notifType === 'targeted' && S.typePillTxtActive]}>\ud83c\udfaf Cibl\u00e9e</Text>
              </TouchableOpacity>
            </View>
            {notifType === 'targeted' && (
              <TouchableOpacity style={S.targetSel} onPress={() => { setTargetSearch(''); setTargetList([]); setShowTargetPicker(true); }}>
                <Ionicons name="person-outline" size={16} color={notifTarget ? C.purple : C.muted} />
                <Text style={[S.targetSelTxt, notifTarget && { color: C.purple }]}>
                  {notifTarget ? `${notifTarget.prenom} ${notifTarget.nom}` : 'S\u00e9lectionner un utilisateur\u2026'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={C.muted} />
              </TouchableOpacity>
            )}
            <Text style={S.fieldLabel}>Titre *</Text>
            <TextInput style={S.input} placeholder="Titre\u2026" placeholderTextColor={C.muted} value={notifTitle} onChangeText={setNotifTitle} />
            <Text style={S.fieldLabel}>Contenu *</Text>
            <TextInput style={[S.input, { minHeight: 80 }]} placeholder="Message\u2026" placeholderTextColor={C.muted} value={notifContent} onChangeText={setNotifContent} multiline />
            <View style={S.sheetActions}>
              <TouchableOpacity style={S.btnSecondary} onPress={() => setShowNotifForm(false)}><Text style={S.btnSecondaryTxt}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity
                style={[S.btnPrimary, (!notifTitle.trim() || !notifContent.trim()) && S.btnDisabled]}
                onPress={sendNotification}
                disabled={!notifTitle.trim() || !notifContent.trim() || actionLoading === 'notif-send'}
              >
                {actionLoading === 'notif-send' ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="send-outline" size={14} color="#FFF" /><Text style={S.btnPrimaryTxt}>Publier</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* S\u00e9lecteur cible notif */}
      <Modal visible={showTargetPicker} animationType="fade" transparent onRequestClose={() => setShowTargetPicker(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <Text style={S.sheetTitle}>S\u00e9lectionner la cible</Text>
            <View style={S.searchBar}>
              <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, fontSize: 14, color: C.text }}
                placeholder="Nom\u2026"
                placeholderTextColor={C.muted}
                value={targetSearch}
                onChangeText={t => { setTargetSearch(t); searchUsers(t, setTargetList, () => {
  // Confirm Modal
  cmOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  cmBox:          { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 340 },
  cmTitle:        { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 10 },
  cmMsg:          { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 20 },
  cmRow:          { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  cmBtnCancel:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  cmBtnCancelTxt: { fontSize: 14, color: '#666', fontWeight: '600' },
  cmBtnConfirm:   { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#8A2BE2' },
  cmBtnDanger:    { backgroundColor: '#DC2626' },
  cmBtnConfirmTxt:{ fontSize: 14, color: '#fff', fontWeight: '700' },
}); }}
                autoFocus
              />
            </View>
            <ScrollView style={{ maxHeight: 250, marginTop: 8 }}>
              {targetList.map(u => (
                <TouchableOpacity key={u.id} style={S.pickItem} onPress={() => { setNotifTarget(u); setShowTargetPicker(false); }}>
                  <View style={S.pickAvatar}><Text style={S.pickAvatarTxt}>{u.prenom.charAt(0)}{u.nom.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}><Text style={S.pickName}>{u.prenom} {u.nom}</Text><Text style={S.pickMeta}>{u.role}</Text></View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[S.btnSecondary, { marginTop: 12 }]} onPress={() => setShowTargetPicker(false)}><Text style={S.btnSecondaryTxt}>Fermer</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// \u2500\u2500\u2500 Styles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

  // Troph\u00e9es
  selectedUser: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3EEFF', borderRadius: 12, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: C.border },
  trophyForm:   { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginTop: 10, borderWidth: 1, borderColor: C.border },
  trophyRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#FEF3C7' },
  trophyEmoji:  { fontSize: 20, marginTop: 2 },
  trophyTitle:  { fontSize: 14, fontWeight: '700', color: C.text },
  trophyDesc:   { fontSize: 12, color: C.soft, marginTop: 2 },
  trophyMeta:   { fontSize: 11, color: C.muted, marginTop: 4 },

  // R\u00e9glages
  settingCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  settingRow:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  settingTitle:{ fontSize: 16, fontWeight: '700', color: C.text },
  settingSub:  { fontSize: 13, color: C.soft, marginTop: 4, lineHeight: 18 },
  settingMeta: { fontSize: 11, color: C.muted, marginTop: 6 },

  // Sessions par jeu
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

  // Recherche / picker
  searchBar:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3EEFF', borderRadius: 10, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: C.border },
  pickList:     { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginTop: 6, overflow: 'hidden' },
  pickItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  pickAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center' },
  pickAvatarTxt:{ color: '#FFF', fontWeight: '700', fontSize: 13 },
  pickName:     { fontSize: 14, fontWeight: '600', color: C.text },
  pickMeta:     { fontSize: 11, color: C.muted, marginTop: 2 },

  // Champs
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.soft, marginBottom: 5, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { backgroundColor: '#F9F6FF', borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text },

  // Boutons
  btnPrimary:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  btnPrimaryTxt:   { color: '#FFF', fontSize: 14, fontWeight: '700' },
  btnSecondary:    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  btnSecondaryTxt: { fontSize: 14, color: C.muted, fontWeight: '600' },
  btnGold:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D97706', borderRadius: 12, paddingVertical: 14, marginTop: 10 },
  btnGoldTxt:      { color: '#FFF', fontSize: 15, fontWeight: '700' },
  btnDisabled:     { opacity: 0.4 },

  empty:    { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTxt: { fontSize: 14, color: C.muted, fontWeight: '600' },

  // Modales
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '88%' },
  sheetTitle:  { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 16 },
  sheetActions:{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },

  typeSwitch:       { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typePill:         { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: '#F9F9F9' },
  typePillActive:   { backgroundColor: C.purple, borderColor: C.purple },
  typePillTxt:      { fontSize: 13, fontWeight: '600', color: C.muted },
  typePillTxtActive:{ color: '#FFF' },
  targetSel:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3EEFF', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  targetSelTxt:     { flex: 1, fontSize: 14, color: C.mute
