// =====================================================
// handlePush.ts
// Route : POST /push
// { action, user_id, access_token, platform, ... }
//
// Actions :
//   subscribe         → enregistre l'abonnement en DB
//   checkSubscription → vérifie si déjà abonné
//   unsubscribe       → désactive l'abonnement
//   sendNotification  → envoie une notif push
//     mobile → Expo Push API (exp.host)
//     web    → réservé (Web Push VAPID — à implémenter plus tard)
//
// Table : user_push_subscriptions
//   platform = 'mobile' → expo_push_token
//   platform = 'web'    → endpoint + p256dh + auth
// =====================================================

import { Request, Response } from 'express'
import { supabaseAdmin, getClientForUser } from '../config/supabase'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

// ── Auth JWT ──────────────────────────────────────────────────────────────────
async function verifyToken(access_token: string, user_id: string): Promise<boolean> {
  try {
    const { data: { user }, error } = await getClientForUser(access_token).auth.getUser()
    return !error && !!user && user.id === user_id
  } catch { return false }
}

// ── Envoi mobile via Expo Push API ────────────────────────────────────────────
interface ExpoMessage {
  to:       string
  title:    string
  body:     string
  data?:    Record<string, any>
  sound?:   'default' | null
  badge?:   number
  priority?: 'default' | 'normal' | 'high'
}

