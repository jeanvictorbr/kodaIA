// src/utils/KodaAIEngine.js
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
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

  _extractJSON(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return JSON.parse(text);
    } catch (error) {
      console.error('🚨 [KodaAI] A IA alucinou e não mandou um JSON válido.', text);
      return { isThreat: false, type: 'NONE', reason: 'Bypass por resposta corrompida.', confidence: 0, suggestTimeout: false };
    }
  }

  _getUncensoredModel() {
    return gemini.getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });
  }

  // 🧠 ATUALIZADO: Com Failover para o Llama em caso de Erro 429 (Limite de Cota)
  async getConsultingInsight(prompt) {
    try {
      const model = this._getUncensoredModel();
      const response = await model.generateContent(prompt);
      return response.response.text();
    } catch (error) {
      console.warn("⚠️ [KodaAI] Gemini esgotou a cota na consultoria. Acionando Failover pro Llama...");
      try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7 
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.LLAMA_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        return response.data.choices[0].message.content;
      } catch (fallbackError) {
        console.error("🚨 Llama também falhou na consultoria:", fallbackError.message);
        return "Métricas computadas. A consultoria IA está momentaneamente indisponível devido ao alto tráfego nas redes neurais.";
      }
    }
  }

  async analyzeText(content, tier = 'FREE') {
    if (this.cache.size > 5000) this.cache.clear();
    const hash = this._hashMessage(content);
    if (this.cache.has(hash)) return this.cache.get(hash);

    const prompt = `
      Você é a KodaAI, um sistema rigoroso de segurança de comunidades.
      Analise a mensagem abaixo e determine se é um golpe, phishing, scam ou link malicioso.
      Mensagem: "${content}"
      Retorne APENAS um JSON válido:
      {"isThreat": boolean, "type": "NONE"|"SCAM_TEXT"|"PHISHING"|"SUSPICIOUS_LINK", "reason": "Explicação técnica", "confidence": number, "suggestTimeout": boolean}
    `;

    try {
      const result = await this._callGemini(prompt);
      this.cache.set(hash, result);
      return result;
    } catch (error) {
      try {
        const fallbackResult = await this._callLlama(prompt);
        this.cache.set(hash, fallbackResult);
        return fallbackResult;
      } catch (critical) {
        return { isThreat: false, type: 'NONE', reason: 'Bypass API.', confidence: 0, suggestTimeout: false };
      }
    }
  }

  async analyzeImage(imageBuffer, mimeType) {
    if (this.cache.size > 5000) this.cache.clear();
    const base64Data = imageBuffer.toString('base64');
    const hash = this._hashMessage(base64Data); 
    if (this.cache.has(hash)) return this.cache.get(hash);

    const prompt = `
      Você é a KodaAI, inteligência artificial de forense digital.
      Analise a imagem em busca de comprovantes PIX falsos, links de phishing, NSFW ou Gore.
      Retorne APENAS JSON:
      {"isThreat": boolean, "type": "NONE"|"FAKE_PRINT"|"IMAGE_SCAM"|"PHISHING_QR"|"NSFW"|"GORE", "reason": "Explicação técnica", "confidence": number}
    `;

    try {
      const model = this._getUncensoredModel();
      const result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType } }]);
      const parsedData = this._extractJSON(result.response.text());
      this.cache.set(hash, parsedData);
      return parsedData;
    } catch (error) {
      return { isThreat: false, type: 'NONE', reason: 'Bypass Visão.', confidence: 0 };
    }
  }

  async _callGemini(prompt) {
    const model = this._getUncensoredModel();
    const response = await model.generateContent(prompt);
    return this._extractJSON(response.response.text());
  }

  async _callLlama(prompt) {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }], temperature: 0.1
    }, {
      headers: { 'Authorization': `Bearer ${process.env.LLAMA_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 10000 
    });
    return this._extractJSON(response.data.choices[0].message.content);
  }

  getRandomPhrase(type) {
    const phrases = {
      threatDeleted: ["Opa! Esse papo aí tá com cheiro de golpe. Interceptei e mandei pro espaço.", "Tentativa de phishing barrada com sucesso pela KodaAI."],
      imageThreatDeleted: ["📸 Tá achando que engana quem com esse print falso? Imagem barrada pela IA.", "Conteúdo visual impróprio detectado. Neutralizado."],
      toxicityDeleted: ["🛑 Baixe o tom! Comportamento tóxico não é tolerado aqui.", "Calma lá, paizão! Insultos interceptados."]
    };
    const list = phrases[type] || phrases['threatDeleted'];
    return list[Math.floor(Math.random() * list.length)];
  }
}

export default new KodaAIEngine();