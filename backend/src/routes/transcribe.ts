// backend/src/routes/transcribe.ts
// POST /transcribe  (multipart/form-data, field: audio)
// Guest access allowed; protected by IP rate limiting.
import { Router, Request, Response } from 'express'
import multer from 'multer'
import { toFile } from 'groq-sdk'
import { getGroq } from '../lib/ai/groq'
import { checkRateLimit } from '../lib/cache'
import { clientIp } from '../lib/request'

const router = Router()

/**
 * Above this, Whisper itself believes the segment contains no speech.
 *
 * 0.6 rather than 0.5: the cost of the two mistakes is not symmetric. Dropping
 * a real but hesitant utterance costs one retry the buyer can see and
 * understand. Accepting a hallucination types words the buyer never said into
 * their search box, and they may not notice before sending it.
 */
const NO_SPEECH_CEILING = 0.6

/**
 * Whisper's mean log-probability for a segment, below which the transcript is
 * guesswork. Its own docs use roughly this line for "failed" decoding.
 */
const AVG_LOGPROB_FLOOR = -1.0

/** Transcripts Whisper emits for silence regardless of audio content. */
const KNOWN_HALLUCINATIONS = [
  /^\s*(thank you|thanks)[.!]?\s*$/i,
  /^\s*you[.!]?\s*$/i,
  /^\s*\.\s*$/,
  /^\s*\[\s*(music|silence|blank_audio|inaudible)\s*\]\s*$/i,
  /^\s*(subscribe|please subscribe)[^\n]{0,40}$/i,
]

/**
 * The transcript, or '' when what came back is not speech.
 *
 * Three independent checks, because none of them catches every case: Whisper's
 * own no-speech probability, its decoding confidence, and a list of the strings
 * it is known to emit when handed silence.
 */
export function speechOrEmpty(t: {
  text?: string
  segments?: Array<{ no_speech_prob?: number; avg_logprob?: number }>
}): string {
  const text = (t.text ?? '').trim()
  if (!text) return ''

  const segments = t.segments ?? []
  if (segments.length > 0) {
    const speechy = segments.filter(
      (s) => (s.no_speech_prob ?? 0) <= NO_SPEECH_CEILING && (s.avg_logprob ?? 0) >= AVG_LOGPROB_FLOOR,
    )
    if (speechy.length === 0) return ''
  }

  if (KNOWN_HALLUCINATIONS.some((rx) => rx.test(text))) return ''

  return text
}

const ALLOWED_AUDIO = new Set([
  'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg',
  'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
})

router.post('/', upload.single('audio'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'audio field required' })
    return
  }

  const ip = clientIp(req)
  const { allowed } = await checkRateLimit(`transcribe:${ip}`, 15, 60)
  if (!allowed) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' })
    return
  }

  if (!ALLOWED_AUDIO.has(req.file.mimetype)) {
    res.status(400).json({ error: 'Unsupported audio format. Supported: webm, ogg, wav, mp3, mp4, m4a, aac, flac.' })
    return
  }

  try {
    const file = await toFile(
      req.file.buffer,
      req.file.originalname,
      { type: req.file.mimetype },
    )

    /**
     * No `language` pin, and `verbose_json` so we can tell speech from noise.
     *
     * This was `language: 'hi'`, which forced every utterance through Hindi —
     * a buyer saying "3BHK in Sector 150" got it transcribed as Hindi rather
     * than recognised as English. Whisper's own detection handles English,
     * Hindi and the Hinglish mix buyers actually speak; pinning one language
     * is strictly worse than letting it choose.
     *
     * `verbose_json` carries `no_speech_prob` per segment, which matters
     * because Whisper HALLUCINATES on silence. Measured: a one-second 440Hz
     * sine tone with no speech in it returned " प्रफ़ज़". A buyer who taps the
     * mic, says nothing and taps again would have had invented words typed
     * into their search box.
     */
    const transcription = await getGroq().audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      response_format: 'verbose_json',
      /**
       * Temperature 0 — a transcript is not a place for sampling. Higher
       * values make the hallucination-on-silence case worse, not better.
       */
      temperature: 0,
    }) as unknown as {
      text?: string
      segments?: Array<{ no_speech_prob?: number; avg_logprob?: number }>
    }

    res.json({ text: speechOrEmpty(transcription) })
  } catch (err) {
    console.error('[transcribe]', err)
    res.status(500).json({ error: 'Transcription failed' })
  }
})

export default router
