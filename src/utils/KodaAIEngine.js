// src/utils/KodaAIEngine.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import crypto from 'node:crypto';

// Instância Primária (Gemini)
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class KodaAIEngine {
  constructor() {
    // Cache em RAM super rápido. O(1) de complexidade.
    this.cache = new Map();
  }

  /**
   * Gera um hash MD5 da mensagem ou imagem para usar como chave do Cache
   */
  _hashMessage(content) {
    return crypto.createHash('md5').update(content.trim().toLowerCase()).digest('hex');
  }

  /**
   * 🆓 MÓDULO FREE: Analisa o texto puro procurando golpes.
   */
  async analyzeText(content, tier = 'FREE') {
    // Limpa o cache se passar de 5000 itens para não estourar a RAM do servidor
    if (this.cache.size > 5000) this.cache.clear();

    const hash = this._hashMessage(content);
    if (this.cache.has(hash)) {
      return this.cache.get(hash);
    }

    // Prompt engenhoso focado em cibersegurança e retorno estrito em JSON
    const prompt = `
      Você é a KodaAI, um sistema rigoroso de segurança de comunidades.
      Analise a mensagem abaixo e determine se é um golpe, phishing, scam, ou link malicioso.
      
      Mensagem do usuário: "${content}"
      
      Retorne APENAS um JSON válido neste formato exato e nada mais:
      {
        "isThreat": boolean,
        "type": "NONE" | "SCAM_TEXT" | "PHISHING" | "SUSPICIOUS_LINK",
        "reason": "Explicação técnica direta e profissional em português para a Staff",
        "confidence": number (0 a 100)
      }
    `;

    try {
      // 🟢 TENTATIVA 1: IA Primária (Gemini 1.5 Flash - Rápido e barato)
      const result = await this._callGemini(prompt);
      this.cache.set(hash, result);
      return result;
    } catch (error) {
      console.warn('⚠️ [KodaAI] Gemini falhou ou deu Rate Limit no texto. Acionando Failover pro Llama...');

      try {
        // 🟡 TENTATIVA 2: IA Secundária (Llama via API Genérica)
        const fallbackResult = await this._callLlama(prompt);
        this.cache.set(hash, fallbackResult);
        return fallbackResult;
      } catch (critical) {
        console.error('🚨 [KodaAI] Pane Global nas APIs de IA!', critical);
        // Fail-open (Deixa passar se a culpa for da nossa infra) pra não punir inocentes
        return { isThreat: false, type: 'NONE', reason: 'Bypass por falha de API.', confidence: 0 };
      }
    }
  }

  /**
   * 💎 MÓDULO VIP: Analisa imagens usando OCR e heurística visual.
   * Procura comprovantes falsos, prints forjados e textos maliciosos em imagens.
   */
  async analyzeImage(imageBuffer, mimeType) {
    if (this.cache.size > 5000) this.cache.clear();
    
    // Converte o Buffer de RAM direto para Base64 (Formato que a API do Google exige)
    const base64Data = imageBuffer.toString('base64');
    const hash = this._hashMessage(base64Data); 

    if (this.cache.has(hash)) {
      return this.cache.get(hash);
    }

    const prompt = `
      Você é a KodaAI, uma inteligência artificial de cibersegurança e forense digital.
      Sua missão é realizar OCR (Leitura de Texto) e análise heurística na imagem anexada.
      Procure ativamente por:
      1. Comprovantes bancários/PIX falsos ou adulterados.
      2. Prints de conversas forjadas.
      3. Textos contendo links de phishing ou golpes (ex: "Acesse o site X para resgatar").
      
      Retorne APENAS um JSON estrito neste formato e nada mais:
      {
        "isThreat": boolean,
        "type": "NONE" | "FAKE_PRINT" | "IMAGE_SCAM" | "PHISHING_QR",
        "reason": "Explicação técnica forense em português para a Staff detalhando o que encontrou na imagem",
        "confidence": number (0 a 100)
      }
    `;

    try {
      // Usando o modelo multimodal nativo do Gemini (Processa imagem + texto)
      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType } }
      ]);
      
      // Correção aplicada: Regex na mesma linha
      let text = result.response.text().replace(/```json\n?|```/g, '').trim();
      const parsedData = JSON.parse(text);
      
      this.cache.set(hash, parsedData);
      return parsedData;

    } catch (error) {
      console.warn('⚠️ [KodaAI - Visão] Falha na API do Gemini ao processar imagem.', error.message);
      // Como a gente precisa de modelos multimodais aqui, se o Gemini cair, bypassamos com segurança.
      return { isThreat: false, type: 'NONE', reason: 'Bypass por falha na engine de visão.', confidence: 0 };
    }
  }

  // ==========================================
  // MÉTODOS INTERNOS (Helpers)
  // ==========================================

  async _callGemini(prompt) {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const response = await model.generateContent(prompt);
    let text = response.response.text();
    // Correção aplicada: Regex na mesma linha
    text = text.replace(/```json\n?|
```/g, '').trim();
    return JSON.parse(text);
  }

  async _callLlama(prompt) {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    }, {
      headers: { 'Authorization': `Bearer ${process.env.LLAMA_API_KEY}` },
      timeout: 5000 
    });
    return JSON.parse(response.data.choices[0].message.content);
  }

  // Arrays dinâmicos de resposta "de quebrada" para manter a personalidade
  getRandomPhrase(type) {
    const phrases = {
      threatDeleted: [
        "Opa! Esse papo aí tá com cheiro de golpe. Interceptei e mandei pro espaço.",
        "Visão, rapaziada! Link suspeito detectado e neutralizado.",
        "Aqui não, paizão. Tentativa de phishing barrada com sucesso pela KodaAI.",
        "Segura a emoção! Apaguei essa mensagem porque o sistema acusou fraude."
      ],
      imageThreatDeleted: [
        "📸 Tá achando que engana quem com esse print falso? Imagem barrada pela IA.",
        "Visão! A Koda bateu o olho e já viu que essa imagem era golpe. Apagado.",
        "PIX falso aqui não passa, chefe. Imagem fraudulenta mandada pro ralo.",
        "QR Code malicioso? Texto camuflado na foto? O radar pegou e neutralizou."
      ]
    };
    
    // Fallback pra threatDeleted se for chamado sem especificar imagem
    const list = phrases[type] || phrases['threatDeleted'];
    return list[Math.floor(Math.random() * list.length)];
  }
}

export default new KodaAIEngine();