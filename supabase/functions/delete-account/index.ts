// AutoCare Tracker - delete the calling user's account (right to erasure).
// Runs on the server: the service key never reaches the browser. The user is
// taken from their own access token; vehicles, expenses and settings go with
// the user (ON DELETE CASCADE) and the photos are removed from Storage first.
// Deploy with "Verify JWT" off: the token is checked here with auth.getUser().
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const ALLOWED_ORIGINS = [
    'https://autocare-tracker.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
];

function cors(origin: string | null) {
    return {
        'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin'
    };
}

Deno.serve(async (req) => {
    const headers = cors(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return new Response('ok', { headers });
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return Response.json({ error: 'No autenticado' }, { status: 401, headers });

    // New projects get the secret keys as JSON; older ones the legacy service_role key
    const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
        || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!secretKey) return Response.json({ error: 'Función mal configurada' }, { status: 500, headers });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return Response.json({ error: 'Sesión no válida' }, { status: 401, headers });

    // Photos live in <user id>/ inside the private bucket
    const { data: files } = await admin.storage.from('vehicle-photos').list(user.id, { limit: 1000 });
    if (files?.length) {
        const { error } = await admin.storage.from('vehicle-photos').remove(files.map((f) => `${user.id}/${f.name}`));
        if (error) return Response.json({ error: 'No se pudieron borrar las fotos' }, { status: 500, headers });
    }

    // Ends every session of the user, then deletes the account (rows cascade)
    await admin.auth.admin.signOut(token, 'global').catch(() => {});
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) return Response.json({ error: 'No se pudo eliminar la cuenta' }, { status: 500, headers });

    return Response.json({ deleted: true }, { headers });
});