async function sendExpoNotification(messages: ExpoMessage[]): Promise<{
  ok: number; failed: number; errors: string[]
}> {
  const res = await fetch(EXPO_PUSH_URL, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':        'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Expo API ${res.status}: ${text}`)
  }

  const result  = await res.json()
  const tickets = result.data ?? []

  let ok = 0, failed = 0
  const errors: string[] = []

  for (const ticket of tickets) {
    if (ticket.status === 'ok') {
      ok++
    } else {
      failed++
      if (ticket.details?.error) errors.push(ticket.details.error)
    }
  }

  return { ok, failed, errors }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export async function handlePush(req: Request, res: Response) {
  const { action, user_id, access_token, platform } = req.body

  if (!user_id || !access_token)
    return res.status(400).json({ error: 'user_id et access_token requis' })

  if (!(await verifyToken(access_token, user_id)))
    return res.status(401).json({ error: 'Token invalide' })

  try {
    switch (action) {

      // ── SUBSCRIBE ────────────────────────────────────────────────────────
      case 'subscribe': {
        if (!platform || !['mobile', 'web'].includes(platform))
          return res.status(400).json({ error: 'platform requis (mobile | web)' })

        // ── Mobile ──
        if (platform === 'mobile') {
          const { expo_push_token } = req.body
          if (!expo_push_token)
            return res.status(400).json({ error: 'expo_push_token requis pour mobile' })

          // Upsert sur expo_push_token (unique index)
          const { error } = await supabaseAdmin
            .from('user_push_subscriptions')
            .upsert(
              {
                user_id,
                platform:        'mobile',
                expo_push_token,
                is_active:       true,
                updated_at:      new Date().toISOString(),
                last_seen_at:    new Date().toISOString(),
              },
              { onConflict: 'expo_push_token' }
            )

          if (error) throw error
          console.log(`[Push] ✅ Mobile abonné — user=${user_id.slice(0,8)} token=${expo_push_token.slice(0,30)}…`)
          return res.json({ success: true, platform: 'mobile' })
        }

        // ── Web ──
        if (platform === 'web') {
          const { endpoint, p256dh, auth } = req.body
          if (!endpoint || !p256dh || !auth)
            return res.status(400).json({ error: 'endpoint, p256dh et auth requis pour web' })

          const { error } = await supabaseAdmin
            .from('user_push_subscriptions')
            .upsert(
              {
                user_id,
                platform:    'web',
                endpoint,
                p256dh,
                auth,
                is_active:   true,
                updated_at:  new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
              },
              { onConflict: 'endpoint' }
            )

          if (error) throw error
          console.log(`[Push] ✅ Web abonné — user=${user_id.slice(0,8)}`)
          return res.json({ success: true, platform: 'web' })
        }

        break
      }

      // ── CHECK SUBSCRIPTION ───────────────────────────────────────────────
      case 'checkSubscription': {
        if (!platform)
          return res.status(400).json({ error: 'platform requis' })

        let query = supabaseAdmin
          .from('user_push_subscriptions')
          .select('id')
          .eq('user_id', user_id)
          .eq('platform', platform)
          .eq('is_active', true)
          .limit(1)

        const { expo_push_token } = req.body
        if (platform === 'mobile' && expo_push_token)
          query = query.eq('expo_push_token', expo_push_token)

        const { data, error } = await query
        if (error) throw error

        const subscribed = (data ?? []).length > 0

        // Rafraîchir last_seen_at → évite l'expiration des 90j
        // fire-and-forget, on n'attend pas
        if (subscribed && data?.[0]?.id) {
          supabaseAdmin
            .from('user_push_subscriptions')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', data[0].id)
            .then(() => {})
            .catch(() => {})
        }

        return res.json({ success: true, subscribed })
      }

      // ── UNSUBSCRIBE ──────────────────────────────────────────────────────
      case 'unsubscribe': {
        if (!platform)
          return res.status(400).json({ error: 'platform requis' })

        if (platform === 'mobile') {
          const { expo_push_token } = req.body
          if (!expo_push_token)
            return res.status(400).json({ error: 'expo_push_token requis' })

          const { error } = await supabaseAdmin
            .from('user_push_subscriptions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('user_id', user_id)
            .eq('expo_push_token', expo_push_token)

          if (error) throw error
        }

        if (platform === 'web') {
          const { endpoint } = req.body
          if (!endpoint)
            return res.status(400).json({ error: 'endpoint requis' })

          const { error } = await supabaseAdmin
            .from('user_push_subscriptions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('user_id', user_id)
            .eq('endpoint', endpoint)

          if (error) throw error
        }

        console.log(`[Push] Désabonnement — user=${user_id.slice(0,8)} platform=${platform}`)
        return res.json({ success: true })
      }

      // ── SEND NOTIFICATION ────────────────────────────────────────────────
      // Appelé par les admins / triggers internes
      // body : { target_user_id, title, body, data? }
      //    OU  { target_user_ids: string[], title, body, data? }  (multi)
      case 'sendNotification': {
        const {
          target_user_id,
          target_user_ids,
          title,
          body: msgBody,
          data: msgData,
        } = req.body

        if (!title || !msgBody)
          return res.status(400).json({ error: 'title et body requis' })

        // Construire la liste des cibles
        const targets: string[] = target_user_ids
          ? (Array.isArray(target_user_ids) ? target_user_ids : [target_user_ids])
          : target_user_id ? [target_user_id] : []

        if (!targets.length)
          return res.status(400).json({ error: 'target_user_id ou target_user_ids requis' })

        // Récupérer les abonnements actifs des cibles
        const { data: subs, error: subErr } = await supabaseAdmin
          .from('user_push_subscriptions')
          .select('user_id, platform, expo_push_token, endpoint')
          .in('user_id', targets)
          .eq('is_active', true)

        if (subErr) throw subErr
        if (!subs || subs.length === 0) {
          console.log(`[Push] Aucun abonnement actif pour les cibles`)
          return res.json({ success: true, sent: 0, message: 'Aucun abonné actif' })
        }

        // ── Envoi mobile (Expo) ──────────────────────────────────────────
        const mobileTokens = subs
          .filter((s: any) => s.platform === 'mobile' && s.expo_push_token)
          .map((s: any) => s.expo_push_token as string)

        let mobileResult = { ok: 0, failed: 0, errors: [] as string[] }

        if (mobileTokens.length > 0) {
          const messages: ExpoMessage[] = mobileTokens.map(token => ({
            to:       token,
            title,
            body:     msgBody,
            data:     msgData ?? {},
            sound:    'default',
            priority: 'high',
          }))

          console.log(`[Push] Envoi Expo → ${mobileTokens.length} token(s)`)
          mobileResult = await sendExpoNotification(messages)
          console.log(`[Push] Expo résultat : ok=${mobileResult.ok} failed=${mobileResult.failed}`)

          // Désactiver les tokens invalides (DeviceNotRegistered)
          if (mobileResult.errors.includes('DeviceNotRegistered')) {
            await supabaseAdmin
              .from('user_push_subscriptions')
              .update({ is_active: false })
              .in('expo_push_token', mobileTokens)
            console.log('[Push] Tokens invalides désactivés')
          }
        }

        // ── Envoi web (réservé) ──────────────────────────────────────────
        const webSubs = subs.filter((s: any) => s.platform === 'web')
        if (webSubs.length > 0) {
          console.log(`[Push] Web Push — ${webSubs.length} abonné(s) — réservé pour plus tard`)
          // TODO : implémenter Web Push VAPID ici
        }

        return res.json({
          success:      true,
          sent:         mobileResult.ok,
          failed:       mobileResult.failed,
          web_pending:  webSubs.length,
        })
      }

      // ── GET ENDPOINT (web) ──────────────────────────────────────────────
      // Retourne l'endpoint web actif en DB pour cet user
      // Utilisé par le frontend pour détecter un changement de navigateur
      case 'getEndpoint': {
        const { data, error } = await supabaseAdmin
          .from('user_push_subscriptions')
          .select('endpoint')
          .eq('user_id', user_id)
          .eq('platform', 'web')
          .eq('is_active', true)
          .order('last_seen_at', { ascending: false })
          .limit(1)

        if (error) throw error
        const endpoint = (data ?? [])[0]?.endpoint ?? null
        return res.json({ success: true, endpoint })
      }

      // ── UPDATE LAST SEEN ─────────────────────────────────────────────────
      // Appelé chaque fois que l'user rouvre l'app sur un navigateur déjà abonné
      // Met à jour last_seen_at → évite le nettoyage des abonnements actifs
      case 'updateLastSeen': {
        const { endpoint } = req.body
        if (!endpoint)
          return res.status(400).json({ error: 'endpoint requis' })

        const { error } = await supabaseAdmin
          .from('user_push_subscriptions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('user_id', user_id)
          .eq('endpoint', endpoint)
          .eq('is_active', true)

        if (error) throw error
        return res.json({ success: true })
      }

      // ── UPDATE SUBSCRIPTION ─────────────────────────────────────────────
      // Appelé quand l'utilisateur se connecte sur un NOUVEAU navigateur
      // Le frontend détecte que l'endpoint actuel ≠ celui en DB
      // → on met à jour l'ancien endpoint par le nouveau
      // body : { platform, endpoint, p256dh, auth, old_endpoint? }
      //     OU { platform: 'mobile', expo_push_token, old_expo_push_token? }
      case 'update': {
        if (!platform || !['mobile', 'web'].includes(platform))
          return res.status(400).json({ error: 'platform requis (mobile | web)' })

        if (platform === 'web') {
          const { endpoint, p256dh, auth: authKey, old_endpoint } = req.body
          if (!endpoint || !p256dh || !authKey)
            return res.status(400).json({ error: 'endpoint, p256dh, auth requis' })

          if (old_endpoint && old_endpoint !== endpoint) {
            // Désactiver l'ancien endpoint
            await supabaseAdmin
              .from('user_push_subscriptions')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('user_id', user_id)
              .eq('endpoint', old_endpoint)
          }

          // Upsert du nouvel endpoint
          const { error } = await supabaseAdmin
            .from('user_push_subscriptions')
            .upsert(
              {
                user_id,
                platform:     'web',
                endpoint,
                p256dh,
                auth:         authKey,
                is_active:    true,
                updated_at:   new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
              },
              { onConflict: 'endpoint' }
            )

          if (error) throw error
          console.log(`[Push] 🔄 Web mis à jour — user=${user_id.slice(0,8)}`)
          return res.json({ success: true, platform: 'web', updated: true })
        }

        if (platform === 'mobile') {
          const { expo_push_token, old_expo_push_token } = req.body
          if (!expo_push_token)
            return res.status(400).json({ error: 'expo_push_token requis' })

          if (old_expo_push_token && old_expo_push_token !== expo_push_token) {
            // Désactiver l'ancien token
            await supabaseAdmin
              .from('user_push_subscriptions')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('user_id', user_id)
              .eq('expo_push_token', old_expo_push_token)
          }

          // Upsert du nouveau token
          const { error } = await supabaseAdmin
            .from('user_push_subscriptions')
            .upsert(
              {
                user_id,
                platform:        'mobile',
                expo_push_token,
                is_active:       true,
                updated_at:      new Date().toISOString(),
                last_seen_at:    new Date().toISOString(),
              },
              { onConflict: 'expo_push_token' }
            )

          if (error) throw error
          console.log(`[Push] 🔄 Mobile mis à jour — user=${user_id.slice(0,8)}`)
          return res.json({ success: true, platform: 'mobile', updated: true })
        }

        return res.status(400).json({ error: 'Platform non gérée' })
      }

      default:
        return res.status(400).json({ error: `Action inconnue: ${action}` })
    }
  } catch (err: any) {
    console.error('[handlePush] ❌', err)
    return res.status(500).json({ error: 'Erreur serveur', details: err.message })
  }
}
