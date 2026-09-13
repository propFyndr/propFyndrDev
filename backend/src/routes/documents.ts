// backend/src/routes/documents.ts
// POST /documents       — upload PDF/image, extract text, persist (admin only)
// GET  /documents?slug= — list docs for a project
// POST /documents/ask   — ask a question about a stored document (rate limited)
import { Router, Request, Response } from 'express'
import { meteredClient } from '../lib/ai/geminiMeter'
import { z } from 'zod'
import multer from 'multer'
import type { ChatCompletionContentPart } from 'groq-sdk/resources/chat/completions'
import { prisma } from '../lib/db'
import { supabaseAdmin } from '../lib/supabase'
import { GoogleGenAI } from '@google/genai'
import { getGroq } from '../lib/ai/groq'
import { MODELS } from '../lib/config'
import { requireStaff } from '../lib/adminGuard'
import { requireRole } from '../lib/adminIdentity'
import { checkRateLimit } from '../lib/cache'
import { clientIp } from '../lib/request'
import { validateUploadedFile } from '../lib/uploadValidator'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
})

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

// ── POST /ask  ────────────────────────────────────────────────────────────────
// IMPORTANT: registered BEFORE the multer POST / handler to avoid param collision.
const AskSchema = z.object({
  document_id: z.string().uuid(),
  question:    z.string().min(5).max(500),
})

router.post('/ask', async (req: Request, res: Response) => {
  const { allowed } = await checkRateLimit(`docs:ask:${clientIp(req)}`, 20, 60)
  if (!allowed) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' })
    return
  }

  const parsed = AskSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  const { document_id, question } = parsed.data

  const doc = await prisma.projectDocument.findUnique({ where: { id: document_id } })
  if (!doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  if (!doc.content_text) {
    res.json({
      answer: "Sorry, text couldn't be extracted from this document. Try uploading a clearer image or a text-based PDF.",
    })
    return
  }

  const maxContext = doc.content_text.slice(0, 8000)

  const DOC_ASK_SYSTEM_PROMPT = 'You are a real estate document analyst. Answer questions strictly based on the document text provided. If the answer isn\'t in the document, say so clearly. Be concise and precise.'

  let answer: string
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error('No GEMINI_API_KEY')
    const client = meteredClient({ apiKey: process.env.GEMINI_API_KEY, endpoint: 'documents' })
    const resp = await client.models.generateContent({
      model: MODELS.GEMINI_LITE,
      contents: [{ role: 'user', parts: [{ text: `DOCUMENT:\n${maxContext}\n\nQUESTION: ${question}` }] }],
      config: { systemInstruction: DOC_ASK_SYSTEM_PROMPT, maxOutputTokens: 600, temperature: 0.1 },
    })
    answer = resp.text || 'Unable to generate answer.'
  } catch (geminiErr) {
    console.warn('[documents/ask] Gemini failed, trying Groq:', geminiErr instanceof Error ? geminiErr.message : geminiErr)
    try {
      const resp = await getGroq().chat.completions.create({
        model: MODELS.GROQ_SMART,
        messages: [
          { role: 'system', content: DOC_ASK_SYSTEM_PROMPT },
          { role: 'user', content: `DOCUMENT:\n${maxContext}\n\nQUESTION: ${question}` },
        ],
        max_tokens: 600,
        temperature: 0.1,
      })
      answer = resp.choices[0]?.message?.content ?? 'Unable to generate answer.'
    } catch (err) {
      console.error('[documents/ask]', err)
      res.status(502).json({ error: 'AI service unavailable' })
      return
    }
  }

  res.json({ answer, document_name: doc.name })
})

// ── GET /  ────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const slug = req.query['slug'] as string | undefined
  if (!slug) {
    res.status(400).json({ error: 'slug required' })
    return
  }

  const docs = await prisma.projectDocument.findMany({
    where: { project_slug: slug },
    orderBy: { created_at: 'desc' },
    select: { id: true, name: true, storage_url: true, doc_type: true, created_at: true, file_size_bytes: true },
  })

  res.json({ docs })
})

// ── POST /  ───────────────────────────────────────────────────────────────────
router.post('/', requireStaff, requireRole('SUPER_ADMIN', 'ANALYST'), upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file
  const project_id   = req.body['project_id'] as string | undefined
  const project_slug = req.body['project_slug'] as string | undefined
  const doc_type     = (req.body['doc_type'] as string | undefined) ?? 'other'

  if (!file || !project_id || !project_slug) {
    res.status(400).json({ error: 'file, project_id, project_slug required' })
    return
  }

  if (!ALLOWED_MIME.has(file.mimetype)) {
    res.status(400).json({ error: 'Only PDF and images (JPEG/PNG/WEBP) supported' })
    return
  }

  // 1.7 Add File-Type Validation (Magic Bytes)
  const validation = await validateUploadedFile(file.buffer)
  if (!validation.valid) {
    res.status(400).json({ error: validation.error || 'Invalid file type' })
    return
  }

  const project = await prisma.project.findUnique({ where: { id: project_id }, select: { id: true } })
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  // Upload to Supabase Storage
  const ext = (file.originalname.split('.').pop() ?? 'pdf').toLowerCase()
  const storagePath = `documents/${project_slug}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('project-docs')
    .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false })

  if (uploadError) {
    console.error('[documents] storage upload failed:', uploadError.message)
    res.status(500).json({ error: 'Storage upload failed' })
    return
  }

  const { data: urlData } = supabaseAdmin.storage
    .from('project-docs')
    .getPublicUrl(storagePath)

  const publicUrl = urlData.publicUrl

  // Extract text using Groq vision for images; PDFs stored as-is (no OCR here)
  let content_text: string | null = null

  if (file.mimetype.startsWith('image/')) {
    const base64 = file.buffer.toString('base64')
    const extractPrompt = 'Extract all text from this real estate document. Return only the extracted text, nothing else.'
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error('No GEMINI_API_KEY')
      const client = meteredClient({ apiKey: process.env.GEMINI_API_KEY, endpoint: 'documents' })
      const resp = await client.models.generateContent({
        model: MODELS.GEMINI_LITE,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: file.mimetype, data: base64 } },
            { text: extractPrompt },
          ],
        }],
        config: { maxOutputTokens: 2000 },
      })
      content_text = resp.text || null
    } catch (geminiErr) {
      console.warn('[docs] Gemini vision extract failed, trying Groq:', geminiErr instanceof Error ? geminiErr.message : geminiErr)
      try {
        const resp = await getGroq().chat.completions.create({
          model: 'llama-3.2-11b-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${file.mimetype};base64,${base64}` } },
                { type: 'text', text: extractPrompt },
              ] as ChatCompletionContentPart[],
            },
          ],
          max_tokens: 2000,
        })
        content_text = resp.choices[0]?.message?.content ?? null
      } catch (e) {
        console.warn('[docs] vision extract failed:', e)
      }
    }
  }

  let doc: { id: string }
  try {
    doc = await prisma.projectDocument.create({
      data: {
        project_id,
        project_slug,
        name:         file.originalname,
        storage_url:  publicUrl,
        content_text,
        doc_type,
        file_size_bytes: file.size,
      },
    })
  } catch (dbError) {
    console.error('[docs] prisma create failed — removing orphaned file:', dbError)
    await supabaseAdmin.storage.from('project-docs').remove([storagePath])
    res.status(500).json({ error: 'Failed to save document record' })
    return
  }

  res.status(201).json({ success: true, id: doc.id, url: publicUrl })
})

export default router
