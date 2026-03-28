import { type LanguageCode, type IndustryCode, type CountryCode, SUPPORTED_INDUSTRIES, SUPPORTED_COUNTRIES } from '../../store';

/**
 * Call the server-side AI proxy instead of the OpenAI SDK directly.
 * The API key stays server-side only — never exposed to the browser.
 */
async function chatCompletion(options: {
    messages: Message[];
    temperature?: number;
    max_tokens?: number;
    model?: string;
    response_format?: { type: string };
}): Promise<string> {
    const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: options.messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens,
            model: options.model ?? 'gpt-4o',
            response_format: options.response_format,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
        throw new Error(err.error?.message || err.error || `AI proxy error (${res.status})`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

// System prompts for different languages
const SYSTEM_PROMPTS: Record<LanguageCode, string> = {
    en: `You are a professional AI interviewer helping users document their business processes as Standard Operating Procedures (SOPs).

Your tone is professional, efficient, and inquisitive. Your goal is to extract detailed, actionable information about business processes through conversational questions.

Guidelines:
- Ask ONE question at a time
- Be specific and probe for details
- Ask about edge cases, exceptions, and common issues
- Ask for examples when helpful
- Validate your understanding before moving on
- Keep responses concise and conversational
- Guide the user through the process step-by-step

When you have enough information, indicate readiness to generate the SOP. You MUST NOT try to print out the SOP in the chat box, and you MUST NOT tell the user to write it themselves in a word processor.
Instead, tell them exactly this: "I have all the information I need. Please click the 'Generate SOP Now' button above the chat box to create your formal document!"`,

    es: `Eres un entrevistador profesional de IA que ayuda a los usuarios a documentar sus procesos comerciales como Procedimientos Operativos Estándar (POE).

Tu tono es profesional, eficiente e inquisitivo. Tu objetivo es extraer información detallada y procesable sobre procesos comerciales a través de preguntas conversacionales.

Directrices:
- Haz UNA pregunta a la vez
- Sé específico y profundiza en los detalles
- Pregunta sobre casos extremos, excepciones y problemas comunes
- Pide ejemplos cuando sea útil
- Valida tu comprensión antes de continuar
- Mantén las respuestas concisas y conversacionales
- Guía al usuario a través del proceso paso a paso

Cuando tengas suficiente información, indica que estás listo para generar el POE diciendo "Tengo toda la información que necesito. ¿Te gustaría que genere el POE ahora?"`,

    nl: `Je bent een professionele AI-interviewer die gebruikers helpt hun bedrijfsprocessen te documenteren als Standard Operating Procedures (SOP's).

Je toon is professioneel, efficiënt en onderzoekend. Je doel is om gedetailleerde, bruikbare informatie over bedrijfsprocessen te verkrijgen door middel van conversationele vragen.

Richtlijnen:
- Stel ÉÉN vraag tegelijk
- Wees specifiek en vraag door naar details
- Vraag naar randgevallen, uitzonderingen en veelvoorkomende problemen
- Vraag om voorbeelden wanneer nuttig
- Valideer je begrip voordat je verder gaat
- Houd antwoorden beknopt en conversationeel
- Begeleid de gebruiker stap voor stap door het proces

Als je genoeg informatie hebt, geef dan aan dat je klaar bent om de SOP te genereren door te zeggen "Ik heb alle informatie die ik nodig heb. Wil je dat ik nu de SOP genereer?"`,

    fr: `Vous êtes un intervieweur IA professionnel aidant les utilisateurs à documenter leurs processus commerciaux sous forme de Procédures Opérationnelles Standard (POS).

Votre ton est professionnel, efficace et inquisiteur. Votre objectif est d'extraire des informations détaillées et exploitables sur les processus commerciaux à travers des questions conversationnelles.

Directives:
- Posez UNE question à la fois
- Soyez précis et approfondissez les détails
- Interrogez sur les cas limites, les exceptions et les problèmes courants
- Demandez des exemples lorsque c'est utile
- Validez votre compréhension avant de continuer
- Gardez les réponses concises et conversationnelles
- Guidez l'utilisateur étape par étape à travers le processus

Lorsque vous avez suffisamment d'informations, indiquez que vous êtes prêt à générer la POS en disant "J'ai toutes les informations dont j'ai besoin. Souhaitez-vous que je génère la POS maintenant?"`,

    de: `Sie sind ein professioneller KI-Interviewer, der Benutzern hilft, ihre Geschäftsprozesse als Standard Operating Procedures (SOPs) zu dokumentieren.

Ihr Ton ist professionell, effizient und wissbegierig. Ihr Ziel ist es, durch gesprächige Fragen detaillierte, umsetzbare Informationen über Geschäftsprozesse zu extrahieren.

Richtlinien:
- Stellen Sie jeweils EINE Frage
- Seien Sie spezifisch und fragen Sie nach Details
- Fragen Sie nach Randfällen, Ausnahmen und häufigen Problemen
- Bitten Sie um Beispiele, wenn hilfreich
- Validieren Sie Ihr Verständnis, bevor Sie fortfahren
- Halten Sie Antworten prägnant und gesprächig
- Führen Sie den Benutzer Schritt für Schritt durch den Prozess

Wenn Sie genügend Informationen haben, geben Sie an, dass Sie bereit sind, die SOP zu generieren, indem Sie sagen "Ich habe alle Informationen, die ich brauche. Möchten Sie, dass ich jetzt die SOP generiere?"`,

    it: `Sei un intervistatore IA professionale che aiuta gli utenti a documentare i loro processi aziendali come Procedure Operative Standard (SOP).

Il tuo tono è professionale, efficiente e inquisitivo. Il tuo obiettivo è estrarre informazioni dettagliate e attuabili sui processi aziendali attraverso domande conversazionali.

Linee guida:
- Fai UNA domanda alla volta
- Sii specifico e approfondisci i dettagli
- Chiedi di casi limite, eccezioni e problemi comuni
- Chiedi esempi quando utile
- Convalida la tua comprensione prima di procedere
- Mantieni le risposte concise e conversazionali
- Guida l'utente passo dopo passo attraverso il processo

Quando hai abbastanza informazioni, indica di essere pronto a generare la SOP dicendo "Ho tutte le informazioni di cui ho bisogno. Vuoi che generi la SOP ora?"`,

    pt: `Você é um entrevistador de IA profissional ajudando os usuários a documentar seus processos de negócios como Procedimentos Operacionais Padrão (POPs).

Seu tom é profissional, eficiente e inquisitivo. Seu objetivo é extrair informações detalhadas e acionáveis sobre processos de negócios por meio de perguntas conversacionais.

Diretrizes:
- Faça UMA pergunta de cada vez
- Seja específico e aprofunde-se nos detalhes
- Pergunte sobre casos extremos, exceções e problemas comuns
- Peça exemplos quando útil
- Valide sua compreensão antes de continuar
- Mantenha as respostas concisas e conversacionais
- Guie o usuário passo a passo pelo processo

Quando tiver informações suficientes, indique prontidão para gerar o POP dizendo "Tenho todas as informações que preciso. Gostaria que eu gerasse o POP agora?"`,

    pl: `Jesteś profesjonalnym ankieterem AI pomagającym użytkownikom dokumentować ich procesy biznesowe jako Standardowe Procedury Operacyjne (SOP).

Twój ton jest profesjonalny, wydajny i dociekliwy. Twoim celem jest wydobycie szczegółowych, możliwych do wykonania informacji o procesach biznesowych poprzez pytania konwersacyjne.

Wytyczne:
- Zadawaj JEDNO pytanie na raz
- Bądź konkretny i dociekaj szczegółów
- Pytaj o przypadki brzegowe, wyjątki i częste problemy
- Proś o przykłady, gdy jest to pomocne
- Sprawdzaj swoje zrozumienie przed kontynuowaniem
- Utrzymuj odpowiedzi zwięzłe i konwersacyjne
- Prowadź użytkownika krok po kroku przez proces

Gdy masz wystarczające informacje, wskaż gotowość do wygenerowania SOP mówiąc "Mam wszystkie potrzebne informacje. Czy chcesz, żebym teraz wygenerował SOP?"`,
};

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class AIInterviewer {
    private conversationHistory: Message[] = [];
    private language: LanguageCode;
    private industry: IndustryCode;
    private country: CountryCode;
    private agenticPrompt: string | null;

    constructor(
        language: LanguageCode = 'en',
        industry: IndustryCode = 'other',
        country: CountryCode = 'gb',
        agenticPrompt: string | null = null
    ) {
        this.language = language;
        this.industry = industry;
        this.country = country;
        this.agenticPrompt = agenticPrompt;

        const industryInfo = SUPPORTED_INDUSTRIES[industry];
        const countryInfo = SUPPORTED_COUNTRIES[country];

        const industryContext = `\n\nINDUSTRY CONTEXT: The user works in the ${industryInfo.name} industry (${industryInfo.description}). 
        REGIONAL CONTEXT: The user is located in ${countryInfo.name}. 
        Use your knowledge of ${countryInfo.name}'s specific laws and ${industryInfo.name} regulations to:
        1. Anticipate common steps in their processes.
        2. Proactively ask about industry-standard requirements (e.g., safety, compliance, quality control, data privacy laws in ${countryInfo.name}).
        3. Suggest best practices tailored to this sector in this region.`;

        const systemContent = agenticPrompt
            ? `${agenticPrompt}\n\n${industryContext}`
            : `${SYSTEM_PROMPTS[language]}${industryContext}`;

        this.conversationHistory = [
            { role: 'system', content: systemContent },
        ];
    }

    /**
     * Get AI response to user input
     */
    async getResponse(userMessage: string): Promise<string> {
        // 1. Detect URLs in the user's message
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = userMessage.match(urlRegex) || [];

        let contextAddition = '';

        // 2. Fetch content for any detected URLs
        if (urls.length > 0) {
            for (const url of urls) {
                try {
                    const res = await fetch('/api/ai/fetch-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url })
                    });
                    const data = await res.json();
                    if (data.success && data.content) {
                        contextAddition += `\n\n--- Content from ${url} ---\n${data.content}\n-----------------------------`;
                    }
                } catch (error) {
                    console.error(`Failed to fetch URL ${url}:`, error);
                }
            }
        }

        // 3. Append to history with context if available
        const finalMessageObject: Message = {
            role: 'user',
            content: contextAddition
                ? `${userMessage}\n\n[System Note: The user shared links. Here is the extracted text from those links to help you respond:]${contextAddition}`
                : userMessage,
        };

        this.conversationHistory.push(finalMessageObject);

        try {
            const aiMessage = await chatCompletion({
                messages: this.conversationHistory,
                temperature: 0.7,
                max_tokens: 500, // slightly increased to account for larger context reasoning
            });

            this.conversationHistory.push({
                role: 'assistant',
                content: aiMessage,
            });

            return aiMessage;
        } catch (error) {
            console.error('AI response error:', error);
            throw new Error('Failed to get AI response');
        }
    }

    /**
     * Generate SOP from interview transcript
     */
    async generateSOP(title: string, authorInfo = ''): Promise<string> {
        const sopPrompt = this.getSOPPrompt(title, authorInfo);

        try {
            return await chatCompletion({
                messages: [
                    ...this.conversationHistory,
                    { role: 'user', content: sopPrompt },
                ],
                temperature: 0.5,
            });
        } catch (error) {
            console.error('SOP generation error:', error);
            throw new Error('Failed to generate SOP');
        }
    }

    /**
     * Get SOP generation prompt in the appropriate language
     */
    private getSOPPrompt(title: string, authorInfo: string): string {
        const currentDate = new Date().toLocaleDateString(this.language, { year: 'numeric', month: 'long', day: 'numeric' });
        const reviewDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString(this.language, { year: 'numeric', month: 'long', day: 'numeric' }); // 6 months from now
        const authorSection = authorInfo ? `\n\n**Created By:** ${authorInfo}\n**Created Date:** ${currentDate}\n**Next Review Date:** ${reviewDate}` : '';

        const prompts: Record<LanguageCode, string> = {
            en: `Based on our conversation, generate a comprehensive Standard Operating Procedure document titled "${title}".
            
Format the SOP in professional Markdown with the following structured sections:

# ${title} ${authorSection}

## 📝 Purpose
A clear, concise statement of why this process exists and what it achieves.

## 👥 Roles & Responsibilities
List exactly who is involved in this process and what their specific duties are. Use a bulleted list.

## 🛠 Prerequisites & Tools
List all required hardware, software, physical tools, or specific environment settings needed before beginning.

## 🏁 Step-by-Step Procedure
Provide extremely detailed, numbered actions in chronological order. 
- Use **bold** for key terms, buttons, or critical values.
- Use sub-steps (a, b, c) if a task is complex.
- Keep sentences short and actionable.

## 🎯 Quality Standards
List the specific criteria that must be met for this SOP to be considered "completed successfully".

## 💡 Pro Tips & Best Practices
Include shortcuts, safety warnings, or "expert knowledge" mentioned during the interview.

## ⚠️ Common Issues & Troubleshooting
Identify what usually goes wrong and provide the exact steps to fix it.

---
**Document Status:** FINAL | **Format:** KLARO STANDARD V2
`,

            es: `Basado en nuestra conversación, genera un documento completo de Procedimiento Operativo Estándar titulado "${title}".

Formatea el POE en Markdown con las siguientes secciones estructuradas:

# ${title} ${authorSection}

## Propósito
Una declaración clara y concisa de por qué existe este proceso y qué logra.

## Alcance
Definir exactamente a quién aplica esto, dónde se usa y en qué situaciones.

## Responsabilidades
Lista los roles o individuos responsables de ejecutar y supervisar este proceso.

## Requisitos Previos
Recursos, herramientas, hardware, software o permisos necesarios antes de comenzar.

## Procedimiento Paso a Paso
Acciones detalladas y numeradas en orden cronológico. Usa voz activa y sé preciso.

## Estándares de Calidad y Criterios de Éxito
Cómo saber si el proceso se ha realizado correctamente y cumple con los requisitos de calidad.

## Consejos y Mejores Prácticas
Consejos profesionales para la eficiencia, seguridad y resultados de alta calidad.

## Problemas Comunes y Solución de Problemas
Problemas potenciales, casos extremos y cómo manejarlos.

## Documentación Relacionada
Enlaces o referencias a otros POE, formularios o manuales mencionados.

Hazlo profesional, procesable y formateado para una alta legibilidad. Usa negrita para enfatizar donde sea apropiado.`,

            nl: `Genereer op basis van ons gesprek een uitgebreid Standard Operating Procedure-document met de titel "${title}".

Formatteer de SOP in Markdown met de volgende gestructureerde secties:
# ${title}

## Doel
Een duidelijke, beknopte beschrijving van waarom dit proces bestaat en wat het bereikt.

## Reikwijdte (Scope)
Definieer precies op wie dit van toepassing is, waar het wordt gebruikt en in welke situaties.

## Verantwoordelijkheden
Lijst van de rollen of individuen die verantwoordelijk zijn voor het uitvoeren en overzien van dit proces.

## Vereisten
Benodigde middelen, tools, hardware, software of machtigingen die nodig zijn voordat u begint.

## Stapsgewijze Procedure
Gedetailleerde, genummerde acties in chronologische volgorde. Gebruik de actieve vorm en wees nauwkeurig.

## Kwaliteitsnormen & Succescriteria
Hoe weet u of het proces correct is uitgevoerd en voldoet aan de kwaliteitseisen.

## Tips & Best Practices
Pro-tips voor efficiëntie, veiligheid en resultaten van hoge kwaliteit.

## Veelvoorkomende Problemen & Probleemoplossing
Potentiële problemen, randgevallen en hoe hiermee om te gaan.

## Gerelateerde Documentatie
Links of verwijzingen naar andere SOP's, formulieren of handleidingen die worden genoemd.

Maak het professioneel, uitvoerbaar en geformatteerd voor een hoge leesbaarheid. Gebruik vette tekst voor nadruk waar nodig.`,

            fr: `Sur la base de notre conversation, générez un document de Procédure Opérationnelle Standard complet intitulé "${title}".

Formatez la POS en Markdown avec les sections structurées suivantes :
# ${title}

## Objectif
Une déclaration claire et concise de la raison d'être de ce processus et de ce qu'il accompli.

## Portée (Scope)
Définissez exactement à qui cela s'applique, où cela est utilisé et dans quelles situations.

## Responsabilités
Listez les rôles ou les individus responsables de l'exécution et de la supervision de ce processus.

## Prérequis
Ressources, outils, matériel, logiciels ou autorisations nécessaires avant de commencer.

## Procédure Étape par Étape
Actions détaillées et numérotées par ordre chronologique. Utilisez la voix active et soyez précis.

## Normes de Qualité et Critères de Réussite
Comment savoir si le processus a été effectué correctement et répond aux exigences de qualité.

## Conseils et Meilleures Pratiques
Conseils d'experts pour l'efficacité, la sécurité et des résultats de haute qualité.

## Problèmes Courants et Dépannage
Problèmes potentiels, cas limites et comment les gérer.

## Documentation Connexe
Liens ou références à d'autres POS, formulaires ou manuels mentionnés.

Rendez-le professionnel, exploitable et formaté pour une grande lisibilité. Utilisez le gras pour souligner si nécessaire.`,

            de: `Erstellen Sie basierend auf unserem Gespräch ein umfassendes Standard Operating Procedure-Dokument mit dem Titel "${title}".

Formatieren Sie die SOP in Markdown mit den folgenden strukturierten Abschnitten:
# ${title}

## Zweck
Eine klare, prägnante Aussage darüber, warum dieser Prozess existiert und was er erreicht.

## Geltungsbereich (Scope)
Definieren Sie genau, für wen dies gilt, wo es verwendet wird und in welchen Situationen.

## Verantwortlichkeiten
Listen Sie die Rollen oder Personen auf, die für die Durchführung und Überwachung dieses Prozesses verantwortlich sind.

## Voraussetzungen
Erforderliche Ressourcen, Werkzeuge, Hardware, Software oder Berechtigungen, die vor dem Start benötigt werden.

## Schritt-für-Schritt-Verfahren
Detaillierte, nummerierte Aktionen in chronologischer Reihenfolge. Verwenden Sie die aktive Sprache und seien Sie präzise.

## Qualitätsstandards & Erfolgskriterien
Woran erkennt man, ob der Prozess korrekt durchgeführt wurde und die Qualitätsanforderungen erfüllt.

## Tipps & Best Practices
Profi-Tipps für Effizienz, Sicherheit und qualitativ hochwertige Ergebnisse.

## Häufige Probleme & Fehlerbehebung
Potenzielle Probleme, Randfälle und wie man damit umgeht.

## Zugehörige Dokumentation
Links oder Verweise auf andere SOPs, Formulare oder Handbücher, die erwähnt werden.

Machen Sie es klar, professionell und handlungsorientiert und für hohe Lesbarkeit formatiert. Verwenden Sie Fettgedrucktes zur Hervorhebung, wo angemessen.`,

            it: `Sulla base della nostra conversazione, genera un documento completo di Procedura Operativa Standard intitolato "${title}".

Formatta la SOP in Markdown con le seguenti sezioni strutturate:
# ${title}

## Scopo
Una dichiarazione chiara e concisa del motivo per cui questo processo esiste e di cosa ottiene.

## Ambito (Scope)
Definisci esattamente a chi si applica, dove viene utilizzato e in quali situazioni.

## Responsabilità
Elenca i ruoli o gli individui responsabili dell'esecuzione e della supervisione di questo processo.

## Prerequisiti
Risorse, strumenti, hardware, software o autorizzazioni necessari prima di iniziare.

## Procedura Passo-Passo
Azioni dettagliate e numerate in ordine cronologico. Usa la voce attiva e sii preciso.

## Standard di Qualità e Criteri di Successo
Come sapere se il processo è stato eseguito correttamente e soddisfa i requisiti di qualità.

## Suggerimenti e Migliori Pratiche
Suggerimenti professionali per efficienza, sicurezza e risultati di alta qualità.

## Problemi Comuni e Risoluzione dei Problemi
Problemi potenziali, casi limite e come gestirli.

## Documentazione Correlata
Link o riferimenti ad altre SOP, moduli o manuali menzionati.

Rendilo professionale, attuabile e formattato per un'elevata leggibilità. Usa il grassetto per enfatizzare dove appropriato.`,

            pt: `Com base em nossa conversa, gere um documento abrangente de Procedimento Operacional Padrão intitulado "${title}".

Formate o POP em Markdown com as seguintes seções estruturadas:
# ${title}

## Objetivo
Uma declaração clara e concisa de por que este processo existe e o que ele alcança.

## Escopo (Scope)
Defina exatamente a quem isso se aplica, onde é usado e em quais situações.

## Responsabilidades
Liste as funções ou indivíduos responsáveis por executar e supervisionar este processo.

## Pré-requisitos
Recursos, ferramentas, hardware, software ou permissões necessárias antes de começar.

## Procedimento Passo a Passo
Ações detalhadas e numeradas em ordem cronológica. Use voz ativa e seja preciso.

## Padrões de Qualidade e Critérios de Sucesso
Como saber se o processo foi feito corretamente e atende aos requisitos de qualidade.

## Dicas e Melhores Práticas
Dicas profissionais para eficiência, segurança e resultados de alta qualidade.

## Problemas Comuns e Solução de Problemas
Problemas potenciais, casos extremos e como lidar com eles.

## Documentação Relacionada
Links ou referências a outros POPs, formulários ou manuais mencionados.

Torne-o profissional, acionável e formatado para alta legibilidade. Use negrito para dar ênfase onde apropriado.`,

            pl: `Na podstawie naszej rozmowy wygeneruj kompleksowy dokument Standardowej Procedury Operacyjnej zatytułowany "${title}".

Sformatuj SOP w Markdown z następującymi ustrukturyzowanymi sekcjami:
# ${title}

## Cel
Jasne i zwięzłe określenie, dlaczego ten proces istnieje i co osiąga.

## Zakres (Scope)
Zdefiniuj dokładnie, kogo to dotyczy, gdzie jest używane i w jakich sytuacjach.

## Odpowiedzialność
Wymień role lub osoby odpowiedzialne za wykonanie i nadzorowanie tego procesu.

## Wymagania Wstępne
Wymagane zasoby, narzędzia, sprzęt, oprogramowanie lub uprawnienia potrzebne przed rozpoczęciem.

## Procedura Krok po Kroku
Szczegółowe, ponumerowane działania w porządku chronologicznym. Używaj strony czynnej i bądź precyzyjny.

## Standardy Jakości i Kryteria Sukcesu
Skąd wiedzieć, że proces został wykonany prawidłowo i spełnia wymagania jakościowe.

## Wskazówki i Najlepsze Praktyki
Pro-tipy dotyczące wydajności, bezpieczeństwa i wysokiej jakości wyników.

## Typowe Problemy i Rozwiązywanie Problemów
Potencjalne problemy, przypadki brzegowe i sposób ich obsługi.

## Powiązana Dokumentacja
Linki lub odniesienia do innych SOP, formularzy lub podręczników wymienionych w rozmowie.

Spraw, aby było profesjonalne, możliwe do wykonania i sformatowane pod kątem wysokiej czytelności. Użyj pogrubienia dla podkreślenia ważnych elementów.`,
        };

        return prompts[this.language];
    }

    /**
     * Extract metadata (tags, department, estimated time) from the conversation
     */
    async extractMetadata(title: string): Promise<{ tags: string[], department?: string, estimatedTime?: string }> {
        const industryInfo = SUPPORTED_INDUSTRIES[this.industry];
        const metadataPrompt = `Based on the conversation above about the process "${title}" in the ${industryInfo.name} industry, extract the following metadata in JSON format:
        {
            "tags": ["tag1", "tag2"],
            "department": "Name of department (e.g., HR, Sales, IT, Ops)",
            "estimatedTime": "Estimated time to complete the process (e.g., 15 mins)"
        }
        Return ONLY the JSON.`;

        try {
            const content = await chatCompletion({
                messages: [
                    ...this.conversationHistory,
                    { role: 'user', content: metadataPrompt },
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            });

            return JSON.parse(content || '{}');
        } catch (error) {
            console.error('Metadata extraction error:', error);
            return { tags: [] };
        }
    }

    /**
     * Reset conversation
     */
    reset(): void {
        this.conversationHistory = [
            { role: 'system', content: SYSTEM_PROMPTS[this.language] },
        ];
    }

    /**
     * Get conversation history
     */
    getHistory(): Message[] {
        return this.conversationHistory;
    }
}
