import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { createClient } from '@/lib/supabase/server';
import { DataPlateSchema, DATA_PLATE_PROMPT, type StoredScan } from '@/lib/scan/schema';

/**
 * Read an equipment data plate off an already-uploaded photo.
 *
 * Access control is the same as everywhere else in this app: the Supabase
 * client here runs as the signed-in user, so the photo row lookup and the
 * storage download both pass through RLS. A tech cannot scan a photo on a
 * property they are not assigned to, and a member cannot scan at all —
 * there is no separate service-role path to abuse.
 */

const MODEL_ID = 'claude-opus-5';

/** Media types the Messages API accepts for an image block. */
const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(request: Request) {
  let photoId: string;
  try {
    const body = (await request.json()) as { photoId?: string };
    if (!body.photoId) {
      return NextResponse.json({ error: 'photoId is required.' }, { status: 400 });
    }
    photoId = body.photoId;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  // Scanning costs money per call, and only staff ever capture equipment
  // plates. A member can READ their photos under RLS, so read access alone
  // is not a sufficient gate here — check the role explicitly.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'tech')) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  }

  // RLS decides whether this user may see this photo at all.
  const { data: photo, error: photoError } = await supabase
    .from('photos')
    .select('id, storage_path, property_id')
    .eq('id', photoId)
    .maybeSingle();

  if (photoError) {
    return NextResponse.json({ error: photoError.message }, { status: 500 });
  }
  if (!photo) {
    return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
  }

  // No key configured: fail clearly and leave the photo itself intact.
  // Capture must keep working on a site even if scanning is switched off.
  if (!process.env.ANTHROPIC_API_KEY) {
    await markFailed(supabase, photoId, 'Scanning is not configured on this deployment.');
    return NextResponse.json(
      {
        error:
          'Scanning is not set up yet. The photo is saved — you can type the numbers in by hand.',
        code: 'NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from('property-photos')
    .download(photo.storage_path);

  if (downloadError || !file) {
    const message = downloadError?.message ?? 'Could not read that photo.';
    await markFailed(supabase, photoId, message);
    return NextResponse.json({ error: message }, { status: 404 });
  }

  const mediaType = ALLOWED_MEDIA.has(file.type) ? file.type : 'image/jpeg';
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');

  try {
    const client = new Anthropic();

    const response = await client.messages.parse({
      model: MODEL_ID,
      max_tokens: 8000,
      // Reading worn, embossed, or badly-lit plates is genuinely fiddly, so
      // thinking stays on. Effort is stepped down from the default because
      // this is a bounded extraction, not open-ended reasoning — raise it
      // to 'high' if real plates start coming back with low confidence.
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: zodOutputFormat(DataPlateSchema),
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data: base64 } },
            { type: 'text', text: DATA_PLATE_PROMPT },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      const message = 'The scanner declined to read that image.';
      await markFailed(supabase, photoId, message);
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const reading = response.parsed_output;
    if (!reading) {
      const message = 'Could not make sense of that plate. Try a straighter, closer photo.';
      await markFailed(supabase, photoId, message);
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const stored: StoredScan = {
      ...reading,
      scanned_at: new Date().toISOString(),
      model_id: MODEL_ID,
    };

    const { error: saveError } = await supabase
      .from('photos')
      .update({
        kind: 'DATA_PLATE',
        scan_status: 'DONE',
        scan_data: stored,
        scan_error: null,
      })
      .eq('id', photoId);

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    return NextResponse.json({ scan: stored });
  } catch (error) {
    const message = describe(error);
    await markFailed(supabase, photoId, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function markFailed(supabase: ServerClient, photoId: string, message: string) {
  await supabase
    .from('photos')
    .update({ scan_status: 'FAILED', scan_error: message })
    .eq('id', photoId);
}

/** Typed, most-specific-first — so a rate limit reads differently to a bad key. */
function describe(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The scanning API key was rejected. Check ANTHROPIC_API_KEY.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'The scanner is busy right now. Try again in a moment.';
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `The scanner rejected that request: ${error.message}`;
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the scanner. Check your signal and try again.';
  }
  if (error instanceof Anthropic.APIError) {
    return `Scanner error ${error.status}: ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Scanning failed.';
}
