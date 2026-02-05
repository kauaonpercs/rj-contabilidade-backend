const express = require("express");
const multer = require("multer");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const FormData = require("form-data");

require("dotenv").config();

const app = express();

/* CONFIG */

const PORT = process.env.PORT || 3000;

app.use(helmet());

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://incomparable-starlight-9e752b.netlify.app",
    "https://kauaonpercs.github.io"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["*"],
  credentials: true
}));

app.use(express.json());

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

/* GARANTE PASTA uploads */

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

/* MULTER */

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
      "text/plain"
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Tipo não permitido"));
    }

    cb(null, true);
  }
});

/* ENDPOINT */

const REMOTE_UPLOAD_URL = process.env.REMOTE_UPLOAD_URL || "https://rj-contabilidade-backend.onrender.com/api/lead-upload";

app.post("/api/lead-upload", upload.array("files[]", 3), async (req, res) => {
  try {
    // Se ENV está em modo teste (sem URL remota real), retornar sucesso local
    if (!process.env.REMOTE_UPLOAD_URL || process.env.REMOTE_UPLOAD_URL.includes("unique-id")) {
      return res.status(200).json({ 
        ok: true, 
        message: "Arquivos salvos localmente",
        files: req.files.map(f => ({ name: f.filename, original: f.originalname }))
      });
    }

    // construir form-data para encaminhar ao backend remoto
    const form = new FormData();

    // anexar campos do body (se houver)
    Object.keys(req.body || {}).forEach(key => {
      form.append(key, req.body[key]);
    });

    // anexar arquivos salvos localmente
    req.files.forEach((f, idx) => {
      const stream = fs.createReadStream(f.path);
      // o nome do campo deve coincidir com o esperado pelo remoto
      form.append("files[]", stream, { filename: f.originalname, contentType: f.mimetype });
    });

    // enviar para o remoto
    const response = await fetch(process.env.REMOTE_UPLOAD_URL, {
      method: "POST",
      headers: form.getHeaders(),
      body: form
    });

    const json = await response.json().catch(() => null);

    // remover arquivos temporários locais
    req.files.forEach(f => {
      fs.unlink(f.path, () => {});
    });

    // repassar resposta do remoto ao cliente
    if (response.ok) {
      return res.status(200).json(json || { ok: true });
    }

    return res.status(response.status || 500).json(json || { ok: false, status: response.status });
  } catch (err) {
    // limpar arquivos locais em caso de erro
    if (req.files) {
      req.files.forEach(f => fs.unlink(f.path, () => {}));
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/* HANDLER DE ERRO */

app.use((err, req, res, next) => {
  res.status(400).json({ ok: false, error: err.message });
});

/* START */

app.listen(PORT, "0.0.0.0", () => console.log(`Servidor rodando na porta ${PORT}`));
