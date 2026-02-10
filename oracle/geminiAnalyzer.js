// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious. Unauthorized access will be prosecuted to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

class GeminiAnalyzer {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("⚠️ GEMINI_API_KEY is missing in environment variables.");
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Using the latest experimental or stable model alias for Gemini 1.5/2.0/3.0
        // Adjust model name as needed based on availability
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" }); 
    }

    async analyzeRepo(repoContext) {
        console.log(`🧠 Nova (Gemini) analyzing repo... (${repoContext.files.length} files)`);

        const prompt = `
        You are the 'Gemini Agent Vetting Oracle' for the ChAI Labor Market.
        Your job is to analyze the following code repository context and generate a reputation score and specialty tags.

        REPOSITORY: ${repoContext.name}
        DESCRIPTION: ${repoContext.description}
        
        CODE FILES:
        ${repoContext.files.map(f => `--- ${f.path} ---\n${f.content.substring(0, 2000)}\n`).join("\n")}

        TASK:
        1. Analyze the code quality, complexity, and completeness.
        2. Identify the primary skills/technologies used (Specialties).
        3. Assign a Reputation Score (0-100) based on:
           - Code structure and cleanliness (30%)
           - Documentation (20%)
           - Complexity/Utility (50%)
        
        OUTPUT FORMAT (JSON only):
        {
            "reputation": <number 0-100>,
            "specialties": "<comma-separated list of top 3-5 tags, e.g. 'Solana, Rust, DeFi'>",
            "summary": "<short 1-sentence analysis>"
        }
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Clean up code block formatting if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            return JSON.parse(cleanText);
        } catch (error) {
            console.error("❌ Gemini Analysis Failed:", error);
            // Fallback for demo/error handling
            return {
                reputation: 50,
                specialties: "Analysis Failed, Unknown",
                summary: "Gemini analysis failed."
            };
        }
    }
}

module.exports = GeminiAnalyzer;