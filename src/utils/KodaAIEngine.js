// src/utils/KodaAIEngine.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import crypto from 'node:crypto';

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class KodaAIEngine {
  constructor() {
    this.cache = new Map();
  }

  _hashMessage(content) {
    return crypto.createHash('md5').update(content.trim().toLowerCase()).digest('hex');
  }

  /**
   * Extrator Blindado de JSON: Ignora conversinha da IA e pega só o objeto.
   */
  _extractJSON(text) {
    try {
      // Procura exatamente o bloco que começa com { e termina com }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      // Se não achar as chaves, tenta fazer o parse direto
      return JSON.parse(text);
    } catch (error) {
      console.error('🚨 [KodaAI] A IA alucinou e não mandou um JSON válido. Texto recebido:\n', text);
      // Fallback seguro pra nave não crashar
      return { isThreat: false, type: 'NONE', reason: 'Bypass por resposta corrompida da IA.', confidence: 0 };
    }
  }

  async analyzeText(content, tier = 'FREE') {
    if (this.cache.size > 5000) this.cache.clear();

    const hash = this._hashMessage(content);
    if (this.cache.has(hash)) {
      return this.cache.get(hash);
    }

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
      const result = await this._callGemini(prompt);
      this.cache.set(hash, result);
      return result;
    } catch (error) {
      console.warn('⚠️ [KodaAI] Gemini falhou no texto. Acionando Failover pro Llama...');

      try {
        const fallbackResult = await this._callLlama(prompt);
        this.cache.set(hash, fallbackResult);
        return fallbackResult;
      } catch (critical) {
        console.error('🚨 [KodaAI] Pane Global nas APIs de IA!', critical);
        return { isThreat: false, type: 'NONE', reason: 'Bypass por falha de API.', confidence: 0 };
      }
    }
  }

  async analyzeImage(imageBuffer, mimeType) {
    if (this.cache.size > 5000) this.cache.clear();
    
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
      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType } }
      ]);
      
      // Passa a resposta da IA no nosso extrator blindado
      const parsedData = this._extractJSON(result.response.text());
      
      this.cache.set(hash, parsedData);
      return parsedData;

    } catch (error) {
      console.warn('⚠️ [KodaAI - Visão] Falha na API do Gemini ao processar imagem.', error.message);
      return { isThreat: false, type: 'NONE', reason: 'Bypass por falha na engine de visão.', confidence: 0 };
    }
  }

  async _callGemini(prompt) {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const response = await model.generateContent(prompt);
    
    // Passa a resposta da IA no nosso extrator blindado
    return this._extractJSON(response.response.text());
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
    
    // Passa a resposta da IA no nosso extrator blindado
    return this._extractJSON(response.data.choices[0].message.content);
  }

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
    
    const list = phrases[type] || phrases['threatDeleted'];
    return list[Math.floor(Math.random() * list.length)];
  }
}

export default new KodaAIEngine();