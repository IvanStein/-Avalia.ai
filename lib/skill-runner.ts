import { GoogleGenerativeAI } from "@google/generative-ai";
import { PROMPTS } from "./skills-prompts"; // Separamos os prompts para manter skill-runner limpo
import fs from "fs";
import path from "path";
import { SKILLS, SkillId } from "./skills";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function runSkill(skillId: string, params: any, dbRef?: any, mode: 'local' | 'remote' = 'local') {
  let config = null;

  // 1. Tentar carregar do sistema de arquivos (.agents/skills)
  try {
    const skillsDir = path.join(process.cwd(), '.agents', 'skills');
    if (fs.existsSync(skillsDir)) {
      const files = fs.readdirSync(skillsDir);
      const skillFile = files.find(f => f.startsWith(skillId));
      if (skillFile) {
        const fullPath = path.join(skillsDir, skillFile);
        const content = fs.readFileSync(fullPath, 'utf8');
        const parts = content.split('---');
        if (parts.length >= 3) {
          const yaml = parts[1];
          const promptTemplate = parts.slice(2).join('---').trim();
          const model = yaml.match(/model:\s*(.+)/)?.[1]?.trim() || 'gemini-1.5-flash';
          const responseType = yaml.match(/responseType:\s*(.+)/)?.[1]?.trim() || 'text';
          
          config = {
            model,
            responseType,
            prompt: (p: any) => {
              let pr = promptTemplate;
              Object.keys(p).forEach(key => {
                pr = pr.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), p[key] ?? "");
              });
              return pr;
            }
          };
        }
      }
    }
  } catch (e) {
    console.warn(`Erro ao carregar skill ${skillId} do arquivo:`, e);
  }

  // 2. Se não encontrou no arquivo, tentar no DB (Habilidades do Usuário)
  if (!config && dbRef) {
    const dbSkills = await dbRef.getSkills(mode);
    const dbSkill = dbSkills.find((s: any) => s.id === skillId || s.name === skillId);
    if (dbSkill) {
      config = {
        model: (dbSkill.model || "gemini-1.5-flash") as any,
        responseType: (dbSkill.responseType || "text") as any,
        prompt: (p: any) => {
          let pr = dbSkill.promptTemplate || "";
          Object.keys(p).forEach(key => {
            pr = pr.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), p[key] ?? "");
          });
          return pr;
        }
      };
    }
  }

  // 3. Se não encontrou, usar o hardcoded (Fallback legado)
  if (!config) {
    config = (PROMPTS as any)[skillId];
  }

  if (!config) throw new Error(`Skill ${skillId} não implementada em .agents/skills, DB ou PROMPTS.`);

  const model = genAI.getGenerativeModel({ model: config.model });
  const prompt = config.prompt(params);

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  if (config.responseType === "json") {
    try {
      return JSON.parse(response.replace(/```json|```/g, "").trim());
    } catch (e) {
      console.error("Failed to parse Skill JSON response:", response);
      throw new Error(`Invalid JSON from Skill ${skillId}`);
    }
  }

  return response;
}
