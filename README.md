# GradeAI — Sistema de Correção com RAG + Gemini

Dashboard para correção automática de trabalhos acadêmicos usando RAG (ChromaDB) + Google Gemini.

## Stack
- **Frontend/Backend**: Next.js 14 + TypeScript
- **LLM**: Google Gemini 1.5 Pro
- **Embeddings**: Google text-embedding-004
- **Vector Store**: ChromaDB (local ou cloud)
- **Deploy**: Vercel (frontend) + Railway/Render (ChromaDB)

---

## Setup Local

### 1. Clone e instale
```bash
git clone https://github.com/seu-usuario/gradeai
cd gradeai
npm install
```

### 2. Configure as variáveis de ambiente
```bash
cp .env.example .env.local
# Edite .env.local com sua GEMINI_API_KEY
```

### 3. Suba o ChromaDB via Docker
```bash
npm run chroma
# ou diretamente:
docker run -p 8000:8000 chromadb/chroma
```

### 4. Rode o projeto
```bash
npm run dev
# Acesse http://localhost:3000
```

---

## Como usar

### Passo 1: Ingerir o gabarito/critérios de avaliação
Envie os documentos de referência (gabarito, rubrica, material de apoio) via API:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -F "subject=Cálculo I" \
  -F "docName=gabarito_p1" \
  -F "file=@gabarito.pdf"
```

Ou com texto direto:
```bash
curl -X POST http://localhost:3000/api/ingest \
  -F "subject=Cálculo I" \
  -F "docName=criterios" \
  -F "text=Critério 1: O aluno deve demonstrar domínio de derivadas..."
```

### Passo 2: Corrigir um trabalho
```bash
curl -X POST http://localhost:3000/api/grade \
  -F "studentName=Ana Souza" \
  -F "subject=Cálculo I" \
  -F "file=@trabalho_ana.pdf"
```

Com link do Google Drive (arquivo deve ser público ou Google Doc):
```bash
curl -X POST http://localhost:3000/api/grade \
  -F "studentName=Bruno Lima" \
  -F "subject=Cálculo I" \
  -F "driveUrl=https://drive.google.com/file/d/ABC123/view"
```

### Resposta da correção:
```json
{
  "studentName": "Ana Souza",
  "subject": "Cálculo I",
  "grade": 8.5,
  "feedback": "Bom domínio dos conceitos. Revisar integração por partes.",
  "strengths": ["Derivadas corretas", "Boa organização"],
  "improvements": ["Integração por partes incompleta"],
  "gradedAt": "2024-03-15T10:30:00.000Z"
}
```

---

## Deploy na Vercel + Railway

### ChromaDB no Railway
1. Crie conta em [railway.app](https://railway.app)
2. New Project → Deploy from Docker Image → `chromadb/chroma`
3. Copie a URL gerada (ex: `https://chroma-xyz.up.railway.app`)

### Next.js na Vercel
1. Push o código para GitHub
2. Importe o repositório na [Vercel](https://vercel.com)
3. Configure as variáveis de ambiente:
   - `GEMINI_API_KEY` = sua chave do Gemini
   - `CHROMA_URL` = URL do Railway
4. Deploy automático a cada push no GitHub ✅

---

## Estrutura do Projeto
```
gradeai/
├── app/
│   ├── page.tsx              # Dashboard principal
│   └── api/
│       ├── grade/route.ts    # POST /api/grade — corrige trabalho
│       └── ingest/route.ts   # POST /api/ingest — ingere gabarito
├── .env.example
├── next.config.js
├── package.json
└── README.md
```

---

## Fluxo RAG

```
Gabarito PDF → Chunks → Gemini Embeddings → ChromaDB
                                                  ↓
Trabalho do aluno → Embed query → Busca top-5 chunks similares
                                                  ↓
                         Gemini 1.5 Pro recebe: contexto + trabalho
                                                  ↓
                              Retorna: nota + feedback + pontos fortes
```
