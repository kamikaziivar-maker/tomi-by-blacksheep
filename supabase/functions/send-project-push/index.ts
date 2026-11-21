// Supabase Edge Function — TOMI by BlackSheep
// Envoi de notifications Push natives Android via Firebase Cloud Messaging (HTTP v1)
//
// Secrets requis dans Supabase (Edge Functions -> Secrets) :
//   - FCM_SERVICE_ACCOUNT_JSON : JSON complet du compte de service Firebase
//   - SUPABASE_URL             : fourni automatiquement par Supabase
//   - SUPABASE_SERVICE_ROLE_KEY: fourni automatiquement par Supabase
//   - PUSH_WEBHOOK_SECRET      : secret partagé envoyé via header x-webhook-secret par le trigger SQL / Webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

interface ServiceAccountJson {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) {
    diff |= ab[i] ^ bb[i];
  }
  return diff === 0;
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getFcmAccessToken(sa: ServiceAccountJson): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const unsignedJwt = `${header}.${claimSet}`;

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  );
  const signedJwt = `${unsignedJwt}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenResp = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    throw new Error(`Erreur OAuth Firebase (${tokenResp.status}): ${errText}`);
  }

  const tokenData = (await tokenResp.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error('Jeton OAuth2 Firebase manquant dans la réponse.');
  }
  return tokenData.access_token;
}

function formatAmountFbu(raw: unknown): string {
  const num = Math.round(Number(raw ?? 0));
  return new Intl.NumberFormat('fr-FR').format(Math.abs(num)).replace(/\u202f|\u00a0/g, ' ');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
    const fcmRaw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Supabase env missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Vérifie l'authenticité du déclencheur (x-webhook-secret OU Bearer service_role_key)
    const incomingSecret = req.headers.get('x-webhook-secret') ?? '';
    const authHeader = req.headers.get('authorization') ?? '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const secretValid = webhookSecret
      ? timingSafeEqual(incomingSecret, webhookSecret)
      : false;
    const serviceRoleValid = serviceRoleKey
      ? timingSafeEqual(bearerToken, serviceRoleKey)
      : false;

    if (!secretValid && !serviceRoleValid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!fcmRaw) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'FCM_SERVICE_ACCOUNT_JSON not configured' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sa = JSON.parse(fcmRaw) as ServiceAccountJson;
    if (!sa.project_id || !sa.private_key || !sa.client_email) {
      return new Response(JSON.stringify({ error: 'Invalid FCM service account JSON' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = (await req.json()) as WebhookPayload;
    const table = payload.table;
    const record = payload.record;

    if (!record || typeof record.project_id !== 'string' || !record.project_id) {
      return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const projectId = record.project_id;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Récupère le projet partagé (titre + propriétaire)
    const { data: projectRow, error: projErr } = await supabaseAdmin
      .from('shared_projects')
      .select('id, name, owner_user_id')
      .eq('id', projectId)
      .maybeSingle();

    if (projErr || !projectRow) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Project not found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const projectName = String(projectRow.name ?? 'Projet partagé');

    // 2. Construit le titre, le message et identifie l'auteur à exclure
    let notifTitle = projectName;
    let notifBody = 'Nouvelle activité sur le projet partagé';
    let actorUserId: string | null = null;
    let extraData: Record<string, string> = {
      project_id: projectId,
      event_table: String(table ?? 'unknown'),
    };

    if (table === 'project_transactions') {
      actorUserId =
        typeof record.author_user_id === 'string' ? record.author_user_id : null;
      const authorName = String(record.author_name ?? 'Un associé');
      const txType = String(record.type ?? 'inflow');
      const outflowNature = record.outflow_nature ? String(record.outflow_nature) : '';
      const txLabel = String(record.label ?? 'Opération');
      const formattedFbu = formatAmountFbu(record.amount_in_fbu ?? record.amount);

      const isInflow = txType === 'inflow';
      const typeLabel = isInflow
        ? 'Entrée'
        : outflowNature === 'stock_purchase'
        ? 'Approvisionnement stock'
        : txType === 'outflow'
        ? 'Sortie'
        : 'Mouvement';
      const sign = isInflow ? '+' : txType === 'outflow' ? '-' : '';

      notifTitle = `${projectName} · ${typeLabel}`;
      notifBody = `${authorName} : ${sign}${formattedFbu} FBU — ${txLabel}`;
      extraData = {
        ...extraData,
        type: 'project_transaction',
        transaction_id: String(record.id ?? ''),
      };
    } else if (table === 'project_members') {
      const memberRole = String(record.role ?? 'manager');
      if (memberRole === 'owner') {
        return new Response(
          JSON.stringify({ skipped: true, reason: 'Owner initialization skipped' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      actorUserId = typeof record.user_id === 'string' ? record.user_id : null;
      const memberName = String(record.display_name ?? 'Un nouveau membre');
      const status = String(record.status ?? 'invited');
      const roleLabel = memberRole === 'viewer' ? 'Observateur' : 'Associé';

      notifTitle = `${projectName} · Équipe`;
      notifBody =
        status === 'active'
          ? `${memberName} a rejoint le projet (${roleLabel})`
          : `${memberName} a été invité en tant que ${roleLabel}`;
      extraData = {
        ...extraData,
        type: 'project_member',
        member_id: String(record.id ?? ''),
      };
    } else {
      return new Response(JSON.stringify({ skipped: true, reason: 'Unhandled table' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Collecte tous les membres du projet sauf l'auteur de l'action
    const { data: membersRows } = await supabaseAdmin
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .not('user_id', 'is', null);

    const recipientSet = new Set<string>();
    if (projectRow.owner_user_id) {
      recipientSet.add(String(projectRow.owner_user_id));
    }
    for (const row of membersRows ?? []) {
      if (row.user_id) {
        recipientSet.add(String(row.user_id));
      }
    }
    if (actorUserId) {
      recipientSet.delete(actorUserId);
    }

    const recipientIds = Array.from(recipientSet);
    if (recipientIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, reason: 'No other active recipients' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Récupère les tokens FCM des destinataires
    const { data: tokenRows, error: tokErr } = await supabaseAdmin
      .from('user_push_tokens')
      .select('id, token, platform')
      .in('user_id', recipientIds);

    if (tokErr || !tokenRows || tokenRows.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, reason: 'No registered push tokens' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Envoi via Firebase Cloud Messaging HTTP v1
    const accessToken = await getFcmAccessToken(sa);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    const invalidTokenIds: string[] = [];
    let sentCount = 0;

    await Promise.all(
      (tokenRows as Array<{ id: string; token: string; platform: string }>).map(
        async (row) => {
        const resp = await fetch(fcmEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: row.token,
              notification: {
                title: notifTitle,
                body: notifBody,
              },
              data: extraData,
              android: {
                priority: 'HIGH',
                notification: {
                  channel_id: 'tomi_projects',
                  sound: 'default',
                },
              },
            },
          }),
        });

        if (resp.ok) {
          sentCount += 1;
        } else {
          const errJson = await resp.json().catch(() => ({}));
          const errStr = JSON.stringify(errJson);
          if (errStr.includes('UNREGISTERED') || errStr.includes('INVALID_ARGUMENT')) {
            invalidTokenIds.push(String(row.id));
          }
        }
      })
    );

    if (invalidTokenIds.length > 0) {
      await supabaseAdmin
        .from('user_push_tokens')
        .delete()
        .in('id', invalidTokenIds);
    }

    return new Response(
      JSON.stringify({
        sent: sentCount,
        totalTokens: tokenRows.length,
        cleanedTokens: invalidTokenIds.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal Server Error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
